import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Clock,
} from "lucide-react";

interface BankAccount {
  id: string;
  name: string;
  account_number?: string;
  company_id: string;
  bank_name: string;
  currency: string;
  is_active?: boolean;
}

interface QueuedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: "pdf" | "csv";
  status: "queued" | "parsing" | "saving" | "success" | "error";
  result?: {
    statement_import_id: string;
    period: string;
    transaction_count: number;
    kb_matches: number;
    hitl_count: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface ParseStatementResult {
  success: boolean;
  action?: "review" | "save";
  status?: "balanced" | "unbalanced" | "no_balance_check";
  status_message?: string;
  transactions?: Array<{
    date: string;
    posting_date?: string;
    description: string;
    amount: number;
    type: "credit" | "debit";
    category_code?: string;
    payee_name?: string;
    has_gst?: boolean;
    gst_amount?: number;
    needs_review?: boolean;
    review_reason?: string;
    running_balance?: number;
    is_credit_card?: boolean;
    is_suspect?: boolean;
  }>;
  account_info?: {
    account_holder: string;
    account_number: string;
    statement_period: string;
    opening_balance: number;
    closing_balance: number;
    currency: string;
  };
  summary?: {
    total_credits: number;
    total_debits: number;
    transaction_count: number;
    hitl_count: number;
    inserted_count: number;
  };
  bank_account?: {
    id: string;
    name: string;
    company: string;
  };
  error?: string;
  statement_import_id?: string;
  inserted_count?: number;
}

interface QueueJob {
  job_id: string | null;
  file_name: string;
  status: "pending" | "processing" | "rate_limited" | "completed" | "failed";
  progress: number;
  error_message: string | null;
  transaction_count?: number;
  statement_import_id?: string;
}

export default function Upload() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const dragZoneRef = useRef<HTMLDivElement>(null);

  // State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankAccountId, setSelectedBankAccountId] =
    useState<string>("");
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [phase, setPhase] = useState<"select" | "processing" | "complete">(
    "select",
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Queue state
  const [queuedJobs, setQueuedJobs] = useState<QueueJob[]>([]);
  const [pollingActive, setPollingActive] = useState(false);

  // Fetch bank accounts on mount
  useEffect(() => {
    if (!user) return;

    const fetchBankAccounts = async () => {
      try {
        const { data, error: err } = await supabase
          .from("bank_accounts")
          .select("*")
          .eq("is_active", true)
          .order("name");

        if (err) throw err;
        setBankAccounts(data || []);
      } catch (err) {
        console.error("Failed to fetch bank accounts:", err);
        setError("Failed to load bank accounts");
      } finally {
        setLoadingAccounts(false);
      }
    };

    fetchBankAccounts();
  }, [user]);

  // Error message mapping
  const getErrorMessage = (code: string): string => {
    const messages: Record<string, string> = {
      DUPLICATE_STATEMENT: "Already imported - appears to be a duplicate",
      ACCOUNT_MISMATCH: "Account number doesn't match the selected account",
      PARSE_ERROR: "Failed to parse the statement",
      SAVE_ERROR: "Failed to save transactions",
      ERROR: "An error occurred while processing",
    };
    return messages[code] || code;
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // Update file status
  const updateFileStatus = (
    fileId: string,
    status: QueuedFile["status"],
    error?: QueuedFile["error"] | null,
    result?: QueuedFile["result"],
  ) => {
    setFiles((prev) =>
      prev.map((f) =>
        f.id === fileId
          ? { ...f, status, error: error || undefined, result }
          : f,
      ),
    );
  };

  // Validate and add files
  const addFiles = (newFiles: FileList) => {
    Array.from(newFiles).forEach((file) => {
      // Check file extension
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "csv"].includes(ext || "")) {
        setError("Invalid file type. Please upload PDF or CSV files.");
        return;
      }

      // Check file size (max 10MB)
      const maxSizeBytes = 10 * 1024 * 1024;
      if (file.size > maxSizeBytes) {
        setError(`File too large: ${file.name}. Maximum 10MB.`);
        return;
      }

      // Check for duplicates in queue
      if (files.some((f) => f.name === file.name && f.size === file.size)) {
        setError(`File already in queue: ${file.name}`);
        return;
      }

      // Add to queue
      const newFile: QueuedFile = {
        id: `file_${Date.now()}_${Math.random()}`,
        file,
        name: file.name,
        size: file.size,
        type: ext as "pdf" | "csv",
        status: "queued",
      };

      setFiles((prev) => [...prev, newFile]);
      setError(null);
    });
  };

  // Handle file input
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
      // Reset input
      if (e.target) e.target.value = "";
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  };

  // Remove file from queue
  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // Clear all files
  const clearAllFiles = () => {
    setFiles([]);
    setError(null);
  };

  // Process files sequentially
  const processFiles = async () => {
    if (!selectedBankAccountId) {
      setError("Please select a bank account");
      return;
    }

    setPhase("processing");
    setError(null);

    for (let i = 0; i < files.length; i++) {
      setCurrentIndex(i);
      const file = files[i];

      updateFileStatus(file.id, "parsing");

      try {
        // Step 1: Parse the file
        const parseFormData = new FormData();
        parseFormData.append("file", file.file);
        parseFormData.append("bank_account_id", selectedBankAccountId);
        parseFormData.append("action", "parse");

        const parseResponse = await fetch(
          "https://llxlkawdmuwsothxaada.supabase.co/functions/v1/parse-statement",
          {
            method: "POST",
            body: parseFormData,
          },
        );

        const parseResult: ParseStatementResult = await parseResponse.json();

        // Check for parse errors
        if (!parseResult.success) {
          updateFileStatus(file.id, "error", {
            code: parseResult.error || "PARSE_ERROR",
            message: getErrorMessage(parseResult.error || "PARSE_ERROR"),
          });
          continue;
        }

        // Step 2: Auto-save transactions
        updateFileStatus(file.id, "saving");

        const saveFormData = new FormData();
        saveFormData.append("action", "save");
        saveFormData.append("bank_account_id", selectedBankAccountId);
        saveFormData.append(
          "transactions",
          JSON.stringify(parseResult.transactions || []),
        );
        saveFormData.append(
          "account_info",
          JSON.stringify(parseResult.account_info || {}),
        );
        saveFormData.append("file_name", file.name);

        const saveResponse = await fetch(
          "https://llxlkawdmuwsothxaada.supabase.co/functions/v1/parse-statement",
          {
            method: "POST",
            body: saveFormData,
          },
        );

        const saveResult: ParseStatementResult = await saveResponse.json();

        // Check for save errors
        if (!saveResult.success && !saveResult.inserted_count) {
          updateFileStatus(file.id, "error", {
            code: saveResult.error || "SAVE_ERROR",
            message: getErrorMessage(saveResult.error || "SAVE_ERROR"),
          });
          continue;
        }

        // Success: Update with results
        updateFileStatus(file.id, "success", null, {
          statement_import_id:
            saveResult.statement_import_id ||
            `import_${Date.now()}_${Math.random()}`,
          period: parseResult.account_info?.statement_period || "Unknown",
          transaction_count:
            saveResult.inserted_count || parseResult.transactions?.length || 0,
          kb_matches:
            (parseResult.summary?.transaction_count || 0) -
            (parseResult.summary?.hitl_count || 0),
          hitl_count: parseResult.summary?.hitl_count || 0,
        });
      } catch (err) {
        updateFileStatus(file.id, "error", {
          code: "ERROR",
          message: err instanceof Error ? err.message : "Connection error",
        });
      }
    }

    setPhase("complete");
  };

  // Reset form
  const handleResetForm = () => {
    setFiles([]);
    setPhase("select");
    setCurrentIndex(0);
    setError(null);
  };

  // Navigation helper
  const goToStatements = (accountId: string, statementId: string) => {
    navigate(`/statements?account=${accountId}&statement=${statementId}`);
  };

  // Calculate summary stats
  const stats = {
    succeeded: files.filter((f) => f.status === "success").length,
    failed: files.filter((f) => f.status === "error").length,
    totalTransactions: files.reduce(
      (sum, f) => sum + (f.result?.transaction_count || 0),
      0,
    ),
    totalHitl: files.reduce((sum, f) => sum + (f.result?.hitl_count || 0), 0),
  };

  if (authLoading || loadingAccounts) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 p-8">
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="max-w-2xl">
          {phase === "select" && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Upload Bank Statements
                </h1>
                <p className="text-gray-600">
                  Upload one or multiple PDF or CSV files
                </p>
              </div>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Select Bank Account</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select
                    value={selectedBankAccountId}
                    onValueChange={setSelectedBankAccountId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a bank account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.account_number})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-2">
                    Required before uploading
                  </p>
                </CardContent>
              </Card>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Upload Files</CardTitle>
                </CardHeader>
                <CardContent>
                  <div
                    ref={dragZoneRef}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition ${
                      dragActive
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-base font-medium text-gray-700 mb-1">
                      Drag & drop PDF or CSV files here
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      or click to browse (select multiple)
                    </p>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.csv"
                      onChange={handleFileInput}
                      className="hidden"
                      id="file-input"
                    />
                    <label htmlFor="file-input">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() =>
                          document.getElementById("file-input")?.click()
                        }
                      >
                        Browse Files
                      </Button>
                    </label>
                  </div>

                  {error && (
                    <Alert className="mt-4 bg-red-50 border-red-200">
                      <AlertCircle className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        {error}
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {files.length > 0 && (
                <Card className="mb-6">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Queued Files ({files.length})</CardTitle>
                    {files.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAllFiles}
                        className="text-red-600 hover:text-red-700"
                      >
                        Clear All
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {files.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <FileText className="h-5 w-5 text-blue-600" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {f.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatFileSize(f.size)}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => removeFile(f.id)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <X className="h-4 w-4 text-gray-500" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button
                onClick={processFiles}
                disabled={files.length === 0 || !selectedBankAccountId}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                Upload {files.length} {files.length === 1 ? "File" : "Files"}
              </Button>
            </>
          )}

          {phase === "processing" && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Processing Statements ({currentIndex + 1}/{files.length})
                </h1>
                <p className="text-gray-600">
                  Please don't close this page while processing...
                </p>
              </div>

              <Card>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    {files.map((f) => (
                      <div key={f.id} className="border rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          {f.status === "success" && (
                            <CheckCircle className="h-5 w-5 text-green-600 mt-1 flex-shrink-0" />
                          )}
                          {f.status === "error" && (
                            <XCircle className="h-5 w-5 text-red-600 mt-1 flex-shrink-0" />
                          )}
                          {(f.status === "parsing" ||
                            f.status === "saving") && (
                            <Loader2 className="h-5 w-5 text-blue-600 animate-spin mt-1 flex-shrink-0" />
                          )}
                          {f.status === "queued" && (
                            <AlertTriangle className="h-5 w-5 text-gray-400 mt-1 flex-shrink-0" />
                          )}

                          <div className="flex-1 min-w-0">
                            <p
                              className={`font-medium ${
                                f.status === "success"
                                  ? "text-green-700"
                                  : f.status === "error"
                                    ? "text-red-700"
                                    : "text-gray-900"
                              }`}
                            >
                              {f.name}
                            </p>

                            {f.status === "parsing" && (
                              <p className="text-xs text-gray-500 mt-1">
                                Parsing...
                              </p>
                            )}
                            {f.status === "saving" && (
                              <p className="text-xs text-gray-500 mt-1">
                                Saving...
                              </p>
                            )}
                            {f.result && (
                              <p className="text-xs text-gray-600 mt-1">
                                {f.result.period} • {f.result.transaction_count}{" "}
                                txns • {f.result.kb_matches} auto-categorized
                              </p>
                            )}
                            {f.error && (
                              <p className="text-xs text-red-600 mt-1">
                                {f.error.message}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {phase === "complete" && (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  ✅ Upload Complete
                </h1>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-600">
                        {stats.succeeded}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Succeeded</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-600">
                        {stats.failed}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Failed</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-blue-600">
                        {stats.totalTransactions}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Transactions</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-orange-600">
                        {stats.totalHitl}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">Needs Review</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {files.map((f) => (
                      <div key={f.id} className="border rounded-lg p-4">
                        {f.status === "success" ? (
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <p className="font-medium text-gray-900">
                                  {f.name}
                                </p>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                {f.result?.period} •{" "}
                                {f.result?.transaction_count} transactions
                              </p>
                            </div>
                            {f.result && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  goToStatements(
                                    selectedBankAccountId,
                                    f.result.statement_import_id,
                                  )
                                }
                              >
                                View
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="font-medium text-gray-900">
                                {f.name}
                              </p>
                              <p className="text-sm text-red-600 mt-1">
                                {f.error?.message}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  onClick={handleResetForm}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  Upload More
                </Button>
                {stats.totalHitl > 0 && (
                  <Button
                    onClick={() => navigate("/review-queue")}
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                    size="lg"
                  >
                    Go to Review Queue
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
