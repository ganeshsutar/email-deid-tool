import { Link } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import type { RecentDataset } from "../api/dashboard-mapper";

interface RecentDatasetsTableProps {
  datasets: RecentDataset[];
}

export function RecentDatasetsTable({ datasets }: RecentDatasetsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Datasets</CardTitle>
        <CardDescription>
          5 most recently uploaded datasets
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Upload Date</TableHead>
              <TableHead>Uploaded By</TableHead>
              <TableHead className="text-right">Files</TableHead>
              <TableHead className="text-right">Delivered</TableHead>
              <TableHead className="w-[200px]">Progress</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {datasets.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground h-24"
                >
                  No datasets yet
                </TableCell>
              </TableRow>
            ) : (
              datasets.map((ds) => {
                const total = ds.fileCount || 1;
                const delivered = ds.statusSummary["DELIVERED"] ?? 0;
                const progress = Math.round((delivered / total) * 100);
                return (
                  <TableRow key={ds.id}>
                    <TableCell className="font-medium">{ds.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(ds.uploadDate), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {ds.uploadedBy?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {ds.fileCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {delivered}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-2" />
                        <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                          {progress}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to="/admin/datasets/$id"
                        params={{ id: ds.id }}
                        className="text-xs text-primary hover:underline"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CardFooter>
        <Link
          to="/admin/datasets"
          className="text-sm text-primary hover:underline"
        >
          View all datasets
        </Link>
      </CardFooter>
    </Card>
  );
}
