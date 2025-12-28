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
} from "lucide-react";

interface BankAccount {
  id: string;
  name: string;
  account_number: string;
  company_id: string;
}

export default function Upload() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [dragActive, setDragActive] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          .select("id, name, account_number, company_id")
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
    setSuccess(null);
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
    setSuccess(null);

    const selectedAccount = bankAccounts.find(
      (acc) => acc.id === selectedBankAccountId
    );

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("bank_account_id", selectedBankAccountId);
    formData.append("bank_account_name", selectedAccount?.name || "");

    try {
      const webhookUrl = import.meta.env.VITE_N8N_WEBHOOK_URL;

      if (!webhookUrl) {
        throw new Error("N8N webhook URL not configured");
      }

      const response = await fetch(webhookUrl, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const result = await response.json();
        const transactionCount = result.transactionCount || result.count || "";
        setSuccess(
          `Successfully processed ${transactionCount ? `${transactionCount} ` : ""}transactions`
        );
        setSelectedFile(null);
        setSelectedBankAccountId("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      } else {
        setError("Failed to process statement. Please try again.");
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loadingAccounts) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const selectedAccount = bankAccounts.find(
    (acc) => acc.id === selectedBankAccountId
  );
  const isFormValid = selectedFile && selectedBankAccountId;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground">Upload</h1>
            <p className="text-muted-foreground mt-1">
              Upload bank statements and transaction data
            </p>
          </div>

          <Card className="max-w-2xl">
            <CardHeader>
              <div className="flex items-center gap-3">
                <UploadIcon className="h-6 w-6 text-primary" />
                <CardTitle>Upload Bank Statement</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  PDF files only, max 10MB
                </p>
              </div>

              {/* Selected File Display */}
              {selectedFile && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{selectedFile.name}</p>
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
                  Select Bank Account
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
                        No bank accounts found
                      </div>
                    ) : (
                      bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name} ({account.account_number})
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
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <UploadIcon className="h-4 w-4" />
                    Process Statement
                  </>
                )}
              </Button>

              {/* Success Message */}
              {success && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    {success}
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Message */}
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
