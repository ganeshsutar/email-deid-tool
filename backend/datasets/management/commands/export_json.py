import base64
import json
import os

from django.core.management.base import BaseCommand, CommandError

from annotations.models import AnnotationVersion
from datasets.models import Dataset, Job


class Command(BaseCommand):
    help = "Export all delivered jobs as a JSON file with base64-encoded email content and annotations."

    def add_arguments(self, parser):
        parser.add_argument(
            "-o",
            "--output",
            type=str,
            default="./delivered_export.json",
            help="Output JSON file path (default: ./delivered_export.json)",
        )
        parser.add_argument(
            "-d",
            "--dataset",
            type=str,
            default=None,
            help="Filter to a specific dataset UUID",
        )
        parser.add_argument(
            "--pretty",
            action="store_true",
            help="Pretty-print JSON with indentation",
        )

    def handle(self, *args, **options):
        output_path = options["output"]
        dataset_id = options["dataset"]
        pretty = options["pretty"]

        # Build queryset
        queryset = Job.objects.filter(
            status=Job.Status.DELIVERED,
        ).exclude(
            eml_content_compressed=b"",
        ).select_related("dataset")

        if dataset_id:
            try:
                Dataset.objects.get(pk=dataset_id)
            except (Dataset.DoesNotExist, ValueError):
                raise CommandError(f"Dataset with ID '{dataset_id}' not found.")
            queryset = queryset.filter(dataset_id=dataset_id)

        total = queryset.count()
        if total == 0:
            self.stdout.write(self.style.WARNING("No delivered jobs found."))
            return

        self.stdout.write(f"Found {total} delivered job(s). Exporting...")

        result = []
        exported = 0

        for job in queryset.iterator():
            # Get latest annotation version
            latest_version = (
                AnnotationVersion.objects.filter(job=job)
                .order_by("-version_number")
                .first()
            )

            annotations = []
            if latest_version:
                anns = (
                    latest_version.annotations
                    .select_related("annotation_class")
                    .order_by("section_index", "start_offset")
                )
                annotations = [
                    {
                        "id": str(ann.id),
                        "class_name": ann.class_name,
                        "class_display_label": (
                            ann.annotation_class.display_label
                            if ann.annotation_class
                            else ann.class_name
                        ),
                        "tag": ann.tag,
                        "section_index": ann.section_index,
                        "start_offset": ann.start_offset,
                        "end_offset": ann.end_offset,
                        "original_text": ann.original_text,
                    }
                    for ann in anns
                ]

            email_content = base64.b64encode(
                job.eml_content.encode("utf-8")
            ).decode("ascii")

            result.append({
                "emailContent": email_content,
                "annotations": annotations,
            })

            exported += 1
            if exported % 100 == 0:
                self.stdout.write(f"  Processed {exported}/{total} jobs...")

        indent = 2 if pretty else None
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=indent, ensure_ascii=False)

        file_size = os.path.getsize(output_path)
        size_label = (
            f"{file_size / (1024 * 1024):.1f} MB"
            if file_size >= 1024 * 1024
            else f"{file_size / 1024:.1f} KB"
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"Done. Exported {exported} job(s) to {output_path} ({size_label})."
            )
        )
