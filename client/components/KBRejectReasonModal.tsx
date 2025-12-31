import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";

interface KBRejectReasonModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (quickReasons: string[], customReason: string) => void;
}

const QUICK_REASONS = [
  "Duplicate entry exists",
  "Incorrect category",
  "Pattern too broad",
  "Pattern too specific",
  "Not enough data",
];

export function KBRejectReasonModal({
  isOpen,
  isLoading = false,
  onClose,
  onConfirm,
}: KBRejectReasonModalProps) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [customReason, setCustomReason] = useState("");

  const handleReasonToggle = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason)
        ? prev.filter((r) => r !== reason)
        : [...prev, reason]
    );
  };

  const handleConfirm = () => {
    onConfirm(selectedReasons, customReason);
    // Reset on close
    setSelectedReasons([]);
    setCustomReason("");
  };

  const handleClose = () => {
    if (isLoading) return;
    setSelectedReasons([]);
    setCustomReason("");
    onClose();
  };

  const hasReason = selectedReasons.length > 0 || customReason.trim();

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reject KB Entry</DialogTitle>
          <DialogDescription>
            Provide a reason for rejecting this suggestion
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Quick Reasons */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Quick Reasons</Label>
            <div className="space-y-2">
              {QUICK_REASONS.map((reason) => (
                <div key={reason} className="flex items-center gap-2">
                  <Checkbox
                    id={reason}
                    checked={selectedReasons.includes(reason)}
                    onCheckedChange={() => handleReasonToggle(reason)}
                    disabled={isLoading}
                  />
                  <Label
                    htmlFor={reason}
                    className="cursor-pointer font-normal text-sm"
                  >
                    {reason}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Reason */}
          <div className="space-y-2">
            <Label htmlFor="custom-reason" className="text-sm font-semibold">
              Additional Details (Optional)
            </Label>
            <Textarea
              id="custom-reason"
              placeholder="Explain why this suggestion should be rejected..."
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              rows={3}
              disabled={isLoading}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isLoading || !hasReason}
              className="gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                "Reject"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
