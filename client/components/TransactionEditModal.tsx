import { useEffect, useState } from "react";
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
  bank_account?: { id: string; name: string; nickname: string };
  has_gst: boolean;
  gst_amount: number;
  needs_review: boolean;
  review_reason?: string;
  is_edited?: boolean;
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
  const [gstAmount, setGstAmount] = useState(0);
  const [needsReview, setNeedsReview] = useState(false);
  const [contextText, setContextText] = useState("");

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

  // Initialize form with transaction data
  useEffect(() => {
    if (transaction) {
      setPayeeName(transaction.payee_name || "");
      setSelectedCategoryId(transaction.category_id || "");
      setHasGst(transaction.has_gst || false);
      setGstAmount(transaction.gst_amount || 0);
      setNeedsReview(transaction.needs_review || false);
      setContextText("");
      setError(null);
      setShowAiResults(false);
      setAiResults(null);
    }
  }, [transaction, isOpen]);

  const handleSaveChanges = async () => {
    if (!transaction) return;

    try {
      const { error: updateError } = await supabase
        .from("transactions")
        .update({
          payee_name: payeeName,
          category_id: selectedCategoryId,
          has_gst: hasGst,
          gst_amount: hasGst ? gstAmount : 0,
          needs_review: needsReview,
          is_edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: "Transaction changes saved!",
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

    // First save the basic changes
    try {
      await supabase
        .from("transactions")
        .update({
          payee_name: payeeName,
          category_id: selectedCategoryId,
          has_gst: hasGst,
          gst_amount: hasGst ? gstAmount : 0,
          needs_review: needsReview,
          is_edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq("id", transaction.id);
    } catch (err) {
      setError("Failed to save changes");
      return;
    }

    // Then process with AI
    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(
        "https://llxlkawdmuwsothxaada.supabase.co/functions/v1/process-transaction-context",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            transaction_id: transaction.id,
            user_context: contextText,
            changes: {
              category_code:
                categories.find((c) => c.id === selectedCategoryId)?.code ||
                transaction.category?.code,
              payee_name: payeeName,
            },
          }),
        },
      );

      const result: AIResult = await response.json();

      if (result.success) {
        setAiResults(result);
        setShowAiResults(true);
        // Pre-check all recommendations
        setCheckedRecs((result.recommendations || []).map(() => true));
        setCheckedKB((result.knowledgebase_updates || []).map(() => true));
      } else {
        setError(result.error || "AI processing failed");
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
        });
      });

      const requestPayload = {
        transaction_id: transaction.id,
        recommendations,
      };

      console.log(
        "📤 Apply recommendations request payload:",
        JSON.stringify(requestPayload, null, 2),
      );

      const response = await fetch(
        "https://llxlkawdmuwsothxaada.supabase.co/functions/v1/apply-recommendations",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestPayload),
        },
      );

      console.log("📥 Apply recommendations response status:", response.status);
      console.log("📥 Apply recommendations response headers:", {
        contentType: response.headers.get("content-type"),
      });

      const result = await response.json();

      console.log("📥 Apply recommendations response body:", result);

      if (!response.ok) {
        console.error("❌ Error response details:", {
          status: response.status,
          statusText: response.statusText,
          error: result.error || result.message,
          details: result,
        });
        throw new Error(
          result.error || result.message || "Failed to apply recommendations",
        );
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
                        transaction.amount < 0
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      ${Math.abs(transaction.amount).toFixed(2)}
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
                <div className="space-y-2">
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
                    <Input
                      type="number"
                      step="0.01"
                      value={gstAmount}
                      onChange={(e) =>
                        setGstAmount(parseFloat(e.target.value) || 0)
                      }
                      placeholder="GST amount"
                    />
                  )}
                </div>

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
              </CardContent>
            </Card>

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
                              ${rt.amount.toFixed(2)} | {rt.category?.name}
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
