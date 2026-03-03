# Dashboard Stats Cards — Query Reference

Maps each dashboard stat card to its backend query logic.

## Overview Row

| Card | Backend Field | Query |
|------|--------------|-------|
| Total Datasets | `total_datasets` | `Dataset.objects.count()` |
| Total Jobs | `total_jobs` | `Job.objects.count()` |
| Delivered | `delivered` | `Job.objects.filter(status=DELIVERED)` |
| Discarded | `discarded` | `Job.objects.filter(status=DISCARDED)` |

## Annotation Row

| Card | Backend Field | Query | Included Statuses |
|------|--------------|-------|-------------------|
| Assigned | `ann_assigned` | `Job.objects.filter(assigned_annotator__isnull=False)` | Any status with an annotator assigned |
| In Progress | `ann_in_progress` | `Job.objects.filter(status=ANNOTATION_IN_PROGRESS)` | ANNOTATION_IN_PROGRESS only |
| Completed | `ann_completed` | `Job.objects.filter(assigned_annotator__isnull=False, status__in=[...])` | SUBMITTED_FOR_QA, ASSIGNED_QA, QA_IN_PROGRESS, QA_ACCEPTED, QA_REJECTED, DELIVERED |

**Note:** `ann_completed` includes QA_REJECTED because the annotator *did* complete annotation — the job was rejected during QA review, not during annotation.

## QA Review Row

| Card | Backend Field | Query | Included Statuses |
|------|--------------|-------|-------------------|
| Assigned | `qa_assigned` | `Job.objects.filter(assigned_qa__isnull=False)` | Any status with a QA reviewer assigned |
| In Progress | `qa_in_progress` | `Job.objects.filter(status=QA_IN_PROGRESS)` | QA_IN_PROGRESS only |
| Completed | `qa_completed` | `Job.objects.filter(assigned_qa__isnull=False, status__in=[...])` | QA_ACCEPTED, QA_REJECTED, DELIVERED |

## Relationships

- `qa_assigned >= qa_in_progress + qa_completed` (assigned includes all QA-touched jobs)
- `ann_completed >= qa_assigned` (annotation must complete before QA assignment)
