import { useMemo, useState } from "react";
import { Check, Flag, Pencil, Plus, Trash2, X } from "lucide-react";
import type { WorkspaceAnnotation } from "@/types/models";
import { AnnotationQAStatus } from "@/types/enums";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface AnnotationsReviewListTabProps {
  annotations: WorkspaceAnnotation[];
  annotationStatuses: Map<string, AnnotationQAStatus>;
  annotationNotes: Map<string, string>;
  onAnnotationClick: (id: string) => void;
  onSetNote: (id: string, note: string) => void;
  showActions?: boolean;
  editMode?: boolean;
  onMarkOK?: (id: string) => void;
  onFlag?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const statusIcons: Record<AnnotationQAStatus, React.ReactNode> = {
  [AnnotationQAStatus.PENDING]: <span className="text-muted-foreground text-xs">-</span>,
  [AnnotationQAStatus.OK]: <Check className="h-3 w-3 text-green-600" />,
  [AnnotationQAStatus.FLAGGED]: <Flag className="h-3 w-3 text-yellow-600" />,
  [AnnotationQAStatus.QA_ADDED]: <Plus className="h-3 w-3 text-blue-600" />,
  [AnnotationQAStatus.DELETED]: <X className="h-3 w-3 text-red-600" />,
};

const statusRowClasses: Record<AnnotationQAStatus, string> = {
  [AnnotationQAStatus.PENDING]: "",
  [AnnotationQAStatus.OK]: "bg-green-50/50 dark:bg-green-950/10",
  [AnnotationQAStatus.FLAGGED]: "bg-yellow-50/50 dark:bg-yellow-950/10",
  [AnnotationQAStatus.QA_ADDED]: "bg-blue-50/50 dark:bg-blue-950/10",
  [AnnotationQAStatus.DELETED]: "bg-red-50/50 dark:bg-red-950/10 line-through opacity-60",
};

export function AnnotationsReviewListTab({
  annotations,
  annotationStatuses,
  annotationNotes,
  onAnnotationClick,
  onSetNote,
  showActions,
  editMode,
  onMarkOK,
  onFlag,
  onEdit,
  onDelete,
}: AnnotationsReviewListTabProps) {
  const [filter, setFilter] = useState("all");

  const counts = useMemo(() => {
    const c = { ok: 0, flagged: 0, added: 0, deleted: 0, pending: 0 };
    annotationStatuses.forEach((status) => {
      if (status === AnnotationQAStatus.OK) c.ok++;
      else if (status === AnnotationQAStatus.FLAGGED) c.flagged++;
      else if (status === AnnotationQAStatus.QA_ADDED) c.added++;
      else if (status === AnnotationQAStatus.DELETED) c.deleted++;
      else c.pending++;
    });
    return c;
  }, [annotationStatuses]);

  const filtered = useMemo(() => {
    const sorted = [...annotations].sort(
      (a, b) => a.startOffset - b.startOffset,
    );
    if (filter === "all") return sorted;
    return sorted.filter((ann) => {
      const status = annotationStatuses.get(ann.id);
      return status === filter;
    });
  }, [annotations, annotationStatuses, filter]);

  return (
    <div className="flex flex-col h-full" data-testid="annotations-review-list">
      <div className="flex items-center gap-2 p-2 border-b text-xs">
        <span className="text-green-600">{counts.ok} OK</span>
        <span className="text-yellow-600">{counts.flagged} Flagged</span>
        <span className="text-blue-600">{counts.added} Added</span>
        <span className="text-red-600">{counts.deleted} Deleted</span>
        <span className="text-muted-foreground">{counts.pending} Pending</span>
        <div className="ml-auto">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-6 text-xs w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value={AnnotationQAStatus.OK}>OK</SelectItem>
              <SelectItem value={AnnotationQAStatus.FLAGGED}>Flagged</SelectItem>
              <SelectItem value={AnnotationQAStatus.QA_ADDED}>Added</SelectItem>
              <SelectItem value={AnnotationQAStatus.DELETED}>Deleted</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead className="w-20">Tag</TableHead>
              <TableHead className="w-28">Class</TableHead>
              <TableHead>Text</TableHead>
              <TableHead className="w-32">Note</TableHead>
              {showActions && <TableHead className="w-28">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showActions ? 6 : 5}
                  className="text-center text-muted-foreground py-8"
                >
                  No annotations match filter
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((ann) => {
                const status = annotationStatuses.get(ann.id) ?? AnnotationQAStatus.PENDING;
                const note = annotationNotes.get(ann.id) ?? "";
                return (
                  <TableRow
                    key={ann.id}
                    className={`cursor-pointer hover:bg-muted/50 ${statusRowClasses[status]}`}
                    onClick={() => onAnnotationClick(ann.id)}
                    data-testid="annotation-list-item"
                  >
                    <TableCell className="text-center">
                      {statusIcons[status]}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {ann.tag}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
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
                      className="font-mono text-xs truncate max-w-[100px]"
                      title={ann.originalText}
                    >
                      {ann.originalText}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Input
                        className="h-6 text-xs"
                        placeholder="Add note..."
                        value={note}
                        onChange={(e) => onSetNote(ann.id, e.target.value)}
                      />
                    </TableCell>
                    {showActions && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-50"
                            disabled={status === AnnotationQAStatus.OK}
                            onClick={() => onMarkOK?.(ann.id)}
                            title="Mark OK"
                            data-testid="annotation-ok-button"
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                            disabled={status === AnnotationQAStatus.FLAGGED}
                            onClick={() => onFlag?.(ann.id)}
                            title="Flag"
                            data-testid="annotation-flag-button"
                          >
                            <Flag className="h-3 w-3" />
                          </Button>
                          {editMode && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => onEdit?.(ann.id)}
                                title="Change class"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive"
                                onClick={() => onDelete?.(ann.id)}
                                title="Delete"
                                data-testid="annotation-delete-button"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
