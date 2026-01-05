import { useState, useEffect } from "react";
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
} from "lucide-react";

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
  const [recentItems, setRecentItems] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

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

      // Fetch recent activity
      const { data: recentData } = await supabase
        .from("receipt_upload_queue")
        .select(
          `
          *,
          receipt:receipts(vendor_name, total_amount)
        `,
        )
        .in("status", ["completed", "failed"])
        .order("completed_at", { ascending: false })
        .limit(compactView ? 5 : 10);

      setRecentItems(recentData || []);
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
    recentItems.length === 0
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

      {/* Recent Activity */}
      {recentItems.length > 0 && (
        <Card>
          <div className="px-4 py-3 border-b">
            <h3 className="font-medium text-gray-900">Recent Activity</h3>
          </div>

          <div className="divide-y">
            {recentItems.map((item) => (
              <div key={item.id} className="px-4 py-3 flex items-center gap-3">
                {/* Status icon */}
                {item.status === "completed" ? (
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                )}

                {/* File name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {item.file_name}
                  </p>
                  {item.status === "completed" && item.receipt && (
                    <p className="text-xs text-gray-500">
                      {item.receipt.vendor_name || "Unknown"} -{" "}
                      {formatAmount(item.receipt.total_amount)}
                    </p>
                  )}
                  {item.status === "failed" && item.error_message && (
                    <p className="text-xs text-red-500 truncate">
                      {item.error_message}
                    </p>
                  )}
                </div>

                {/* Time ago */}
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {getTimeAgo(item.completed_at)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
