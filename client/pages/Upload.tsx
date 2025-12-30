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
  stage: "" | "uploading" | "parsing" | "validating" | "correcting" | "saving" | "complete" | "error";
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
    <div className={`flex items-start gap-3 ${status === "pending" ? "opacity-50" : ""}`}>
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
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({
    stage: "",
    message: "",
    details: "",
    progress: 0,
    attempts: 0,
  });

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

    const currentStage = (stages as Record<string, number>)[processingStatus.stage] || 0;

    if (processingStatus.stage === "error") return "error";
    if (step < currentStage) return "complete";
    if (step === currentStage) return "active";
    return "pending";
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

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("bank_account_id", selectedBankAccountId);

    try {
      const response = await fetch(
        "https://llxlkawdmuwsothxaada.supabase.co/functions/v1/parse-statement",
        {
          method: "POST",
          body: formData,
        },
      );

      const data: ParseStatementResult = await response.json();

      if (data.success) {
        setResult(data);
        setSelectedFile(null);
        setSelectedBankAccountId("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        setError(
          data.error || "Failed to process statement. Please try again.",
        );
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Upload failed. Please check your file and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setResult(null);
    setSelectedFile(null);
    setSelectedBankAccountId("");
    setError(null);
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

          {/* Upload Form */}
          {!result?.success && (
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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
