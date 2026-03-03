import os
import zipfile

from django.core.management.base import BaseCommand, CommandError

from datasets.models import Dataset, Job


class Command(BaseCommand):
    help = "Export original EML files from the database as a zip archive, organized by dataset."

    def add_arguments(self, parser):
        parser.add_argument(
            "-o",
            "--output",
            type=str,
            default="./eml_export.zip",
            help="Output zip file path (default: ./eml_export.zip)",
        )
        parser.add_argument(
            "-d",
            "--dataset",
            type=str,
            default=None,
            help="Filter to a specific dataset UUID",
        )

    def handle(self, *args, **options):
        output_path = options["output"]
        dataset_id = options["dataset"]

        # Build queryset
        queryset = Job.objects.select_related("dataset").exclude(eml_content_compressed=b"")

        if dataset_id:
            try:
                Dataset.objects.get(pk=dataset_id)
            except (Dataset.DoesNotExist, ValueError):
                raise CommandError(f"Dataset with ID '{dataset_id}' not found.")
            queryset = queryset.filter(dataset_id=dataset_id)

        total = queryset.count()
        if total == 0:
            self.stdout.write(self.style.WARNING("No jobs with EML content found."))
            return

        self.stdout.write(f"Found {total} job(s) with EML content.")

        # Track filenames per dataset to handle duplicates
        seen_names: dict[str, dict[str, int]] = {}
        files_written = 0

        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for job in queryset.iterator():
                dataset_name = job.dataset.name
                file_name = job.file_name

                # Ensure .eml extension
                if not file_name.lower().endswith(".eml"):
                    file_name += ".eml"

                # Handle duplicate filenames within a dataset
                if dataset_name not in seen_names:
                    seen_names[dataset_name] = {}

                name_counts = seen_names[dataset_name]
                if file_name in name_counts:
                    name_counts[file_name] += 1
                    base, ext = os.path.splitext(file_name)
                    file_name = f"{base}_{name_counts[file_name]}{ext}"
                else:
                    name_counts[file_name] = 0

                arc_path = f"{dataset_name}/{file_name}"
                zf.writestr(arc_path, job.eml_content)
                files_written += 1

                if files_written % 100 == 0:
                    self.stdout.write(f"  Written {files_written}/{total} files...")

        zip_size = os.path.getsize(output_path)
        size_label = f"{zip_size / (1024 * 1024):.1f} MB" if zip_size >= 1024 * 1024 else f"{zip_size / 1024:.1f} KB"

        self.stdout.write(self.style.SUCCESS(f"Done. Wrote {files_written} file(s) to {output_path} ({size_label})."))
