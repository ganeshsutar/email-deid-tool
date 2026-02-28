"""
Management command to trim leading/trailing whitespace from annotation offsets.

Annotators sometimes accidentally select extra whitespace when annotating text.
This command finds those annotations, computes corrected offsets, verifies them
against the actual email content, and updates only verified records.

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


def _trim_whitespace(original_text, start_offset, end_offset):
    """Compute trimmed text and adjusted offsets.

    Returns (new_text, new_start, new_end, was_changed) or None if all-whitespace.
    """
    stripped = original_text.strip()
    if stripped == original_text:
        return (original_text, start_offset, end_offset, False)
    if not stripped:
        return None  # all-whitespace annotation
    leading = len(original_text) - len(original_text.lstrip())
    trailing = len(original_text) - len(original_text.rstrip())
    new_start = start_offset + leading
    new_end = end_offset - trailing
    return (stripped, new_start, new_end, True)


def _get_sections_map(job):
    """Return dict mapping section_index → section content string."""
    sections = extract_sections(job.eml_content)
    return {s.index: s.content for s in sections}


class Command(BaseCommand):
    help = "Trim leading/trailing whitespace from annotation offsets with verification"

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
        # Each file maps to count of trimmed annotations from that store
        all_affected_files = defaultdict(int)
        for fname, count in ann_stats["affected_files"].items():
            all_affected_files[fname] += count
        for fname, count in draft_stats["affected_files"].items():
            all_affected_files[fname] += count
        for fname, count in qa_stats["affected_files"].items():
            all_affected_files[fname] += count

        total_trimmed = (
            ann_stats["trimmed"]
            + draft_stats["trimmed"]
            + qa_stats["trimmed"]
        )

        # Summary
        total_annotations = (
            ann_stats["checked"]
            + draft_stats["checked"]
            + qa_stats["checked"]
        )
        total_with_whitespace = (
            ann_stats["has_whitespace"]
            + draft_stats["has_whitespace"]
            + qa_stats["has_whitespace"]
        )

        self.stdout.write("\n" + "=" * 50)
        self.stdout.write("SUMMARY")
        self.stdout.write("=" * 50)
        self.stdout.write(f"  Total annotations scanned:    {total_annotations:,}")
        self.stdout.write(f"  Annotations with whitespace:  {total_with_whitespace:,}")
        self.stdout.write(f"  Successfully trimmed:         {total_trimmed:,}")
        total_failed = (
            ann_stats["verification_failed"]
            + draft_stats["verification_failed"]
            + qa_stats["verification_failed"]
        )
        total_all_ws = (
            ann_stats["all_whitespace"]
            + draft_stats["all_whitespace"]
            + qa_stats["all_whitespace"]
        )
        self.stdout.write(f"  Verification failed (skipped): {total_failed:,}")
        self.stdout.write(f"  All-whitespace (skipped):      {total_all_ws:,}")
        self.stdout.write(f"  Files affected:                {len(all_affected_files):,}")

        if all_affected_files:
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("Affected files:")
            self.stdout.write(f"{'─' * 50}")
            # Sort by count descending, then filename
            sorted_files = sorted(
                all_affected_files.items(), key=lambda x: (-x[1], x[0])
            )
            for fname, count in sorted_files:
                self.stdout.write(f"  {fname}  ({count} annotations)")

        action = "would be trimmed" if dry_run else "trimmed"
        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone: {total_trimmed} annotations {action} "
                f"across {len(all_affected_files)} files."
            )
        )

    def _fix_annotations(self, dry_run):
        """Fix whitespace in Annotation model records."""
        self.stdout.write("\n=== Annotation Records ===")

        annotations = (
            Annotation.objects.select_related("annotation_version__job").all()
        )

        stats = {
            "checked": 0,
            "has_whitespace": 0,
            "trimmed": 0,
            "verification_failed": 0,
            "all_whitespace": 0,
            "affected_files": defaultdict(int),  # file_name → trimmed count
        }

        # Cache sections per job to avoid repeated decompression
        sections_cache = {}
        # Cache job_id → file_name for file tracking
        job_file_names = {}
        to_update = []

        for ann in annotations.iterator():
            stats["checked"] += 1

            job = ann.annotation_version.job
            job_id = job.id
            if job_id not in job_file_names:
                job_file_names[job_id] = job.file_name

            result = _trim_whitespace(
                ann.original_text, ann.start_offset, ann.end_offset
            )

            if result is None:
                stats["has_whitespace"] += 1
                stats["all_whitespace"] += 1
                logger.warning(
                    "Annotation %s: all-whitespace text, skipping", ann.id
                )
                continue

            new_text, new_start, new_end, was_changed = result
            if not was_changed:
                continue

            stats["has_whitespace"] += 1

            # Verify against actual email content
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

            actual_text = section_content[new_start:new_end]
            if actual_text != new_text:
                logger.warning(
                    "Annotation %s: verification mismatch — expected %r, got %r",
                    ann.id, new_text, actual_text,
                )
                stats["verification_failed"] += 1
                continue

            # Verified — apply changes
            ann.original_text = new_text
            ann.start_offset = new_start
            ann.end_offset = new_end
            to_update.append(ann)
            stats["trimmed"] += 1
            stats["affected_files"][job_file_names[job_id]] += 1

        if to_update and not dry_run:
            with transaction.atomic():
                Annotation.objects.bulk_update(
                    to_update,
                    ["original_text", "start_offset", "end_offset"],
                    batch_size=500,
                )

        self._print_stats(stats)
        return stats

    def _fix_draft_annotations(self, dry_run):
        """Fix whitespace in DraftAnnotation JSON annotations."""
        self.stdout.write("\n=== Draft Annotations (JSON) ===")

        drafts = DraftAnnotation.objects.select_related("job").all()

        stats = {
            "drafts_checked": 0,
            "checked": 0,
            "has_whitespace": 0,
            "trimmed": 0,
            "verification_failed": 0,
            "all_whitespace": 0,
            "drafts_modified": 0,
            "affected_files": defaultdict(int),
        }

        sections_cache = {}

        for draft in drafts.iterator():
            stats["drafts_checked"] += 1
            annotations = draft.annotations

            if not isinstance(annotations, list):
                logger.warning(
                    "DraftAnnotation %s: annotations is not a list, skipping",
                    draft.id,
                )
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
            to_remove = []

            for i, ann in enumerate(annotations):
                if not isinstance(ann, dict):
                    continue

                original_text = ann.get("originalText", "")
                start_offset = ann.get("startOffset")
                end_offset = ann.get("endOffset")
                section_index = ann.get("sectionIndex", 0)

                if not isinstance(original_text, str) or start_offset is None or end_offset is None:
                    continue

                stats["checked"] += 1
                result = _trim_whitespace(original_text, start_offset, end_offset)

                if result is None:
                    stats["has_whitespace"] += 1
                    stats["all_whitespace"] += 1
                    to_remove.append(i)
                    logger.warning(
                        "DraftAnnotation %s: all-whitespace annotation at index %d, removing",
                        draft.id, i,
                    )
                    continue

                new_text, new_start, new_end, was_changed = result
                if not was_changed:
                    continue

                stats["has_whitespace"] += 1

                # Verify
                section_content = sections_map.get(section_index)
                if section_content is None:
                    logger.warning(
                        "DraftAnnotation %s: section_index %d out of range at index %d",
                        draft.id, section_index, i,
                    )
                    stats["verification_failed"] += 1
                    continue

                actual_text = section_content[new_start:new_end]
                if actual_text != new_text:
                    logger.warning(
                        "DraftAnnotation %s index %d: verification mismatch — expected %r, got %r",
                        draft.id, i, new_text, actual_text,
                    )
                    stats["verification_failed"] += 1
                    continue

                ann["originalText"] = new_text
                ann["startOffset"] = new_start
                ann["endOffset"] = new_end
                modified = True
                stats["trimmed"] += 1
                stats["affected_files"][file_name] += 1

            # Remove all-whitespace annotations (iterate in reverse to preserve indices)
            for i in reversed(to_remove):
                annotations.pop(i)
                modified = True

            if modified:
                stats["drafts_modified"] += 1
                if not dry_run:
                    draft.save(update_fields=["annotations"])

        self._print_draft_stats(stats, "Draft records")
        return stats

    def _fix_qa_draft_reviews(self, dry_run):
        """Fix whitespace in QADraftReview JSON annotations."""
        self.stdout.write("\n=== QA Draft Reviews (JSON) ===")

        reviews = QADraftReview.objects.select_related("job").all()

        stats = {
            "drafts_checked": 0,
            "checked": 0,
            "has_whitespace": 0,
            "trimmed": 0,
            "verification_failed": 0,
            "all_whitespace": 0,
            "drafts_modified": 0,
            "affected_files": defaultdict(int),
        }

        sections_cache = {}

        for review in reviews.iterator():
            stats["drafts_checked"] += 1
            data = review.data

            if not isinstance(data, dict):
                logger.warning(
                    "QADraftReview %s: data is not a dict, skipping",
                    review.id,
                )
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
            to_remove = []

            for i, ann in enumerate(annotations):
                if not isinstance(ann, dict):
                    continue

                original_text = ann.get("originalText", "")
                start_offset = ann.get("startOffset")
                end_offset = ann.get("endOffset")
                section_index = ann.get("sectionIndex", 0)

                if not isinstance(original_text, str) or start_offset is None or end_offset is None:
                    continue

                stats["checked"] += 1
                result = _trim_whitespace(original_text, start_offset, end_offset)

                if result is None:
                    stats["has_whitespace"] += 1
                    stats["all_whitespace"] += 1
                    to_remove.append(i)
                    logger.warning(
                        "QADraftReview %s: all-whitespace annotation at index %d, removing",
                        review.id, i,
                    )
                    continue

                new_text, new_start, new_end, was_changed = result
                if not was_changed:
                    continue

                stats["has_whitespace"] += 1

                # Verify
                section_content = sections_map.get(section_index)
                if section_content is None:
                    logger.warning(
                        "QADraftReview %s: section_index %d out of range at index %d",
                        review.id, section_index, i,
                    )
                    stats["verification_failed"] += 1
                    continue

                actual_text = section_content[new_start:new_end]
                if actual_text != new_text:
                    logger.warning(
                        "QADraftReview %s index %d: verification mismatch — expected %r, got %r",
                        review.id, i, new_text, actual_text,
                    )
                    stats["verification_failed"] += 1
                    continue

                ann["originalText"] = new_text
                ann["startOffset"] = new_start
                ann["endOffset"] = new_end
                modified = True
                stats["trimmed"] += 1
                stats["affected_files"][file_name] += 1

            # Remove all-whitespace annotations
            for i in reversed(to_remove):
                annotations.pop(i)
                modified = True

            if modified:
                stats["drafts_modified"] += 1
                if not dry_run:
                    review.save(update_fields=["data"])

        self._print_draft_stats(stats, "Review records")
        return stats

    def _print_stats(self, stats):
        self.stdout.write(f"  Total annotations:              {stats['checked']:,}")
        self.stdout.write(f"  With whitespace issues:         {stats['has_whitespace']:,}")
        self.stdout.write(f"  Trimmed:                        {stats['trimmed']:,}")
        self.stdout.write(
            f"  Verification failed (skipped):  {stats['verification_failed']:,}"
        )
        self.stdout.write(
            f"  All-whitespace (skipped):       {stats['all_whitespace']:,}"
        )
        self.stdout.write(
            f"  Files affected:                 {len(stats['affected_files']):,}"
        )

    def _print_draft_stats(self, stats, label):
        self.stdout.write(f"  {label} checked:                {stats['drafts_checked']:,}")
        self.stdout.write(f"  Total annotations:              {stats['checked']:,}")
        self.stdout.write(f"  With whitespace issues:         {stats['has_whitespace']:,}")
        self.stdout.write(f"  Trimmed:                        {stats['trimmed']:,}")
        self.stdout.write(
            f"  Verification failed (skipped):  {stats['verification_failed']:,}"
        )
        self.stdout.write(
            f"  All-whitespace (removed):       {stats['all_whitespace']:,}"
        )
        self.stdout.write(
            f"  {label} modified:               {stats['drafts_modified']:,}"
        )
        self.stdout.write(
            f"  Files affected:                 {len(stats['affected_files']):,}"
        )
