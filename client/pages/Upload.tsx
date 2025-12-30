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
import {
  Upload as UploadIcon,
  Loader2,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Package,
  Circle,
  XCircle,
  RefreshCw,
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
}

interface ProcessingStatus {
  stage:
    | ""
    | "uploading"
    | "parsing"
    | "validating"
    | "correcting"
    | "saving"
    | "complete"
    | "error";
  message: string;
  details: string;
  progress: number;
  attempts: number;
}

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
  color?: "green" | "orange" | "blue" | "purple";
}

interface StatusStepProps {
  step: number;
  label: string;
  status: "pending" | "active" | "complete" | "error";
  detail?: string;
  isRetry?: boolean;
}

function StatusStep({ step, label, status, detail, isRetry }: StatusStepProps) {
  const icons = {
    pending: <Circle className="h-5 w-5 text-gray-300" />,
    active: <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />,
    complete: <CheckCircle className="h-5 w-5 text-green-600" />,
    error: <XCircle className="h-5 w-5 text-red-600" />,
    retry: <RefreshCw className="h-5 w-5 text-orange-500 animate-spin" />,
  };

  return (
    <div
      className={`flex items-start gap-3 ${status === "pending" ? "opacity-50" : ""}`}
    >
      {isRetry ? icons.retry : icons[status]}
      <div className="flex-1">
        <p
          className={`text-sm font-medium ${
            status === "active"
              ? "text-blue-700"
              : status === "complete"
                ? "text-green-700"
                : status === "error"
                  ? "text-red-700"
                  : "text-gray-500"
          }`}
        >
          {label}
        </p>
        {detail && status === "active" && (
          <p className="text-xs text-gray-500">{detail}</p>
        )}
      </div>
      {status === "complete" && (
        <span className="text-xs text-green-600">✓</span>
      )}
    </div>
  );
}

interface ProgressStepProps {
  icon: typeof Loader2;
  label: string;
  detail?: string;
  status: "pending" | "active" | "complete";
}

function ProgressStep({
  icon: Icon,
  label,
  detail,
  status,
}: ProgressStepProps) {
  const colors = {
    pending: "text-gray-300",
    active: "text-blue-600",
    complete: "text-green-600",
  };

  return (
    <div
      className={`flex items-start gap-3 ${status === "pending" ? "opacity-50" : ""}`}
    >
      <Icon
        className={`h-5 w-5 mt-0.5 ${colors[status]} ${status === "active" ? "animate-spin" : ""}`}
      />
      <div>
        <p
          className={`font-medium ${
            status === "active"
              ? "text-blue-700"
              : status === "complete"
                ? "text-green-700"
                : "text-gray-400"
          }`}
        >
          {label}
        </p>
        {detail && status === "active" && (
          <p className="text-sm text-gray-500">{detail}</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  highlight,
  color = "blue",
}: StatCardProps) {
  const bgColor = {
    green: "bg-green-50",
    orange: "bg-orange-50",
    blue: "bg-blue-50",
    purple: "bg-purple-50",
  }[color];

  const iconColor = {
    green: "text-green-600",
    orange: "text-orange-600",
    blue: "text-blue-600",
    purple: "text-purple-600",
  }[color];

  return (
    <div
      className={`${bgColor} rounded-lg p-4 ${highlight ? "ring-2 ring-offset-2 ring-orange-400" : ""}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
        <div className={`${iconColor} p-2 rounded-lg`}>{icon}</div>
      </div>
    </div>
  );
}

export default function Upload() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBankAccountId, setSelectedBankAccountId] =
    useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ParseStatementResult | null>(null);
  const [balanceError, setBalanceError] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    stage: "",
    message: "",
    details: "",
    progress: 0,
    attempts: 0,
  });
  const [editableTransactions, setEditableTransactions] = useState<
    Array<
      Record<string, unknown> & { original_type?: string; changed?: boolean }
    >
  >([]);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [processingStage, setProcessingStage] = useState(0);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusDetail, setStatusDetail] = useState("");
  const [parsedData, setParsedData] = useState<
    Record<string, unknown> | null
  >(null);
  const [allTransactions, setAllTransactions] = useState<
    Array<
      Record<string, unknown> & {
        original_type?: string;
        original_amount?: number;
        changed?: boolean;
      }
    >
  >([]);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const getStepStatus = (
    step: number,
  ): "pending" | "active" | "complete" | "error" => {
    const stages = {
      uploading: 1,
      parsing: 2,
      validating: 3,
      correcting: 4,
      saving: 5,
      complete: 6,
      error: 7,
    };

    const currentStage =
      (stages as Record<string, number>)[processingStatus.stage] || 0;

    if (processingStatus.stage === "error") return "error";
    if (step < currentStage) return "complete";
    if (step === currentStage) return "active";
    return "pending";
  };

  const toggleTransactionType = (index: number) => {
    setEditableTransactions((prev) =>
      prev.map((t, i) => {
        if (i === index) {
          const newType = (t.type as string) === "credit" ? "debit" : "credit";
          return {
            ...t,
            type: newType,
            changed: newType !== (t.original_type as string),
          };
        }
        return t;
      }),
    );
  };

  const calculateNewBalance = (): string => {
    if (!balanceError?.reconciliation) return "0.00";

    const reconciliation = balanceError.reconciliation as Record<
      string,
      unknown
    >;
    let balance = (reconciliation.statement_opening as number) || 0;

    editableTransactions.forEach((t) => {
      const amount = (t.amount as number) || 0;
      if ((t.type as string) === "credit") {
        balance += amount;
      } else {
        balance -= amount;
      }
    });

    return balance.toFixed(2);
  };

  const handleResubmitWithCorrections = async () => {
    if (!selectedFile || !selectedBankAccountId) return;

    setIsRevalidating(true);

    // Get the corrections (transactions that were flipped)
    const corrections = editableTransactions
      .filter((t) => (t.type as string) !== (t.original_type as string))
      .map((t) => ({
        description: t.description as string,
        date: t.date as string,
        amount: t.amount as number,
        corrected_type: t.type as string,
      }));

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("bank_account_id", selectedBankAccountId);
    formData.append("corrections", JSON.stringify(corrections));

    try {
      const response = await fetch(
        "https://llxlkawdmuwsothxaada.supabase.co/functions/v1/parse-statement",
        {
          method: "POST",
          body: formData,
        },
      );

      const result: ParseStatementResult = await response.json();

      if (result.success) {
        setBalanceError(null);
        setEditableTransactions([]);
        setResult(result);
        setSelectedFile(null);
        setSelectedBankAccountId("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else if (result.error === "BALANCE_MISMATCH") {
        // Still not balanced, update the error
        setBalanceError(result);
      } else {
        setError(result.error || "Revalidation failed");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Revalidation failed";
      setError(errorMessage);
    }

    setIsRevalidating(false);
  };

  const handleSaveTransactions = async () => {
    if (!selectedBankAccountId || allTransactions.length === 0) return;

    setIsSaving(true);

    try {
      const formData = new FormData();
      formData.append("bank_account_id", selectedBankAccountId);
      formData.append("action", "save");
      formData.append(
        "transactions",
        JSON.stringify(
          allTransactions.map((t) => ({
            date: t.date,
            posting_date: t.posting_date,
            description: t.description,
            amount: t.amount,
            type: t.type,
            category_code: t.category_code,
            payee_name: t.payee_name,
            has_gst: t.has_gst,
            gst_amount: t.gst_amount,
            needs_review: t.needs_review,
            review_reason: t.review_reason,
            was_edited: t.changed,
          })),
        ),
      );

      const response = await fetch(
        "https://llxlkawdmuwsothxaada.supabase.co/functions/v1/parse-statement",
        {
          method: "POST",
          body: formData,
        },
      );

      const saveResult = await response.json();

      if (
        (saveResult as Record<string, unknown>).success ||
        (saveResult as Record<string, unknown>).inserted_count
      ) {
        const insertedCount =
          (saveResult as Record<string, unknown>).inserted_count ||
          allTransactions.length;

        // Show success toast (requires toast implementation)
        console.log(`✓ Saved ${insertedCount} transactions!`);

        // Reset state
        setIsReviewing(false);
        setParsedData(null);
        setAllTransactions([]);
        setSelectedFile(null);
        setSelectedBankAccountId("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        // Show success result
        setResult({
          success: true,
          account_info: {
            account_holder:
              (parsedData as Record<string, unknown>)?.account_info?.
                account_holder || "",
            account_number:
              (parsedData as Record<string, unknown>)?.account_info?.
                account_number || "",
            statement_period:
              (parsedData as Record<string, unknown>)?.account_info?.
                statement_period || "",
            opening_balance: 0,
            closing_balance: 0,
            currency: "CAD",
          },
          summary: {
            total_credits: 0,
            total_debits: 0,
            transaction_count: allTransactions.length,
            hitl_count: 0,
            inserted_count: insertedCount as number,
          },
        });
      } else {
        setError(
          (saveResult as Record<string, unknown>).error ||
            "Failed to save transactions",
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to save transactions";
      setError(errorMessage);
      console.error("Save error:", err);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Fetch bank accounts on mount
  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        const { data, error } = await supabase
          .from("bank_accounts")
          .select(
            "id, name, account_number, company_id, bank_name, currency, is_active",
          )
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        setBankAccounts(data || []);
      } catch (err) {
        console.error("Error fetching bank accounts:", err);
        setError("Failed to load bank accounts");
      } finally {
        setLoadingAccounts(false);
      }
    };

    if (user) {
      fetchBankAccounts();
    }
  }, [user]);

  // Populate editable transactions when balance error occurs
  useEffect(() => {
    if (
      balanceError?.reconciliation &&
      (balanceError.reconciliation as Record<string, unknown>)
        .suspect_transactions
    ) {
      const suspects = (balanceError.reconciliation as Record<string, unknown>)
        .suspect_transactions as Array<Record<string, unknown>>;
      setEditableTransactions(
        suspects.map((t) => ({
          ...t,
          original_type: t.type,
          changed: false,
        })),
      );
    }
  }, [balanceError]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    // Validate file type
    if (file.type !== "application/pdf") {
      setError("Only PDF files are accepted");
      return;
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File size must be less than 10MB");
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile || !selectedBankAccountId) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setBalanceError(null);
    setEditableTransactions([]);
    setProcessingStage(1);
    setStatusMessage("AI is reading the statement...");
    setStatusDetail("Extracting account info and transactions");

    // Stage 1: Uploading
    setProcessingStatus({
      stage: "uploading",
      message: "Uploading PDF to server...",
      details: selectedFile.name,
      progress: 10,
      attempts: 0,
    });

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("bank_account_id", selectedBankAccountId);

    try {
      // Stage 2: Parsing
      setProcessingStage(2);
      setStatusMessage("Validating balance...");
      setStatusDetail("Checking: Opening + Credits - Debits = Closing");
      setProcessingStatus({
        stage: "parsing",
        message: "AI is reading the statement...",
        details: "Extracting account info and transactions",
        progress: 30,
        attempts: 1,
      });

      const response = await fetch(
        "https://llxlkawdmuwsothxaada.supabase.co/functions/v1/parse-statement",
        {
          method: "POST",
          body: formData,
        },
      );

      // Stage 3: Validating
      setProcessingStatus((prev) => ({
        ...prev,
        stage: "validating",
        message: "Checking balance calculation...",
        details: "Opening + Credits - Debits = Closing",
        progress: 60,
      }));

      const data: ParseStatementResult = await response.json();

      // Check if correction was needed
      if (
        data.success &&
        (data as Record<string, unknown>).reconciliation &&
        (
          (data as Record<string, unknown>).reconciliation as Record<
            string,
            unknown
          >
        ).attempts > 1
      ) {
        const reconciliation = (data as Record<string, unknown>)
          .reconciliation as Record<string, unknown>;
        setProcessingStatus((prev) => ({
          ...prev,
          stage: "correcting",
          message: `AI self-corrected (${reconciliation.attempts} attempts)`,
          details: "Found and fixed transaction direction errors",
          progress: 80,
          attempts: (reconciliation.attempts as number) || 1,
        }));

        // Brief pause to show correction status
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (data.success) {
        // Check if we should enter review mode or show results
        if ((data as Record<string, unknown>).action === "review") {
          // Enter two-step review flow
          setProcessingStage(4);
          setStatusMessage("Ready for Review");
          setStatusDetail("Please verify the parsed transactions below");
          setProcessingStatus({
            stage: "complete",
            message: "Successfully parsed!",
            details: "Ready for review",
            progress: 100,
            attempts:
              (
                (data as Record<string, unknown>).reconciliation as Record<
                  string,
                  unknown
                >
              )?.attempts || 1,
          });

          // Brief pause to show completion
          await new Promise((resolve) => setTimeout(resolve, 800));

          // Set review mode with transactions
          setParsedData(data);
          setAllTransactions(
            (
              (data as Record<string, unknown>).transactions as Array<
                Record<string, unknown>
              >
            ).map((t) => ({
              ...t,
              original_type: t.type,
              original_amount: t.amount as number,
              changed: false,
            })),
          );
          setIsReviewing(true);
        } else {
          // Original flow - direct save
          setProcessingStage(4);
          setStatusMessage("Complete!");
          setStatusDetail(
            `${data.summary?.inserted_count || data.summary?.transaction_count || 0} transactions saved`,
          );
          setProcessingStatus({
            stage: "complete",
            message: "Successfully processed!",
            details: `${data.summary?.inserted_count || data.summary?.transaction_count || 0} transactions saved`,
            progress: 100,
            attempts:
              (
                (data as Record<string, unknown>).reconciliation as Record<
                  string,
                  unknown
                >
              )?.attempts || 1,
          });

          // Brief pause to show success
          await new Promise((resolve) => setTimeout(resolve, 800));

          setResult(data);
          setSelectedFile(null);
          setSelectedBankAccountId("");
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
        }
      } else if (data.error === "BALANCE_MISMATCH") {
        setProcessingStatus({
          stage: "error",
          message: "Balance mismatch detected",
          details: `Off by $${Math.abs((data as Record<string, unknown>).reconciliation ? ((data as Record<string, unknown>).reconciliation as Record<string, unknown>).difference : 0).toFixed(2)}`,
          progress: 100,
          attempts: (data as Record<string, unknown>).reconciliation
            ? (
                (data as Record<string, unknown>).reconciliation as Record<
                  string,
                  unknown
                >
              ).attempts
            : 0,
        });
        setBalanceError(data);
        setError(
          "Balance mismatch detected. Please review the error details below.",
        );
      } else {
        setProcessingStatus({
          stage: "error",
          message: "Processing failed",
          details: data.error || "Unknown error",
          progress: 100,
          attempts: 0,
        });
        setError(
          data.error || "Failed to process statement. Please try again.",
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setProcessingStatus({
        stage: "error",
        message: "Upload failed",
        details: errorMessage,
        progress: 0,
        attempts: 0,
      });
      console.error("Upload error:", err);
      setError("Upload failed. Please check your file and try again.");
    } finally {
      setLoading(false);
      setProcessingStage(0);
    }
  };

  const handleResetForm = () => {
    setResult(null);
    setSelectedFile(null);
    setSelectedBankAccountId("");
    setError(null);
    setBalanceError(null);
    setEditableTransactions([]);
    setProcessingStage(0);
    setStatusMessage("");
    setStatusDetail("");
    setProcessingStatus({
      stage: "",
      message: "",
      details: "",
      progress: 0,
      attempts: 0,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (authLoading || loadingAccounts) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isFormValid = selectedFile && selectedBankAccountId;
  const hasHitlItems =
    result?.summary?.hitl_count && result.summary.hitl_count > 0;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="p-8 max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">
              Upload Bank Statement
            </h1>
            <p className="text-muted-foreground mt-1">
              Upload PDF statements to automatically parse and categorize
              transactions
            </p>
          </div>

          {/* Processing Status Display */}
          {loading && processingStatus.stage && (
            <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Loader2 className="h-6 w-6 text-blue-600 animate-spin" />
                <h3 className="text-lg font-semibold text-blue-800">
                  Processing Statement
                </h3>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-blue-100 rounded-full h-2 mb-4">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${processingStatus.progress}%` }}
                />
              </div>

              {/* Status Steps */}
              <div className="space-y-3">
                <StatusStep
                  step={1}
                  label="Uploading PDF"
                  status={getStepStatus(1)}
                />
                <StatusStep
                  step={2}
                  label="AI Reading Statement"
                  status={getStepStatus(2)}
                  detail="Extracting transactions and balances..."
                />
                <StatusStep
                  step={3}
                  label="Validating Balance"
                  status={getStepStatus(3)}
                  detail="Opening + Credits - Debits = Closing"
                />
                {processingStatus.attempts > 1 && (
                  <StatusStep
                    step={4}
                    label={`Self-Correction (Attempt ${processingStatus.attempts})`}
                    status={getStepStatus(4)}
                    detail="AI re-checking transactions..."
                    isRetry
                  />
                )}
                <StatusStep
                  step={5}
                  label="Saving Transactions"
                  status={getStepStatus(5)}
                />
              </div>

              {/* Current Action Detail */}
              <div className="mt-4 p-3 bg-white rounded border border-blue-100">
                <p className="text-sm text-blue-700 font-medium">
                  {processingStatus.message}
                </p>
                {processingStatus.details && (
                  <p className="text-xs text-blue-500 mt-1">
                    {processingStatus.details}
                  </p>
                )}
              </div>

              {/* Time Estimate */}
              <p className="text-xs text-blue-400 mt-3 text-center">
                This typically takes 30-60 seconds. Scanned PDFs may take
                longer.
              </p>
            </div>
          )}

          {/* Review Screen */}
          {isReviewing && parsedData && (
            <div className="space-y-6 mb-8">
              {/* Status Header */}
              <div
                className={`rounded-lg p-4 mb-6 border ${
                  (parsedData as Record<string, unknown>).status === "balanced"
                    ? "bg-green-100 border-green-300"
                    : (parsedData as Record<string, unknown>).status ===
                        "unbalanced"
                      ? "bg-yellow-100 border-yellow-300"
                      : "bg-blue-100 border-blue-300"
                }`}
              >
                <div className="flex items-center gap-3">
                  {(parsedData as Record<string, unknown>).status ===
                    "balanced" && (
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  )}
                  {(parsedData as Record<string, unknown>).status ===
                    "unbalanced" && (
                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                  )}
                  {(parsedData as Record<string, unknown>).status ===
                    "no_balance_check" && (
                    <FileText className="h-6 w-6 text-blue-600" />
                  )}

                  <div className="flex-1">
                    <h3
                      className={`font-bold ${
                        (parsedData as Record<string, unknown>).status ===
                        "balanced"
                          ? "text-green-800"
                          : (parsedData as Record<string, unknown>).status ===
                              "unbalanced"
                            ? "text-yellow-800"
                            : "text-blue-800"
                      }`}
                    >
                      {(parsedData as Record<string, unknown>).status ===
                        "balanced" && "Balance Verified ✓"}
                      {(parsedData as Record<string, unknown>).status ===
                        "unbalanced" &&
                        "Balance Mismatch - Review Required"}
                      {(parsedData as Record<string, unknown>).status ===
                        "no_balance_check" &&
                        "Credit Card Statement - Review Transactions"}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {(parsedData as Record<string, unknown>)
                        .status_message || ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Info Card */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Statement Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Account Holder
                      </p>
                      <p className="font-semibold text-lg">
                        {(
                          (parsedData as Record<string, unknown>)
                            .account_info as Record<string, unknown>
                        )?.account_holder || "Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Account Number
                      </p>
                      <p className="font-semibold text-lg">
                        ••••
                        {(
                          (parsedData as Record<string, unknown>)
                            .account_info as Record<string, unknown>
                        )?.account_number || "****"}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">
                        Statement Period
                      </p>
                      <p className="font-semibold text-lg">
                        {(
                          (parsedData as Record<string, unknown>)
                            .account_info as Record<string, unknown>
                        )?.statement_period || "Unknown"}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Opening Balance
                        </p>
                        <p className="text-lg font-semibold">
                          $
                          {(
                            (
                              (parsedData as Record<string, unknown>)
                                .account_info as Record<string, unknown>
                            )?.opening_balance as number
                          )?.toFixed(2) || "0.00"}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Closing Balance
                        </p>
                        <p className="text-lg font-semibold">
                          $
                          {(
                            (
                              (parsedData as Record<string, unknown>)
                                .account_info as Record<string, unknown>
                            )?.closing_balance as number
                          )?.toFixed(2) || "0.00"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Transaction Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <StatCard
                      label="Total Transactions"
                      value={allTransactions.length}
                      icon={<Package className="h-6 w-6" />}
                      color="blue"
                    />
                    <StatCard
                      label="Total Credits"
                      value={`$${allTransactions
                        .filter((t) => (t.type as string) === "credit")
                        .reduce((sum, t) => sum + ((t.amount as number) || 0), 0)
                        .toFixed(2)}`}
                      icon={<TrendingUp className="h-6 w-6" />}
                      color="green"
                    />
                    <StatCard
                      label="Total Debits"
                      value={`$${allTransactions
                        .filter((t) => (t.type as string) === "debit")
                        .reduce((sum, t) => sum + ((t.amount as number) || 0), 0)
                        .toFixed(2)}`}
                      icon={<TrendingUp className="h-6 w-6" />}
                      color="purple"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleSaveTransactions}
                  disabled={isSaving}
                  size="lg"
                  className={`flex-1 text-white ${
                    (parsedData as Record<string, unknown>).status ===
                    "balanced"
                      ? "bg-green-600 hover:bg-green-700"
                      : (parsedData as Record<string, unknown>).status ===
                          "unbalanced"
                        ? "bg-yellow-600 hover:bg-yellow-700"
                        : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Confirm & Save {allTransactions.length} Transactions
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={() => {
                    setIsReviewing(false);
                    setParsedData(null);
                    setAllTransactions([]);
                    setSelectedFile(null);
                    setSelectedBankAccountId("");
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  disabled={isSaving}
                  size="lg"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Results Display */}
          {result?.success && (
            <div className="space-y-6 mb-8">
              {/* Account Info */}
              <Card>
                <CardHeader className="bg-gradient-to-r from-blue-50 to-blue-100">
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    Statement Processed Successfully
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Account Holder
                      </p>
                      <p className="font-semibold text-lg">
                        {result.account_info?.account_holder}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Account Number
                      </p>
                      <p className="font-semibold text-lg">
                        ••••{result.account_info?.account_number}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-sm text-muted-foreground">
                        Statement Period
                      </p>
                      <p className="font-semibold text-lg">
                        {result.account_info?.statement_period}
                      </p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Opening Balance
                        </p>
                        <p className="text-lg font-semibold">
                          ${result.account_info?.opening_balance?.toFixed(2)}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Closing Balance
                        </p>
                        <p className="text-lg font-semibold">
                          ${result.account_info?.closing_balance?.toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Summary Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <StatCard
                      label="Total Transactions"
                      value={result.summary?.transaction_count || 0}
                      icon={<Package className="h-6 w-6" />}
                      color="blue"
                    />
                    <StatCard
                      label="Successfully Categorized"
                      value={
                        (result.summary?.transaction_count || 0) -
                        (result.summary?.hitl_count || 0)
                      }
                      icon={<CheckCircle className="h-6 w-6" />}
                      color="green"
                    />
                    {hasHitlItems && (
                      <StatCard
                        label="Needs Review"
                        value={result.summary?.hitl_count || 0}
                        icon={<AlertTriangle className="h-6 w-6" />}
                        highlight
                        color="orange"
                      />
                    )}
                    <StatCard
                      label="Total Credits"
                      value={`$${result.summary?.total_credits?.toFixed(2)}`}
                      icon={<TrendingUp className="h-6 w-6" />}
                      color="green"
                    />
                    <StatCard
                      label="Total Debits"
                      value={`$${result.summary?.total_debits?.toFixed(2)}`}
                      icon={<TrendingUp className="h-6 w-6" />}
                      color="purple"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={() => navigate("/transactions")}
                  size="lg"
                  className="flex-1"
                >
                  View Transactions
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                {hasHitlItems && (
                  <Button
                    onClick={() => navigate("/review-queue")}
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                  >
                    Review {result.summary?.hitl_count} Items
                    <AlertTriangle className="ml-2 h-4 w-4" />
                  </Button>
                )}
                <Button onClick={handleResetForm} variant="outline" size="lg">
                  Upload Another
                </Button>
              </div>
            </div>
          )}

          {/* Progress Tracker - Shown only during processing */}
          {loading && processingStage > 0 && (
            <Card className="max-w-2xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                    Processing Statement
                  </h2>

                  {/* Show which file is being processed */}
                  <div className="text-sm text-gray-500 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {selectedFile?.name}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Progress Steps */}
                <div className="space-y-4">
                  <ProgressStep
                    icon={CheckCircle}
                    label="Uploading PDF"
                    status={processingStage >= 1 ? "complete" : "pending"}
                  />
                  <ProgressStep
                    icon={processingStage >= 2 ? CheckCircle : Loader2}
                    label="AI Reading Statement"
                    detail="Extracting transactions and balances..."
                    status={
                      processingStage >= 2
                        ? "complete"
                        : processingStage === 1
                          ? "active"
                          : "pending"
                    }
                  />
                  <ProgressStep
                    icon={processingStage >= 3 ? CheckCircle : Circle}
                    label="Validating Balance"
                    detail="Opening + Credits - Debits = Closing"
                    status={
                      processingStage >= 3
                        ? "complete"
                        : processingStage === 2
                          ? "active"
                          : "pending"
                    }
                  />
                  <ProgressStep
                    icon={processingStage >= 4 ? CheckCircle : Circle}
                    label="Saving Transactions"
                    status={
                      processingStage >= 4
                        ? "complete"
                        : processingStage === 3
                          ? "active"
                          : "pending"
                    }
                  />
                </div>

                {/* Current status message */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <p className="text-blue-700 font-medium">{statusMessage}</p>
                  {statusDetail && (
                    <p className="text-blue-500 text-sm mt-1">{statusDetail}</p>
                  )}
                </div>

                <p className="text-xs text-gray-400 mt-4 text-center">
                  This typically takes 30-60 seconds. Scanned PDFs may take
                  longer.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Upload Form - Hidden during processing or review */}
          {!loading && !result?.success && !balanceError && !isReviewing && (
            <Card className="max-w-2xl">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <UploadIcon className="h-6 w-6 text-primary" />
                  <CardTitle>Upload Bank Statement</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Drag and Drop Zone */}
                <div
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    dragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-sm text-foreground font-medium mb-1">
                    Drag & drop your bank statement PDF here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF files only, max 10MB. Supports both digital and scanned
                    PDFs.
                  </p>
                </div>

                {/* Selected File Display */}
                {selectedFile && (
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">
                          {selectedFile.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFile();
                      }}
                      className="h-8 w-8"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Bank Account Dropdown */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Select Bank Account *
                  </label>
                  <Select
                    value={selectedBankAccountId}
                    onValueChange={setSelectedBankAccountId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a bank account..." />
                    </SelectTrigger>
                    <SelectContent>
                      {bankAccounts.length === 0 ? (
                        <div className="p-2 text-sm text-muted-foreground">
                          No bank accounts found. Create one in Settings.
                        </div>
                      ) : (
                        bankAccounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.name} ({account.bank_name} -{" "}
                            {account.currency})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={!isFormValid || loading}
                  className="w-full"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing... This may take 30-60 seconds
                    </>
                  ) : (
                    <>
                      <UploadIcon className="h-4 w-4 mr-2" />
                      Process Statement
                    </>
                  )}
                </Button>

                {/* Error Message */}
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Balance Mismatch Error Details */}
                {balanceError?.reconciliation && (
                  <div className="mt-4 space-y-4">
                    {(balanceError.reconciliation as Record<string, unknown>)
                      .first_error && (
                      <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                        <h4 className="font-bold text-yellow-800 mb-2">
                          🎯 Error Located:{" "}
                          {
                            (
                              (
                                balanceError.reconciliation as Record<
                                  string,
                                  unknown
                                >
                              ).first_error as Record<string, unknown>
                            ).date
                          }
                        </h4>
                        <p className="text-sm text-yellow-700">
                          Transaction:{" "}
                          {
                            (
                              (
                                balanceError.reconciliation as Record<
                                  string,
                                  unknown
                                >
                              ).first_error as Record<string, unknown>
                            ).transaction
                          }
                        </p>
                        <div className="mt-2 text-sm space-y-1">
                          <p>
                            Expected balance: $
                            {(
                              (
                                (
                                  balanceError.reconciliation as Record<
                                    string,
                                    unknown
                                  >
                                ).first_error as Record<string, unknown>
                              ).expected as number
                            ).toFixed(2)}
                          </p>
                          <p>
                            Calculated: $
                            {(
                              (
                                (
                                  balanceError.reconciliation as Record<
                                    string,
                                    unknown
                                  >
                                ).first_error as Record<string, unknown>
                              ).calculated as number
                            ).toFixed(2)}
                          </p>
                          <p className="font-bold text-red-600">
                            Off by: $
                            {Math.abs(
                              ((
                                (
                                  balanceError.reconciliation as Record<
                                    string,
                                    unknown
                                  >
                                ).first_error as Record<string, unknown>
                              ).difference as number) || 0,
                            ).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}

                    {editableTransactions.length > 0 && (
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-gray-800">
                            🔧 Edit &amp; Resubmit Transactions
                          </h4>
                          <p className="text-xs text-gray-500">
                            Click on a transaction to flip Debit ↔ Credit
                          </p>
                        </div>

                        {/* Editable Transaction List */}
                        <div className="space-y-2 mb-4">
                          {editableTransactions.map((t, i) => (
                            <div
                              key={i}
                              onClick={() => toggleTransactionType(i)}
                              className={`
                            flex justify-between items-center p-3 rounded-lg border-2 cursor-pointer
                            transition-all duration-200 hover:shadow-md
                            ${
                              (t.changed as boolean)
                                ? "border-green-400 bg-green-50"
                                : "border-gray-200 bg-white hover:border-blue-300"
                            }
                          `}
                            >
                              <div className="flex items-center gap-3">
                                {/* Direction Toggle Button */}
                                <button
                                  className={`
                                w-20 px-2 py-1 rounded text-xs font-bold transition-colors
                                ${
                                  (t.type as string) === "credit"
                                    ? "bg-green-500 text-white"
                                    : "bg-red-500 text-white"
                                }
                              `}
                                >
                                  {(t.type as string) === "credit"
                                    ? "↓ CREDIT"
                                    : "↑ DEBIT"}
                                </button>

                                <div>
                                  <p className="text-sm font-medium text-gray-800">
                                    {t.description as string}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {t.date as string}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right">
                                <p
                                  className={`font-bold ${
                                    (t.type as string) === "credit"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }`}
                                >
                                  {(t.type as string) === "credit" ? "+" : "-"}$
                                  {((t.amount as number) || 0).toLocaleString(
                                    "en-CA",
                                    {
                                      minimumFractionDigits: 2,
                                    },
                                  )}
                                </p>
                                {(t.changed as boolean) && (
                                  <span className="text-xs text-green-600 font-medium">
                                    ✓ Changed
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Balance Preview */}
                        <div className="bg-gray-100 rounded-lg p-4 mb-4">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-600">
                              Expected Closing Balance:
                            </span>
                            <span className="font-bold">
                              $
                              {(
                                (
                                  balanceError.reconciliation as Record<
                                    string,
                                    unknown
                                  >
                                ).statement_closing as number
                              ).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-gray-600">
                              After Your Corrections:
                            </span>
                            <span
                              className={`font-bold ${
                                Math.abs(
                                  parseFloat(calculateNewBalance()) -
                                    ((
                                      balanceError.reconciliation as Record<
                                        string,
                                        unknown
                                      >
                                    ).statement_closing as number),
                                ) < 0.02
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              ${calculateNewBalance()}
                            </span>
                          </div>
                          {Math.abs(
                            parseFloat(calculateNewBalance()) -
                              ((
                                balanceError.reconciliation as Record<
                                  string,
                                  unknown
                                >
                              ).statement_closing as number),
                          ) < 0.02 && (
                            <p className="text-green-600 text-sm mt-2 font-medium">
                              ✓ This should balance!
                            </p>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3">
                          <Button
                            onClick={handleResubmitWithCorrections}
                            disabled={
                              isRevalidating ||
                              !editableTransactions.some(
                                (t) => t.changed as boolean,
                              )
                            }
                            className="bg-green-600 hover:bg-green-700 text-white flex-1"
                          >
                            {isRevalidating ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Revalidating...
                              </>
                            ) : (
                              <>
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Resubmit with Corrections
                              </>
                            )}
                          </Button>

                          <Button
                            variant="outline"
                            onClick={() => {
                              // Reset to original
                              setEditableTransactions(
                                editableTransactions.map((t) => ({
                                  ...t,
                                  type: t.original_type,
                                  changed: false,
                                })),
                              );
                            }}
                          >
                            Reset
                          </Button>
                        </div>

                        <p className="text-xs text-gray-500 mt-3 text-center">
                          Click transactions to flip their direction, then
                          resubmit to verify balance.
                        </p>
                      </div>
                    )}

                    {/* Reset Button */}
                    <Button
                      variant="outline"
                      onClick={handleResetForm}
                      className="w-full mt-4"
                    >
                      Upload Different Statement
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
