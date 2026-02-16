import { useState, useMemo, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shuffle } from "lucide-react";
import { useUser } from "@/lib/auth";
import { useUpdateAvatar } from "@/features/auth/api/update-avatar";
import { buildAvatarUrl, AVATAAR_OPTIONS, AVATAAR_OPTION_KEYS, formatOptionLabel } from "@/lib/avatar";
import type { AvatarConfig } from "@/types/models";
import { cn } from "@/lib/utils";

interface AvatarChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function generateRandomSeeds(count: number): string[] {
  return Array.from({ length: count }, () =>
    Math.random().toString(36).substring(2, 10),
  );
}

export function AvatarChangeDialog({ open, onOpenChange }: AvatarChangeDialogProps) {
  const user = useUser();
  const updateAvatar = useUpdateAvatar();

  const defaultConfig: AvatarConfig = useMemo(
    () => user.avatarConfig ?? { seed: user.email },
    [user.avatarConfig, user.email],
  );

  const [config, setConfig] = useState<AvatarConfig>(defaultConfig);
  const [randomSeeds, setRandomSeeds] = useState<string[]>(() => generateRandomSeeds(12));

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setConfig(user.avatarConfig ?? { seed: user.email });
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, user.avatarConfig, user.email],
  );

  function handleShuffle() {
    setRandomSeeds(generateRandomSeeds(12));
  }

  function handleSelectRandom(seed: string) {
    setConfig({ seed });
  }

  function handleOptionChange(key: string, value: string) {
    setConfig((prev) => {
      const next = { ...prev, [key]: value };
      if (value === "") {
        delete next[key as keyof AvatarConfig];
      }
      return next;
    });
  }

  async function handleSave() {
    await updateAvatar.mutateAsync(config);
    onOpenChange(false);
  }

  const previewUrl = buildAvatarUrl(config, user.email, 128);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Change Avatar</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-6">
          {/* Preview */}
          <div className="flex flex-col items-center gap-2 shrink-0">
            <img
              src={previewUrl}
              alt="Avatar preview"
              className="h-32 w-32 rounded-full border bg-muted"
            />
            <span className="text-xs text-muted-foreground">Preview</span>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="random" className="flex-1 min-w-0">
            <TabsList className="w-full">
              <TabsTrigger value="random" className="flex-1">Random</TabsTrigger>
              <TabsTrigger value="customize" className="flex-1">Customize</TabsTrigger>
            </TabsList>

            <TabsContent value="random" className="mt-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">Pick an avatar</span>
                <Button variant="outline" size="sm" onClick={handleShuffle}>
                  <Shuffle className="mr-1.5 h-3.5 w-3.5" />
                  Shuffle
                </Button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {randomSeeds.map((seed) => {
                  const url = buildAvatarUrl({ seed }, user.email, 64);
                  const isSelected = config.seed === seed && Object.keys(config).length === 1;
                  return (
                    <button
                      key={seed}
                      type="button"
                      className={cn(
                        "rounded-lg border-2 p-1 transition-colors hover:border-primary",
                        isSelected ? "border-primary ring-2 ring-primary/30" : "border-transparent",
                      )}
                      onClick={() => handleSelectRandom(seed)}
                    >
                      <img src={url} alt="Avatar option" className="w-full rounded-md bg-muted" />
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="customize" className="mt-3">
              <ScrollArea className="h-64 pr-3">
                <div className="space-y-3">
                  {AVATAAR_OPTION_KEYS.filter((k) => k !== "nose").map((key) => {
                    const options = AVATAAR_OPTIONS[key];
                    const isColorOption = key.toLowerCase().includes("color");
                    return (
                      <div key={key} className="grid grid-cols-[120px_1fr] items-center gap-2">
                        <label className="text-sm font-medium truncate">
                          {formatOptionLabel(key)}
                        </label>
                        <Select
                          value={(config[key as keyof AvatarConfig] as string) ?? "__default__"}
                          onValueChange={(v) => handleOptionChange(key, v === "__default__" ? "" : v)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Default" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__default__">Default</SelectItem>
                            {(options as readonly string[]).map((opt) => (
                              <SelectItem key={opt} value={opt}>
                                <span className="flex items-center gap-2">
                                  {isColorOption && (
                                    <span
                                      className="inline-block h-3 w-3 rounded-full shrink-0 border"
                                      style={{ backgroundColor: `#${opt}` }}
                                    />
                                  )}
                                  {opt}
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={updateAvatar.isPending}>
            {updateAvatar.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
