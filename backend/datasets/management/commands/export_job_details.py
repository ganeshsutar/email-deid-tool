import csv

from django.core.management.base import BaseCommand, CommandError

from datasets.models import Dataset, Job


class Command(BaseCommand):
    help = "Export job details as CSV for filenames listed in a text file."

    def add_arguments(self, parser):
        parser.add_argument(
            "file",
            type=str,
            help="Path to a text file with one filename per line",
        )
        parser.add_argument(
            "-o",
            "--output",
            type=str,
            default="job-details.csv",
            help="Output CSV file path (default: job-details.csv)",
        )
        parser.add_argument(
            "-d",
            "--dataset",
            type=str,
            default=None,
            help="Filter to a specific dataset UUID",
        )

    def handle(self, *args, **options):
        file_path = options["file"]
        output_path = options["output"]
        dataset_id = options["dataset"]

        # Read filenames from the text file
        try:
            with open(file_path) as f:
                filenames = [line.strip() for line in f if line.strip()]
        except FileNotFoundError:
            raise CommandError(f"File not found: {file_path}")

        if not filenames:
            self.stdout.write(self.style.WARNING("No filenames found in the file."))
            return

        self.stdout.write(f"Read {len(filenames)} filename(s) from {file_path}")

        # Build queryset
        queryset = Job.objects.filter(file_name__in=filenames).select_related(
            "dataset", "assigned_annotator", "assigned_qa"
        )

        if dataset_id:
            try:
                Dataset.objects.get(pk=dataset_id)
            except (Dataset.DoesNotExist, ValueError):
                raise CommandError(f"Dataset with ID '{dataset_id}' not found.")
            queryset = queryset.filter(dataset_id=dataset_id)

        # Report missing filenames
        found_filenames = set(queryset.values_list("file_name", flat=True))
        missing = set(filenames) - found_filenames

        self.stdout.write(f"Matched {queryset.count()} job(s) in the database.")

        if missing:
            self.stdout.write(
                self.style.WARNING(f"{len(missing)} filename(s) not found:")
            )
            for name in sorted(missing):
                self.stdout.write(f"  - {name}")

        # Build a lookup: filename -> list of jobs
        jobs_by_filename = {}
        for job in queryset.order_by("file_name", "dataset__name"):
            jobs_by_filename.setdefault(job.file_name, []).append(job)

        # Write CSV — iterate over input filenames to preserve order
        # and include blank rows for missing filenames
        header = [
            "id",
            "file_name",
            "dataset",
            "content_hash",
            "status",
            "assigned_annotator",
            "assigned_qa",
            "created_at",
            "updated_at",
        ]
        row_count = 0
        with open(output_path, "w", newline="") as csvfile:
            writer = csv.writer(csvfile)
            writer.writerow(header)
            for filename in filenames:
                jobs = jobs_by_filename.get(filename)
                if jobs:
                    for job in jobs:
                        writer.writerow([
                            str(job.id),
                            job.file_name,
                            job.dataset.name,
                            job.content_hash,
                            job.status,
                            job.assigned_annotator.email if job.assigned_annotator else "",
                            job.assigned_qa.email if job.assigned_qa else "",
                            job.created_at.isoformat(),
                            job.updated_at.isoformat(),
                        ])
                        row_count += 1
                else:
                    # Not found — write filename with blank details
                    writer.writerow(["", filename, "", "", "", "", "", "", ""])
                    row_count += 1

        self.stdout.write(
            self.style.SUCCESS(f"Exported {row_count} row(s) to {output_path}")
        )
