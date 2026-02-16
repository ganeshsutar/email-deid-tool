import type {
  UserRole,
  UserStatus,
  JobStatus,
  DatasetStatus,
  AnnotationSource,
  QADecision,
} from "./enums";

export interface AvatarConfig {
  seed?: string;
  top?: string;
  accessories?: string;
  accessoriesProbability?: string;
  hairColor?: string;
  facialHair?: string;
  facialHairProbability?: string;
  clothing?: string;
  clothingGraphic?: string;
  eyes?: string;
  eyebrows?: string;
  mouth?: string;
  skinColor?: string;
  nose?: string;
  hatColor?: string;
  clothesColor?: string;
  accessoriesColor?: string;
  facialHairColor?: string;
  style?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  forcePasswordChange: boolean;
  avatarConfig: AvatarConfig | null;
  createdAt: string;
}

export interface Dataset {
  id: string;
  name: string;
  uploadedBy: User | null;
  uploadDate: string;
  fileCount: number;
  duplicateCount: number;
  excludedCount: number;
  status: DatasetStatus;
  errorMessage: string;
}

export interface Job {
  id: string;
  dataset: Dataset | string;
  fileName: string;
  status: JobStatus;
  assignedAnnotator: User | null;
  assignedQa: User | null;
  discardReason?: string;
  discardedBy?: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface AnnotationClass {
  id: string;
  name: string;
  displayLabel: string;
  color: string;
  description: string;
  createdBy: User | null;
  createdAt: string;
}

export interface AnnotationVersion {
  id: string;
  job: string;
  versionNumber: number;
  createdBy: User | null;
  source: AnnotationSource;
  createdAt: string;
}

export interface Annotation {
  id: string;
  annotationVersion: string;
  annotationClass: string | null;
  className: string;
  tag: string;
  startOffset: number;
  endOffset: number;
  originalText: string;
  createdAt: string;
}

export interface QAReviewVersion {
  id: string;
  job: string;
  versionNumber: number;
  annotationVersion: string;
  reviewedBy: User | null;
  decision: QADecision;
  comments: string;
  modificationsSummary: string;
  reviewedAt: string;
}

export interface ExportRecord {
  id: string;
  dataset: string;
  jobIds: string[];
  fileSize: number;
  exportedBy: User | null;
  exportedAt: string;
}

export interface DraftAnnotation {
  id: string;
  job: string;
  annotations: unknown[];
  updatedAt: string;
}

export interface PlatformSetting {
  id: number;
  key: string;
  value: string;
}

export interface WorkspaceAnnotation {
  id: string;
  classId: string;
  className: string;
  classColor: string;
  classDisplayLabel: string;
  tag: string;
  sectionIndex: number;
  startOffset: number;
  endOffset: number;
  originalText: string;
}

export interface EmailSection {
  index: number;
  type: string; // "HEADERS" | "TEXT_PLAIN" | "TEXT_HTML"
  label: string;
  content: string;
}

export interface ExcludedFileHash {
  id: string;
  contentHash: string;
  fileName: string;
  note: string;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
}
