import type { VersionAnnotation } from "../api/history-mapper";

export interface DiffEntry {
  type: "added" | "removed" | "modified" | "unchanged";
  annotation: VersionAnnotation;
  previousAnnotation?: VersionAnnotation;
}

export interface DiffResult {
  added: DiffEntry[];
  removed: DiffEntry[];
  modified: DiffEntry[];
  unchanged: DiffEntry[];
  summary: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
  };
}

export function computeVersionDiff(
  versionA: VersionAnnotation[],
  versionB: VersionAnnotation[],
): DiffResult {
  const keyFn = (a: VersionAnnotation) => `${a.sectionIndex}-${a.startOffset}-${a.endOffset}`;

  const mapA = new Map<string, VersionAnnotation>();
  for (const ann of versionA) {
    mapA.set(keyFn(ann), ann);
  }

  const mapB = new Map<string, VersionAnnotation>();
  for (const ann of versionB) {
    mapB.set(keyFn(ann), ann);
  }

  const added: DiffEntry[] = [];
  const removed: DiffEntry[] = [];
  const modified: DiffEntry[] = [];
  const unchanged: DiffEntry[] = [];

  // Check items in B against A
  for (const [key, annB] of mapB) {
    const annA = mapA.get(key);
    if (!annA) {
      added.push({ type: "added", annotation: annB });
    } else if (annA.classId !== annB.classId || annA.tag !== annB.tag) {
      modified.push({
        type: "modified",
        annotation: annB,
        previousAnnotation: annA,
      });
    } else {
      unchanged.push({ type: "unchanged", annotation: annB });
    }
  }

  // Check items in A not in B
  for (const [key, annA] of mapA) {
    if (!mapB.has(key)) {
      removed.push({ type: "removed", annotation: annA });
    }
  }

  return {
    added,
    removed,
    modified,
    unchanged,
    summary: {
      added: added.length,
      removed: removed.length,
      modified: modified.length,
      unchanged: unchanged.length,
    },
  };
}
