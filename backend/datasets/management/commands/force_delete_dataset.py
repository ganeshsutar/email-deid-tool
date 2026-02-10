import shutil
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from annotations.models import AnnotationVersion, DraftAnnotation
from datasets.models import Dataset
from exports.models import ExportRecord
from qa.models import QADraftReview, QAReviewVersion


class Command(BaseCommand):
    help = "Permanently delete a dataset and all related data (jobs, annotations, QA reviews, drafts, export records + files on disk)."

    def add_arguments(self, parser):
        parser.add_argument("dataset_id", type=str, help="UUID of the dataset to delete")
        parser.add_argument(
            "--yes",
            "-y",
            action="store_true",
            default=False,
            help="Skip confirmation prompt",
        )

    def handle(self, *args, **options):
        dataset_id = options["dataset_id"]

        try:
            dataset = Dataset.objects.get(pk=dataset_id)
        except (Dataset.DoesNotExist, ValueError):
            raise CommandError(f"Dataset with ID '{dataset_id}' not found.")

        # Gather stats
        jobs = dataset.jobs.all()
        job_count = jobs.count()
        job_ids = list(jobs.values_list("id", flat=True))

        annotation_version_count = AnnotationVersion.objects.filter(job_id__in=job_ids).count()
        draft_annotation_count = DraftAnnotation.objects.filter(job_id__in=job_ids).count()
        qa_review_count = QAReviewVersion.objects.filter(job_id__in=job_ids).count()
        qa_draft_count = QADraftReview.objects.filter(job_id__in=job_ids).count()

        export_records = ExportRecord.objects.filter(dataset=dataset)
        export_count = export_records.count()
        export_file_paths = list(export_records.values_list("file_path", flat=True))

        # Print summary
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("=== Dataset Deletion Summary ==="))
        self.stdout.write(f"  Dataset:              {dataset.name} ({dataset.id})")
        self.stdout.write(f"  Jobs:                 {job_count}")
        self.stdout.write(f"  Annotation versions:  {annotation_version_count}")
        self.stdout.write(f"  Draft annotations:    {draft_annotation_count}")
        self.stdout.write(f"  QA review versions:   {qa_review_count}")
        self.stdout.write(f"  QA drafts:            {qa_draft_count}")
        self.stdout.write(f"  Export records:        {export_count}")
        self.stdout.write("")

        # Confirm
        if not options["yes"]:
            confirm = input("Are you sure you want to permanently delete this dataset? [y/N] ")
            if confirm.lower() not in ("y", "yes"):
                self.stdout.write(self.style.WARNING("Aborted."))
                return

        # Delete DB records in a transaction
        with transaction.atomic():
            deleted_count, deleted_detail = dataset.delete()

        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted_count} database records."))
        for model_label, count in deleted_detail.items():
            if count > 0:
                self.stdout.write(f"  {model_label}: {count}")

        # Clean up export files from disk (after successful DB delete)
        files_deleted = 0
        for file_path in export_file_paths:
            if not file_path:
                continue
            full_path = Path(settings.MEDIA_ROOT) / file_path
            if full_path.is_file():
                full_path.unlink()
                files_deleted += 1
                # Remove parent directory if empty
                parent = full_path.parent
                if parent.is_dir() and not any(parent.iterdir()):
                    shutil.rmtree(parent)

        if files_deleted:
            self.stdout.write(self.style.SUCCESS(f"Removed {files_deleted} export file(s) from disk."))

        self.stdout.write(self.style.SUCCESS("Done."))
