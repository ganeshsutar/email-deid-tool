"""
Management command to verify annotation offset integrity.

For every annotation across all three stores (Annotation model, DraftAnnotation
JSON, QADraftReview JSON), checks that section_content[start_offset:end_offset]
matches the stored original_text. Read-only — never modifies data.
"""

import logging
from collections import defaultdict

from django.core.management.base import BaseCommand

from annotations.models import Annotation, DraftAnnotation
from core.section_extractor import extract_sections
from qa.models import QADraftReview

logger = logging.getLogger(__name__)


def _get_sections_map(job):
    """Return dict mapping section_index → section content string."""
    sections = extract_sections(job.eml_content)
    return {s.index: s.content for s in sections}


def _truncate(text, length=60):
    """Truncate text for display, adding ellipsis if needed."""
    if len(text) <= length:
        return repr(text)
    return repr(text[:length]) + "..."


class Command(BaseCommand):
    help = "Verify that annotation offsets match stored original_text (read-only)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--verbose",
            action="store_true",
            help="Print details for each mismatched annotation",
        )

    def handle(self, *args, **options):
        verbose = options["verbose"]

        ann_stats = self._check_annotations(verbose)
        draft_stats = self._check_draft_annotations(verbose)
        qa_stats = self._check_qa_draft_reviews(verbose)

        # Merge affected files
        all_issue_files = defaultdict(int)
        for fname, count in ann_stats["issue_files"].items():
            all_issue_files[fname] += count
        for fname, count in draft_stats["issue_files"].items():
            all_issue_files[fname] += count
        for fname, count in qa_stats["issue_files"].items():
            all_issue_files[fname] += count

        total_checked = (
            ann_stats["checked"]
            + draft_stats["checked"]
            + qa_stats["checked"]
        )
        total_matching = (
            ann_stats["matching"]
            + draft_stats["matching"]
            + qa_stats["matching"]
        )
        total_mismatched = (
            ann_stats["mismatched"]
            + draft_stats["mismatched"]
            + qa_stats["mismatched"]
        )
        total_section_missing = (
            ann_stats["section_missing"]
            + draft_stats["section_missing"]
            + qa_stats["section_missing"]
        )
        total_extraction_failed = (
            ann_stats["extraction_failed"]
            + draft_stats["extraction_failed"]
            + qa_stats["extraction_failed"]
        )

        self.stdout.write("\n" + "=" * 50)
        self.stdout.write("SUMMARY")
        self.stdout.write("=" * 50)
        self.stdout.write(f"  Total checked:          {total_checked:,}")
        self.stdout.write(f"  Matching:               {total_matching:,}")
        self.stdout.write(f"  Mismatched:             {total_mismatched:,}")
        self.stdout.write(f"  Section missing:        {total_section_missing:,}")
        self.stdout.write(f"  Extraction failed:      {total_extraction_failed:,}")
        self.stdout.write(f"  Files with issues:      {len(all_issue_files):,}")

        if all_issue_files:
            self.stdout.write(f"\n{'─' * 50}")
            self.stdout.write("Files with issues:")
            self.stdout.write(f"{'─' * 50}")
            sorted_files = sorted(
                all_issue_files.items(), key=lambda x: (-x[1], x[0])
            )
            for fname, count in sorted_files:
                self.stdout.write(f"  {fname}  ({count} issues)")

        total_issues = total_mismatched + total_section_missing + total_extraction_failed
        if total_issues == 0:
            self.stdout.write(
                self.style.SUCCESS(f"\nDone: all {total_checked:,} annotations verified OK.")
            )
        else:
            self.stdout.write(
                self.style.WARNING(
                    f"\nDone: {total_issues:,} issues found across "
                    f"{len(all_issue_files):,} files."
                )
            )

    def _check_annotations(self, verbose):
        """Verify offsets in Annotation model records."""
        self.stdout.write("\n=== Annotation Records ===")

        annotations = (
            Annotation.objects.select_related("annotation_version__job").all()
        )

        stats = {
            "checked": 0,
            "matching": 0,
            "mismatched": 0,
            "section_missing": 0,
            "extraction_failed": 0,
            "issue_files": defaultdict(int),
        }

        sections_cache = {}
        job_file_names = {}

        for ann in annotations.iterator():
            stats["checked"] += 1

            job = ann.annotation_version.job
            job_id = job.id
            if job_id not in job_file_names:
                job_file_names[job_id] = job.file_name

            file_name = job_file_names[job_id]

            # Get sections
            if job_id not in sections_cache:
                try:
                    sections_cache[job_id] = _get_sections_map(job)
                except Exception as e:
                    logger.warning(
                        "Annotation %s: failed to extract sections for job %s: %s",
                        ann.id, job_id, e,
                    )
                    stats["extraction_failed"] += 1
                    stats["issue_files"][file_name] += 1
                    continue

            sections_map = sections_cache[job_id]
            section_content = sections_map.get(ann.section_index)

            if section_content is None:
                stats["section_missing"] += 1
                stats["issue_files"][file_name] += 1
                if verbose:
                    self.stdout.write(
                        self.style.ERROR(
                            f"  SECTION MISSING: {file_name} | annotation {ann.id} | "
                            f"section_index={ann.section_index}"
                        )
                    )
                continue

            actual_text = section_content[ann.start_offset:ann.end_offset]
            if actual_text == ann.original_text:
                stats["matching"] += 1
            else:
                stats["mismatched"] += 1
                stats["issue_files"][file_name] += 1
                if verbose:
                    self.stdout.write(
                        self.style.ERROR(
                            f"  MISMATCH: {file_name} | annotation {ann.id} | "
                            f"sec={ann.section_index} [{ann.start_offset}:{ann.end_offset}]\n"
                            f"    stored:  {_truncate(ann.original_text)}\n"
                            f"    actual:  {_truncate(actual_text)}"
                        )
                    )

        self._print_stats(stats)
        return stats

    def _check_draft_annotations(self, verbose):
        """Verify offsets in DraftAnnotation JSON annotations."""
        self.stdout.write("\n=== Draft Annotations (JSON) ===")

        drafts = DraftAnnotation.objects.select_related("job").all()

        stats = {
            "checked": 0,
            "matching": 0,
            "mismatched": 0,
            "section_missing": 0,
            "extraction_failed": 0,
            "issue_files": defaultdict(int),
        }

        sections_cache = {}

        for draft in drafts.iterator():
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
                    # Count all annotations in this draft as extraction_failed
                    ann_count = sum(1 for a in annotations if isinstance(a, dict))
                    stats["extraction_failed"] += ann_count
                    stats["issue_files"][file_name] += ann_count
                    continue

            sections_map = sections_cache[job_id]

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

                section_content = sections_map.get(section_index)
                if section_content is None:
                    stats["section_missing"] += 1
                    stats["issue_files"][file_name] += 1
                    if verbose:
                        self.stdout.write(
                            self.style.ERROR(
                                f"  SECTION MISSING: {file_name} | draft {draft.id} index {i} | "
                                f"section_index={section_index}"
                            )
                        )
                    continue

                actual_text = section_content[start_offset:end_offset]
                if actual_text == original_text:
                    stats["matching"] += 1
                else:
                    stats["mismatched"] += 1
                    stats["issue_files"][file_name] += 1
                    if verbose:
                        self.stdout.write(
                            self.style.ERROR(
                                f"  MISMATCH: {file_name} | draft {draft.id} index {i} | "
                                f"sec={section_index} [{start_offset}:{end_offset}]\n"
                                f"    stored:  {_truncate(original_text)}\n"
                                f"    actual:  {_truncate(actual_text)}"
                            )
                        )

        self._print_stats(stats)
        return stats

    def _check_qa_draft_reviews(self, verbose):
        """Verify offsets in QADraftReview JSON annotations."""
        self.stdout.write("\n=== QA Draft Reviews (JSON) ===")

        reviews = QADraftReview.objects.select_related("job").all()

        stats = {
            "checked": 0,
            "matching": 0,
            "mismatched": 0,
            "section_missing": 0,
            "extraction_failed": 0,
            "issue_files": defaultdict(int),
        }

        sections_cache = {}

        for review in reviews.iterator():
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
                    ann_count = sum(1 for a in annotations if isinstance(a, dict))
                    stats["extraction_failed"] += ann_count
                    stats["issue_files"][file_name] += ann_count
                    continue

            sections_map = sections_cache[job_id]

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

                section_content = sections_map.get(section_index)
                if section_content is None:
                    stats["section_missing"] += 1
                    stats["issue_files"][file_name] += 1
                    if verbose:
                        self.stdout.write(
                            self.style.ERROR(
                                f"  SECTION MISSING: {file_name} | review {review.id} index {i} | "
                                f"section_index={section_index}"
                            )
                        )
                    continue

                actual_text = section_content[start_offset:end_offset]
                if actual_text == original_text:
                    stats["matching"] += 1
                else:
                    stats["mismatched"] += 1
                    stats["issue_files"][file_name] += 1
                    if verbose:
                        self.stdout.write(
                            self.style.ERROR(
                                f"  MISMATCH: {file_name} | review {review.id} index {i} | "
                                f"sec={section_index} [{start_offset}:{end_offset}]\n"
                                f"    stored:  {_truncate(original_text)}\n"
                                f"    actual:  {_truncate(actual_text)}"
                            )
                        )

        self._print_stats(stats)
        return stats

    def _print_stats(self, stats):
        self.stdout.write(f"  Total annotations:      {stats['checked']:,}")
        self.stdout.write(f"  Matching:               {stats['matching']:,}")
        self.stdout.write(f"  Mismatched:             {stats['mismatched']:,}")
        self.stdout.write(f"  Section missing:        {stats['section_missing']:,}")
        self.stdout.write(f"  Extraction failed:      {stats['extraction_failed']:,}")
        self.stdout.write(
            f"  Files with issues:      {len(stats['issue_files']):,}"
        )
