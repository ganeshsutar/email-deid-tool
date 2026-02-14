import { Link } from "@tanstack/react-router";
import { Upload, UserPlus, ShieldCheck, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link to="/admin/datasets">
          <Upload className="h-4 w-4 mr-1.5" />
          Upload Dataset
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link to="/admin/job-assignment">
          <UserPlus className="h-4 w-4 mr-1.5" />
          Assign Annotation Jobs
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link to="/admin/job-assignment">
          <ShieldCheck className="h-4 w-4 mr-1.5" />
          Assign QA Jobs
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link to="/admin/export">
          <Download className="h-4 w-4 mr-1.5" />
          Export Delivered Jobs
        </Link>
      </Button>
    </div>
  );
}
