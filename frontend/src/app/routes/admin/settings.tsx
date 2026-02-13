import { useRef, useState } from "react";
import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  ShieldBan,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TableSkeleton } from "@/components/table-skeleton";
import { EmptyState } from "@/components/empty-state";
import { useBlindReviewSetting } from "@/features/dashboard/api/get-blind-review-setting";
import { useUpdateBlindReviewSetting } from "@/features/dashboard/api/update-blind-review-setting";
import { useMinAnnotationLengthSetting } from "@/features/dashboard/api/get-min-annotation-length-setting";
import { useUpdateMinAnnotationLengthSetting } from "@/features/dashboard/api/update-min-annotation-length-setting";
import { useDiscardReasons } from "@/features/dashboard/api/get-discard-reasons-setting";
import { useUpdateDiscardReasons } from "@/features/dashboard/api/update-discard-reasons-setting";
import { useExcludedHashes } from "@/features/dashboard/api/get-excluded-hashes";
import { useCreateExcludedHash } from "@/features/dashboard/api/create-excluded-hash";
import { useBulkCreateExcludedHashes } from "@/features/dashboard/api/bulk-create-excluded-hashes";
import { useDeleteExcludedHash } from "@/features/dashboard/api/delete-excluded-hash";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: blindReview, isLoading } = useBlindReviewSetting();
  const updateBlindReview = useUpdateBlindReviewSetting();

  const { data: minLengthSetting, isLoading: minLengthLoading } =
    useMinAnnotationLengthSetting();
  const updateMinLength = useUpdateMinAnnotationLengthSetting();
  const [minLengthValue, setMinLengthValue] = useState<number>(1);

  useEffect(() => {
    if (minLengthSetting) {
      setMinLengthValue(minLengthSetting.minLength);
    }
  }, [minLengthSetting]);

  const minLengthChanged = minLengthSetting
    ? minLengthValue !== minLengthSetting.minLength
    : false;

  const { data: discardReasonsData, isLoading: discardReasonsLoading } =
    useDiscardReasons();
  const updateDiscardReasons = useUpdateDiscardReasons();
  const [localReasons, setLocalReasons] = useState<string[]>([]);
  const [newReason, setNewReason] = useState("");

  useEffect(() => {
    if (discardReasonsData) {
      setLocalReasons(discardReasonsData.reasons);
    }
  }, [discardReasonsData]);

  const discardReasonsChanged = discardReasonsData
    ? JSON.stringify(localReasons) !== JSON.stringify(discardReasonsData.reasons)
    : false;

  function handleToggle(checked: boolean) {
    updateBlindReview.mutate({ enabled: checked });
  }

  function handleSaveMinLength() {
    const clamped = Math.max(1, minLengthValue);
    updateMinLength.mutate({ minLength: clamped });
  }

  function handleAddReason() {
    const trimmed = newReason.trim();
    if (trimmed && !localReasons.includes(trimmed)) {
      setLocalReasons((prev) => [...prev, trimmed]);
      setNewReason("");
    }
  }

  function handleRemoveReason(index: number) {
    setLocalReasons((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSaveDiscardReasons() {
    if (localReasons.length > 0) {
      updateDiscardReasons.mutate({ reasons: localReasons });
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Platform configuration and preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>QA Review Settings</CardTitle>
          <CardDescription>
            Configure how QA reviewers interact with annotations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between space-x-4">
            <div className="space-y-1">
              <Label htmlFor="blind-review" className="text-sm font-medium">
                Blind Review Mode
              </Label>
              <p className="text-sm text-muted-foreground">
                When enabled, QA reviewers cannot see which annotator worked on
                each job. This reduces bias and ensures objective quality
                assessment.
              </p>
            </div>
            <Switch
              id="blind-review"
              checked={blindReview?.enabled ?? false}
              onCheckedChange={handleToggle}
              disabled={isLoading || updateBlindReview.isPending}
              data-testid="blind-review-toggle"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Annotation Validation</CardTitle>
          <CardDescription>
            Configure validation rules for annotations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="min-annotation-length"
                className="text-sm font-medium"
              >
                Minimum Annotation Length
              </Label>
              <p className="text-sm text-muted-foreground">
                The minimum number of characters required for an annotation
                text selection. Annotations shorter than this will be rejected.
              </p>
              <div className="flex items-center gap-3">
                <Input
                  id="min-annotation-length"
                  type="number"
                  min={1}
                  value={minLengthValue}
                  onChange={(e) =>
                    setMinLengthValue(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-24"
                  disabled={minLengthLoading}
                />
                <Button
                  size="sm"
                  onClick={handleSaveMinLength}
                  disabled={
                    !minLengthChanged ||
                    minLengthLoading ||
                    updateMinLength.isPending
                  }
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discard Reasons</CardTitle>
          <CardDescription>
            Configure the list of reasons that annotators and QA reviewers can
            select when discarding a file
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {localReasons.map((reason, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{reason}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveReason(index)}
                  disabled={localReasons.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2 border-t">
              <Input
                placeholder="Add a reason..."
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddReason();
                  }
                }}
                className="flex-1"
                disabled={discardReasonsLoading}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleAddReason}
                disabled={!newReason.trim() || discardReasonsLoading}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                onClick={handleSaveDiscardReasons}
                disabled={
                  !discardReasonsChanged ||
                  discardReasonsLoading ||
                  updateDiscardReasons.isPending ||
                  localReasons.length === 0
                }
              >
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <ExcludedHashesCard />
    </div>
  );
}

const PAGE_SIZE = 10;

function ExcludedHashesCard() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [hashInput, setHashInput] = useState("");
  const [fileNameInput, setFileNameInput] = useState("");
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading } = useExcludedHashes({
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
  });

  const createHash = useCreateExcludedHash();
  const bulkCreate = useBulkCreateExcludedHashes();
  const deleteHash = useDeleteExcludedHash();

  const totalPages = data ? Math.ceil(data.count / PAGE_SIZE) : 0;

  function handleAddHash() {
    const trimmed = hashInput.trim().toLowerCase();
    if (!trimmed) return;
    createHash.mutate(
      { contentHash: trimmed, fileName: fileNameInput.trim() },
      {
        onSuccess: () => {
          setHashInput("");
          setFileNameInput("");
        },
      },
    );
  }

  function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());

      // Detect if first line is a header
      const firstLine = lines[0]?.toLowerCase() ?? "";
      const hasHeader =
        firstLine.includes("filename") || firstLine.includes("hash");
      const startIdx = hasHeader ? 1 : 0;

      const items: { content_hash: string; file_name: string }[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(",").map((s) => s.trim());
        if (parts.length >= 2) {
          items.push({ content_hash: parts[1], file_name: parts[0] });
        } else if (parts.length === 1 && parts[0]) {
          items.push({ content_hash: parts[0], file_name: "" });
        }
      }

      if (items.length > 0) {
        bulkCreate.mutate(items);
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Excluded File Hashes</CardTitle>
        <CardDescription>
          Pre-registered SHA-256 hashes that will be automatically blocked
          during dataset uploads.{" "}
          {data && (
            <span className="font-medium">
              {data.count} hash(es) in blocklist
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by hash, filename, or note..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Add hash form */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">SHA-256 Hash</Label>
            <Input
              placeholder="64-character hex hash..."
              value={hashInput}
              onChange={(e) => setHashInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddHash();
                }
              }}
            />
          </div>
          <div className="w-40 space-y-1">
            <Label className="text-xs text-muted-foreground">
              Filename (optional)
            </Label>
            <Input
              placeholder="file.eml"
              value={fileNameInput}
              onChange={(e) => setFileNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddHash();
                }
              }}
            />
          </div>
          <Button
            size="sm"
            onClick={handleAddHash}
            disabled={!hashInput.trim() || createHash.isPending}
          >
            <Plus className="mr-1 h-4 w-4" />
            Add
          </Button>
          <div>
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleCsvImport}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => csvInputRef.current?.click()}
              disabled={bulkCreate.isPending}
            >
              <Upload className="mr-1 h-4 w-4" />
              Import CSV
            </Button>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <TableSkeleton rows={5} columns={5} />
        ) : !data || data.count === 0 ? (
          <EmptyState
            icon={ShieldBan}
            title="No excluded hashes"
            description="Add hashes manually or import from a CSV file to block files from future uploads."
          />
        ) : (
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hash</TableHead>
                  <TableHead>Filename</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="cursor-default">
                            {item.contentHash.slice(0, 16)}...
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="font-mono text-xs">
                          {item.contentHash}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.fileName || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.note || "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteHash.mutate(item.id)}
                        disabled={deleteHash.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Page {page} of {totalPages} ({data.count} total)
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
