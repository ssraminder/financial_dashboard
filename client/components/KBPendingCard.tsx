import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Check, X, AlertCircle, Clock } from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

interface PendingItem {
  id: string;
  source: string;
  proposed_payee_pattern: string;
  proposed_payee_display_name?: string;
  proposed_payee_type?: string;
  proposed_category_id: string;
  proposed_has_gst: boolean;
  proposed_gst_rate: number;
  proposed_has_tip: boolean;
  confidence_score: number;
  match_count: number;
  sample_transactions?: unknown[];
  created_at: string;
  expires_at: string;
  status?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

interface KBPendingCardProps {
  item: PendingItem;
  onApprove: (item: PendingItem) => void;
  onReject: (item: PendingItem) => void;
  isLoading?: boolean;
  readonly?: boolean;
}

const SOURCE_COLORS: Record<string, string> = {
  hitl_correction: "bg-blue-100 text-blue-800",
  auto_suggest: "bg-purple-100 text-purple-800",
  receipt_ocr: "bg-green-100 text-green-800",
  csv_import: "bg-orange-100 text-orange-800",
};

const SOURCE_LABELS: Record<string, string> = {
  hitl_correction: "HITL Correction",
  auto_suggest: "Auto-Suggest",
  receipt_ocr: "Receipt OCR",
  csv_import: "CSV Import",
};

export function KBPendingCard({
  item,
  onApprove,
  onReject,
  isLoading = false,
  readonly = false,
}: KBPendingCardProps) {
  const confidenceColor =
    item.confidence_score >= 80
      ? "bg-green-100 text-green-800"
      : item.confidence_score >= 60
        ? "bg-amber-100 text-amber-800"
        : "bg-red-100 text-red-800";

  const timeToExpire = () => {
    const now = new Date();
    const expiry = new Date(item.expires_at);
    const daysLeft = Math.ceil(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    return daysLeft;
  };

  const daysLeft = timeToExpire();
  const isExpiringSoon = daysLeft <= 7;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge
                className={`${SOURCE_COLORS[item.source] || "bg-slate-100 text-slate-800"}`}
                variant="outline"
              >
                {SOURCE_LABELS[item.source] || item.source}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {formatDate(item.created_at.split("T")[0])}
              </span>
            </div>
            <h3 className="font-mono font-bold text-lg">
              {item.proposed_payee_pattern}
            </h3>
            {item.proposed_payee_display_name && (
              <p className="text-sm text-muted-foreground">
                Display: {item.proposed_payee_display_name}
              </p>
            )}
          </div>

          {/* Expiry Warning */}
          {!readonly && isExpiringSoon && (
            <Alert className="w-auto bg-amber-50 border-amber-200">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-xs text-amber-800">
                Expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Separator */}
        <div className="border-t" />

        {/* Details */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground font-semibold mb-1">
              PAYEE TYPE
            </p>
            <p className="text-sm font-medium">
              {item.proposed_payee_type || "vendor"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold mb-1">
              CONFIDENCE
            </p>
            <Badge className={`${confidenceColor}`} variant="outline">
              {item.confidence_score}%
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold mb-1">
              MATCH COUNT
            </p>
            <p className="text-sm font-medium">
              {item.match_count.toLocaleString()}
            </p>
          </div>
        </div>

        {/* Tax Settings */}
        <div className="bg-muted/50 rounded p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            Tax Settings
          </p>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span>GST:</span>
              <Badge variant={item.proposed_has_gst ? "default" : "outline"}>
                {item.proposed_has_gst
                  ? `Yes (${(item.proposed_gst_rate * 100).toFixed(0)}%)`
                  : "No"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span>Tip:</span>
              <Badge variant={item.proposed_has_tip ? "default" : "outline"}>
                {item.proposed_has_tip ? "Yes" : "No"}
              </Badge>
            </div>
          </div>
        </div>

        {/* Sample Transactions */}
        {item.sample_transactions && item.sample_transactions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              Sample Transactions ({item.sample_transactions.length})
            </p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {(item.sample_transactions as Record<string, unknown>[]).map(
                (tx, idx) => (
                  <div
                    key={idx}
                    className="text-xs bg-muted/30 rounded px-2 py-1"
                  >
                    • {String(tx.description || tx.payee || "Transaction")} - $
                    {((tx.amount as number) || 0).toFixed(2)}
                  </div>
                ),
              )}
            </div>
          </div>
        )}

        {/* Status Display */}
        {readonly && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              Status
            </p>
            <div className="flex items-center gap-3">
              {item.status === "approved" && (
                <>
                  <Badge
                    className="bg-green-100 text-green-800"
                    variant="outline"
                  >
                    Approved
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    by {item.reviewed_by}
                  </span>
                </>
              )}
              {item.status === "rejected" && (
                <div className="space-y-1 w-full">
                  <Badge className="bg-red-100 text-red-800" variant="outline">
                    Rejected
                  </Badge>
                  {item.rejection_reason && (
                    <p className="text-xs bg-red-50 text-red-800 rounded p-2">
                      {item.rejection_reason}
                    </p>
                  )}
                </div>
              )}
              {item.status === "expired" && (
                <Badge
                  className="bg-amber-100 text-amber-800"
                  variant="outline"
                >
                  Expired
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!readonly && (
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onReject(item)}
              disabled={isLoading}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Reject
            </Button>
            <Button
              onClick={() => onApprove(item)}
              disabled={isLoading}
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              Approve
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
