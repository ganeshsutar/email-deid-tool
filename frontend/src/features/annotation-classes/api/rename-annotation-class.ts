import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { AnnotationClass } from "@/types/models";
import { mapAnnotationClass } from "./annotation-class-mapper";

interface RenameAnnotationClassData {
  id: string;
  name: string;
}

interface RenameAnnotationClassResponse {
  annotation_class: Record<string, unknown>;
  updated_annotations: number;
}

async function renameAnnotationClass({
  id,
  name,
}: RenameAnnotationClassData): Promise<{
  annotationClass: AnnotationClass;
  updatedAnnotations: number;
}> {
  const response = await apiClient.post<RenameAnnotationClassResponse>(
    `/annotation-classes/${id}/rename/`,
    { name },
  );
  return {
    annotationClass: mapAnnotationClass(response.data.annotation_class),
    updatedAnnotations: response.data.updated_annotations,
  };
}

export function useRenameAnnotationClass() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: renameAnnotationClass,
    onSuccess: (_data, _variables) => {
      queryClient.invalidateQueries({ queryKey: ["annotation-classes"] });
      const count = _data.updatedAnnotations;
      toast.success(
        count > 0
          ? `Annotation class renamed — ${count} annotation${count === 1 ? "" : "s"} updated`
          : "Annotation class renamed",
      );
    },
  });
}
