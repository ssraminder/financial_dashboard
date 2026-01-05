import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Camera,
  Image as ImageIcon,
  FileText,
  CheckCircle,
  AlertCircle,
  X,
  Loader2,
  Receipt,
} from "lucide-react";

interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  status: "pending" | "uploading" | "queued" | "error";
  progress: number;
  error?: string;
  queueId?: string;
}

interface UploadResult {
  success: boolean;
  batchId: string;
  queuedCount: number;
  errorCount: number;
}

interface Company {
  id: string;
  name: string;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "application/pdf",
];

export default function ReceiptUpload() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchCompanies = async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      setCompanies(data || []);
      if (data?.length === 1) {
        setSelectedCompanyId(data[0].id);
      }
    };
    fetchCompanies();
  }, []);

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    if (file.size > MAX_FILE_SIZE) {
      return { valid: false, error: "File too large (max 10MB)" };
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return { valid: false, error: "Invalid file type" };
    }
    return { valid: true };
  };

  const addFiles = (newFiles: File[]) => {
    const uploadFiles: UploadFile[] = newFiles.map((file) => {
      const validation = validateFile(file);
      return {
        id: crypto.randomUUID(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        status: validation.valid ? "pending" : "error",
        progress: 0,
        error: validation.error,
      };
    });

    setFiles((prev) => [...prev, ...uploadFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    addFiles(droppedFiles);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      addFiles(selectedFiles);
    }
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const uploadFiles = async () => {
    if (!selectedCompanyId) {
      toast.error("Please select a company");
      return;
    }

    const validFiles = files.filter((f) => f.status === "pending");
    if (validFiles.length === 0) {
      toast.error("No valid files to upload");
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("company_id", selectedCompanyId);
      formData.append("upload_source", "web_upload");

      // Get current user
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        formData.append("uploaded_by", user.id);
      }

      // Add all files
      validFiles.forEach((f) => {
        formData.append("files", f.file);
      });

      // Update status to uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.status === "pending"
            ? { ...f, status: "uploading", progress: 50 }
            : f,
        ),
      );

      // Call Edge Function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-receipts`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: formData,
        },
      );

      const result = await response.json();

      if (result.success) {
        // Update file statuses
        setFiles((prev) =>
          prev.map((f) => ({
            ...f,
            status: "queued",
            progress: 100,
            queueId: result.files.find((rf: any) => rf.file_name === f.name)
              ?.queue_id,
          })),
        );

        setUploadResult({
          success: true,
          batchId: result.batch_id,
          queuedCount: result.queued_count,
          errorCount: result.error_count,
        });

        toast.success(`${result.queued_count} receipt(s) queued for processing`);
      } else {
        throw new Error(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Failed to upload receipts");

      setFiles((prev) =>
        prev.map((f) =>
          f.status === "uploading"
            ? { ...f, status: "error", error: "Upload failed" }
            : f,
        ),
      );
    } finally {
      setIsUploading(false);
    }
  };

  const resetUpload = () => {
    setFiles([]);
    setUploadResult(null);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
        <div className="p-8 max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Receipt className="h-8 w-8" />
              Upload Receipts
            </h1>
            <p className="text-muted-foreground mt-1">
              Upload receipt images for AI processing and categorization
            </p>
          </div>

          {/* Success State */}
          {uploadResult && uploadResult.success ? (
            <Card>
              <CardContent className="pt-6">
                <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <CheckCircle className="w-8 h-8 text-green-500" />
                    <div>
                      <h3 className="text-lg font-medium text-green-800">
                        {uploadResult.queuedCount} receipt(s) queued for
                        processing
                      </h3>
                      <p className="text-sm text-green-600">
                        Your receipts will be processed in the background.
                        You'll be notified when they're ready.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={resetUpload}
                      variant="outline"
                      className="border-green-300 text-green-700 hover:bg-green-50"
                    >
                      Upload More
                    </Button>
                    <Button
                      onClick={() => navigate("/receipts")}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      View Receipt Queue
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Company Selection */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Select Company</CardTitle>
                </CardHeader>
                <CardContent>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select company...</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </CardContent>
              </Card>

              {/* Upload Zone */}
              <Card className="mb-6">
                <CardContent className="pt-6">
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`
                      border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                      transition-colors duration-200
                      ${
                        isDragOver
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-300 hover:border-gray-400 bg-gray-50"
                      }
                    `}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.heic,.heif,.pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-12 h-12 text-gray-400" />
                      <p className="text-lg font-medium text-gray-700">
                        Drop receipts here
                      </p>
                      <p className="text-sm text-gray-500">
                        or click to browse files
                      </p>
                      <p className="text-xs text-gray-400 mt-2">
                        Accepts: JPEG, PNG, HEIC, PDF (max 10MB)
                      </p>
                    </div>
                  </div>

                  {/* Mobile Camera Button */}
                  <div className="mt-4 md:hidden">
                    <input
                      ref={cameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        cameraInputRef.current?.click();
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      <Camera className="w-5 h-5 mr-2" />
                      Take Photo
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* File Queue */}
              {files.length > 0 && (
                <Card className="mb-6">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>
                        Selected Files ({files.length})
                      </CardTitle>
                      {files.filter((f) => f.status === "pending").length >
                        0 && (
                        <Button
                          onClick={uploadFiles}
                          disabled={
                            isUploading ||
                            files.filter((f) => f.status === "pending")
                              .length === 0 ||
                            !selectedCompanyId
                          }
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {isUploading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Upload className="w-4 h-4 mr-2" />
                              Upload{" "}
                              {
                                files.filter((f) => f.status === "pending")
                                  .length
                              }{" "}
                              Receipt(s)
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center gap-3 p-3 bg-white rounded-lg border"
                        >
                          {/* File icon */}
                          <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center">
                            {file.type === "application/pdf" ? (
                              <FileText className="w-5 h-5 text-red-500" />
                            ) : (
                              <ImageIcon className="w-5 h-5 text-blue-500" />
                            )}
                          </div>

                          {/* File info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {file.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatSize(file.size)}
                            </p>
                          </div>

                          {/* Status */}
                          <div className="flex items-center gap-2">
                            {file.status === "pending" && (
                              <span className="text-xs text-gray-500">
                                Ready
                              </span>
                            )}
                            {file.status === "uploading" && (
                              <div className="w-20">
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-blue-500 transition-all"
                                    style={{ width: `${file.progress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                            {file.status === "queued" && (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            )}
                            {file.status === "error" && (
                              <div className="flex items-center gap-1">
                                <AlertCircle className="w-5 h-5 text-red-500" />
                                <span className="text-xs text-red-500">
                                  {file.error}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Remove button */}
                          {(file.status === "pending" ||
                            file.status === "error") && (
                            <button
                              onClick={() => removeFile(file.id)}
                              className="p-1 hover:bg-gray-100 rounded"
                            >
                              <X className="w-4 h-4 text-gray-400" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
