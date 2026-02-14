import { useState, useMemo } from "react";
import { ArrowUp, ArrowDown, Pencil, Trash2 } from "lucide-react";
import type { WorkspaceAnnotation } from "@/types/models";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const SortKey = {
  TAG: "tag",
  CLASS: "classDisplayLabel",
  TEXT: "originalText",
  SECTION: "sectionIndex",
  START: "startOffset",
  END: "endOffset",
} as const;
type SortKey = (typeof SortKey)[keyof typeof SortKey];

type SortDirection = "asc" | "desc";

const STRING_KEYS = new Set<SortKey>(["tag", "classDisplayLabel", "originalText"]);

interface AnnotationsListTabProps {
  annotations: WorkspaceAnnotation[];
  onAnnotationClick: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  showActions?: boolean;
}

export function AnnotationsListTab({
  annotations,
  onAnnotationClick,
  onEdit,
  onDelete,
  showActions = true,
}: AnnotationsListTabProps) {
  const [sortKey, setSortKey] = useState<SortKey>("tag");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const sorted = useMemo(() => {
    const dir = sortDirection === "asc" ? 1 : -1;
    return [...annotations].sort((a, b) => {
      if (STRING_KEYS.has(sortKey)) {
        const cmp = (a[sortKey] as string).localeCompare(b[sortKey] as string);
        return cmp * dir;
      }
      return ((a[sortKey] as number) - (b[sortKey] as number)) * dir;
    });
  }, [annotations, sortKey, sortDirection]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Table aria-label="Annotations list">
          <TableHeader>
            <TableRow>
              {([
                { key: "tag" as SortKey, label: "Tag", className: "w-24" },
                { key: "classDisplayLabel" as SortKey, label: "Class", className: "w-32" },
                { key: "originalText" as SortKey, label: "Text", className: "" },
                { key: "sectionIndex" as SortKey, label: "Sec", className: "w-10 text-right" },
                { key: "startOffset" as SortKey, label: "Start", className: "w-16 text-right" },
                { key: "endOffset" as SortKey, label: "End", className: "w-16 text-right" },
              ]).map((col) => {
                const active = sortKey === col.key;
                const Icon = active && sortDirection === "desc" ? ArrowDown : ArrowUp;
                return (
                  <TableHead
                    key={col.key}
                    className={`${col.className} cursor-pointer select-none`}
                    onClick={() => handleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {col.label}
                      <Icon className={`h-3 w-3 ${active ? "opacity-100" : "opacity-0"}`} />
                    </span>
                  </TableHead>
                );
              })}
              {showActions && <TableHead className="w-20">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showActions ? 7 : 6}
                  className="text-center text-muted-foreground py-8"
                >
                  No annotations yet
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((ann) => (
                <TableRow
                  key={ann.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onAnnotationClick(ann.id)}
                  data-testid="annotation-list-item"
                >
                  <TableCell className="font-mono text-xs" data-testid="annotation-tag">
                    {ann.tag}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-3 w-3 rounded shrink-0"
                        style={{ backgroundColor: ann.classColor }}
                      />
                      <span className="text-xs truncate">
                        {ann.classDisplayLabel}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell
                    className="font-mono text-xs truncate max-w-[150px]"
                    title={ann.originalText}
                  >
                    {ann.originalText}
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {ann.sectionIndex}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {ann.startOffset}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    {ann.endOffset}
                  </TableCell>
                  {showActions && (
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit?.(ann.id);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          data-testid="annotation-delete-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete?.(ann.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
