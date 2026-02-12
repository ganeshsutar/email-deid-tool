import glob
import hashlib
import json
import re
import zlib
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from accounts.models import User
from annotations.models import Annotation, AnnotationVersion
from core.section_extractor import extract_sections
from core.models import AnnotationClass
from datasets.models import Dataset, Job

COLOR_PALETTE = [
    "#E53E3E", "#DD6B20", "#D69E2E", "#38A169", "#3182CE",
    "#805AD5", "#D53F8C", "#319795", "#718096", "#2B6CB0",
]

FILE_KEY_RE = re.compile(r"^\d+_job_(\d+)_task_\d+_assets_(.+)$")
TYPE_RE = re.compile(r"^(.+?)_(\d+)$")


class Command(BaseCommand):
    help = "Import pre-labeled annotation data from external pipeline into a dataset"

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
            default=None,
            help="Path to data directory (default: <project_root>/data)",
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
            help="Validate without writing to DB",
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
            raise CommandError(
                "Provide either --dataset-id or --create-dataset"
            )

        # Resolve data directory
        if options["data_dir"]:
            data_dir = Path(options["data_dir"])
        else:
            data_dir = Path(__file__).resolve().parents[4] / "data"

        if not data_dir.is_dir():
            raise CommandError(f"Data directory not found: {data_dir}")

        annotations_dir = data_dir / "annotations"
        email_data_dir = data_dir / "email-data"
        if not annotations_dir.is_dir():
            raise CommandError(f"Annotations directory not found: {annotations_dir}")
        if not email_data_dir.is_dir():
            raise CommandError(f"Email data directory not found: {email_data_dir}")

        # Validate annotator
        annotator = None
        if options["annotator_email"]:
            try:
                annotator = User.objects.get(email=options["annotator_email"])
            except User.DoesNotExist:
                raise CommandError(
                    f"User not found: {options['annotator_email']}"
                )

        # Resolve dataset: look up existing or create new
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

        # Pre-load existing annotation classes into cache
        class_cache = {ac.name: ac for ac in AnnotationClass.objects.all()}
        color_index = len(class_cache) % len(COLOR_PALETTE)

        # Collect existing content hashes for this dataset
        existing_hashes = set(
            Job.objects.filter(dataset=dataset)
            .exclude(content_hash="")
            .values_list("content_hash", flat=True)
        )

        # Process annotation files
        json_files = sorted(annotations_dir.glob("*.json"))
        if not json_files:
            raise CommandError(f"No JSON files found in {annotations_dir}")

        self.stdout.write(f"Found {len(json_files)} annotation files")
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN — no DB writes"))

        imported = 0
        skipped = 0
        errors = 0
        total_annotations = 0

        for json_path in json_files:
            try:
                result = self._process_file(
                    json_path=json_path,
                    email_data_dir=email_data_dir,
                    dataset=dataset,
                    annotator=annotator,
                    target_status=target_status,
                    class_cache=class_cache,
                    color_index=color_index,
                    existing_hashes=existing_hashes,
                    dry_run=dry_run,
                )
            except SkipFile as e:
                self.stdout.write(self.style.WARNING(f"  SKIP {json_path.name}: {e}"))
                skipped += 1
                continue
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  ERROR {json_path.name}: {e}"))
                errors += 1
                continue

            color_index = result["color_index"]
            imported += 1
            total_annotations += result["annotation_count"]
            self.stdout.write(
                f"  OK {json_path.name} → {result['file_name']} "
                f"({result['annotation_count']} annotations)"
            )

        # Update dataset
        if not dry_run and imported > 0:
            dataset.file_count = Job.objects.filter(dataset=dataset).count()
            dataset.status = Dataset.Status.READY
            dataset.save(update_fields=["file_count", "status"])

        self.stdout.write(
            self.style.SUCCESS(
                f"\nDone: {imported} imported, {skipped} skipped, {errors} errors, "
                f"{total_annotations} total annotations"
            )
        )
        if dataset.pk:
            self.stdout.write(f"Dataset ID: {dataset.pk}")

    def _process_file(
        self,
        json_path,
        email_data_dir,
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

        file_key = data.get("file_key", "")
        entities = (
            data.get("raw_responses", {}).get("openai", {}).get("Entities", [])
        )

        # Parse file_key
        match = FILE_KEY_RE.match(file_key)
        if not match:
            raise SkipFile(f"Cannot parse file_key: {file_key}")
        job_id, asset_name = match.groups()

        # Find EML file
        eml_pattern = str(
            email_data_dir / "job" / job_id / "task" / "*" / "assets" / "*" / f"{asset_name}.eml"
        )
        eml_matches = glob.glob(eml_pattern)
        if not eml_matches:
            raise SkipFile(f"EML not found: {asset_name}.eml (job {job_id})")
        eml_path = eml_matches[0]

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

        # Extract sections for section-based offsets
        sections = extract_sections(eml_text)
        raw_stripped = eml_text.replace("\r", "")
        file_name = f"{asset_name}.eml"

        # Dedup entities by (BeginOffset, EndOffset, Type)
        seen = set()
        unique_entities = []
        for entity in entities:
            key = (entity["BeginOffset"], entity["EndOffset"], entity["Type"])
            if key not in seen:
                seen.add(key)
                unique_entities.append(entity)

        # Sort entities by offset for sequential text matching
        unique_entities.sort(key=lambda e: e["BeginOffset"])

        # Track search positions per section for sequential matching
        search_positions = {s.index: 0 for s in sections}

        # Parse and validate entities, mapping to section-based offsets
        annotation_records = []
        for entity in unique_entities:
            text = entity["Text"]
            entity_type = entity["Type"]
            raw_start = entity["BeginOffset"]
            raw_end = entity["EndOffset"]

            # Parse type: EMAIL_ADDRESS_1 → class_name=email_address, tag=email_address_1
            type_match = TYPE_RE.match(entity_type)
            if type_match:
                class_name = type_match.group(1).lower()
                tag = f"[{entity_type.lower()}]"
            else:
                class_name = entity_type.lower()
                tag = f"[{entity_type.lower()}]"

            # Pre-check: validate text against raw content
            raw_text = raw_stripped[raw_start:raw_end]
            if raw_text != text:
                self.stdout.write(
                    self.style.WARNING(
                        f"    RAW MISMATCH in {file_name} at [{raw_start}:{raw_end}]: "
                        f"expected {text!r}, got {raw_text!r}"
                    )
                )

            # Find text in sections using sequential search
            section_index = None
            local_start = None
            local_end = None

            for section in sections:
                pos = section.content.find(text, search_positions[section.index])
                if pos != -1:
                    section_index = section.index
                    local_start = pos
                    local_end = pos + len(text)
                    search_positions[section.index] = local_end
                    break

            # Fallback: search from beginning of all sections
            if section_index is None:
                for section in sections:
                    pos = section.content.find(text)
                    if pos != -1:
                        section_index = section.index
                        local_start = pos
                        local_end = pos + len(text)
                        break

            if section_index is None:
                self.stdout.write(
                    self.style.WARNING(
                        f"    UNMAPPED in {file_name}: {text!r} not found in any section"
                    )
                )
                continue

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

            annotation_records.append({
                "class_name": class_name,
                "tag": tag,
                "section_index": section_index,
                "start_offset": local_start,
                "end_offset": local_end,
                "original_text": text,
                "annotation_class": class_cache.get(class_name),
            })

        if dry_run:
            return {
                "file_name": file_name,
                "annotation_count": len(annotation_records),
                "color_index": color_index,
            }

        # Create DB records within a savepoint
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
            "color_index": color_index,
        }


class SkipFile(Exception):
    pass
