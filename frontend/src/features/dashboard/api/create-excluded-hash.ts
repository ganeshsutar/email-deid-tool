import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface CreateExcludedHashParams {
  contentHash: string;
  fileName?: string;
  note?: string;
}

async function createExcludedHash(params: CreateExcludedHashParams) {
  const response = await apiClient.post("/excluded-hashes/", {
    content_hash: params.contentHash,
    file_name: params.fileName ?? "",
    note: params.note ?? "",
  });
  return response.data;
}

export function useCreateExcludedHash() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createExcludedHash,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["excluded-hashes"] });
      toast.success("Hash added to blocklist");
    },
  });
}
