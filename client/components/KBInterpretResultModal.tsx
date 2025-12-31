import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sparkles, AlertCircle } from "lucide-react";
import { AIInterpretationResult } from "@/types/knowledge-base";

interface KBInterpretResultModalProps {
  isOpen: boolean;
  result: AIInterpretationResult | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onEdit: () => void;
}

export function KBInterpretResultModal({
  isOpen,
  result,
  isLoading = false,
  onClose,
  onConfirm,
  onEdit,
}: KBInterpretResultModalProps) {
  if (!result) return null;

  const confidenceColor =
    result.confidence >= 80
      ? "bg-green-100 text-green-800"
      : result.confidence >= 60
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Interpretation Results
          </DialogTitle>
          <DialogDescription>
            Review the AI interpretation and confirm or edit before saving
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Confidence Score */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Confidence Score</span>
            <Badge className={`text-base px-3 py-1 ${confidenceColor}`}>
              {result.confidence}%
            </Badge>
          </div>

          {/* AI Interpretation */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                AI Interpretation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {result.ai_interpretation}
              </p>
            </CardContent>
          </Card>

          {/* Changes Summary */}
          {result.changes_summary && result.changes_summary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Proposed Changes</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.changes_summary.map((change, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-2 text-sm text-foreground"
                    >
                      <span className="text-green-600 mt-1">✓</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Proposed Entry Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Entry Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Pattern</p>
                  <p className="font-mono text-sm font-semibold">
                    {result.proposed.payee_pattern}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Type</p>
                  <p className="text-sm">
                    {result.proposed.pattern_type || "contains"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Display Name</p>
                  <p className="text-sm">
                    {result.proposed.payee_display_name || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Payee Type</p>
                  <p className="text-sm">
                    {result.proposed.payee_type || "vendor"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="text-sm">
                    {result.proposed.category_code || "—"}
                  </p>
                </div>
              </div>

              {/* Tax Settings */}
              {(result.proposed.default_has_gst !== undefined ||
                result.proposed.default_has_tip !== undefined) && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">
                    Tax Settings
                  </p>
                  <div className="flex gap-4">
                    {result.proposed.default_has_gst !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Has GST:</span>
                        <Badge
                          variant={
                            result.proposed.default_has_gst
                              ? "default"
                              : "outline"
                          }
                        >
                          {result.proposed.default_has_gst ? "Yes" : "No"}
                        </Badge>
                        {result.proposed.default_has_gst &&
                          result.proposed.default_gst_rate && (
                            <span className="text-sm text-muted-foreground">
                              (
                              {(result.proposed.default_gst_rate * 100).toFixed(
                                0,
                              )}
                              %)
                            </span>
                          )}
                      </div>
                    )}
                    {result.proposed.default_has_tip !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Has Tip:</span>
                        <Badge
                          variant={
                            result.proposed.default_has_tip
                              ? "default"
                              : "outline"
                          }
                        >
                          {result.proposed.default_has_tip ? "Yes" : "No"}
                        </Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Existing Entry Warning */}
          {result.action === "update" && result.existing_entry && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This will <strong>update</strong> the existing entry for{" "}
                <code className="font-mono text-sm">
                  {result.existing_entry.payee_pattern}
                </code>
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={onEdit} disabled={isLoading}>
              Edit Entry
            </Button>
            <Button onClick={onConfirm} disabled={isLoading}>
              {isLoading ? "Saving..." : "Confirm & Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
