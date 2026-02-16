import { apiClient } from "@/lib/api-client";

interface DownloadJobCsvParams {
  status?: string;
  datasetIds?: string[];
}

export async function downloadJobCsv(params: DownloadJobCsvParams) {
  const queryParams: Record<string, string> = {};
  if (params.status) {
    queryParams.status = params.status;
  }
  if (params.datasetIds && params.datasetIds.length > 0) {
    queryParams.dataset_ids = params.datasetIds.join(",");
  }

  const response = await apiClient.get("/dashboard/job-csv-export/", {
    params: queryParams,
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = params.status
    ? `jobs_${params.status.toLowerCase()}.csv`
    : "jobs_all.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
