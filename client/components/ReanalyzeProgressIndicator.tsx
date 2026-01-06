import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast as sonnerToast } from "sonner";

interface ReanalyzeBatch {
  id: string;
  status:
    | "pending"
    | "detecting_transfers"
    | "matching_kb"
    | "processing_ai"
    | "completed"
    | "failed"
    | "cancelled";
  total_transactions: number;
  progress_current: number;
  progress_total: number;
  progress_message: string | null;
  transfers_detected: number;
  transfers_auto_linked: number;
  transfers_pending_hitl: number;
  kb_matched: number;
  ai_matched: number;
  unmatched: number;
  errors: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ProgressBarProps {
  current: number;
  total: number;
}

const ProgressBar = ({ current, total }: ProgressBarProps) => {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-gray-600 mb-1">
        <span>{percentage}%</span>
        <span>
          {current}/{total}
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

interface StatusStepsProps {
  batch: ReanalyzeBatch;
}

const StatusSteps = ({ batch }: StatusStepsProps) => {
  const steps = [
    {
      key: "transfers",
      label: "Transfer detection",
      done: ["matching_kb", "processing_ai", "completed"].includes(
        batch.status,
      ),
      active: batch.status === "detecting_transfers",
      result:
        batch.transfers_detected > 0
          ? `${batch.transfers_detected} pairs found`
          : null,
    },
    {
      key: "kb",
      label: "KB matching",
      done: ["processing_ai", "completed"].includes(batch.status),
      active: batch.status === "matching_kb",
      result: batch.kb_matched > 0 ? `${batch.kb_matched} matched` : null,
    },
    {
      key: "ai",
      label: "AI categorization",
      done: batch.status === "completed",
      active: batch.status === "processing_ai",
      result: batch.ai_matched > 0 ? `${batch.ai_matched} matched` : null,
    },
  ];

  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <div key={step.key} className="flex items-center gap-2 text-sm">
          {step.done ? (
            <span className="text-green-600">✓</span>
          ) : step.active ? (
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          ) : (
            <span className="text-gray-400">○</span>
          )}
          <span
            className={
              step.done
                ? "text-gray-600"
                : step.active
                  ? "text-blue-600 font-medium"
                  : "text-gray-400"
            }
          >
            {step.label}
            {step.result && (
              <span className="ml-1 text-gray-500">: {step.result}</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
};

const getEstimatedTime = (batch: ReanalyzeBatch) => {
  if (batch.status !== "processing_ai") return null;

  const remaining = batch.progress_total - batch.progress_current;
  const secondsPerItem = 2; // 1 item per 2 seconds
  const totalSeconds = remaining * secondsPerItem;

  if (totalSeconds < 60) {
    return `~${totalSeconds} seconds remaining`;
  } else {
    const minutes = Math.ceil(totalSeconds / 60);
    return `~${minutes} minute${minutes > 1 ? "s" : ""} remaining`;
  }
};

interface ReanalyzeProgressIndicatorProps {
  onComplete?: () => void;
}

export function ReanalyzeProgressIndicator({
  onComplete,
}: ReanalyzeProgressIndicatorProps) {
  const navigate = useNavigate();
  const [activeBatch, setActiveBatch] = useState<ReanalyzeBatch | null>(null);
  const [polling, setPolling] = useState(false);

  // Fetch active batch
  const fetchActiveBatch = async () => {
    try {
      const { data, error } = await supabase
        .from("reanalyze_batches")
        .select("*")
        .in("status", [
          "pending",
          "detecting_transfers",
          "matching_kb",
          "processing_ai",
        ])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setActiveBatch(data);
        return true;
      }

      // Check for recently completed/failed batches (within last 30 seconds)
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      const { data: recentBatch } = await supabase
        .from("reanalyze_batches")
        .select("*")
        .in("status", ["completed", "failed"])
        .gte("completed_at", thirtySecondsAgo)
        .order("completed_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentBatch) {
        setActiveBatch(recentBatch);
        return false; // Don't continue polling for completed/failed
      }

      setActiveBatch(null);
      return false;
    } catch (err) {
      console.error("Error fetching active batch:", err);
      return false;
    }
  };

  // Initial check and setup polling
  useEffect(() => {
    const checkForBatch = async () => {
      const hasActive = await fetchActiveBatch();
      if (hasActive && !polling) {
        setPolling(true);
      }
    };

    checkForBatch();
  }, []);

  // Polling interval
  useEffect(() => {
    if (!polling) return;

    const interval = setInterval(async () => {
      const hasActive = await fetchActiveBatch();
      if (!hasActive) {
        setPolling(false);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [polling]);

  // Stop polling when completed or failed
  useEffect(() => {
    if (
      activeBatch?.status === "completed" ||
      activeBatch?.status === "failed" ||
      activeBatch?.status === "cancelled"
    ) {
      setPolling(false);
    }
  }, [activeBatch?.status]);

  // Call onComplete when batch finishes
  useEffect(() => {
    if (activeBatch?.status === "completed" && onComplete) {
      onComplete();
    }
  }, [activeBatch?.status, onComplete]);

  // Handlers
  const handleCancel = async () => {
    if (!activeBatch) return;

    const confirmed = window.confirm(
      "Are you sure you want to cancel this re-analysis?",
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("reanalyze_batches")
        .update({
          status: "cancelled",
          completed_at: new Date().toISOString(),
        })
        .eq("id", activeBatch.id);

      if (error) throw error;

      setActiveBatch(null);
      setPolling(false);
      sonnerToast.info("Re-analysis cancelled");
    } catch (err) {
      console.error("Error cancelling batch:", err);
      sonnerToast.error("Failed to cancel batch");
    }
  };

  const handleDismiss = () => {
    setActiveBatch(null);
    if (onComplete) {
      onComplete();
    }
  };

  const handleRetry = async () => {
    if (!activeBatch) return;

    try {
      // Update batch status to pending to retry
      const { error } = await supabase
        .from("reanalyze_batches")
        .update({
          status: "pending",
          error_message: null,
          errors: 0,
        })
        .eq("id", activeBatch.id);

      if (error) throw error;

      setPolling(true);
      sonnerToast.info("Retrying re-analysis...");
    } catch (err) {
      console.error("Error retrying batch:", err);
      sonnerToast.error("Failed to retry");
    }
  };

  // Don't render if no active batch
  if (!activeBatch) return null;

  const isActive = [
    "pending",
    "detecting_transfers",
    "matching_kb",
    "processing_ai",
  ].includes(activeBatch.status);
  const isCompleted = activeBatch.status === "completed";
  const isFailed = activeBatch.status === "failed";
  const isCancelled = activeBatch.status === "cancelled";

  return (
    <div
      className={`
      rounded-lg border p-4 mb-4
      ${isActive ? "bg-blue-50 border-blue-200" : ""}
      ${isCompleted ? "bg-green-50 border-green-200" : ""}
      ${isFailed || isCancelled ? "bg-red-50 border-red-200" : ""}
    `}
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-medium flex items-center gap-2">
          {isActive && <span className="animate-pulse text-lg">🔄</span>}
          {isCompleted && <CheckCircle className="w-5 h-5 text-green-600" />}
          {(isFailed || isCancelled) && (
            <XCircle className="w-5 h-5 text-red-600" />
          )}
          {isActive && "Re-Analyzing Transactions"}
          {isCompleted && "Re-Analysis Complete"}
          {isFailed && "Re-Analysis Failed"}
          {isCancelled && "Re-Analysis Cancelled"}
        </h3>
        <button
          onClick={isActive ? handleCancel : handleDismiss}
          className="text-sm text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
        >
          {isActive ? "Cancel" : "Dismiss"}
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <ProgressBar
          current={activeBatch.progress_current}
          total={activeBatch.progress_total}
        />
      </div>

      {/* Status Steps */}
      {(isActive || isCompleted) && (
        <div className="mb-3">
          <StatusSteps batch={activeBatch} />
        </div>
      )}

      {/* Estimated Time (AI processing only) */}
      {activeBatch.status === "processing_ai" && (
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
          <Clock className="w-4 h-4" />
          {getEstimatedTime(activeBatch)}
        </div>
      )}

      {/* Progress Message */}
      {activeBatch.progress_message && isActive && (
        <div className="text-sm text-gray-600 mb-3 italic">
          {activeBatch.progress_message}
        </div>
      )}

      {/* Error Message */}
      {(isFailed || isCancelled) && activeBatch.error_message && (
        <div className="text-sm text-red-600 mb-3 p-2 bg-red-100 rounded">
          <strong>Error:</strong> {activeBatch.error_message}
        </div>
      )}

      {/* Completion Summary */}
      {isCompleted && (
        <div className="space-y-1 text-sm text-gray-600 mb-3">
          {activeBatch.transfers_auto_linked > 0 && (
            <div>✓ Transfers linked: {activeBatch.transfers_auto_linked}</div>
          )}
          {activeBatch.kb_matched > 0 && (
            <div>✓ KB matched: {activeBatch.kb_matched}</div>
          )}
          {activeBatch.ai_matched > 0 && (
            <div>✓ AI matched: {activeBatch.ai_matched}</div>
          )}
          {activeBatch.unmatched > 0 && (
            <div className="text-gray-500">
              • {activeBatch.unmatched} still need review
            </div>
          )}
        </div>
      )}

      {/* Completion Actions */}
      {isCompleted && (
        <div className="flex gap-2 flex-wrap">
          {activeBatch.transfers_pending_hitl > 0 && (
            <button
              onClick={() => navigate("/transfers/review")}
              className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              View Transfer Matches ({activeBatch.transfers_pending_hitl})
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
          >
            Refresh Transactions
          </button>
        </div>
      )}

      {/* Failed Actions */}
      {isFailed && (
        <div className="flex gap-2">
          <button
            onClick={handleRetry}
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry Now
          </button>
          <button
            onClick={handleCancel}
            className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
          >
            Cancel Batch
          </button>
        </div>
      )}
    </div>
  );
}
