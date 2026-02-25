import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  Search,
  ShieldBan,
  Trash2,
  Upload,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import type { ExcludedFileHash } from "@/types/models";

export const Route = createFileRoute("/admin/settings")({
  component: SettingsPage,
});

const SHA256_RE = /^[a-f0-9]{64}$/i;
const MAX_CSV_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_LENGTH_MIN = 1;
const MIN_LENGTH_MAX = 500;

function SettingsPage() {
  const { data: blindReview, isLoading } = useBlindReviewSetting();
  const updateBlindReview = useUpdateBlindReviewSetting();
  const [blindReviewPending, setBlindReviewPending] = useState<boolean | null>(
    null,
  );

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

  const hasUnsavedChanges = minLengthChanged || discardReasonsChanged;

  // Warn on page unload if there are unsaved changes
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  function handleToggleBlindReview(checked: boolean) {
    setBlindReviewPending(checked);
  }

  function confirmBlindReview() {
    if (blindReviewPending !== null) {
      updateBlindReview.mutate(
        { enabled: blindReviewPending },
        { onSettled: () => setBlindReviewPending(null) },
      );
    }
  }

  function handleSaveMinLength() {
    const clamped = Math.min(
      MIN_LENGTH_MAX,
      Math.max(MIN_LENGTH_MIN, minLengthValue),
    );
    updateMinLength.mutate({ minLength: clamped });
  }

  function handleAddReason() {
    const trimmed = newReason.trim();
    if (!trimmed) return;
    if (localReasons.includes(trimmed)) {
      toast.warning("This reason already exists");
      return;
    }
    setLocalReasons((prev) => [...prev, trimmed]);
    setNewReason("");
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

      {/* Blind Review Confirmation Dialog */}
      <AlertDialog
        open={blindReviewPending !== null}
        onOpenChange={(open) => {
          if (!open) setBlindReviewPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blindReviewPending
                ? "Enable blind review mode?"
                : "Disable blind review mode?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blindReviewPending
                ? "QA reviewers will no longer see annotator names. This reduces bias and ensures objective quality assessment."
                : "QA reviewers will be able to see which annotator worked on each job."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBlindReview}>
              {blindReviewPending ? "Enable" : "Disable"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="qa-review">
        <TabsList>
          <TabsTrigger value="qa-review" data-testid="tab-qa-review">
            QA Review
          </TabsTrigger>
          <TabsTrigger
            value="annotation-validation"
            data-testid="tab-annotation-validation"
          >
            Annotation Validation
          </TabsTrigger>
          <TabsTrigger value="discard-reasons" data-testid="tab-discard-reasons">
            Discard Reasons
          </TabsTrigger>
          <TabsTrigger
            value="excluded-hashes"
            data-testid="tab-excluded-hashes"
          >
            Excluded File Hashes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="qa-review" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>QA Review Settings</CardTitle>
              <CardDescription>
                Configure how QA reviewers interact with annotations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between space-x-4">
                {isLoading ? (
                  <>
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-4 w-80" />
                    </div>
                    <Skeleton className="h-5 w-9 rounded-full" />
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <Label
                        htmlFor="blind-review"
                        className="text-sm font-medium"
                      >
                        Blind Review Mode
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, QA reviewers cannot see which annotator
                        worked on each job. This reduces bias and ensures
                        objective quality assessment.
                      </p>
                    </div>
                    <Switch
                      id="blind-review"
                      checked={blindReview?.enabled ?? false}
                      onCheckedChange={handleToggleBlindReview}
                      disabled={isLoading || updateBlindReview.isPending}
                      data-testid="blind-review-toggle"
                    />
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="annotation-validation" className="mt-4">
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
                    text selection. Annotations shorter than this will be
                    rejected.
                  </p>
                  {minLengthLoading ? (
                    <Skeleton className="h-9 w-24" />
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <Input
                          id="min-annotation-length"
                          type="number"
                          min={MIN_LENGTH_MIN}
                          max={MIN_LENGTH_MAX}
                          value={minLengthValue}
                          onChange={(e) => {
                            const val =
                              parseInt(e.target.value) || MIN_LENGTH_MIN;
                            setMinLengthValue(
                              Math.min(
                                MIN_LENGTH_MAX,
                                Math.max(MIN_LENGTH_MIN, val),
                              ),
                            );
                          }}
                          className="w-24"
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveMinLength}
                          disabled={
                            !minLengthChanged || updateMinLength.isPending
                          }
                        >
                          Save
                        </Button>
                        {minLengthChanged && (
                          <Badge variant="outline" className="text-amber-600">
                            Unsaved changes
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Must be between {MIN_LENGTH_MIN} and {MIN_LENGTH_MAX}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discard-reasons" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Discard Reasons</CardTitle>
              <CardDescription>
                Configure the list of reasons that annotators and QA reviewers
                can select when discarding a file
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {discardReasonsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                ) : (
                  <>
                    {localReasons.map((reason, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <span className="flex-1 text-sm">{reason}</span>
                        {localReasons.length <= 1 ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span tabIndex={0}>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground"
                                    disabled
                                    aria-label="Remove reason"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                At least one reason is required
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleRemoveReason(index)}
                            aria-label="Remove reason"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <div className="flex items-center gap-2 border-t pt-2">
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
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleAddReason}
                        disabled={!newReason.trim()}
                        aria-label="Add reason"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      {discardReasonsChanged && (
                        <Badge variant="outline" className="text-amber-600">
                          Unsaved changes
                        </Badge>
                      )}
                      <Button
                        size="sm"
                        onClick={handleSaveDiscardReasons}
                        disabled={
                          !discardReasonsChanged ||
                          updateDiscardReasons.isPending ||
                          localReasons.length === 0
                        }
                      >
                        Save
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="excluded-hashes" className="mt-4">
          <ExcludedHashesCard />
        </TabsContent>
      </Tabs>
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
  const [hashError, setHashError] = useState("");
  const [hashToDelete, setHashToDelete] = useState<ExcludedFileHash | null>(
    null,
  );
  const [copiedHashId, setCopiedHashId] = useState<string | null>(null);
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

  const isHashValid = SHA256_RE.test(hashInput.trim());

  function handleHashInputChange(value: string) {
    setHashInput(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setHashError("");
    } else if (!SHA256_RE.test(trimmed)) {
      setHashError("Must be a 64-character hex string");
    } else {
      setHashError("");
    }
  }

  function handleAddHash() {
    const trimmed = hashInput.trim().toLowerCase();
    if (!trimmed || !SHA256_RE.test(trimmed)) return;
    createHash.mutate(
      { contentHash: trimmed, fileName: fileNameInput.trim() },
      {
        onSuccess: () => {
          setHashInput("");
          setFileNameInput("");
          setHashError("");
        },
      },
    );
  }

  function handleCsvImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_CSV_SIZE) {
      toast.error("File too large. Maximum size is 5MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());

      // Detect if first line is a header
      const firstLine = lines[0]?.toLowerCase() ?? "";
      const hasHeader =
        firstLine.includes("filename") || firstLine.includes("hash");
      const startIdx = hasHeader ? 1 : 0;

      const validItems: { content_hash: string; file_name: string }[] = [];
      let invalidCount = 0;

      for (let i = startIdx; i < lines.length; i++) {
        const parts = lines[i].split(",").map((s) => s.trim());
        let hash = "";
        let fileName = "";

        if (parts.length >= 2) {
          hash = parts[1];
          fileName = parts[0];
        } else if (parts.length === 1 && parts[0]) {
          hash = parts[0];
        }

        if (hash && SHA256_RE.test(hash)) {
          validItems.push({ content_hash: hash, file_name: fileName });
        } else if (hash) {
          invalidCount++;
        }
      }

      if (validItems.length === 0) {
        toast.error(
          invalidCount > 0
            ? `All ${invalidCount} hash(es) were invalid. Hashes must be 64-character hex strings.`
            : "No hashes found in the file.",
        );
        return;
      }

      if (invalidCount > 0) {
        toast.info(
          `Found ${validItems.length} valid hash(es) (${invalidCount} invalid skipped)`,
        );
      }

      bulkCreate.mutate(validItems);
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  const handleCopyHash = useCallback(
    (id: string, hash: string) => {
      navigator.clipboard.writeText(hash).then(() => {
        setCopiedHashId(id);
        setTimeout(() => setCopiedHashId(null), 1500);
      });
    },
    [],
  );

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
        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={hashToDelete !== null}
          onOpenChange={(open) => {
            if (!open) setHashToDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove excluded hash?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the hash{" "}
                <span className="font-mono text-xs">
                  {hashToDelete?.contentHash.slice(0, 16)}...
                </span>
                {hashToDelete?.fileName && (
                  <>
                    {" "}
                    (file: <span className="font-medium">{hashToDelete.fileName}</span>)
                  </>
                )}{" "}
                from the blocklist. Files with this hash will no longer be
                blocked during upload.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (hashToDelete) {
                    deleteHash.mutate(hashToDelete.id);
                    setHashToDelete(null);
                  }
                }}
              >
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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
            <Label className="text-xs text-muted-foreground">
              SHA-256 Hash
            </Label>
            <Input
              placeholder="64-character hex hash..."
              value={hashInput}
              onChange={(e) => handleHashInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddHash();
                }
              }}
              className={hashError ? "border-destructive" : ""}
            />
            <div className="flex items-center justify-between">
              {hashError ? (
                <p className="text-xs text-destructive">{hashError}</p>
              ) : (
                <span />
              )}
              {hashInput.trim() && (
                <p className="text-xs text-muted-foreground">
                  {hashInput.trim().length}/64
                </p>
              )}
            </div>
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
            disabled={!isHashValid || createHash.isPending}
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
          debouncedSearch ? (
            <EmptyState
              icon={Search}
              title="No hashes match your search"
              description={`No results for "${debouncedSearch}". Try a different search term.`}
            />
          ) : (
            <EmptyState
              icon={ShieldBan}
              title="No excluded hashes"
              description="Add hashes manually or import from a CSV file to block files from future uploads."
            />
          )
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
                          <button
                            type="button"
                            className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                            onClick={() =>
                              handleCopyHash(item.id, item.contentHash)
                            }
                          >
                            {item.contentHash.slice(0, 16)}...
                            {copiedHashId === item.id ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100 [[data-state=open]>&]:opacity-100" />
                            )}
                          </button>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          className="font-mono text-xs"
                        >
                          {copiedHashId === item.id
                            ? "Copied!"
                            : "Click to copy"}
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
                        onClick={() => setHashToDelete(item)}
                        disabled={deleteHash.isPending}
                        aria-label="Remove hash"
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
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={page >= totalPages}
                    aria-label="Next page"
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
