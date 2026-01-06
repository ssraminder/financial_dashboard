import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Card, CardContent } from "@/components/ui/card";
import {
  Clock,
  Loader2,
  CheckCircle,
  XCircle,
  FileText,
  RefreshCw,
  Inbox,
  ChevronDown,
  ChevronUp,
  Play,
  X,
  RotateCw,
  Eye,
} from "lucide-react";
import { toast } from "sonner";

interface QueueStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  oldest_queued: string | null;
  newest_queued: string | null;
}

interface QueueItem {
  id: string;
  file_name: string;
  status: "queued" | "processing" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
  processing_started_at: string | null;
  completed_at: string | null;
  receipt_id: string | null;
  receipt?: {
    vendor_name: string | null;
    total_amount: number | null;
  };
}

interface ReceiptQueueStatusProps {
  compactView?: boolean;
  showHeader?: boolean;
}

export function ReceiptQueueStatus({
  compactView = false,
  showHeader = true,
}: ReceiptQueueStatusProps) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [currentlyProcessing, setCurrentlyProcessing] =
    useState<QueueItem | null>(null);
  const [allItems, setAllItems] = useState<QueueItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "queued" | "processing" | "completed" | "failed"
  >("all");
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  const fetchQueueStatus = async () => {
    try {
      // Fetch stats - count by status
      const { data: queueData, error: queueError } = await supabase
        .from("receipt_upload_queue")
        .select("status");

      if (queueError) throw queueError;

      // Calculate stats
      const statsObj: QueueStats = {
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        oldest_queued: null,
        newest_queued: null,
      };

      queueData?.forEach((item) => {
        if (item.status === "queued") statsObj.queued++;
        if (item.status === "processing") statsObj.processing++;
        if (item.status === "completed") statsObj.completed++;
        if (item.status === "failed") statsObj.failed++;
      });

      setStats(statsObj);

      // Fetch currently processing
      const { data: processingData } = await supabase
        .from("receipt_upload_queue")
        .select("*")
        .eq("status", "processing")
        .order("processing_started_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      setCurrentlyProcessing(processingData);

      // Fetch ALL items (not just completed/failed)
      const { data: itemsData } = await supabase
        .from("receipt_upload_queue")
        .select(
          `
          *,
          receipt:receipts(vendor_name, total_amount)
        `,
        )
        .order("created_at", { ascending: false })
        .limit(100);

      setAllItems(itemsData || []);
    } catch (error) {
      console.error("Error fetching queue status:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    fetchQueueStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchQueueStatus, 10000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Real-time updates via Supabase subscription
  useEffect(() => {
    const channel = supabase
      .channel("receipt_queue_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "receipt_upload_queue",
        },
        (payload) => {
          console.log("Queue change:", payload);
          fetchQueueStatus();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter and sort items
  const displayItems = useMemo(() => {
    // Filter by status
    let filtered =
      statusFilter === "all"
        ? allItems
        : allItems.filter((item) => item.status === statusFilter);

    // Sort by priority: processing -> queued -> failed -> completed
    const statusOrder = {
      processing: 0,
      queued: 1,
      failed: 2,
      completed: 3,
    };

    return filtered.sort((a, b) => {
      const statusDiff =
        (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
      if (statusDiff !== 0) return statusDiff;

      // Within same status, sort by created_at (newest first)
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });
  }, [allItems, statusFilter]);

  const handleProcessNow = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("receipt_upload_queue")
        .update({
          status: "processing",
          processing_started_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (error) throw error;

      toast.success("Processing started");
      fetchQueueStatus();
    } catch (error) {
      console.error("Error processing item:", error);
      toast.error("Failed to start processing");
    }
  };

  const handleCancel = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("receipt_upload_queue")
        .delete()
        .eq("id", itemId);

      if (error) throw error;

      toast.success("Item cancelled");
      fetchQueueStatus();
    } catch (error) {
      console.error("Error cancelling item:", error);
      toast.error("Failed to cancel item");
    }
  };

  const handleRetry = async (itemId: string) => {
    try {
      const { error } = await supabase
        .from("receipt_upload_queue")
        .update({
          status: "queued",
          error_message: null,
          processing_started_at: null,
          completed_at: null,
        })
        .eq("id", itemId);

      if (error) throw error;

      toast.success("Item queued for retry");
      fetchQueueStatus();
    } catch (error) {
      console.error("Error retrying item:", error);
      toast.error("Failed to retry item");
    }
  };

  const getElapsedTime = (startTime: string | null): string => {
    if (!startTime) return "";

    const start = new Date(startTime);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - start.getTime()) / 1000);

    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const getTimeAgo = (timestamp: string | null): string => {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const formatAmount = (amount: number | null): string => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(amount);
  };

  const toggleErrorExpansion = (itemId: string) => {
    setExpandedErrors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "queued":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 mr-1" /> Queued
          </span>
        );
      case "processing":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 mr-1" /> Completed
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 mr-1" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Empty state
  if (
    stats?.queued === 0 &&
    stats?.processing === 0 &&
    stats?.completed === 0 &&
    stats?.failed === 0
  ) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <Inbox className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No receipts in queue
            </h3>
            <p className="text-gray-500 mb-4">
              Upload some receipts to get started
            </p>
            <button
              onClick={() => navigate("/receipts/upload")}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Upload Receipts
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Receipt Processing Queue</h2>

          <div className="flex items-center gap-3">
            {/* Auto-refresh toggle */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>

            {/* Manual refresh button */}
            <button
              onClick={fetchQueueStatus}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 rounded-lg"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Queued */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Queued</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats?.queued || 0}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400" />
          </div>
        </div>

        {/* Processing */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Processing</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats?.processing || 0}
              </p>
            </div>
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        </div>

        {/* Completed */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">
                {stats?.completed || 0}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-400" />
          </div>
        </div>

        {/* Failed */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600">
                {stats?.failed || 0}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      {/* Currently Processing */}
      {currentlyProcessing && (
        <Card>
          <CardContent className="pt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                Currently Processing
              </h3>

              <div className="bg-white rounded-lg p-3">
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <span className="font-medium">
                    {currentlyProcessing.file_name}
                  </span>
                </div>

                {/* Progress bar (animated) */}
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-blue-500 rounded-full animate-pulse"
                    style={{ width: "60%" }}
                  />
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>Extracting data...</span>
                  <span>
                    {getElapsedTime(currentlyProcessing.processing_started_at)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(["all", "queued", "processing", "completed", "failed"] as const).map(
          (status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 text-sm font-medium rounded-lg capitalize transition-colors ${
                statusFilter === status
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {status}
              {status !== "all" && stats && (
                <span className="ml-1.5">({stats[status]})</span>
              )}
            </button>
          ),
        )}
      </div>

      {/* Queue Items List */}
      <Card>
        <div className="px-4 py-3 border-b">
          <h3 className="font-medium text-gray-900">
            All Queue Items ({displayItems.length})
          </h3>
        </div>

        {displayItems.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No items to display</p>
          </div>
        ) : (
          <div className="divide-y">
            {displayItems.map((item) => {
              const isExpanded = expandedErrors.has(item.id);
              const errorTooLong =
                item.error_message && item.error_message.length > 100;

              return (
                <div key={item.id} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    {/* File icon */}
                    <FileText className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />

                    {/* File name and details */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.file_name}
                      </p>

                      {/* Success details */}
                      {item.status === "completed" && item.receipt && (
                        <p className="text-xs text-gray-500 mt-1">
                          {item.receipt.vendor_name || "Unknown"} -{" "}
                          {formatAmount(item.receipt.total_amount)}
                        </p>
                      )}

                      {/* Error details - with wrapping and show more */}
                      {item.status === "failed" && item.error_message && (
                        <div className="mt-1 bg-red-50 border border-red-200 rounded-lg p-2">
                          <p
                            className={`text-sm text-red-700 break-words whitespace-pre-wrap ${
                              !isExpanded && errorTooLong ? "line-clamp-2" : ""
                            }`}
                          >
                            {item.error_message}
                          </p>

                          {/* Show more/less button for long errors */}
                          {errorTooLong && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleErrorExpansion(item.id);
                              }}
                              className="mt-2 text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-3 h-3" />
                                  Show less
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-3 h-3" />
                                  Show more
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Status badge and actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Status badge */}
                      {getStatusBadge(item.status)}

                      {/* Time */}
                      <span className="text-xs text-gray-400 min-w-[60px] text-right">
                        {getTimeAgo(item.created_at)}
                      </span>

                      {/* Action buttons */}
                      <div className="flex gap-2">
                        {item.status === "queued" && (
                          <>
                            <button
                              onClick={() => handleProcessNow(item.id)}
                              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                              title="Process Now"
                            >
                              <Play className="w-3 h-3" />
                              Process
                            </button>
                            <button
                              onClick={() => handleCancel(item.id)}
                              className="px-3 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 flex items-center gap-1"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                              Cancel
                            </button>
                          </>
                        )}

                        {item.status === "failed" && (
                          <button
                            onClick={() => handleRetry(item.id)}
                            className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 flex items-center gap-1"
                            title="Retry"
                          >
                            <RotateCw className="w-3 h-3" />
                            Retry
                          </button>
                        )}

                        {item.status === "completed" && item.receipt_id && (
                          <button
                            onClick={() =>
                              navigate(`/receipts?id=${item.receipt_id}`)
                            }
                            className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1"
                            title="View Receipt"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
