import { apiClient } from "@/lib/api-client";

interface DownloadDatasetCsvParams {
  datasetId: string;
  datasetName: string;
  includeAnnotations: boolean;
}

export async function downloadDatasetCsv(params: DownloadDatasetCsvParams) {
  const response = await apiClient.get(
    `/datasets/${params.datasetId}/csv-export/`,
    {
      params: { include_annotations: params.includeAnnotations },
      responseType: "blob",
    },
  );

  const blob = new Blob([response.data], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const suffix = params.includeAnnotations
    ? "_jobs_with_annotations"
    : "_jobs";
  a.download = `${params.datasetName}${suffix}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
