import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Eye,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface QueueStats {
  pending: number;
  processing: number;
  rate_limited: number;
  total_queue: number;
}

interface QueueJob {
  id: string;
  job_id: string;
  file_name: string;
  status: "pending" | "processing" | "rate_limited" | "completed" | "failed";
  attempts: number;
  max_attempts: number;
  created_at: string;
  completed_at?: string;
  next_attempt_at?: string;
  last_attempt_at?: string;
  transaction_count?: number;
  statement_import_id?: string;
  error_message?: string;
  bank_account?: {
    name: string;
    bank_name: string;
  };
}

export default function UploadQueue() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<QueueStats>({
    pending: 0,
    processing: 0,
    rate_limited: 0,
    total_queue: 0,
  });
  const [jobs, setJobs] = useState<QueueJob[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  const fetchQueueStatus = async () => {
    try {
      const response = await fetch(
        "https://llxlkawdmuwsothxaada.supabase.co/functions/v1/queue-status",
      );
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        setJobs(data.jobs || []);
      }
    } catch (err) {
      console.error("Failed to fetch queue status:", err);
    } finally {
      setLoading(false);
    }
  };

  // Check if a job is stuck (processing for more than 5 minutes)
  const isStuck = (job: QueueJob) => {
    if (job.status !== "processing") return false;
    if (!job.last_attempt_at) return false;

    const lastAttempt = new Date(job.last_attempt_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastAttempt.getTime()) / (1000 * 60);

    return diffMinutes > 5; // Stuck if processing for more than 5 minutes
  };

  // Retry a stuck job - reset to pending
  const handleRetryJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from("parse_queue")
        .update({
          status: "pending",
          attempts: 0,
          error_message: null,
          last_attempt_at: null,
          next_attempt_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;

      toast.success("Job queued for retry");
      fetchQueueStatus(); // Refresh the list
    } catch (error) {
      console.error("Retry error:", error);
      toast.error("Failed to retry job");
    }
  };

  // Cancel/delete a job from queue
  const handleCancelJob = async (jobId: string) => {
    if (
      !confirm(
        "Are you sure you want to cancel this job? The file will need to be re-uploaded.",
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("parse_queue")
        .delete()
        .eq("id", jobId);

      if (error) throw error;

      // ✅ Optimistically update UI immediately
      setJobs((prevJobs) => prevJobs.filter((job) => job.id !== jobId));

      // ✅ Update stats to reflect removal
      setStats((prevStats) => ({
        ...prevStats,
        pending: Math.max(0, prevStats.pending - 1),
        total_queue: Math.max(0, prevStats.total_queue - 1),
      }));

      toast.success("Job cancelled");

      // ✅ Background refresh to ensure server consistency
      fetchQueueStatus();
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error("Failed to cancel job");

      // ✅ On error, refresh to restore correct state
      fetchQueueStatus();
    }
  };

  // Force process a job immediately (trigger Edge Function)
  const handleForceProcess = async (jobId: string) => {
    try {
      // First reset to pending
      await supabase
        .from("parse_queue")
        .update({
          status: "pending",
          attempts: 0,
          error_message: null,
          last_attempt_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      // Then trigger the process-queue function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-queue`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
        },
      );

      if (response.ok) {
        toast.success("Processing triggered");
      } else {
        toast.error("Failed to trigger processing");
      }

      // Refresh after a short delay
      setTimeout(fetchQueueStatus, 2000);
    } catch (error) {
      console.error("Force process error:", error);
      toast.error("Failed to force process");
    }
  };

  useEffect(() => {
    fetchQueueStatus();
  }, []);

  // Auto-refresh every 5 seconds when there are active jobs
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchQueueStatus, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case "processing":
        return <Badge className="bg-blue-100 text-blue-800">Processing</Badge>;
      case "rate_limited":
        return (
          <Badge className="bg-orange-100 text-orange-800">Rate Limited</Badge>
        );
      case "completed":
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  const toggleErrorExpansion = (jobId: string) => {
    setExpandedErrors((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeJobs = jobs.filter((j) =>
    ["pending", "processing", "rate_limited"].includes(j.status),
  );
  const completedJobs = jobs.filter((j) =>
    ["completed", "failed"].includes(j.status),
  );

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Clock className="h-8 w-8" />
                Processing Queue
              </h1>
              <p className="text-muted-foreground mt-1">
                Monitor statement processing status
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                {autoRefresh ? "Pause" : "Resume"} Auto-refresh
              </Button>
              <Button variant="outline" size="sm" onClick={fetchQueueStatus}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-yellow-600">Pending</p>
                    <p className="text-3xl font-bold text-yellow-700">
                      {stats.pending}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-blue-600">Processing</p>
                    <p className="text-3xl font-bold text-blue-700">
                      {stats.processing}
                    </p>
                  </div>
                  <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-orange-600">Rate Limited</p>
                    <p className="text-3xl font-bold text-orange-700">
                      {stats.rate_limited}
                    </p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-green-600">Total in Queue</p>
                    <p className="text-3xl font-bold text-green-700">
                      {stats.total_queue}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Auto-refresh indicator */}
          {autoRefresh && stats.total_queue > 0 && (
            <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Auto-refreshing every 5 seconds...
            </div>
          )}

          {/* Active Jobs */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5" />
                Active Jobs ({activeJobs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeJobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attempts</TableHead>
                      <TableHead>Queued At</TableHead>
                      <TableHead>Next Retry</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {job.file_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {job.bank_account?.bank_name} -{" "}
                          {job.bank_account?.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-1 text-xs rounded ${
                                job.status === "pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : job.status === "processing"
                                    ? "bg-blue-100 text-blue-700"
                                    : job.status === "completed"
                                      ? "bg-green-100 text-green-700"
                                      : job.status === "failed"
                                        ? "bg-red-100 text-red-700"
                                        : job.status === "rate_limited"
                                          ? "bg-orange-100 text-orange-700"
                                          : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {job.status === "processing" && isStuck(job)
                                ? "Stuck"
                                : job.status}
                            </span>

                            {job.status === "processing" && isStuck(job) && (
                              <span
                                className="text-red-500"
                                title="Job appears to be stuck"
                              >
                                ⚠️
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {job.attempts}/{job.max_attempts}
                        </TableCell>
                        <TableCell>{formatDate(job.created_at)}</TableCell>
                        <TableCell>{formatDate(job.next_attempt_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {/* Show different actions based on status */}
                            {job.status === "processing" && isStuck(job) && (
                              <Button
                                onClick={() => handleRetryJob(job.id)}
                                size="sm"
                                variant="outline"
                                className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-yellow-300"
                                title="Reset and retry"
                              >
                                Retry
                              </Button>
                            )}

                            {job.status === "pending" && (
                              <Button
                                onClick={() => handleForceProcess(job.id)}
                                size="sm"
                                variant="outline"
                                className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-300"
                                title="Process now"
                              >
                                Process Now
                              </Button>
                            )}

                            {(job.status === "failed" ||
                              job.status === "rate_limited") && (
                              <Button
                                onClick={() => handleRetryJob(job.id)}
                                size="sm"
                                variant="outline"
                                className="bg-green-100 text-green-700 hover:bg-green-200 border-green-300"
                                title="Retry"
                              >
                                Retry
                              </Button>
                            )}

                            {/* Cancel button - always available for non-completed */}
                            <Button
                              onClick={() => handleCancelJob(job.id)}
                              size="sm"
                              variant="outline"
                              className="bg-red-100 text-red-700 hover:bg-red-200 border-red-300"
                              title="Cancel job"
                            >
                              Cancel
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500 opacity-50" />
                  <p>No active jobs</p>
                  <p className="text-sm">Queue is empty</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Jobs ({completedJobs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completedJobs.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Transactions</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {completedJobs.map((job) => (
                      <TableRow key={job.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            {job.file_name}
                          </div>
                        </TableCell>
                        <TableCell>
                          {job.bank_account?.bank_name} -{" "}
                          {job.bank_account?.name}
                        </TableCell>
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell>
                          {job.status === "completed"
                            ? job.transaction_count
                            : "-"}
                        </TableCell>
                        <TableCell>{formatDate(job.completed_at)}</TableCell>
                        <TableCell>
                          {job.status === "completed" &&
                            job.statement_import_id && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  (window.location.href = `/statements?id=${job.statement_import_id}`)
                                }
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View
                              </Button>
                            )}
                          {job.status === "failed" && job.error_message && (
                            <div className="mt-2 max-w-md">
                              <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                                <p
                                  className={`text-sm text-red-700 break-words whitespace-pre-wrap ${
                                    !expandedErrors.has(job.id) &&
                                    job.error_message.length > 100
                                      ? "line-clamp-2"
                                      : ""
                                  }`}
                                >
                                  {job.error_message}
                                </p>
                                {job.error_message.length > 100 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleErrorExpansion(job.id);
                                    }}
                                    className="mt-2 text-xs text-red-600 hover:text-red-800 font-medium flex items-center gap-1"
                                  >
                                    {expandedErrors.has(job.id) ? (
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
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No recent jobs</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
