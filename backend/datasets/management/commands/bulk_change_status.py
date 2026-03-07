import csv

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Count

from datasets.models import Dataset, Job


class Command(BaseCommand):
    help = "Bulk change the status of jobs by reading filenames from a text file."

    def add_arguments(self, parser):
        parser.add_argument(
            "file",
            type=str,
            help="Path to a text file with one filename per line",
        )
        parser.add_argument(
            "-s",
            "--status",
            type=str,
            required=True,
            choices=[s.value for s in Job.Status],
            help="Target status to set on matching jobs",
        )
        parser.add_argument(
            "-d",
            "--dataset",
            type=str,
            default=None,
            help="Filter to a specific dataset UUID",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview changes without writing to the database",
        )
        parser.add_argument(
            "--export-duplicates",
            type=str,
            nargs="?",
            const="duplicate-filenames.csv",
            default=None,
            help="Export duplicate filenames (matching multiple jobs) to a CSV file (default: duplicate-filenames.csv)",
        )

    def handle(self, *args, **options):
        file_path = options["file"]
        target_status = options["status"]
        dataset_id = options["dataset"]
        dry_run = options["dry_run"]

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
        queryset = Job.objects.filter(file_name__in=filenames)

        if dataset_id:
            try:
                Dataset.objects.get(pk=dataset_id)
            except (Dataset.DoesNotExist, ValueError):
                raise CommandError(f"Dataset with ID '{dataset_id}' not found.")
            queryset = queryset.filter(dataset_id=dataset_id)

        # Find which filenames matched
        found_filenames = set(queryset.values_list("file_name", flat=True))
        missing = set(filenames) - found_filenames
        match_count = queryset.count()

        self.stdout.write(f"Matched {match_count} job(s) in the database.")

        if missing:
            self.stdout.write(
                self.style.WARNING(f"{len(missing)} filename(s) not found:")
            )
            for name in sorted(missing):
                self.stdout.write(f"  - {name}")

        # Export duplicates if requested
        export_duplicates = options["export_duplicates"]
        if export_duplicates:
            dupes = (
                queryset.values("file_name")
                .annotate(job_count=Count("id"))
                .filter(job_count__gt=1)
                .order_by("file_name")
            )
            if dupes:
                # Get full details for duplicate filenames
                dupe_names = [d["file_name"] for d in dupes]
                dupe_jobs = (
                    queryset.filter(file_name__in=dupe_names)
                    .select_related("dataset")
                    .order_by("file_name", "dataset__name")
                )
                with open(export_duplicates, "w", newline="") as csvfile:
                    writer = csv.writer(csvfile)
                    writer.writerow(["file_name", "dataset", "job_id", "status"])
                    for job in dupe_jobs:
                        writer.writerow(
                            [job.file_name, job.dataset.name, str(job.id), job.status]
                        )
                self.stdout.write(
                    self.style.SUCCESS(
                        f"Exported {dupe_jobs.count()} rows for {len(dupe_names)} duplicate filename(s) to {export_duplicates}"
                    )
                )
            else:
                self.stdout.write("No duplicate filenames found.")

        if match_count == 0:
            self.stdout.write(self.style.WARNING("No jobs to update."))
            return

        if dry_run:
            self.stdout.write(
                self.style.NOTICE(
                    f"[DRY RUN] Would update {match_count} job(s) to status '{target_status}'."
                )
            )
            return

        updated = queryset.update(status=target_status)
        self.stdout.write(
            self.style.SUCCESS(
                f"Updated {updated} job(s) to status '{target_status}'."
            )
        )
