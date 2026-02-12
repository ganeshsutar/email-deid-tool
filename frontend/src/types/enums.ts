export const UserRole = {
  ADMIN: "ADMIN",
  ANNOTATOR: "ANNOTATOR",
  QA: "QA",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const JobStatus = {
  UPLOADED: "UPLOADED",
  ASSIGNED_ANNOTATOR: "ASSIGNED_ANNOTATOR",
  ANNOTATION_IN_PROGRESS: "ANNOTATION_IN_PROGRESS",
  SUBMITTED_FOR_QA: "SUBMITTED_FOR_QA",
  ASSIGNED_QA: "ASSIGNED_QA",
  QA_IN_PROGRESS: "QA_IN_PROGRESS",
  QA_REJECTED: "QA_REJECTED",
  QA_ACCEPTED: "QA_ACCEPTED",
  DELIVERED: "DELIVERED",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const DatasetStatus = {
  UPLOADING: "UPLOADING",
  EXTRACTING: "EXTRACTING",
  READY: "READY",
  FAILED: "FAILED",
} as const;
export type DatasetStatus = (typeof DatasetStatus)[keyof typeof DatasetStatus];

export const AnnotationSource = {
  ANNOTATOR: "ANNOTATOR",
  QA: "QA",
} as const;
export type AnnotationSource =
  (typeof AnnotationSource)[keyof typeof AnnotationSource];

export const QADecision = {
  ACCEPT: "ACCEPT",
  REJECT: "REJECT",
} as const;
export type QADecision = (typeof QADecision)[keyof typeof QADecision];

export const SectionType = {
  HEADERS: "HEADERS",
  TEXT_PLAIN: "TEXT_PLAIN",
  TEXT_HTML: "TEXT_HTML",
} as const;
export type SectionType = (typeof SectionType)[keyof typeof SectionType];

export const AnnotationQAStatus = {
  PENDING: "PENDING",
  OK: "OK",
  FLAGGED: "FLAGGED",
  QA_ADDED: "QA_ADDED",
  DELETED: "DELETED",
} as const;
export type AnnotationQAStatus =
  (typeof AnnotationQAStatus)[keyof typeof AnnotationQAStatus];
