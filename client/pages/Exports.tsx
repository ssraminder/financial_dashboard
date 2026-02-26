import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Download,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";

interface Export {
  id: string;
  status: "processing" | "completed" | "failed";
  file_name: string;
  file_path: string | null;
  file_size: number | null;
  row_count: number | null;
  filters: Record<string, any>;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function Exports() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [exports, setExports] = useState<Export[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchExports();
    }
  }, [user]);

  // Poll for processing exports
  useEffect(() => {
    const hasProcessing = exports.some((e) => e.status === "processing");
    if (!hasProcessing) return;

    const interval = setInterval(fetchExports, 3000);
    return () => clearInterval(interval);
  }, [exports]);

  const fetchExports = async () => {
    try {
      const { data, error } = await supabase
        .from("exports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setExports(data || []);
    } catch (err) {
      console.error("Error fetching exports:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (exp: Export) => {
    if (!exp.file_path) return;

    setDownloading(exp.id);
    try {
      const { data, error } = await supabase.storage
        .from("exports")
        .createSignedUrl(exp.file_path, 60);

      if (error) throw error;

      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = exp.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download error:", err);
      toast({
        title: "Download Failed",
        description: "Could not download the export file.",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const handleDelete = async (exp: Export) => {
    try {
      // Delete from storage if file exists
      if (exp.file_path) {
        await supabase.storage.from("exports").remove([exp.file_path]);
      }

      // Delete record
      const { error } = await supabase
        .from("exports")
        .delete()
        .eq("id", exp.id);

      if (error) throw error;

      setExports((prev) => prev.filter((e) => e.id !== exp.id));
      toast({ title: "Export deleted" });
    } catch (err) {
      console.error("Delete error:", err);
      toast({
        title: "Delete Failed",
        description: "Could not delete the export.",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number | null): string => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFilterSummary = (filters: Record<string, any>): string => {
    const parts: string[] = [];
    if (filters.from_date && filters.to_date) {
      parts.push(`${filters.from_date} to ${filters.to_date}`);
    }
    if (filters.bank_account_name) parts.push(filters.bank_account_name);
    if (filters.company_name) parts.push(filters.company_name);
    if (filters.category_name) parts.push(filters.category_name);
    if (filters.status) parts.push(`status: ${filters.status}`);
    if (filters.needs_review) parts.push("needs review");
    if (filters.search_term) parts.push(`"${filters.search_term}"`);
    return parts.length > 0 ? parts.join(", ") : "All transactions";
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "processing":
        return (
          <Badge variant="outline" className="border-blue-300 bg-blue-50 text-blue-700">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="outline" className="border-green-300 bg-green-50 text-green-700">
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
            Failed
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Exports</h1>
              <p className="text-muted-foreground mt-1">
                Download your exported transaction files
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchExports}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Export History</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : exports.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No exports yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use the Export CSV button on the Transactions page to create one.
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>File</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Filters</TableHead>
                      <TableHead className="text-right">Rows</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exports.map((exp) => (
                      <TableRow key={exp.id}>
                        <TableCell className="font-medium text-sm">
                          {exp.file_name}
                        </TableCell>
                        <TableCell>{statusBadge(exp.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          <span title={getFilterSummary(exp.filters)}>
                            {getFilterSummary(exp.filters)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {exp.row_count?.toLocaleString() ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-sm">
                          {formatFileSize(exp.file_size)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(exp.created_at), "MMM d, yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {exp.status === "completed" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDownload(exp)}
                                disabled={downloading === exp.id}
                                title="Download"
                              >
                                {downloading === exp.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            {exp.status !== "processing" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(exp)}
                                title="Delete"
                                className="text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
