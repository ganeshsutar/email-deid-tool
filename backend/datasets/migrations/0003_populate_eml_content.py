"""Data migration: read .eml files from disk and store content in eml_content."""

from django.db import migrations


def populate_eml_content(apps, schema_editor):
    Job = apps.get_model("datasets", "Job")
    for job in Job.objects.filter(eml_content="").exclude(file_path="").iterator():
        try:
            with open(job.file_path, "r", encoding="utf-8") as f:
                job.eml_content = f.read()
        except FileNotFoundError:
            continue
        except UnicodeDecodeError:
            with open(job.file_path, "r", encoding="latin-1") as f:
                job.eml_content = f.read()
        job.save(update_fields=["eml_content"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("datasets", "0002_job_eml_content"),
    ]

    operations = [
        migrations.RunPython(populate_eml_content, noop),
    ]
