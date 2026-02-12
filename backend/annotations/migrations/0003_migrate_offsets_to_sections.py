"""
Data migration: Convert global flat-string offsets to per-section offsets.

Old model: annotations have (start_offset, end_offset) into a flat \r-stripped
normalized .eml string produced by eml_normalizer.normalize_eml().

New model: annotations have (section_index, start_offset, end_offset) where
offsets are local to the section's content from section_extractor.extract_sections().

Algorithm per job:
1. Get raw .eml content
2. Build old flat normalized string (via normalize_eml + strip \r)
3. Extract sections (via extract_sections)
4. Find each section's content position within the flat string
5. Map each annotation's global offsets to (section_index, local_offset)
6. Validate via original_text matching
"""

import zlib

from django.db import migrations


def _decompress_eml(compressed_bytes):
    """Decompress eml_content_compressed field."""
    if not compressed_bytes:
        return ""
    # Handle memoryview from Django BinaryField
    if isinstance(compressed_bytes, memoryview):
        compressed_bytes = bytes(compressed_bytes)
    return zlib.decompress(compressed_bytes).decode("utf-8")


def _decode_text_parts(msg):
    """Recursively decode base64/QP text/* parts to 8bit in-place."""
    if msg.is_multipart():
        for part in msg.get_payload():
            _decode_text_parts(part)
        return

    ct = msg.get_content_type() or ""
    if not ct.startswith("text/"):
        return

    cte = (msg.get("Content-Transfer-Encoding") or "").strip().lower()
    if cte not in ("base64", "quoted-printable"):
        return

    decoded_bytes = msg.get_payload(decode=True)
    if not decoded_bytes:
        return

    charset = msg.get_content_charset() or "utf-8"
    try:
        text = decoded_bytes.decode(charset, errors="replace")
    except (LookupError, UnicodeDecodeError):
        text = decoded_bytes.decode("utf-8", errors="replace")

    msg.set_payload(text)
    if "Content-Transfer-Encoding" in msg:
        msg.replace_header("Content-Transfer-Encoding", "8bit")
    else:
        msg["Content-Transfer-Encoding"] = "8bit"


def _build_normalized_content(raw_content):
    """Rebuild a flat string with text/* parts decoded (approximates old normalize_eml)."""
    import email as email_mod

    msg = email_mod.message_from_string(raw_content)
    _decode_text_parts(msg)
    return msg.as_string()


def _find_section_positions(flat_content, sections):
    """Find where each section's content starts in the flat normalized string.

    Returns a list of (section_index, global_start, global_end) tuples.
    """
    positions = []
    search_start = 0

    for section in sections:
        content = section.content
        if not content:
            continue
        pos = flat_content.find(content, search_start)
        if pos == -1:
            # Try with a shorter prefix (in case of minor differences)
            prefix = content[:min(100, len(content))]
            pos = flat_content.find(prefix, search_start)
            if pos == -1:
                continue
        positions.append((section.index, pos, pos + len(content)))
        # Move search_start past this section to avoid false matches
        search_start = pos + len(content)

    return positions


def _map_annotation_to_section(ann_start, ann_end, section_positions):
    """Find which section a global offset range falls into.

    Returns (section_index, local_start, local_end) or None if no match.
    """
    for section_index, sec_start, sec_end in section_positions:
        if ann_start >= sec_start and ann_end <= sec_end:
            return (
                section_index,
                ann_start - sec_start,
                ann_end - sec_start,
            )
    return None


def _strip_qp_soft_breaks(text):
    """Remove quoted-printable soft line breaks (=\\n) from text."""
    return text.replace("=\n", "")


def _text_search_in_sections(original_text, sections):
    """Find original_text in all sections by direct text search.

    Returns list of (section_index, local_start, local_end).
    """
    matches = []
    for section in sections:
        if not section.content:
            continue
        start = 0
        while True:
            pos = section.content.find(original_text, start)
            if pos == -1:
                break
            matches.append((section.index, pos, pos + len(original_text)))
            start = pos + 1
    return matches


def _pick_best_match(matches, global_offset, section_positions, norm_stripped="", section_content_map=None):
    """From multiple text matches, pick the best using surrounding context + proximity."""
    CONTEXT_LEN = 20  # chars before/after to compare

    # Extract surrounding context from the old flat string
    old_before = norm_stripped[max(0, global_offset - CONTEXT_LEN):global_offset]
    # Derive annotation length from first match
    ann_len = matches[0][2] - matches[0][1]
    global_end = global_offset + ann_len
    old_after = norm_stripped[global_end:global_end + CONTEXT_LEN]

    section_starts = {idx: start for idx, start, _ in section_positions}

    best = None
    best_score = -1
    best_distance = float("inf")

    for section_index, local_start, local_end in matches:
        score = 0

        # Context-based scoring
        if section_content_map:
            content = section_content_map.get(section_index, "")
            cand_before = content[max(0, local_start - CONTEXT_LEN):local_start]
            cand_after = content[local_end:local_end + CONTEXT_LEN]

            # Count matching suffix of "before" context (chars immediately preceding)
            for i in range(1, min(len(old_before), len(cand_before)) + 1):
                if old_before[-i] == cand_before[-i]:
                    score += 1
                else:
                    break

            # Count matching prefix of "after" context (chars immediately following)
            for i in range(min(len(old_after), len(cand_after))):
                if old_after[i] == cand_after[i]:
                    score += 1
                else:
                    break

        # Proximity as tiebreaker
        sec_start = section_starts.get(section_index)
        distance = abs((sec_start + local_start) - global_offset) if sec_start is not None else float("inf")

        if score > best_score or (score == best_score and distance < best_distance):
            best_score = score
            best_distance = distance
            best = (section_index, local_start, local_end)

    return best or matches[0]


def _duplicate_body_annotations(job, sections, section_content_map, Annotation, AnnotationVersion):
    """Create duplicate annotations for other body sections where the text matches."""
    body_sections = [s for s in sections if s.section_type != "HEADERS"]
    if len(body_sections) <= 1:
        return 0  # nothing to duplicate

    # Get all annotations for this job (freshly mapped)
    annotations = list(
        Annotation.objects.filter(annotation_version__job=job).exclude(section_index__lte=0)
    )
    if not annotations:
        return 0

    # Collect existing (annotation_version_id, section_index, original_text) to avoid dupes
    existing = set()
    for ann in annotations:
        existing.add((ann.annotation_version_id, ann.section_index, ann.original_text))

    duplicates = []
    for ann in annotations:
        for section in body_sections:
            if section.index == ann.section_index:
                continue
            key = (ann.annotation_version_id, section.index, ann.original_text)
            if key in existing:
                continue
            content = section_content_map.get(section.index, "")
            pos = content.find(ann.original_text)
            if pos == -1:
                continue
            duplicates.append(Annotation(
                annotation_version_id=ann.annotation_version_id,
                annotation_class_id=ann.annotation_class_id,
                class_name=ann.class_name,
                tag=ann.tag,
                section_index=section.index,
                start_offset=pos,
                end_offset=pos + len(ann.original_text),
                original_text=ann.original_text,
            ))
            existing.add(key)

    if duplicates:
        Annotation.objects.bulk_create(duplicates)
    return len(duplicates)


def _duplicate_draft_body_annotations(annotations, sections, section_content_map):
    """Duplicate draft JSON annotations to other body sections where the text matches.

    Modifies the annotations list in place and returns the number of duplicates added.
    """
    body_sections = [s for s in sections if s.section_type != "HEADERS"]
    if len(body_sections) <= 1:
        return 0

    existing = set()
    for ann in annotations:
        if not isinstance(ann, dict):
            continue
        si = ann.get("sectionIndex", -1)
        text = ann.get("originalText", ann.get("original_text", ""))
        if si > 0 and text:
            existing.add((si, text))

    duplicates = []
    for ann in list(annotations):  # iterate over copy
        if not isinstance(ann, dict):
            continue
        si = ann.get("sectionIndex", -1)
        if si <= 0:
            continue
        original_text = ann.get("originalText", ann.get("original_text", ""))
        if not original_text:
            continue

        for section in body_sections:
            if section.index == si:
                continue
            key = (section.index, original_text)
            if key in existing:
                continue
            content = section_content_map.get(section.index, "")
            pos = content.find(original_text)
            if pos == -1:
                continue
            dup = dict(ann)
            dup["sectionIndex"] = section.index
            dup["startOffset"] = pos
            dup["endOffset"] = pos + len(original_text)
            if "originalText" in dup:
                dup["originalText"] = original_text
            duplicates.append(dup)
            existing.add(key)

    annotations.extend(duplicates)
    return len(duplicates)


def migrate_annotations_forward(apps, schema_editor):
    """Convert global offsets to per-section offsets for all existing annotations."""
    # Import utilities — normalize_eml may not exist post-cleanup
    try:
        from core.eml_normalizer import normalize_eml
    except ImportError:
        normalize_eml = None

    try:
        from core.section_extractor import extract_sections
    except ImportError:
        print("  WARNING: section_extractor not available, skipping migration")
        return

    Job = apps.get_model("datasets", "Job")
    Annotation = apps.get_model("annotations", "Annotation")
    AnnotationVersion = apps.get_model("annotations", "AnnotationVersion")
    DraftAnnotation = apps.get_model("annotations", "DraftAnnotation")

    # Get all jobs that have annotations
    job_ids_with_annotations = (
        AnnotationVersion.objects.values_list("job_id", flat=True).distinct()
    )
    jobs = Job.objects.filter(id__in=job_ids_with_annotations)

    migrated_count = 0
    text_search_count = 0
    mapping_error_count = 0
    text_mismatch_count = 0
    skipped_count = 0

    for job in jobs.iterator():
        raw_content = _decompress_eml(job.eml_content_compressed)
        if not raw_content:
            continue

        # Build old flat normalized string
        if normalize_eml is not None:
            try:
                normalized, _ = normalize_eml(raw_content)
            except Exception:
                normalized = _build_normalized_content(raw_content)
        else:
            normalized = _build_normalized_content(raw_content)

        norm_stripped = normalized.replace("\r", "")

        # Extract sections
        try:
            sections = extract_sections(raw_content)
        except Exception:
            skipped_count += 1
            continue

        # Find section positions in the flat string
        section_positions = _find_section_positions(norm_stripped, sections)

        # Build section content lookup for validation
        section_content_map = {s.index: s.content for s in sections}

        # Migrate annotations for this job
        annotations = Annotation.objects.filter(
            annotation_version__job=job
        ).order_by("start_offset")

        for ann in annotations:
            result = _map_annotation_to_section(
                ann.start_offset, ann.end_offset, section_positions
            )

            # Try position-based mapping first
            if result is not None:
                section_index, local_start, local_end = result
                section_content = section_content_map.get(section_index, "")
                extracted_text = section_content[local_start:local_end]

                if extracted_text == ann.original_text:
                    # Position-based success
                    ann.section_index = section_index
                    ann.start_offset = local_start
                    ann.end_offset = local_end
                    ann.save(update_fields=["section_index", "start_offset", "end_offset"])
                    migrated_count += 1
                    continue

            # Fallback: text search using original_text
            if ann.original_text:
                search_text = ann.original_text
                matches = _text_search_in_sections(search_text, sections)

                # If no matches, try stripping QP soft line breaks
                if not matches and "=\n" in search_text:
                    search_text = _strip_qp_soft_breaks(search_text)
                    matches = _text_search_in_sections(search_text, sections)

                if len(matches) == 1:
                    si, ls, le = matches[0]
                    ann.section_index = si
                    ann.start_offset = ls
                    ann.end_offset = le
                    ann.original_text = search_text
                    ann.save(update_fields=["section_index", "start_offset", "end_offset", "original_text"])
                    text_search_count += 1
                    continue
                elif len(matches) > 1:
                    si, ls, le = _pick_best_match(
                        matches, ann.start_offset, section_positions,
                        norm_stripped, section_content_map,
                    )
                    ann.section_index = si
                    ann.start_offset = ls
                    ann.end_offset = le
                    ann.original_text = search_text
                    ann.save(update_fields=["section_index", "start_offset", "end_offset", "original_text"])
                    text_search_count += 1
                    continue

            # Both strategies failed — flag
            ann.section_index = -1
            ann.save(update_fields=["section_index"])
            mapping_error_count += 1

        # Duplicate body annotations to other body sections
        _duplicate_body_annotations(
            job, sections, section_content_map, Annotation, AnnotationVersion
        )

    # Migrate DraftAnnotation JSON fields
    draft_migrated, draft_text_search = _migrate_drafts(
        DraftAnnotation, Job, normalize_eml, extract_sections
    )

    # Migrate QADraftReview JSON fields
    QADraftReview = apps.get_model("qa", "QADraftReview")
    qa_draft_migrated, qa_draft_text_search = _migrate_qa_drafts(
        QADraftReview, Job, normalize_eml, extract_sections
    )

    print(
        f"  Annotations: {migrated_count} position-mapped, {text_search_count} text-search fallback, "
        f"{mapping_error_count} failed, {skipped_count} jobs skipped"
    )
    print(
        f"  Drafts: {draft_migrated} annotator ({draft_text_search} text-search), "
        f"{qa_draft_migrated} QA ({qa_draft_text_search} text-search) migrated"
    )


def _migrate_drafts(DraftAnnotation, Job, normalize_eml, extract_sections):
    """Migrate DraftAnnotation.annotations (JSONField list)."""
    migrated = 0
    text_search_total = 0

    for draft in DraftAnnotation.objects.all():
        annotations = draft.annotations
        if not annotations or not isinstance(annotations, list):
            continue

        # Check if already migrated (has section_index)
        if annotations and isinstance(annotations[0], dict) and "sectionIndex" in annotations[0]:
            continue

        try:
            job = Job.objects.get(id=draft.job_id)
            raw_content = _decompress_eml(job.eml_content_compressed)
            if not raw_content:
                continue
        except Job.DoesNotExist:
            continue

        if normalize_eml is not None:
            try:
                normalized, _ = normalize_eml(raw_content)
            except Exception:
                normalized = _build_normalized_content(raw_content)
        else:
            normalized = _build_normalized_content(raw_content)

        norm_stripped = normalized.replace("\r", "")
        sections = extract_sections(raw_content)
        section_positions = _find_section_positions(norm_stripped, sections)
        section_content_map = {s.index: s.content for s in sections}

        updated = False
        for ann in annotations:
            if not isinstance(ann, dict):
                continue
            start = ann.get("startOffset", ann.get("start_offset", 0))
            end = ann.get("endOffset", ann.get("end_offset", 0))
            original_text = ann.get("originalText", ann.get("original_text", ""))

            # Try position-based mapping first
            result = _map_annotation_to_section(start, end, section_positions)
            if result:
                section_index, local_start, local_end = result
                section_content = section_content_map.get(section_index, "")
                if section_content[local_start:local_end] == original_text:
                    ann["sectionIndex"] = section_index
                    ann["startOffset"] = local_start
                    ann["endOffset"] = local_end
                    updated = True
                    continue

            # Fallback: text search using original_text
            if original_text:
                search_text = original_text
                matches = _text_search_in_sections(search_text, sections)

                # If no matches, try stripping QP soft line breaks
                if not matches and "=\n" in search_text:
                    search_text = _strip_qp_soft_breaks(search_text)
                    matches = _text_search_in_sections(search_text, sections)

                if len(matches) == 1:
                    si, ls, le = matches[0]
                    ann["sectionIndex"] = si
                    ann["startOffset"] = ls
                    ann["endOffset"] = le
                    if search_text != original_text:
                        ann["originalText"] = search_text
                    updated = True
                    text_search_total += 1
                    continue
                elif len(matches) > 1:
                    si, ls, le = _pick_best_match(
                        matches, start, section_positions,
                        norm_stripped, section_content_map,
                    )
                    ann["sectionIndex"] = si
                    ann["startOffset"] = ls
                    ann["endOffset"] = le
                    if search_text != original_text:
                        ann["originalText"] = search_text
                    updated = True
                    text_search_total += 1
                    continue

            # Both strategies failed
            ann["sectionIndex"] = -1

        # Duplicate body annotations to other body sections
        dupes = _duplicate_draft_body_annotations(annotations, sections, section_content_map)
        if dupes > 0:
            updated = True

        if updated:
            draft.annotations = annotations
            draft.save(update_fields=["annotations"])
            migrated += 1

    return migrated, text_search_total


def _migrate_qa_drafts(QADraftReview, Job, normalize_eml, extract_sections):
    """Migrate QADraftReview.data.annotations (JSONField nested list)."""
    migrated = 0
    text_search_total = 0

    for draft in QADraftReview.objects.all():
        data = draft.data
        if not data or not isinstance(data, dict):
            continue
        annotations = data.get("annotations")
        if not annotations or not isinstance(annotations, list):
            continue

        # Check if already migrated
        if annotations and isinstance(annotations[0], dict) and "sectionIndex" in annotations[0]:
            continue

        try:
            job = Job.objects.get(id=draft.job_id)
            raw_content = _decompress_eml(job.eml_content_compressed)
            if not raw_content:
                continue
        except Job.DoesNotExist:
            continue

        if normalize_eml is not None:
            try:
                normalized, _ = normalize_eml(raw_content)
            except Exception:
                normalized = _build_normalized_content(raw_content)
        else:
            normalized = _build_normalized_content(raw_content)

        norm_stripped = normalized.replace("\r", "")
        sections = extract_sections(raw_content)
        section_positions = _find_section_positions(norm_stripped, sections)
        section_content_map = {s.index: s.content for s in sections}

        updated = False
        for ann in annotations:
            if not isinstance(ann, dict):
                continue
            start = ann.get("startOffset", ann.get("start_offset", 0))
            end = ann.get("endOffset", ann.get("end_offset", 0))
            original_text = ann.get("originalText", ann.get("original_text", ""))

            # Try position-based mapping first
            result = _map_annotation_to_section(start, end, section_positions)
            if result:
                section_index, local_start, local_end = result
                section_content = section_content_map.get(section_index, "")
                if section_content[local_start:local_end] == original_text:
                    ann["sectionIndex"] = section_index
                    ann["startOffset"] = local_start
                    ann["endOffset"] = local_end
                    updated = True
                    continue

            # Fallback: text search using original_text
            if original_text:
                search_text = original_text
                matches = _text_search_in_sections(search_text, sections)

                # If no matches, try stripping QP soft line breaks
                if not matches and "=\n" in search_text:
                    search_text = _strip_qp_soft_breaks(search_text)
                    matches = _text_search_in_sections(search_text, sections)

                if len(matches) == 1:
                    si, ls, le = matches[0]
                    ann["sectionIndex"] = si
                    ann["startOffset"] = ls
                    ann["endOffset"] = le
                    if search_text != original_text:
                        ann["originalText"] = search_text
                    updated = True
                    text_search_total += 1
                    continue
                elif len(matches) > 1:
                    si, ls, le = _pick_best_match(
                        matches, start, section_positions,
                        norm_stripped, section_content_map,
                    )
                    ann["sectionIndex"] = si
                    ann["startOffset"] = ls
                    ann["endOffset"] = le
                    if search_text != original_text:
                        ann["originalText"] = search_text
                    updated = True
                    text_search_total += 1
                    continue

            # Both strategies failed
            ann["sectionIndex"] = -1

        # Duplicate body annotations to other body sections
        dupes = _duplicate_draft_body_annotations(annotations, sections, section_content_map)
        if dupes > 0:
            updated = True

        if updated:
            data["annotations"] = annotations
            draft.data = data
            draft.save(update_fields=["data"])
            migrated += 1

    return migrated, text_search_total


def migrate_annotations_reverse(apps, schema_editor):
    """Reverse migration: set all section_index back to 0.

    NOTE: This is lossy — original global offsets cannot be recovered.
    """
    Annotation = apps.get_model("annotations", "Annotation")
    Annotation.objects.all().update(section_index=0)


class Migration(migrations.Migration):

    dependencies = [
        ("annotations", "0002_section_index"),
        ("qa", "0001_initial"),
        ("datasets", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(
            migrate_annotations_forward,
            migrate_annotations_reverse,
        ),
    ]
