import { useEffect, useState, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  Loader2,
  Sparkles,
  Check,
  Link2,
  ChevronDown,
  ChevronUp,
  Lock,
} from "lucide-react";
import { format } from "date-fns";

interface Category {
  id: string;
  code: string;
  name: string;
  category_type: string;
}

interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  amount: number;
  payee_name?: string;
  category_id: string;
  category?: Category;
  bank_account?: {
    id: string;
    name: string;
    nickname: string;
    account_number?: string;
  };
  has_gst: boolean;
  gst_amount: number;
  needs_review: boolean;
  review_reason?: string;
  is_edited?: boolean;
  manually_locked?: boolean;
  manually_locked_at?: string;
  manually_locked_by?: string;
  is_locked?: boolean;
  linked_to?: string;
  link_type?: string;
  transfer_status?: string;
}

interface AIRecommendation {
  action: string;
  transaction_id: string;
  changes: Record<string, unknown>;
  reason: string;
}

interface AIResult {
  success: boolean;
  original_transaction: Transaction;
  ai_analysis: string;
  related_transactions: Transaction[];
  recommendations: AIRecommendation[];
  knowledgebase_updates: Array<{
    payee_pattern: string;
    default_category: string;
    notes: string;
  }>;
  net_calculation?: {
    original_expense: number;
    reimbursement: number;
    net_expense: number;
    explanation: string;
  };
  error?: string;
}

interface TransactionEditModalProps {
  transaction: Transaction | null;
  categories: Category[];
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function TransactionEditModal({
  transaction,
  categories,
  isOpen,
  onClose,
  onSave,
}: TransactionEditModalProps) {
  const { toast } = useToast();

  // Form state
  const [payeeName, setPayeeName] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [hasGst, setHasGst] = useState(false);
  const [gstRate, setGstRate] = useState(0.05);
  const [hasTip, setHasTip] = useState(false);
  const [tipAmount, setTipAmount] = useState(0);
  const [needsReview, setNeedsReview] = useState(false);
  const [contextText, setContextText] = useState("");
  const [manuallyLocked, setManuallyLocked] = useState(false);

  // Transfer linking state
  const [isTransfer, setIsTransfer] = useState(false);
  const [transferAccountId, setTransferAccountId] = useState<string>("");
  const [linkedTransactionId, setLinkedTransactionId] = useState<string>("");
  const [bankAccounts, setBankAccounts] = useState<
    Array<{
      id: string;
      name: string;
      nickname: string;
      bank_name: string;
      account_number_last4: string;
    }>
  >([]);
  const [potentialMatches, setPotentialMatches] = useState<
    Array<{
      id: string;
      transaction_date: string;
      description: string;
      amount: number;
      bank_account: { name: string; bank_name: string };
    }>
  >([]);
  const [loadingMatches, setLoadingMatches] = useState(false);

  // AI processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [showAiResults, setShowAiResults] = useState(false);
  const [aiResults, setAiResults] = useState<AIResult | null>(null);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    analysis: true,
    related: true,
    recommendations: true,
  });

  // Checkbox state for recommendations
  const [checkedRecs, setCheckedRecs] = useState<boolean[]>([]);
  const [checkedKB, setCheckedKB] = useState<boolean[]>([]);

  // Apply state
  const [isApplying, setIsApplying] = useState(false);

  // Error state
  const [error, setError] = useState<string | null>(null);

  // Auto-calculate GST (extracting from total, not adding to it)
  const gstAmount = useMemo(() => {
    if (!hasGst || !transaction?.amount) return 0;
    const totalAmount = Math.abs(transaction.amount);
    // GST is included in total: GST = total × rate / (1 + rate)
    return Math.round(((totalAmount * gstRate) / (1 + gstRate)) * 100) / 100;
  }, [hasGst, gstRate, transaction?.amount]);

  // Get selected category
  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === selectedCategoryId);
  }, [selectedCategoryId, categories]);

  // Initialize form with transaction data
  useEffect(() => {
    if (transaction) {
      setPayeeName(transaction.payee_name || "");
      setSelectedCategoryId(transaction.category_id || "");
      setHasGst(transaction.has_gst || false);
      setGstRate((transaction as any).gst_rate || 0.05);
      setHasTip((transaction as any).has_tip || false);
      setTipAmount((transaction as any).tip_amount || 0);
      setNeedsReview(transaction.needs_review || false);
      setContextText("");
      setManuallyLocked(transaction.manually_locked || false);
      setError(null);
      setShowAiResults(false);
      setAiResults(null);

      // Initialize transfer state
      setLinkedTransactionId(transaction.linked_to || "");
      setTransferAccountId(""); // Will be set when user selects

      // Check if this is already a transfer
      const category = categories.find((c) => c.id === transaction.category_id);
      setIsTransfer(
        category?.category_type === "transfer" ||
          category?.code === "bank_transfer" ||
          category?.code === "bank_intercompany" ||
          !!transaction.linked_to,
      );
    }
  }, [transaction, isOpen, categories]);

  // Fetch bank accounts for transfer dropdown
  useEffect(() => {
    const fetchBankAccounts = async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, name, nickname, bank_name, account_number_last4")
        .eq("is_active", true)
        .order("bank_name");

      if (!error && data) {
        setBankAccounts(data);
      }
    };

    fetchBankAccounts();
  }, []);

  // Check if category is a transfer type and apply defaults
  useEffect(() => {
    if (selectedCategoryId && categories.length > 0) {
      const selectedCategory = categories.find(
        (c) => c.id === selectedCategoryId,
      );
      const isTransferCategory =
        selectedCategory?.category_type === "transfer" ||
        selectedCategory?.code === "bank_transfer" ||
        selectedCategory?.code === "bank_intercompany";
      setIsTransfer(isTransferCategory);

      // Apply category-based defaults (only on category change, not initial load)
      if (selectedCategory && transaction) {
        const categoryCode = selectedCategory.code;

        if (categoryCode === "meals_entertainment") {
          setHasGst(true);
          setGstRate(0.05);
          setHasTip(true);
          // Don't set tip amount if no receipt
          if (!(transaction as any).receipt_id) {
            setTipAmount(0);
          }
        } else if (
          [
            "bank_fee",
            "insurance",
            "loan_payment",
            "tax_cra",
            "bank_transfer",
          ].includes(categoryCode)
        ) {
          // These categories don't have GST or tips
          setHasGst(false);
          setHasTip(false);
        } else {
          // Default for most Canadian expenses
          setHasGst(true);
          setGstRate(0.05);
          setHasTip(false);
        }
      }
    }
  }, [selectedCategoryId, categories]);

  // Search for potential matching transactions in the selected account
  const searchPotentialMatches = async (accountId: string) => {
    if (!accountId || !transaction) return;

    setLoadingMatches(true);
    try {
      // Look for transactions with similar amount (opposite sign) within ±7 days
      const targetAmount = Math.abs(transaction.amount);
      const txnDate = new Date(transaction.transaction_date);
      const startDate = new Date(txnDate);
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date(txnDate);
      endDate.setDate(endDate.getDate() + 7);

      const { data, error } = await supabase
        .from("transactions")
        .select(
          `
          id,
          transaction_date,
          description,
          amount,
          total_amount,
          transaction_type,
          linked_to,
          bank_account:bank_accounts!bank_account_id(name, bank_name)
        `,
        )
        .eq("bank_account_id", accountId)
        .gte("transaction_date", startDate.toISOString().split("T")[0])
        .lte("transaction_date", endDate.toISOString().split("T")[0])
        .is("linked_to", null) // Not already linked
        .neq("id", transaction.id) // Not the same transaction
        .order("transaction_date", { ascending: false });

      if (!error && data) {
        // Filter for matching amounts (within $0.50 tolerance)
        const matches = data.filter(
          (t) =>
            Math.abs(Math.abs(t.amount || t.total_amount) - targetAmount) < 0.5,
        );
        setPotentialMatches(matches);
      }
    } catch (err) {
      console.error("Error searching matches:", err);
    } finally {
      setLoadingMatches(false);
    }
  };

  // When transfer account changes, search for matches
  useEffect(() => {
    if (transferAccountId && isTransfer) {
      searchPotentialMatches(transferAccountId);
    } else {
      setPotentialMatches([]);
    }
  }, [transferAccountId, isTransfer]);

  const handleSaveChanges = async () => {
    if (!transaction) return;

    try {
      const updates: any = {
        payee_name: payeeName,
        category_id: selectedCategoryId,
        has_gst: hasGst,
        gst_rate: hasGst ? gstRate : 0,
        gst_amount: hasGst ? gstAmount : 0,
        has_tip: hasTip,
        tip_amount: hasTip ? tipAmount : 0,
        needs_review: needsReview,
        is_edited: true,
        edited_at: new Date().toISOString(),
        manually_locked: manuallyLocked,
      };

      // Handle transfer linking
      if (isTransfer) {
        updates.link_type = "transfer";
        updates.transfer_status = linkedTransactionId ? "matched" : "pending";

        if (linkedTransactionId) {
          updates.linked_to = linkedTransactionId;

          // Also update the linked transaction to point back
          await supabase
            .from("transactions")
            .update({
              linked_to: transaction.id,
              link_type: "transfer",
              transfer_status: "matched",
            })
            .eq("id", linkedTransactionId);
        }
      } else {
        // Clear transfer fields if not a transfer
        updates.linked_to = null;
        updates.link_type = null;
        updates.transfer_status = null;
      }

      // Only set lock timestamp if locking (not unlocking)
      if (manuallyLocked && !transaction.manually_locked) {
        updates.manually_locked_at = new Date().toISOString();
      }

      // Clear lock timestamp if unlocking
      if (!manuallyLocked && transaction.manually_locked) {
        updates.manually_locked_at = null;
        updates.manually_locked_by = null;
      }

      const { error: updateError } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", transaction.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: manuallyLocked
          ? "Transaction saved and locked!"
          : "Transaction changes saved!",
      });

      onSave();
      onClose();
    } catch (err) {
      setError("Failed to save changes");
      console.error(err);
    }
  };

  const handleSaveAndProcessAI = async () => {
    if (!transaction) return;

    // DEBUG: Log the transaction being edited
    console.log("Transaction being edited:", transaction);
    console.log("Transaction ID:", transaction.id);

    // First save the basic changes
    try {
      const updates: any = {
        payee_name: payeeName,
        category_id: selectedCategoryId,
        has_gst: hasGst,
        gst_rate: hasGst ? gstRate : 0,
        gst_amount: hasGst ? gstAmount : 0,
        has_tip: hasTip,
        tip_amount: hasTip ? tipAmount : 0,
        needs_review: needsReview,
        is_edited: true,
        edited_at: new Date().toISOString(),
        manually_locked: manuallyLocked,
      };

      // Handle transfer linking
      if (isTransfer) {
        updates.link_type = "transfer";
        updates.transfer_status = linkedTransactionId ? "matched" : "pending";

        if (linkedTransactionId) {
          updates.linked_to = linkedTransactionId;

          // Also update the linked transaction to point back
          await supabase
            .from("transactions")
            .update({
              linked_to: transaction.id,
              link_type: "transfer",
              transfer_status: "matched",
            })
            .eq("id", linkedTransactionId);
        }
      } else {
        // Clear transfer fields if not a transfer
        updates.linked_to = null;
        updates.link_type = null;
        updates.transfer_status = null;
      }

      // Only set lock timestamp if locking (not unlocking)
      if (manuallyLocked && !transaction.manually_locked) {
        updates.manually_locked_at = new Date().toISOString();
      }

      // Clear lock timestamp if unlocking
      if (!manuallyLocked && transaction.manually_locked) {
        updates.manually_locked_at = null;
        updates.manually_locked_by = null;
      }

      await supabase
        .from("transactions")
        .update(updates)
        .eq("id", transaction.id);
    } catch (err) {
      setError("Failed to save changes");
      return;
    }

    // Then process with AI
    setIsProcessing(true);
    setError(null);

    try {
      const aiPayload = {
        transaction_id: transaction.id,
        original_transaction_id: transaction.id,
        user_context: contextText,
        changes: {
          category_code:
            categories.find((c) => c.id === selectedCategoryId)?.code ||
            transaction.category?.code,
          payee_name: payeeName,
        },
      };

      console.log("DEBUG: AI processing payload:", aiPayload);

      const { data, error: invokeError } = await supabase.functions.invoke(
        "process-transaction-context",
        {
          body: aiPayload,
        },
      );

      if (invokeError) {
        console.error("Edge function error:", invokeError);
        setError(invokeError.message || "AI processing failed");
        return;
      }

      const result: AIResult = data;

      if (result?.success) {
        setAiResults(result);
        setShowAiResults(true);
        // Pre-check all recommendations
        setCheckedRecs((result.recommendations || []).map(() => true));
        setCheckedKB((result.knowledgebase_updates || []).map(() => true));
      } else {
        setError(result?.error || "AI processing failed");
      }
    } catch (err) {
      setError("Failed to process with AI");
      console.error(err);
    }

    setIsProcessing(false);
  };

  const handleApplyRecommendations = async (applyAll = false) => {
    if (!transaction || !aiResults) return;

    setIsApplying(true);

    try {
      // Get approved recommendations
      const approvedRecs = applyAll
        ? aiResults.recommendations
        : (aiResults.recommendations || []).filter((_, i) => checkedRecs[i]);

      // Get approved KB updates
      const approvedKB = applyAll
        ? aiResults.knowledgebase_updates
        : (aiResults.knowledgebase_updates || []).filter(
            (_, i) => checkedKB[i],
          );

      // Build recommendations array with proper type structure
      const recommendations: Array<{
        type: string;
        [key: string]: unknown;
      }> = [];

      // Add recategorization recommendations
      approvedRecs.forEach((rec) => {
        if (rec.action === "recategorize") {
          recommendations.push({
            type: "recategorize",
            new_category_code: rec.changes?.category_code || "",
            new_payee_name: rec.changes?.payee_name || "",
          });
        } else if (rec.action === "link") {
          recommendations.push({
            type: "link_transactions",
            target_transaction_id: rec.transaction_id || "",
            reason: rec.reason || "",
          });
        }
      });

      // Add knowledgebase update recommendations
      approvedKB.forEach((kb) => {
        recommendations.push({
          type: "knowledgebase_update",
          payee_pattern: kb.payee_pattern,
          category_code: kb.default_category,
          description: kb.notes || "",
          original_transaction_id: transaction.id,
        });
      });

      const requestPayload = {
        original_transaction_id: transaction.id,
        recommendations,
      };

      console.log(
        "📤 Apply recommendations request payload:",
        JSON.stringify(requestPayload, null, 2),
      );

      const { data, error: invokeError } = await supabase.functions.invoke(
        "apply-recommendations",
        {
          body: requestPayload,
        },
      );

      console.log("📥 Apply recommendations response:", data);

      if (invokeError) {
        console.error("❌ Error invoking function:", invokeError);
        throw new Error(
          invokeError.message || "Failed to apply recommendations",
        );
      }

      const result = data;

      if (!result) {
        throw new Error("No response from edge function");
      }

      if (result.success) {
        console.log("✅ Recommendations applied successfully");
        toast({
          title: "Success",
          description:
            `Applied ${result.results?.recategorizations_applied || 0} changes, ` +
            `${result.results?.links_created || 0} links, ` +
            `${result.results?.knowledgebase_entries_added || 0} KB entries`,
        });
        onSave();
        onClose();
      } else {
        console.error("❌ Recommendations apply failed:", result);
        setError(result.error || "Failed to apply recommendations");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("❌ Apply recommendations error:", {
        message: errorMessage,
        error: err,
        stack: err instanceof Error ? err.stack : undefined,
      });
      setError(errorMessage);
    }

    setIsApplying(false);
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  if (!transaction) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {showAiResults ? "AI Analysis Results" : "Edit Transaction"}
          </DialogTitle>
          <DialogDescription>
            {showAiResults
              ? "Review AI analysis and apply recommendations"
              : "Edit transaction details and categorization"}
          </DialogDescription>
        </DialogHeader>

        {!showAiResults ? (
          <div className="space-y-6">
            {/* Transaction Details (Read-only) */}
            <Card className="bg-muted/50">
              <CardHeader>
                <CardTitle className="text-base">Transaction Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Date</p>
                    <p className="font-semibold">
                      {format(
                        new Date(transaction.transaction_date),
                        "MMM d, yyyy",
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p
                      className={`font-semibold ${
                        (transaction.amount || 0) < 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      ${Math.abs(transaction.amount || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Description</p>
                    <p className="font-semibold">{transaction.description}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Account</p>
                    <p className="font-semibold">
                      {transaction.bank_account?.nickname || "Unknown"}
                      {transaction.bank_account?.account_number && (
                        <>
                          {" "}
                          ••••{" "}
                          {transaction.bank_account.account_number.slice(-4)}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Editable Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Edit Transaction</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Payee Name */}
                <div className="space-y-2">
                  <Label htmlFor="payee">Payee Name</Label>
                  <Input
                    id="payee"
                    value={payeeName}
                    onChange={(e) => setPayeeName(e.target.value)}
                    placeholder="Enter payee name"
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={selectedCategoryId}
                    onValueChange={setSelectedCategoryId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* GST */}
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="has-gst"
                        checked={hasGst}
                        onCheckedChange={(checked) =>
                          setHasGst(checked as boolean)
                        }
                      />
                      <Label htmlFor="has-gst" className="cursor-pointer">
                        Has GST
                      </Label>
                    </div>

                    {hasGst && (
                      <Select
                        value={gstRate.toString()}
                        onValueChange={(v) => setGstRate(parseFloat(v))}
                      >
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0.05">5% GST</SelectItem>
                          <SelectItem value="0.13">13% HST</SelectItem>
                          <SelectItem value="0.15">15% HST</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {hasGst && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>GST Amount:</span>
                      <span className="font-medium">
                        ${gstAmount.toFixed(2)}
                      </span>
                      <span className="text-xs">(auto-calculated)</span>
                    </div>
                  )}
                </div>

                {/* Tip - Only for meals_entertainment */}
                {selectedCategory?.code === "meals_entertainment" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="has-tip"
                          checked={hasTip}
                          onCheckedChange={(checked) =>
                            setHasTip(checked as boolean)
                          }
                        />
                        <Label htmlFor="has-tip" className="cursor-pointer">
                          Has Tip
                        </Label>
                      </div>

                      {hasTip && (
                        <div className="flex items-center gap-2">
                          <span>$</span>
                          <Input
                            type="number"
                            value={tipAmount}
                            onChange={(e) =>
                              setTipAmount(parseFloat(e.target.value) || 0)
                            }
                            className="w-24"
                            step="0.01"
                          />
                        </div>
                      )}
                    </div>

                    {!(transaction as any)?.receipt_id && hasTip && (
                      <p className="text-xs text-amber-600">
                        ⚠️ No receipt attached. Tip amount should be verified.
                      </p>
                    )}
                  </div>
                )}

                {/* Needs Review */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="needs-review"
                    checked={needsReview}
                    onCheckedChange={(checked) =>
                      setNeedsReview(checked as boolean)
                    }
                  />
                  <Label htmlFor="needs-review" className="cursor-pointer">
                    Mark for review
                  </Label>
                </div>

                {/* Transfer Linking Section */}
                {isTransfer && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-2 mb-3">
                      <Link2 className="h-4 w-4 text-blue-600" />
                      <span className="font-medium text-blue-800">
                        Transfer Details
                      </span>
                    </div>

                    {/* Transfer Account Selection */}
                    <div className="space-y-2 mb-3">
                      <Label className="text-sm text-blue-700">
                        Transfer To/From Account
                      </Label>
                      <Select
                        value={transferAccountId}
                        onValueChange={setTransferAccountId}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder="Select counterpart account" />
                        </SelectTrigger>
                        <SelectContent>
                          {bankAccounts
                            .filter(
                              (acc) => acc.id !== transaction?.bank_account?.id,
                            )
                            .map((acc) => (
                              <SelectItem key={acc.id} value={acc.id}>
                                {acc.bank_name} - {acc.nickname || acc.name}{" "}
                                (••••{acc.account_number_last4})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Potential Matches */}
                    {transferAccountId && (
                      <div className="space-y-2">
                        <Label className="text-sm text-blue-700">
                          Link to Transaction
                        </Label>

                        {loadingMatches ? (
                          <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Searching for matches...
                          </div>
                        ) : potentialMatches.length > 0 ? (
                          <Select
                            value={linkedTransactionId}
                            onValueChange={setLinkedTransactionId}
                          >
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Select matching transaction (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">
                                <span className="text-gray-500">
                                  No link - mark as pending transfer
                                </span>
                              </SelectItem>
                              {potentialMatches.map((match) => (
                                <SelectItem key={match.id} value={match.id}>
                                  <div className="flex flex-col">
                                    <span>
                                      {new Date(
                                        match.transaction_date,
                                      ).toLocaleDateString("en-CA")}{" "}
                                      - ${Math.abs(match.amount).toFixed(2)}
                                    </span>
                                    <span className="text-xs text-gray-500 truncate max-w-[300px]">
                                      {match.description}
                                    </span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-sm text-gray-500 py-2 px-3 bg-gray-100 rounded">
                            No matching transactions found in this account (±7
                            days, similar amount). The counterpart may not be
                            imported yet.
                          </div>
                        )}

                        <p className="text-xs text-blue-600 mt-1">
                          {linkedTransactionId
                            ? "✓ Will link both transactions together"
                            : "Will mark as pending transfer until counterpart is imported"}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lock & Protect */}
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-700">
                  Lock & Protect
                </span>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  id="manually-locked"
                  checked={manuallyLocked}
                  onCheckedChange={(checked) =>
                    setManuallyLocked(checked as boolean)
                  }
                  className="mt-1"
                />
                <div>
                  <Label
                    htmlFor="manually-locked"
                    className="cursor-pointer text-sm text-gray-700"
                  >
                    Lock this transaction
                  </Label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Prevent re-analysis from changing this transaction. You can
                    still edit it manually.
                  </p>
                </div>
              </label>
            </div>

            {/* AI Context */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Add Context for AI Processing
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Provide context to help AI better understand this transaction:
                </p>
                <Textarea
                  value={contextText}
                  onChange={(e) => setContextText(e.target.value)}
                  placeholder="Example: This was a car repair bill. Insurance reimbursed me $3,130 via e-transfer on Dec 15."
                  rows={4}
                />
              </CardContent>
            </Card>

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Buttons */}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={handleSaveChanges} disabled={isProcessing}>
                Save Changes
              </Button>
              <Button
                onClick={handleSaveAndProcessAI}
                disabled={isProcessing || !contextText.trim()}
                className="gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Save & Process AI
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : aiResults ? (
          <div className="space-y-6">
            {/* AI Analysis */}
            <Card>
              <CardHeader
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => toggleSection("analysis")}
              >
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI Analysis
                  </CardTitle>
                  {expandedSections["analysis"] ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </div>
              </CardHeader>
              {expandedSections["analysis"] && (
                <CardContent>
                  <p className="text-sm">{aiResults.ai_analysis}</p>
                </CardContent>
              )}
            </Card>

            {/* Related Transactions */}
            {aiResults.related_transactions &&
              aiResults.related_transactions.length > 0 && (
                <Card>
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleSection("related")}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Link2 className="h-5 w-5" />
                        Related Transactions Found
                      </CardTitle>
                      {expandedSections["related"] ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedSections["related"] && (
                    <CardContent>
                      <div className="space-y-2">
                        {aiResults.related_transactions.map((rt) => (
                          <div
                            key={rt.id}
                            className="p-2 bg-muted rounded-lg text-sm"
                          >
                            <p className="font-medium">
                              {format(new Date(rt.transaction_date), "MMM d")} -{" "}
                              {rt.description}
                            </p>
                            <p className="text-muted-foreground">
                              ${(rt.amount ?? 0).toFixed(2)} |{" "}
                              {rt.category?.name}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

            {/* Recommendations */}
            {aiResults.recommendations &&
              aiResults.recommendations.length > 0 && (
                <Card>
                  <CardHeader
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleSection("recommendations")}
                  >
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        Recommended Changes
                      </CardTitle>
                      {expandedSections["recommendations"] ? (
                        <ChevronUp className="h-5 w-5" />
                      ) : (
                        <ChevronDown className="h-5 w-5" />
                      )}
                    </div>
                  </CardHeader>
                  {expandedSections["recommendations"] && (
                    <CardContent className="space-y-3">
                      {aiResults.recommendations.map((rec, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <Checkbox
                            checked={checkedRecs[idx] || false}
                            onCheckedChange={(checked) => {
                              const newChecked = [...checkedRecs];
                              newChecked[idx] = checked as boolean;
                              setCheckedRecs(newChecked);
                            }}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {rec.action === "recategorize"
                                ? "Recategorize"
                                : rec.action === "link"
                                  ? "Link transactions"
                                  : rec.action}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {rec.reason}
                            </p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              )}

            {/* Knowledgebase Updates */}
            {aiResults.knowledgebase_updates &&
              aiResults.knowledgebase_updates.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Knowledgebase Updates
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {aiResults.knowledgebase_updates.map((kb, idx) => (
                      <div key={idx} className="flex items-start gap-3">
                        <Checkbox
                          checked={checkedKB[idx] || false}
                          onCheckedChange={(checked) => {
                            const newChecked = [...checkedKB];
                            newChecked[idx] = checked as boolean;
                            setCheckedKB(newChecked);
                          }}
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            Remember: {kb.payee_pattern} = {kb.default_category}
                          </p>
                          {kb.notes && (
                            <p className="text-sm text-muted-foreground">
                              {kb.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

            {/* Net Calculation */}
            {aiResults.net_calculation && (
              <Card className="bg-green-50 border-green-200">
                <CardHeader>
                  <CardTitle className="text-base">Net Calculation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Original Expense:</span>
                    <span className="font-semibold">
                      ${aiResults.net_calculation.original_expense.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Reimbursement:</span>
                    <span className="font-semibold">
                      ${aiResults.net_calculation.reimbursement.toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t pt-2 flex justify-between text-base font-bold">
                    <span>Net Out-of-Pocket:</span>
                    <span className="text-green-600">
                      ${aiResults.net_calculation.net_expense.toFixed(2)}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-3">
                    {aiResults.net_calculation.explanation}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Error Message */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Buttons */}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowAiResults(false)}>
                Back to Edit
              </Button>
              <Button
                variant="outline"
                onClick={() => handleApplyRecommendations(false)}
                disabled={isApplying}
              >
                Apply Selected
              </Button>
              <Button
                onClick={() => handleApplyRecommendations(true)}
                disabled={isApplying}
                className="gap-2"
              >
                {isApplying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Applying...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Apply All
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
