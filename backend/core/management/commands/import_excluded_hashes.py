import csv
import re

from django.core.management.base import BaseCommand

from core.models import ExcludedFileHash


class Command(BaseCommand):
    help = "Import excluded file hashes from a CSV file (columns: filename, hash)"

    def add_arguments(self, parser):
        parser.add_argument("csv_path", type=str, help="Path to the CSV file")
        parser.add_argument(
            "--has-header",
            action="store_true",
            help="Skip the first row (header row)",
        )
        parser.add_argument(
            "--note",
            type=str,
            default="",
            help="Note to attach to all imported hashes",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Validate and report without writing to the database",
        )

    def handle(self, *args, **options):
        csv_path = options["csv_path"]
        has_header = options["has_header"]
        note = options["note"]
        dry_run = options["dry_run"]

        hex_pattern = re.compile(r"^[0-9a-f]{64}$")

        to_import = []
        seen_in_csv = set()
        csv_duplicates = 0
        errors = []

        with open(csv_path, "r", newline="") as f:
            reader = csv.reader(f)
            if has_header:
                next(reader, None)

            for row_num, row in enumerate(reader, start=2 if has_header else 1):
                if not row or len(row) < 2:
                    errors.append(f"Row {row_num}: insufficient columns")
                    continue

                file_name = row[0].strip()
                content_hash = row[1].strip().lower()

                if not hex_pattern.match(content_hash):
                    errors.append(
                        f"Row {row_num}: invalid hash '{content_hash[:20]}...'"
                    )
                    continue

                if content_hash in seen_in_csv:
                    csv_duplicates += 1
                    continue

                seen_in_csv.add(content_hash)
                to_import.append((file_name, content_hash))

        # Check which already exist in DB
        existing = set(
            ExcludedFileHash.objects.filter(
                content_hash__in=[h for _, h in to_import]
            ).values_list("content_hash", flat=True)
        )

        new_items = [(fn, h) for fn, h in to_import if h not in existing]
        already_existed = len(to_import) - len(new_items)

        self.stdout.write(f"\nCSV rows parsed: {len(seen_in_csv) + csv_duplicates + len(errors)}")
        self.stdout.write(f"  Valid unique hashes: {len(to_import)}")
        self.stdout.write(f"  CSV duplicates skipped: {csv_duplicates}")
        self.stdout.write(f"  Parse errors: {len(errors)}")
        self.stdout.write(f"  Already in blocklist: {already_existed}")
        self.stdout.write(f"  New to create: {len(new_items)}")

        if errors:
            self.stdout.write(self.style.WARNING("\nErrors:"))
            for err in errors[:20]:
                self.stdout.write(f"  {err}")
            if len(errors) > 20:
                self.stdout.write(f"  ... and {len(errors) - 20} more")

        if dry_run:
            self.stdout.write(self.style.SUCCESS("\n[DRY RUN] No changes made."))
            return

        if new_items:
            objects = [
                ExcludedFileHash(
                    content_hash=content_hash,
                    file_name=file_name,
                    note=note,
                )
                for file_name, content_hash in new_items
            ]
            ExcludedFileHash.objects.bulk_create(objects, ignore_conflicts=True)
            self.stdout.write(
                self.style.SUCCESS(f"\nCreated {len(new_items)} excluded hash(es).")
            )
        else:
            self.stdout.write(self.style.WARNING("\nNo new hashes to import."))
