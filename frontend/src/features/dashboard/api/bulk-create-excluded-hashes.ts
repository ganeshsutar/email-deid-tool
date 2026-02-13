import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface BulkCreateItem {
  content_hash: string;
  file_name?: string;
  note?: string;
}

interface BulkCreateResponse {
  created: number;
  skipped: number;
  errors: { index: number; error: string }[];
}

async function bulkCreateExcludedHashes(
  items: BulkCreateItem[],
): Promise<BulkCreateResponse> {
  const response = await apiClient.post("/excluded-hashes/bulk-create/", {
    items,
  });
  return response.data;
}

export function useBulkCreateExcludedHashes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bulkCreateExcludedHashes,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["excluded-hashes"] });
      toast.success(
        `Imported: ${data.created} created, ${data.skipped} skipped${data.errors.length > 0 ? `, ${data.errors.length} errors` : ""}`,
      );
    },
  });
}
