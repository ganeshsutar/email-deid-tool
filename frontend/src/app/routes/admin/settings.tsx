import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { useBlindReviewSetting } from "@/features/dashboard/api/get-blind-review-setting";
import { useUpdateBlindReviewSetting } from "@/features/dashboard/api/update-blind-review-setting";
import { useMinAnnotationLengthSetting } from "@/features/dashboard/api/get-min-annotation-length-setting";
import { useUpdateMinAnnotationLengthSetting } from "@/features/dashboard/api/update-min-annotation-length-setting";

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

  function handleToggle(checked: boolean) {
    updateBlindReview.mutate({ enabled: checked });
  }

  function handleSaveMinLength() {
    const clamped = Math.max(1, minLengthValue);
    updateMinLength.mutate({ minLength: clamped });
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
    </div>
  );
}
