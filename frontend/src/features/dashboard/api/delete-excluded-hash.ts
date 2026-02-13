import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

async function deleteExcludedHash(id: string) {
  await apiClient.delete(`/excluded-hashes/${id}/`);
}

export function useDeleteExcludedHash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteExcludedHash,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["excluded-hashes"] });
      toast.success("Hash removed from blocklist");
    },
  });
}
