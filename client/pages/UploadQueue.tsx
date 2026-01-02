import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
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
                        <TableCell>{getStatusBadge(job.status)}</TableCell>
                        <TableCell>
                          {job.attempts}/{job.max_attempts}
                        </TableCell>
                        <TableCell>{formatDate(job.created_at)}</TableCell>
                        <TableCell>{formatDate(job.next_attempt_at)}</TableCell>
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
                            <span className="text-sm text-red-600">
                              {job.error_message}
                            </span>
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
