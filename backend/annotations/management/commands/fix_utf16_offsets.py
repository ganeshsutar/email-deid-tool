"""
Management command to fix UTF-16 surrogate pair offset mismatches.

JavaScript's String.length counts UTF-16 code units, not Unicode code points.
Characters above U+FFFF (e.g. emojis) are surrogate pairs — 2 in JS but 1 in
Python. This command converts stored UTF-16 code-unit offsets to Python
code-point offsets, with verification against actual email content.

Handles three data stores:
  1. Annotation model records (snake_case fields)
  2. DraftAnnotation.annotations JSON list (camelCase keys)
  3. QADraftReview.data["annotations"] JSON list (camelCase keys)
"""

import logging
from collections import defaultdict

from django.core.management.base import BaseCommand
from django.db import transaction

from annotations.models import Annotation, DraftAnnotation
from core.section_extractor import extract_sections
from qa.models import QADraftReview

logger = logging.getLogger(__name__)


def _utf16_offset_to_codepoint(text, utf16_offset):
    """Convert a UTF-16 code-unit offset to a Python code-point offset.

    Walks through the string counting how many UTF-16 code units each
    character occupies (2 for chars above U+FFFF, 1 otherwise).
    Returns the code-point index where the UTF-16 count reaches the target,
    or None if the offset is invalid.
    """
    u16_pos = 0
    for cp_idx, ch in enumerate(text):
        if u16_pos >= utf16_offset:
            return cp_idx
        u16_pos += 2 if ord(ch) > 0xFFFF else 1
    # Handle offset pointing to end of string
    if u16_pos == utf16_offset:
        return len(text)
    return None


def _try_fix(section_content, start_offset, end_offset, original_text):
    """Attempt to convert UTF-16 offsets to code-point offsets.

    Returns (new_start, new_end, was_changed) if successful,
    or None if conversion or verification failed.
    """
    new_start = _utf16_offset_to_codepoint(section_content, start_offset)
    new_end = _utf16_offset_to_codepoint(section_content, end_offset)

    if new_start is None or new_end is None:
        return None

    # No non-BMP chars before this annotation — offsets already correct
    if new_start == start_offset and new_end == end_offset:
        return (start_offset, end_offset, False)

    # Verify the converted offsets extract the expected text
    if section_content[new_start:new_end] == original_text:
        return (new_start, new_end, True)

    return None


def _get_sections_map(job):
    """Return dict mapping section_index -> section content string."""
    sections = extract_sections(job.eml_content)
    return {s.index: s.content for s in sections}


class Command(BaseCommand):
    help = "Fix UTF-16 surrogate pair offset mismatches in annotations"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview changes without writing to DB",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no DB writes\n"))

        ann_stats = self._fix_annotations(dry_run)
        draft_stats = self._fix_draft_annotations(dry_run)
        qa_stats = self._fix_qa_draft_reviews(dry_run)

        # Merge affected files across all stores
        all_affected_files = defaultdict(int)
        for fname, count in ann_stats["affected_files"].items():
            all_affected_files[fname] += count
        for fname, count in draft_stats["affected_files"].items():
            all_affected_files[fname] += count
        for fname, count in qa_stats["affected_files"].items():
            all_affected_files[fname] += count

        total_fixed = (
            ann_stats["fixed"]
            + draft_stats["fixed"]
            + qa_stats["fixed"]
        )

        total_checked = (
            ann_stats["checked"]
            + draft_stats["checked"]
            + qa_stats["checked"]
        )
        total_needed_fix = (
            ann_stats["needed_fix"]
            + draft_stats["needed_fix"]
            + qa_stats["needed_fix"]
        )
        total_failed = (
            ann_stats["verification_failed"]
            + draft_stats["verification_failed"]
            + qa_stats["verification_failed"]
        )

        self.stdout.write("\n" + "=" * 50)
        self.stdout.write("SUMMARY")
        self.stdout.write("=" * 50)
        self.stdout.write(f"  Total annotations scanned:     {total_checked:,}")
        self.stdout.write(f"  Needed UTF-16 fix:             {total_needed_fix:,}")
        self.stdout.write(f"  Successfully fixed:            {total_fixed:,}")
        self.stdout.write(f"  Verification failed (skipped): {total_failed:,}")
        self.stdout.write(f"  Files affected:                {len(all_affected_files):,}")

        if all_affected_files:
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("Affected files:")
            self.stdout.write(f"{'─' * 50}")
            sorted_files = sorted(
                all_affected_files.items(), key=lambda x: (-x[1], x[0])
            )
            for fname, count in sorted_files:
                self.stdout.write(f"  {fname}  ({count} annotations)")

        action = "would be fixed" if dry_run else "fixed"
        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone: {total_fixed} annotations {action} "
                f"across {len(all_affected_files)} files."
            )
        )

    def _fix_annotations(self, dry_run):
        """Fix UTF-16 offsets in Annotation model records."""
        self.stdout.write("\n=== Annotation Records ===")

        annotations = (
            Annotation.objects.select_related("annotation_version__job").all()
        )

        stats = {
            "checked": 0,
            "needed_fix": 0,
            "fixed": 0,
            "verification_failed": 0,
            "affected_files": defaultdict(int),
        }

        sections_cache = {}
        job_file_names = {}
        to_update = []

        for ann in annotations.iterator():
            stats["checked"] += 1

            job = ann.annotation_version.job
            job_id = job.id
            if job_id not in job_file_names:
                job_file_names[job_id] = job.file_name

            # Get sections
            if job_id not in sections_cache:
                try:
                    sections_cache[job_id] = _get_sections_map(job)
                except Exception as e:
                    logger.warning(
                        "Annotation %s: failed to extract sections for job %s: %s",
                        ann.id, job_id, e,
                    )
                    stats["verification_failed"] += 1
                    continue

            sections_map = sections_cache[job_id]
            section_content = sections_map.get(ann.section_index)

            if section_content is None:
                logger.warning(
                    "Annotation %s: section_index %d out of range (job %s has %d sections)",
                    ann.id, ann.section_index, job_id, len(sections_map),
                )
                stats["verification_failed"] += 1
                continue

            result = _try_fix(
                section_content, ann.start_offset, ann.end_offset,
                ann.original_text,
            )

            if result is None:
                logger.warning(
                    "Annotation %s: UTF-16 offset conversion/verification failed",
                    ann.id,
                )
                stats["verification_failed"] += 1
                continue

            new_start, new_end, was_changed = result
            if not was_changed:
                continue

            stats["needed_fix"] += 1
            ann.start_offset = new_start
            ann.end_offset = new_end
            to_update.append(ann)
            stats["fixed"] += 1
            stats["affected_files"][job_file_names[job_id]] += 1

        if to_update and not dry_run:
            with transaction.atomic():
                Annotation.objects.bulk_update(
                    to_update,
                    ["start_offset", "end_offset"],
                    batch_size=500,
                )

        self._print_stats(stats)
        return stats

    def _fix_draft_annotations(self, dry_run):
        """Fix UTF-16 offsets in DraftAnnotation JSON annotations."""
        self.stdout.write("\n=== Draft Annotations (JSON) ===")

        drafts = DraftAnnotation.objects.select_related("job").all()

        stats = {
            "drafts_checked": 0,
            "checked": 0,
            "needed_fix": 0,
            "fixed": 0,
            "verification_failed": 0,
            "drafts_modified": 0,
            "affected_files": defaultdict(int),
        }

        sections_cache = {}

        for draft in drafts.iterator():
            stats["drafts_checked"] += 1
            annotations = draft.annotations

            if not isinstance(annotations, list):
                continue

            job = draft.job
            job_id = job.id
            file_name = job.file_name

            if job_id not in sections_cache:
                try:
                    sections_cache[job_id] = _get_sections_map(job)
                except Exception as e:
                    logger.warning(
                        "DraftAnnotation %s: failed to extract sections for job %s: %s",
                        draft.id, job_id, e,
                    )
                    continue

            sections_map = sections_cache[job_id]
            modified = False

            for ann in annotations:
                if not isinstance(ann, dict):
                    continue

                original_text = ann.get("originalText", "")
                start_offset = ann.get("startOffset")
                end_offset = ann.get("endOffset")
                section_index = ann.get("sectionIndex", 0)

                if not isinstance(original_text, str) or start_offset is None or end_offset is None:
                    continue

                stats["checked"] += 1

                section_content = sections_map.get(section_index)
                if section_content is None:
                    stats["verification_failed"] += 1
                    continue

                result = _try_fix(
                    section_content, start_offset, end_offset, original_text,
                )

                if result is None:
                    stats["verification_failed"] += 1
                    continue

                new_start, new_end, was_changed = result
                if not was_changed:
                    continue

                stats["needed_fix"] += 1
                ann["startOffset"] = new_start
                ann["endOffset"] = new_end
                modified = True
                stats["fixed"] += 1
                stats["affected_files"][file_name] += 1

            if modified:
                stats["drafts_modified"] += 1
                if not dry_run:
                    draft.save(update_fields=["annotations"])

        self._print_draft_stats(stats, "Draft records")
        return stats

    def _fix_qa_draft_reviews(self, dry_run):
        """Fix UTF-16 offsets in QADraftReview JSON annotations."""
        self.stdout.write("\n=== QA Draft Reviews (JSON) ===")

        reviews = QADraftReview.objects.select_related("job").all()

        stats = {
            "drafts_checked": 0,
            "checked": 0,
            "needed_fix": 0,
            "fixed": 0,
            "verification_failed": 0,
            "drafts_modified": 0,
            "affected_files": defaultdict(int),
        }

        sections_cache = {}

        for review in reviews.iterator():
            stats["drafts_checked"] += 1
            data = review.data

            if not isinstance(data, dict):
                continue

            annotations = data.get("annotations", [])
            if not isinstance(annotations, list):
                continue

            job = review.job
            job_id = job.id
            file_name = job.file_name

            if job_id not in sections_cache:
                try:
                    sections_cache[job_id] = _get_sections_map(job)
                except Exception as e:
                    logger.warning(
                        "QADraftReview %s: failed to extract sections for job %s: %s",
                        review.id, job_id, e,
                    )
                    continue

            sections_map = sections_cache[job_id]
            modified = False

            for ann in annotations:
                if not isinstance(ann, dict):
                    continue

                original_text = ann.get("originalText", "")
                start_offset = ann.get("startOffset")
                end_offset = ann.get("endOffset")
                section_index = ann.get("sectionIndex", 0)

                if not isinstance(original_text, str) or start_offset is None or end_offset is None:
                    continue

                stats["checked"] += 1

                section_content = sections_map.get(section_index)
                if section_content is None:
                    stats["verification_failed"] += 1
                    continue

                result = _try_fix(
                    section_content, start_offset, end_offset, original_text,
                )

                if result is None:
                    stats["verification_failed"] += 1
                    continue

                new_start, new_end, was_changed = result
                if not was_changed:
                    continue

                stats["needed_fix"] += 1
                ann["startOffset"] = new_start
                ann["endOffset"] = new_end
                modified = True
                stats["fixed"] += 1
                stats["affected_files"][file_name] += 1

            if modified:
                stats["drafts_modified"] += 1
                if not dry_run:
                    review.save(update_fields=["data"])

        self._print_draft_stats(stats, "Review records")
        return stats

    def _print_stats(self, stats):
        self.stdout.write(f"  Total annotations:             {stats['checked']:,}")
        self.stdout.write(f"  Needed UTF-16 fix:             {stats['needed_fix']:,}")
        self.stdout.write(f"  Fixed:                         {stats['fixed']:,}")
        self.stdout.write(
            f"  Verification failed (skipped): {stats['verification_failed']:,}"
        )
        self.stdout.write(
            f"  Files affected:                {len(stats['affected_files']):,}"
        )

    def _print_draft_stats(self, stats, label):
        self.stdout.write(f"  {label} checked:               {stats['drafts_checked']:,}")
        self.stdout.write(f"  Total annotations:             {stats['checked']:,}")
        self.stdout.write(f"  Needed UTF-16 fix:             {stats['needed_fix']:,}")
        self.stdout.write(f"  Fixed:                         {stats['fixed']:,}")
        self.stdout.write(
            f"  Verification failed (skipped): {stats['verification_failed']:,}"
        )
        self.stdout.write(
            f"  {label} modified:              {stats['drafts_modified']:,}"
        )
        self.stdout.write(
            f"  Files affected:                {len(stats['affected_files']):,}"
        )
