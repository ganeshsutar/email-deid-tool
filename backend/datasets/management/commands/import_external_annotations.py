import hashlib
import json
import traceback
from pathlib import Path
from types import SimpleNamespace

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User
from annotations.models import Annotation, AnnotationVersion
from core.models import AnnotationClass
from core.section_extractor import extract_sections
from core.section_reassembler import (
    deidentify_and_reassemble,
    group_annotations_by_section,
)
from datasets.models import Dataset, Job

COLOR_PALETTE = [
    "#E53E3E",
    "#DD6B20",
    "#D69E2E",
    "#38A169",
    "#3182CE",
    "#805AD5",
    "#D53F8C",
    "#319795",
    "#718096",
    "#2B6CB0",
]


class SkipFile(Exception):
    pass


class Command(BaseCommand):
    help = "Import annotations from exported data (flat directory with paired .eml + .json files)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dataset-id", default=None, help="UUID of an existing target dataset"
        )
        parser.add_argument(
            "--create-dataset",
            default=None,
            help="Create a new dataset with this name",
        )
        parser.add_argument(
            "--data-dir",
            required=True,
            help="Path to directory containing paired .eml and .json files",
        )
        parser.add_argument(
            "--annotator-email",
            default=None,
            help="Email of user to set as annotator/creator",
        )
        parser.add_argument(
            "--status",
            default="SUBMITTED_FOR_QA",
            choices=[s.value for s in Job.Status],
            help="Job status after import (default: SUBMITTED_FOR_QA)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate without writing to DB, run full verification",
        )
        parser.add_argument(
            "--report-file",
            default=None,
            help="Path for error report file (default: export.txt in data dir)",
        )

    def handle(self, *args, **options):
        dataset_id = options["dataset_id"]
        create_dataset = options["create_dataset"]
        dry_run = options["dry_run"]
        target_status = options["status"]

        if dataset_id and create_dataset:
            raise CommandError(
                "Provide either --dataset-id or --create-dataset, not both"
            )
        if not dataset_id and not create_dataset:
            raise CommandError("Provide either --dataset-id or --create-dataset")

        # Resolve data directory
        data_dir = Path(options["data_dir"]).resolve()
        if not data_dir.is_dir():
            raise CommandError(f"Data directory not found: {data_dir}")

        # Resolve report file
        if options["report_file"]:
            report_path = Path(options["report_file"])
        else:
            report_path = data_dir / "export.txt"

        # Validate annotator
        annotator = None
        if options["annotator_email"]:
            try:
                annotator = User.objects.get(email=options["annotator_email"])
            except User.DoesNotExist:
                raise CommandError(f"User not found: {options['annotator_email']}")

        # Resolve dataset
        if dataset_id:
            try:
                dataset = Dataset.objects.get(pk=dataset_id)
            except Dataset.DoesNotExist:
                raise CommandError(f"Dataset not found: {dataset_id}")
        else:
            if dry_run:
                self.stdout.write(f"Would create dataset: {create_dataset}")
                dataset = Dataset(name=create_dataset)
            else:
                dataset = Dataset.objects.create(
                    name=create_dataset,
                    uploaded_by=annotator,
                    status=Dataset.Status.UPLOADING,
                )
                self.stdout.write(
                    f"Created dataset: {dataset.name} ({dataset.id})"
                )

        # Pre-load annotation class cache
        class_cache = {ac.name: ac for ac in AnnotationClass.objects.all()}
        color_index = len(class_cache) % len(COLOR_PALETTE)

        # Collect existing content hashes
        existing_hashes = set(
            Job.objects.filter(dataset=dataset)
            .exclude(content_hash="")
            .values_list("content_hash", flat=True)
        )

        # Collect JSON files (each paired with a .eml of the same stem)
        json_files = sorted(data_dir.glob("*.json"))
        if not json_files:
            raise CommandError(f"No JSON files found in {data_dir}")

        self.stdout.write(f"Found {len(json_files)} annotation files")
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no DB writes"))

        # Stats
        stats = {
            "imported": 0,
            "skipped": 0,
            "skipped_errors": 0,
            "errors": 0,
            "total_annotations": 0,
            "total_unmapped": 0,
            "total_duplicates": 0,
            "total_overlaps": 0,
            "total_text_mismatches": 0,
            "redaction_ok": 0,
            "redaction_failed": 0,
        }
        file_reports = []

        for json_path in json_files:
            try:
                result = self._process_file(
                    json_path=json_path,
                    data_dir=data_dir,
                    dataset=dataset,
                    annotator=annotator,
                    target_status=target_status,
                    class_cache=class_cache,
                    color_index=color_index,
                    existing_hashes=existing_hashes,
                    dry_run=dry_run,
                )
            except SkipFile as e:
                self.stdout.write(
                    self.style.WARNING(f"  SKIP {json_path.name}: {e}")
                )
                stats["skipped"] += 1
                continue
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"  ERROR {json_path.name}: {e}")
                )
                stats["errors"] += 1
                continue

            color_index = result["color_index"]
            stats["total_annotations"] += result["annotation_count"]
            stats["total_unmapped"] += result["unmapped_count"]

            has_errors = result.get("has_errors", False)

            if result.get("report_lines"):
                stats["total_duplicates"] += result["duplicate_count"]
                stats["total_overlaps"] += result["overlap_count"]
                stats["total_text_mismatches"] += result["text_mismatch_count"]
                if result["redaction_error"]:
                    stats["redaction_failed"] += 1
                else:
                    stats["redaction_ok"] += 1
                file_reports.append(result["report_lines"])
            else:
                stats["redaction_ok"] += 1

            if has_errors:
                stats["skipped_errors"] += 1
                self.stdout.write(
                    self.style.WARNING(
                        f"  SKIP (errors) {json_path.name} → {result['file_name']} "
                        f"({result['annotation_count']} annotations)"
                    )
                )
            else:
                stats["imported"] += 1
                self.stdout.write(
                    f"  OK {json_path.name} → {result['file_name']} "
                    f"({result['annotation_count']} annotations"
                    f"{', ' + str(result['unmapped_count']) + ' unmapped' if result['unmapped_count'] else ''})"
                )

        # Update dataset
        if not dry_run and stats["imported"] > 0:
            dataset.file_count = Job.objects.filter(dataset=dataset).count()
            dataset.status = Dataset.Status.READY
            dataset.save(update_fields=["file_count", "status"])

        # Write error report (always when there are error files)
        if file_reports:
            with open(report_path, "w") as f:
                for lines in file_reports:
                    f.write("\n".join(lines))
                    f.write("\n\n")
            self.stdout.write(
                self.style.WARNING(f"\nReport written to: {report_path}")
            )

        # Console summary
        self.stdout.write(
            self.style.SUCCESS(
                f"\n=== {'Validation' if dry_run else 'Import'} Summary ==="
            )
        )
        self.stdout.write(f"Files imported:           {stats['imported']}")
        self.stdout.write(
            f"Files skipped (errors):   {stats['skipped_errors']}"
            + (f"  (details in {report_path.name})" if stats["skipped_errors"] else "")
        )
        self.stdout.write(f"Files skipped (other):    {stats['skipped']}")
        self.stdout.write(f"Files errored:            {stats['errors']}")
        self.stdout.write(f"Total entities:           {stats['total_annotations']}")
        self.stdout.write(
            f"  Mapped successfully:    {stats['total_annotations'] - stats['total_unmapped']}"
        )
        self.stdout.write(f"  Unmapped (not found):   {stats['total_unmapped']}")
        self.stdout.write(
            f"  Text mismatches:        {stats['total_text_mismatches']}"
        )
        self.stdout.write(
            f"  Duplicates:             {stats['total_duplicates']}"
        )
        self.stdout.write(
            f"  Overlapping:            {stats['total_overlaps']}"
        )
        self.stdout.write("Redaction simulation:")
        self.stdout.write(
            f"  Successful:             {stats['redaction_ok']}"
        )
        self.stdout.write(
            f"  Failed:                 {stats['redaction_failed']}"
        )

        if dataset.pk:
            self.stdout.write(f"Dataset ID: {dataset.pk}")

    def _process_file(
        self,
        json_path,
        data_dir,
        dataset,
        annotator,
        target_status,
        class_cache,
        color_index,
        existing_hashes,
        dry_run,
    ):
        # Parse JSON
        with open(json_path) as f:
            data = json.load(f)

        file_name = data.get("file_name", json_path.stem + ".eml")
        annotations_data = data.get("annotations", [])

        # Find paired EML file (same stem as JSON)
        eml_path = data_dir / (json_path.stem + ".eml")
        if not eml_path.exists():
            raise SkipFile(f"Paired EML not found: {eml_path.name}")

        # Read EML
        with open(eml_path, "rb") as f:
            raw_bytes = f.read()

        content_hash = hashlib.sha256(raw_bytes).hexdigest()
        if content_hash in existing_hashes:
            raise SkipFile(f"Duplicate content_hash: {content_hash[:12]}...")

        try:
            eml_text = raw_bytes.decode("utf-8")
        except UnicodeDecodeError:
            eml_text = raw_bytes.decode("latin-1")

        # Extract sections for section-based offset mapping
        sections = extract_sections(eml_text)

        # Sort annotations by start_offset for sequential matching
        annotations_data.sort(key=lambda a: a["start_offset"])

        # Track search positions per section for sequential matching
        search_positions = {s.index: 0 for s in sections}

        # Map annotations to section-based offsets
        annotation_records = []
        unmapped_annotations = []

        for ann in annotations_data:
            text = ann["original_text"]
            class_name = ann["class_name"]
            tag = ann["tag"]
            global_start = ann["start_offset"]

            # Map to section-based offset via text search with offset hint
            mapping = self._map_to_section(
                text, global_start, sections, search_positions
            )

            if mapping is None:
                unmapped_annotations.append(ann)
                continue

            section_index, local_start, local_end = mapping

            # Get or create annotation class
            if class_name not in class_cache:
                if not dry_run:
                    display_label = class_name.replace("_", " ").title()
                    ac, _ = AnnotationClass.objects.get_or_create(
                        name=class_name,
                        defaults={
                            "display_label": display_label,
                            "color": COLOR_PALETTE[color_index % len(COLOR_PALETTE)],
                        },
                    )
                    class_cache[class_name] = ac
                    color_index += 1
                else:
                    class_cache[class_name] = None
                    color_index += 1

            annotation_records.append(
                {
                    "class_name": class_name,
                    "tag": tag,
                    "section_index": section_index,
                    "start_offset": local_start,
                    "end_offset": local_end,
                    "original_text": text,
                    "annotation_class": class_cache.get(class_name),
                }
            )

        # --- Validation ---
        report_lines = []
        text_mismatch_count = 0
        duplicate_count = 0
        overlap_count = 0
        redaction_error = None

        # a) Text verification
        for rec in annotation_records:
            section = sections[rec["section_index"]]
            actual = section.content[rec["start_offset"] : rec["end_offset"]]
            if actual != rec["original_text"]:
                text_mismatch_count += 1
                ctx = self._context_snippet(
                    section.content, rec["start_offset"], rec["end_offset"]
                )
                report_lines.append(
                    f"  TEXT MISMATCH:\n"
                    f"    Class: {rec['class_name']}, Text: {rec['original_text']!r}\n"
                    f"    Section {rec['section_index']} "
                    f"[{rec['start_offset']}:{rec['end_offset']}]: "
                    f"actual={actual!r}\n"
                    f"    Context: {ctx}"
                )

        # b) Unmapped annotations
        # Build concatenated content for global offset context
        if unmapped_annotations:
            full_content = "".join(s.content for s in sections)

        for ann in unmapped_annotations:
            gs, ge = ann["start_offset"], ann["end_offset"]
            if gs < len(full_content):
                ctx = self._context_snippet(full_content, gs, min(ge, len(full_content)))
            else:
                ctx = f"(offset {gs} beyond content length {len(full_content)})"
            report_lines.append(
                f"  UNMAPPED:\n"
                f"    Class: {ann['class_name']}, Tag: {ann['tag']}, "
                f"Text: {ann['original_text']!r}\n"
                f"    Global offset: [{gs}:{ge}]\n"
                f"    Context at offset: {ctx}\n"
                f"    Reason: Text not found in any section"
            )

        # c) Duplicate & overlap detection per section
        by_section = {}
        for rec in annotation_records:
            by_section.setdefault(rec["section_index"], []).append(rec)

        for sec_idx, recs in by_section.items():
            # Duplicates
            seen_offsets = {}
            for rec in recs:
                key = (rec["start_offset"], rec["end_offset"])
                if key in seen_offsets:
                    duplicate_count += 1
                    prev = seen_offsets[key]
                    report_lines.append(
                        f"  DUPLICATE in Section {sec_idx}:\n"
                        f"    A: {prev['class_name']} {prev['original_text']!r} "
                        f"[{prev['start_offset']}:{prev['end_offset']}]\n"
                        f"    B: {rec['class_name']} {rec['original_text']!r} "
                        f"[{rec['start_offset']}:{rec['end_offset']}]"
                    )
                else:
                    seen_offsets[key] = rec

            # Overlaps
            sorted_recs = sorted(recs, key=lambda r: r["start_offset"])
            sec_content = sections[sec_idx].content
            for i in range(len(sorted_recs) - 1):
                a = sorted_recs[i]
                b = sorted_recs[i + 1]
                if a["end_offset"] > b["start_offset"]:
                    overlap_count += 1
                    overlap_chars = a["end_offset"] - b["start_offset"]
                    ctx = self._context_snippet(
                        sec_content, a["start_offset"], b["end_offset"]
                    )
                    report_lines.append(
                        f"  OVERLAP in Section {sec_idx}:\n"
                        f"    A: {a['class_name']} {a['original_text']!r} "
                        f"[{a['start_offset']}:{a['end_offset']}]\n"
                        f"    B: {b['class_name']} {b['original_text']!r} "
                        f"[{b['start_offset']}:{b['end_offset']}]\n"
                        f"    Overlap: {overlap_chars} chars\n"
                        f"    Context: {ctx}"
                    )

        # d) Redaction simulation
        if annotation_records:
            try:
                ns_annotations = [
                    SimpleNamespace(**rec) for rec in annotation_records
                ]
                ann_by_section = group_annotations_by_section(ns_annotations)
                result = deidentify_and_reassemble(
                    eml_text, sections, ann_by_section
                )
                if not result or not result.strip():
                    redaction_error = "Empty output from deidentify_and_reassemble"
                    report_lines.append(
                        f"  REDACTION FAILED:\n    Error: {redaction_error}"
                    )
            except Exception as e:
                redaction_error = str(e)
                report_lines.append(
                    f"  REDACTION FAILED:\n"
                    f"    Error: {e}\n"
                    f"    {traceback.format_exc().splitlines()[-2]}"
                )

        # Build file header if there are errors
        has_errors = bool(report_lines)
        if has_errors:
            header = f"=== ERRORS: {file_name} ===\n"
            separator = "=" * 80
            report_lines = [header] + report_lines + [separator]

        # DB writes (non-dry-run, only if no validation errors)
        if not dry_run and not has_errors:
            with transaction.atomic():
                job = Job(
                    dataset=dataset,
                    file_name=file_name,
                    content_hash=content_hash,
                    status=target_status,
                    assigned_annotator=annotator,
                )
                job.eml_content = eml_text
                job.save()

                existing_hashes.add(content_hash)

                version = AnnotationVersion.objects.create(
                    job=job,
                    version_number=1,
                    created_by=annotator,
                    source=AnnotationVersion.Source.ANNOTATOR,
                )

                annotations = [
                    Annotation(
                        annotation_version=version,
                        annotation_class=rec["annotation_class"],
                        class_name=rec["class_name"],
                        tag=rec["tag"],
                        section_index=rec["section_index"],
                        start_offset=rec["start_offset"],
                        end_offset=rec["end_offset"],
                        original_text=rec["original_text"],
                    )
                    for rec in annotation_records
                ]
                Annotation.objects.bulk_create(annotations)

        return {
            "file_name": file_name,
            "annotation_count": len(annotation_records),
            "unmapped_count": len(unmapped_annotations),
            "color_index": color_index,
            "has_errors": has_errors,
            "report_lines": report_lines if has_errors else None,
            "text_mismatch_count": text_mismatch_count,
            "duplicate_count": duplicate_count,
            "overlap_count": overlap_count,
            "redaction_error": redaction_error,
        }

    def _context_snippet(self, content, start, end, margin=20):
        """Return a snippet around [start:end] with `margin` chars on each side.

        Produces: '...before>>>matched<<<after...'
        """
        ctx_start = max(0, start - margin)
        ctx_end = min(len(content), end + margin)
        before = content[ctx_start:start].replace("\n", "\\n")
        matched = content[start:end].replace("\n", "\\n")
        after = content[end:ctx_end].replace("\n", "\\n")
        prefix = "..." if ctx_start > 0 else ""
        suffix = "..." if ctx_end < len(content) else ""
        return f"{prefix}{before}>>>{matched}<<<{after}{suffix}"

    def _map_to_section(self, text, global_offset, sections, search_positions):
        """Map text with a global offset to section-based (section_index, start, end).

        Uses text search with global offset as a hint for disambiguation.
        Returns (section_index, local_start, local_end) or None if unmapped.
        """
        # Compute hint section from global offset
        hint_idx = self._compute_section_hint(global_offset, sections)

        # Strategy 1: Search in hint section first (sequential)
        if hint_idx is not None:
            hint_section = sections[hint_idx]
            pos = hint_section.content.find(
                text, search_positions[hint_section.index]
            )
            if pos != -1:
                search_positions[hint_section.index] = pos + len(text)
                return (hint_section.index, pos, pos + len(text))

        # Strategy 2: Search all sections sequentially
        for section in sections:
            pos = section.content.find(text, search_positions[section.index])
            if pos != -1:
                search_positions[section.index] = pos + len(text)
                return (section.index, pos, pos + len(text))

        # Strategy 3: Fallback — search from beginning of all sections
        for section in sections:
            pos = section.content.find(text)
            if pos != -1:
                return (section.index, pos, pos + len(text))

        return None

    def _compute_section_hint(self, global_offset, sections):
        """Determine which section a global offset likely falls in.

        Walks sections by cumulative content length.
        Returns section index or None.
        """
        cumulative = 0
        for section in sections:
            section_len = len(section.content)
            if cumulative + section_len > global_offset:
                return section.index
            cumulative += section_len
        return None
