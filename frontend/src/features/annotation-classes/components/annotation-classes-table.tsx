import { Pencil, Tags, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AnnotationClass } from "@/types/models";

interface AnnotationClassesTableProps {
  classes: AnnotationClass[];
  onEdit: (cls: AnnotationClass) => void;
  onDelete: (cls: AnnotationClass) => void;
}

export function AnnotationClassesTable({
  classes,
  onEdit,
  onDelete,
}: AnnotationClassesTableProps) {
  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[50px]">Color</TableHead>
            <TableHead>Display Label</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {classes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="p-0">
                <EmptyState
                  icon={Tags}
                  title="No annotation classes"
                  description="Create your first annotation class to get started."
                />
              </TableCell>
            </TableRow>
          ) : (
            classes.map((cls) => (
              <TableRow key={cls.id}>
                <TableCell>
                  <span
                    className="inline-block h-5 w-5 rounded border align-middle"
                    style={{ backgroundColor: cls.color }}
                  />
                </TableCell>
                <TableCell className="font-medium">{cls.displayLabel}</TableCell>
                <TableCell>
                  <code className="text-sm">{cls.name}</code>
                </TableCell>
                <TableCell className="max-w-[300px] truncate">
                  {cls.description || "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(cls)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(cls)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
