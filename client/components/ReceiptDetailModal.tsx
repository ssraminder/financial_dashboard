import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  X,
  ZoomIn,
  ZoomOut,
  Download,
  CheckCircle,
  AlertCircle,
  Link as LinkIcon,
  Search,
  Loader2,
  Trash2,
  Edit,
  FileText,
  ExternalLink,
} from "lucide-react";

interface ReceiptData {
  id: string;
  file_path: string;
  file_name: string;
  vendor_name: string | null;
  vendor_gst_number: string | null;
  vendor_address: string | null;
  receipt_date: string | null;
  receipt_time: string | null;
  total_amount: number | null;
  subtotal: number | null;
  gst_amount: number;
  pst_amount: number;
  hst_amount: number;
  tip_amount: number;
  currency: string;
  status: string;
  needs_review: boolean;
  review_reason: string | null;
  matched_transaction_id: string | null;
  match_confidence: number | null;
  ai_confidence_score: number | null;
  extraction_notes: string | null;
  company_id: string;
  created_at: string;
}

interface LineItem {
  id: string;
  receipt_id: string;
  line_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface MatchCandidate {
  id: string;
  receipt_id: string;
  transaction_id: string;
  confidence_score: number;
  status: string;
  transactions?: {
    id: string;
    transaction_date: string;
    description: string;
    total_amount: number;
    payee_name: string;
  };
}

interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  total_amount: number;
  payee_name: string;
}

interface ReceiptDetailModalProps {
  receipt: ReceiptData | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (receipt: ReceiptData) => void;
}

export function ReceiptDetailModal({
  receipt,
  isOpen,
  onClose,
  onUpdate,
}: ReceiptDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedReceipt, setEditedReceipt] = useState<ReceiptData | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidate[]>([]);
  const [linkedTransaction, setLinkedTransaction] =
    useState<Transaction | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isPDF, setIsPDF] = useState(false);
  const [isImageZoomed, setIsImageZoomed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (receipt?.file_path) {
      setEditedReceipt(receipt);
      setImageUrl(null); // Reset first
      fetchReceiptDetails();
      fetchReceiptImage();
    }
  }, [receipt?.id]);

  const fetchReceiptDetails = async () => {
    if (!receipt) return;

    setLoading(true);
    try {
      // Fetch line items
      const { data: items } = await supabase
        .from("receipt_line_items")
        .select("*")
        .eq("receipt_id", receipt.id)
        .order("line_number");

      setLineItems(items || []);

      // Fetch match candidates if needs review
      if (receipt.needs_review) {
        const { data: candidates } = await supabase
          .from("receipt_match_candidates")
          .select(
            `
            *,
            transactions(id, transaction_date, description, total_amount, payee_name)
          `,
          )
          .eq("receipt_id", receipt.id)
          .eq("status", "suggested")
          .order("confidence_score", { ascending: false });

        setMatchCandidates(candidates || []);
      }

      // Fetch linked transaction if matched
      if (receipt.matched_transaction_id) {
        const { data: txn } = await supabase
          .from("transactions")
          .select("*")
          .eq("id", receipt.matched_transaction_id)
          .single();

        setLinkedTransaction(txn);
      }
    } catch (error) {
      console.error("Error fetching receipt details:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReceiptImage = async () => {
    if (!receipt?.file_path) {
      console.log("No file path available");
      return;
    }

    // Detect if PDF
    const fileIsPDF =
      receipt.file_path.toLowerCase().endsWith(".pdf") ||
      receipt.file_name?.toLowerCase().endsWith(".pdf");
    setIsPDF(fileIsPDF);

    try {
      console.log("Fetching signed URL for:", receipt.file_path);

      const { data, error } = await supabase.storage
        .from("receipts")
        .createSignedUrl(receipt.file_path, 3600);

      if (error) {
        console.error("Storage error:", error);
        return;
      }

      if (data?.signedUrl) {
        console.log("Got signed URL:", data.signedUrl);
        setImageUrl(data.signedUrl);
      } else {
        console.error("No signed URL returned");
      }
    } catch (err) {
      console.error("Fetch error:", err);
    }
  };

  const handleLinkTransaction = async (transactionId: string) => {
    if (!receipt) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            action: "link",
            receipt_id: receipt.id,
            transaction_id: transactionId,
          }),
        },
      );

      const result = await response.json();

      if (result.success) {
        toast.success("Receipt linked to transaction");
        fetchReceiptDetails();
        onUpdate({
          ...receipt,
          status: "matched",
          matched_transaction_id: transactionId,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error linking receipt:", error);
      toast.error("Failed to link receipt");
    }
  };

  const handleUnlinkTransaction = async () => {
    if (!receipt) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            action: "unlink",
            receipt_id: receipt.id,
          }),
        },
      );

      const result = await response.json();

      if (result.success) {
        toast.success("Receipt unlinked");
        setLinkedTransaction(null);
        onUpdate({
          ...receipt,
          status: "pending",
          matched_transaction_id: null,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error unlinking receipt:", error);
      toast.error("Failed to unlink receipt");
    }
  };

  const handleMarkNoMatch = async () => {
    if (!receipt) return;

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/link-receipt`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            action: "mark_no_match",
            receipt_id: receipt.id,
          }),
        },
      );

      const result = await response.json();

      if (result.success) {
        toast.success("Receipt marked as no match expected");
        onUpdate({
          ...receipt,
          status: "no_match_expected",
          needs_review: false,
        });
        onClose();
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error("Error marking no match:", error);
      toast.error("Failed to update receipt");
    }
  };

  const handleSaveChanges = async () => {
    if (!editedReceipt) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("receipts")
        .update({
          vendor_name: editedReceipt.vendor_name,
          vendor_gst_number: editedReceipt.vendor_gst_number,
          total_amount: editedReceipt.total_amount,
          subtotal: editedReceipt.subtotal,
        })
        .eq("id", editedReceipt.id);

      if (error) throw error;

      toast.success("Receipt updated");
      setIsEditing(false);
      onUpdate(editedReceipt);
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteReceipt = async () => {
    if (!receipt) return;

    if (
      !confirm(
        "Are you sure you want to delete this receipt? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("receipts")
        .delete()
        .eq("id", receipt.id);

      if (error) throw error;

      toast.success("Receipt deleted");
      onClose();
      // Trigger parent refresh
      onUpdate(receipt);
    } catch (error) {
      console.error("Error deleting receipt:", error);
      toast.error("Failed to delete receipt");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatAmount = (amount: number | null | undefined) => {
    if (amount === null || amount === undefined) return "-";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(amount);
  };

  if (!receipt) return null;

  return (
    <div className={`fixed inset-0 z-50 ${isOpen ? "visible" : "invisible"}`}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 ${
          isOpen ? "opacity-50" : "opacity-0"
        }`}
        onClick={onClose}
      />

      {/* Slide-out Panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-3xl bg-white shadow-xl transform transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        } overflow-y-auto`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-xl font-semibold">Receipt Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Receipt Image */}
          <div className="mb-6">
            <div className="relative bg-gray-100 rounded-lg overflow-hidden">
              {imageUrl ? (
                isPDF ? (
                  <div className="bg-gray-100 rounded-lg overflow-hidden">
                    <iframe
                      src={imageUrl}
                      className="w-full h-96 border-0"
                      title="Receipt PDF"
                    />
                    <div className="p-2 bg-white border-t flex justify-center">
                      <a
                        href={imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open PDF in New Tab
                      </a>
                    </div>
                  </div>
                ) : (
                  <img
                    src={imageUrl}
                    alt="Receipt"
                    className="w-full object-contain max-h-96 rounded-lg"
                  />
                )
              ) : (
                <div className="h-64 flex items-center justify-center bg-gray-100 rounded-lg">
                  <div className="text-center text-gray-500">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                    <p>Loading receipt...</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Vendor Information */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">
              Vendor Information
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500">Vendor Name</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedReceipt?.vendor_name || ""}
                    onChange={(e) =>
                      setEditedReceipt(
                        (r) => r && { ...r, vendor_name: e.target.value },
                      )
                    }
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  />
                ) : (
                  <p className="text-sm font-medium mt-1">
                    {receipt.vendor_name || "Unknown"}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-500">GST/HST Number</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editedReceipt?.vendor_gst_number || ""}
                    onChange={(e) =>
                      setEditedReceipt(
                        (r) => r && { ...r, vendor_gst_number: e.target.value },
                      )
                    }
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  />
                ) : (
                  <p className="text-sm mt-1">
                    {receipt.vendor_gst_number || "-"}
                  </p>
                )}
              </div>

              <div className="col-span-2">
                <label className="text-xs text-gray-500">Address</label>
                <p className="text-sm mt-1">{receipt.vendor_address || "-"}</p>
              </div>
            </div>
          </div>

          {/* Receipt Details */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">Receipt Details</h3>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-500">Date</label>
                <p className="text-sm font-medium mt-1">
                  {formatDate(receipt.receipt_date)}
                </p>
              </div>

              <div>
                <label className="text-xs text-gray-500">Time</label>
                <p className="text-sm mt-1">{receipt.receipt_time || "-"}</p>
              </div>
            </div>

            <hr className="my-4" />

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Subtotal</span>
                <span className="text-sm">
                  {formatAmount(receipt.subtotal)}
                </span>
              </div>

              {receipt.gst_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">GST (5%)</span>
                  <span className="text-sm">
                    {formatAmount(receipt.gst_amount)}
                  </span>
                </div>
              )}

              {receipt.pst_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">PST</span>
                  <span className="text-sm">
                    {formatAmount(receipt.pst_amount)}
                  </span>
                </div>
              )}

              {receipt.hst_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">HST</span>
                  <span className="text-sm">
                    {formatAmount(receipt.hst_amount)}
                  </span>
                </div>
              )}

              {receipt.tip_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Tip</span>
                  <span className="text-sm">
                    {formatAmount(receipt.tip_amount)}
                  </span>
                </div>
              )}

              <hr />

              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>{formatAmount(receipt.total_amount)}</span>
              </div>
            </div>
          </div>

          {/* AI Confidence */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-600">
                AI Extraction Confidence
              </span>
              <span className="text-sm font-medium">
                {receipt.ai_confidence_score || 0}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  (receipt.ai_confidence_score || 0) >= 80
                    ? "bg-green-500"
                    : (receipt.ai_confidence_score || 0) >= 50
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${receipt.ai_confidence_score || 0}%` }}
              />
            </div>
            {receipt.extraction_notes && (
              <p className="text-xs text-gray-500 mt-1">
                {receipt.extraction_notes}
              </p>
            )}
          </div>

          {/* Transaction Match */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-gray-900">Transaction Match</h3>
            </div>

            {/* Linked Transaction */}
            {linkedTransaction && (
              <div className="bg-white rounded-lg p-3 border border-green-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">
                        {linkedTransaction.description}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(linkedTransaction.transaction_date)} •{" "}
                        {formatAmount(linkedTransaction.total_amount)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleUnlinkTransaction}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Unlink
                  </button>
                </div>
                {receipt.match_confidence && (
                  <p className="text-xs text-gray-500 mt-2">
                    Match confidence: {receipt.match_confidence}%
                  </p>
                )}
              </div>
            )}

            {/* Match Candidates */}
            {!linkedTransaction && matchCandidates.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-gray-600 mb-2">
                  {matchCandidates.length} potential match
                  {matchCandidates.length > 1 ? "es" : ""} found:
                </p>
                {matchCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="bg-white rounded-lg p-3 border hover:border-blue-300 cursor-pointer"
                    onClick={() =>
                      handleLinkTransaction(candidate.transaction_id)
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {candidate.transactions?.description}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(candidate.transactions?.transaction_date)}{" "}
                          • {formatAmount(candidate.transactions?.total_amount)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-sm font-medium ${
                            candidate.confidence_score >= 90
                              ? "text-green-600"
                              : candidate.confidence_score >= 70
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          {candidate.confidence_score}%
                        </span>
                        <p className="text-xs text-gray-500">confidence</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* No Match */}
            {!linkedTransaction && matchCandidates.length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-gray-600 mb-3">
                  No matching transactions found
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    onClick={handleMarkNoMatch}
                    className="px-3 py-2 text-sm bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Mark No Match Expected
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Line Items */}
          {lineItems.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-gray-900 mb-3">Line Items</h3>

              <div className="space-y-2">
                {lineItems.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">{item.quantity}x</span>
                      <span>{item.description}</span>
                    </div>
                    <span className="font-medium">
                      {formatAmount(item.total_price)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-between">
          <button
            onClick={handleDeleteReceipt}
            className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Delete Receipt
          </button>

          <div className="flex gap-3">
            {isEditing ? (
              <>
                <Button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedReceipt(receipt);
                  }}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveChanges}
                  disabled={isSaving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </>
            ) : (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit Details
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
