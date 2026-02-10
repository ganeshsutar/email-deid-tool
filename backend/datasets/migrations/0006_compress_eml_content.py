"""Data migration: compress eml_content text into eml_content_compressed."""

import zlib

from django.db import migrations


def compress_eml_content(apps, schema_editor):
    Job = apps.get_model("datasets", "Job")
    for job in Job.objects.exclude(eml_content="").iterator():
        job.eml_content_compressed = zlib.compress(job.eml_content.encode("utf-8"))
        job.save(update_fields=["eml_content_compressed"])


def decompress_eml_content(apps, schema_editor):
    Job = apps.get_model("datasets", "Job")
    for job in Job.objects.exclude(eml_content_compressed=b"").iterator():
        job.eml_content = zlib.decompress(job.eml_content_compressed).decode("utf-8")
        job.save(update_fields=["eml_content"])


class Migration(migrations.Migration):

    dependencies = [
        ("datasets", "0005_add_eml_content_compressed"),
    ]

    operations = [
        migrations.RunPython(compress_eml_content, decompress_eml_content),
    ]
