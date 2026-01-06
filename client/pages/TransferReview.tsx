import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import {
  CheckCircle,
  XCircle,
  ArrowDown,
  Building2,
  Calendar,
  DollarSign,
  AlertTriangle,
  Loader2,
  RefreshCw,
  SkipForward,
  Check,
  X,
  Filter,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";

interface ConfidenceFactors {
  amount_match: boolean;
  amount_match_type: string;
  date_diff_days: number;
  same_company: boolean;
  has_transfer_keywords: boolean;
}

interface TransferCandidate {
  id: string;
  from_transaction_id: string;
  to_transaction_id: string;
  amount_from: number;
  amount_to: number;
  currency_from: string;
  currency_to: string;
  exchange_rate_used: number | null;
  exchange_rate_source: string | null;
  date_from: string;
  date_to: string;
  date_diff_days: number;
  from_account_id: string;
  to_account_id: string;
  from_company_id: string | null;
  to_company_id: string | null;
  is_cross_company: boolean;
  confidence_score: number;
  confidence_factors: ConfidenceFactors;
  status: "pending" | "confirmed" | "rejected" | "auto_linked";
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  from_transaction: {
    id: string;
    description: string;
    transaction_date: string;
    posting_date: string;
  };
  to_transaction: {
    id: string;
    description: string;
    transaction_date: string;
    posting_date: string;
  };
  from_account: {
    id: string;
    bank_name: string;
    nickname: string | null;
    account_number_last4: string;
    currency: string;
  };
  to_account: {
    id: string;
    bank_name: string;
    nickname: string | null;
    account_number_last4: string;
    currency: string;
  };
  from_company: { id: string; name: string } | null;
  to_company: { id: string; name: string } | null;
}

export default function TransferReview() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // State
  const [candidates, setCandidates] = useState<TransferCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all");
  const [crossCompanyFilter, setCrossCompanyFilter] = useState<string>("all");

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Fetch data
  useEffect(() => {
    if (user) {
      fetchCandidates();
    }
  }, [user]);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("transfer_candidates")
        .select(
          `
          id,
          from_transaction_id,
          to_transaction_id,
          amount_from,
          amount_to,
          currency_from,
          currency_to,
          exchange_rate_used,
          exchange_rate_source,
          date_from,
          date_to,
          date_diff_days,
          from_account_id,
          to_account_id,
          from_company_id,
          to_company_id,
          is_cross_company,
          confidence_score,
          confidence_factors,
          status,
          reviewed_by,
          reviewed_at,
          rejection_reason,
          from_transaction:transactions!from_transaction_id(
            id, description, transaction_date, posting_date
          ),
          to_transaction:transactions!to_transaction_id(
            id, description, transaction_date, posting_date
          ),
          from_account:bank_accounts!from_account_id(
            id, bank_name, nickname, account_number_last4, currency
          ),
          to_account:bank_accounts!to_account_id(
            id, bank_name, nickname, account_number_last4, currency
          ),
          from_company:companies!from_company_id(id, name),
          to_company:companies!to_company_id(id, name)
        `,
        )
        .order("confidence_score", { ascending: false });

      if (error) throw error;
      setCandidates(data || []);
    } catch (error) {
      console.error("Error fetching transfer candidates:", error);
      sonnerToast.error("Failed to load transfer candidates");
    } finally {
      setLoading(false);
    }
  };

  // Summary calculations
  const summary = useMemo(
    () => ({
      pending: candidates.filter((c) => c.status === "pending").length,
      confirmed: candidates.filter((c) => c.status === "confirmed").length,
      rejected: candidates.filter((c) => c.status === "rejected").length,
      autoLinked: candidates.filter((c) => c.status === "auto_linked").length,
    }),
    [candidates],
  );

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Skip filter (local UI only)
      if (skippedIds.has(c.id)) return false;

      // Status filter
      if (statusFilter !== "all" && c.status !== statusFilter) return false;

      // Confidence filter
      if (confidenceFilter === "high" && c.confidence_score < 90) return false;
      if (
        confidenceFilter === "medium" &&
        (c.confidence_score < 70 || c.confidence_score >= 90)
      )
        return false;
      if (confidenceFilter === "low" && c.confidence_score >= 70) return false;

      // Cross-company filter
      if (crossCompanyFilter === "yes" && !c.is_cross_company) return false;
      if (crossCompanyFilter === "no" && c.is_cross_company) return false;

      return true;
    });
  }, [candidates, statusFilter, confidenceFilter, crossCompanyFilter, skippedIds]);

  // Action handlers
  const handleConfirm = async (candidate: TransferCandidate) => {
    setProcessing(candidate.id);

    try {
      // 1. Get bank_transfer category ID
      const { data: category, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("code", "bank_transfer")
        .single();

      if (categoryError) throw categoryError;

      // 2. Update transfer_candidates status
      const { error: updateError } = await supabase
        .from("transfer_candidates")
        .update({
          status: "confirmed",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", candidate.id);

      if (updateError) throw updateError;

      // 3. Link the transactions
      const { error: fromError } = await supabase
        .from("transactions")
        .update({
          linked_to: candidate.to_transaction_id,
          link_type: "transfer_out",
          category_id: category?.id,
          transfer_status: "matched",
          needs_review: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidate.from_transaction_id);

      if (fromError) throw fromError;

      const { error: toError } = await supabase
        .from("transactions")
        .update({
          linked_to: candidate.from_transaction_id,
          link_type: "transfer_in",
          category_id: category?.id,
          transfer_status: "matched",
          needs_review: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", candidate.to_transaction_id);

      if (toError) throw toError;

      // 4. Refresh list
      await fetchCandidates();
      sonnerToast.success("Transfer confirmed and linked");
    } catch (err) {
      console.error("Error confirming transfer:", err);
      sonnerToast.error("Failed to confirm transfer");
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (candidate: TransferCandidate, reason?: string) => {
    setProcessing(candidate.id);

    try {
      const { error } = await supabase
        .from("transfer_candidates")
        .update({
          status: "rejected",
          rejection_reason: reason || "Not a transfer",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", candidate.id);

      if (error) throw error;

      await fetchCandidates();
      sonnerToast.info("Match rejected");
    } catch (err) {
      console.error("Error rejecting transfer:", err);
      sonnerToast.error("Failed to reject transfer");
    } finally {
      setProcessing(null);
    }
  };

  const handleSkip = (candidateId: string) => {
    setSkippedIds((prev) => new Set(prev).add(candidateId));
    sonnerToast.info("Skipped for now");
  };

  // Helper functions
  const getConfidenceBadge = (score: number) => {
    if (score >= 90)
      return { color: "bg-green-100 text-green-800", label: "High" };
    if (score >= 70)
      return { color: "bg-yellow-100 text-yellow-800", label: "Medium" };
    return { color: "bg-red-100 text-red-800", label: "Low" };
  };

  const formatDateSafe = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
  };

  const formatAmount = (
    amount: number,
    currency: string,
    type: "from" | "to",
  ) => {
    const formatted = new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currency,
    }).format(Math.abs(amount));

    return type === "from" ? `-${formatted}` : `+${formatted}`;
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
        <div className="p-6 max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Transfer Matches to Review
              </h1>
              <p className="text-gray-500 mt-1">
                Review and confirm potential internal transfer matches
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-blue-600 font-medium">
                  {summary.pending} pending
                </span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500">
                  {summary.confirmed + summary.rejected + summary.autoLinked}{" "}
                  reviewed
                </span>
              </div>
              <button
                onClick={fetchCandidates}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div
              className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
                statusFilter === "pending"
                  ? "ring-2 ring-blue-500"
                  : "hover:border-gray-300"
              }`}
              onClick={() => setStatusFilter("pending")}
            >
              <div className="flex items-center gap-2 mb-1">
                <Loader2 className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-500">Pending</span>
              </div>
              <div className="text-3xl font-bold text-blue-600">
                {summary.pending}
              </div>
            </div>

            <div
              className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
                statusFilter === "confirmed"
                  ? "ring-2 ring-green-500"
                  : "hover:border-gray-300"
              }`}
              onClick={() => setStatusFilter("confirmed")}
            >
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-500">Confirmed</span>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {summary.confirmed}
              </div>
            </div>

            <div
              className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
                statusFilter === "rejected"
                  ? "ring-2 ring-red-500"
                  : "hover:border-gray-300"
              }`}
              onClick={() => setStatusFilter("rejected")}
            >
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-gray-500">Rejected</span>
              </div>
              <div className="text-3xl font-bold text-red-600">
                {summary.rejected}
              </div>
            </div>

            <div
              className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
                statusFilter === "auto_linked"
                  ? "ring-2 ring-purple-500"
                  : "hover:border-gray-300"
              }`}
              onClick={() => setStatusFilter("auto_linked")}
            >
              <div className="flex items-center gap-2 mb-1">
                <Check className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-gray-500">Auto Linked</span>
              </div>
              <div className="text-3xl font-bold text-purple-600">
                {summary.autoLinked}
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white rounded-lg border p-4 mb-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">
                  Filters:
                </span>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="rejected">Rejected</option>
                <option value="auto_linked">Auto Linked</option>
              </select>

              {/* Confidence Filter */}
              <select
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm"
              >
                <option value="all">All Confidence</option>
                <option value="high">High (≥90%)</option>
                <option value="medium">Medium (70-89%)</option>
                <option value="low">Low (&lt;70%)</option>
              </select>

              {/* Cross-Company Filter */}
              <select
                value={crossCompanyFilter}
                onChange={(e) => setCrossCompanyFilter(e.target.value)}
                className="px-3 py-1.5 border rounded-lg text-sm"
              >
                <option value="all">All Companies</option>
                <option value="yes">Cross-Company Only</option>
                <option value="no">Same Company Only</option>
              </select>

              {(statusFilter !== "pending" ||
                confidenceFilter !== "all" ||
                crossCompanyFilter !== "all") && (
                <button
                  onClick={() => {
                    setStatusFilter("pending");
                    setConfidenceFilter("all");
                    setCrossCompanyFilter("all");
                  }}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Transfer Cards */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : filteredCandidates.length === 0 ? (
            /* Empty State */
            <div className="bg-white rounded-lg border p-12 text-center">
              {statusFilter === "pending" && candidates.length === 0 ? (
                <>
                  <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
                  <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
                  <p className="text-gray-500 mb-6">
                    No pending transfer matches to review.
                  </p>
                  <button
                    onClick={() => navigate("/transactions")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Go to Transactions
                  </button>
                </>
              ) : candidates.length === 0 ? (
                <>
                  <Filter className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-semibold mb-2">
                    No transfer matches
                  </h3>
                  <p className="text-gray-500 mb-6">
                    Run transfer detection on your transactions to find internal
                    transfers.
                  </p>
                  <button
                    onClick={() => navigate("/transactions")}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Go to Transactions
                  </button>
                </>
              ) : (
                <>
                  <Filter className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                  <h3 className="text-xl font-semibold mb-2">
                    No matches found
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Try adjusting your filters to see more results.
                  </p>
                  <button
                    onClick={() => {
                      setStatusFilter("pending");
                      setConfidenceFilter("all");
                      setCrossCompanyFilter("all");
                    }}
                    className="text-blue-600 hover:underline"
                  >
                    Reset Filters
                  </button>
                </>
              )}
            </div>
          ) : (
            /* Transfer Cards List */
            <div className="space-y-4">
              {filteredCandidates.map((candidate, idx) => {
                const confidenceBadge = getConfidenceBadge(
                  candidate.confidence_score,
                );
                const isProcessing = processing === candidate.id;

                return (
                  <div
                    key={candidate.id}
                    className="bg-white rounded-lg border hover:shadow-md transition-shadow"
                  >
                    {/* Card Header */}
                    <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-600">
                          Match #{idx + 1}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-500">
                          Confidence:
                        </span>
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${confidenceBadge.color}`}
                        >
                          {candidate.confidence_score}% •{" "}
                          {confidenceBadge.label}
                        </span>
                      </div>
                    </div>

                    {/* Cross-Company Warning */}
                    {candidate.is_cross_company && (
                      <div className="px-6 py-3 bg-amber-50 border-b border-amber-200 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        <div>
                          <div className="font-medium text-amber-900">
                            CROSS-COMPANY TRANSFER
                          </div>
                          <div className="text-sm text-amber-700">
                            This transfer is between different companies.
                            Requires manual review.
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-6">
                      {/* FROM Transaction */}
                      <div className="mb-4">
                        <div className="text-xs font-semibold text-gray-500 mb-2">
                          FROM
                        </div>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Building2 className="w-4 h-4 text-gray-500" />
                                <span className="font-medium">
                                  {candidate.from_account.bank_name}
                                  {candidate.from_account.nickname && (
                                    <span className="text-gray-500 font-normal">
                                      {" "}
                                      - {candidate.from_account.nickname}
                                    </span>
                                  )}
                                </span>
                                <span className="text-sm text-gray-500">
                                  (••••
                                  {candidate.from_account.account_number_last4}
                                  )
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                <Calendar className="w-3 h-3" />
                                {formatDateSafe(candidate.date_from)}
                              </div>
                              <div className="text-sm text-gray-700 mb-2">
                                "{candidate.from_transaction.description}"
                              </div>
                              {candidate.from_company && (
                                <div className="text-xs text-gray-500">
                                  🏢 {candidate.from_company.name}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-red-700">
                                {formatAmount(
                                  candidate.amount_from,
                                  candidate.currency_from,
                                  "from",
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {candidate.currency_from}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Arrow */}
                      <div className="flex justify-center my-2">
                        <ArrowDown className="w-6 h-6 text-gray-400" />
                      </div>

                      {/* TO Transaction */}
                      <div className="mb-4">
                        <div className="text-xs font-semibold text-gray-500 mb-2">
                          TO
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Building2 className="w-4 h-4 text-gray-500" />
                                <span className="font-medium">
                                  {candidate.to_account.bank_name}
                                  {candidate.to_account.nickname && (
                                    <span className="text-gray-500 font-normal">
                                      {" "}
                                      - {candidate.to_account.nickname}
                                    </span>
                                  )}
                                </span>
                                <span className="text-sm text-gray-500">
                                  (••••
                                  {candidate.to_account.account_number_last4})
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                                <Calendar className="w-3 h-3" />
                                {formatDateSafe(candidate.date_to)}
                              </div>
                              <div className="text-sm text-gray-700 mb-2">
                                "{candidate.to_transaction.description}"
                              </div>
                              {candidate.to_company && (
                                <div className="text-xs text-gray-500">
                                  🏢 {candidate.to_company.name}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-green-700">
                                {formatAmount(
                                  candidate.amount_to,
                                  candidate.currency_to,
                                  "to",
                                )}
                              </div>
                              <div className="text-xs text-gray-500">
                                {candidate.currency_to}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Details */}
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                        <div className="flex items-center gap-4 text-sm">
                          {candidate.exchange_rate_used && (
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-blue-600" />
                              <span>
                                Exchange Rate: 1 {candidate.currency_from} ={" "}
                                {candidate.exchange_rate_used.toFixed(4)}{" "}
                                {candidate.currency_to}
                                {candidate.exchange_rate_source && (
                                  <span className="text-gray-500">
                                    {" "}
                                    ({candidate.exchange_rate_source})
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <span>
                              Date Difference:{" "}
                              {candidate.date_diff_days === 0
                                ? "Same day"
                                : `${candidate.date_diff_days} day${candidate.date_diff_days !== 1 ? "s" : ""}`}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      {candidate.status === "pending" && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleConfirm(candidate)}
                            disabled={isProcessing}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                          >
                            {isProcessing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                            Confirm Match
                          </button>
                          <button
                            onClick={() => handleReject(candidate)}
                            disabled={isProcessing}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-red-600 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                          >
                            <X className="w-4 h-4" />
                            Not a Transfer
                          </button>
                          <button
                            onClick={() => handleSkip(candidate.id)}
                            disabled={isProcessing}
                            className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center gap-2"
                          >
                            <SkipForward className="w-4 h-4" />
                            Skip
                          </button>
                        </div>
                      )}

                      {/* Status for reviewed items */}
                      {candidate.status !== "pending" && (
                        <div className="text-center py-2">
                          {candidate.status === "confirmed" && (
                            <span className="inline-flex items-center gap-2 text-green-600 font-medium">
                              <CheckCircle className="w-5 h-5" />
                              Confirmed and Linked
                            </span>
                          )}
                          {candidate.status === "rejected" && (
                            <span className="inline-flex items-center gap-2 text-red-600 font-medium">
                              <XCircle className="w-5 h-5" />
                              Rejected
                              {candidate.rejection_reason && (
                                <span className="text-sm text-gray-500">
                                  ({candidate.rejection_reason})
                                </span>
                              )}
                            </span>
                          )}
                          {candidate.status === "auto_linked" && (
                            <span className="inline-flex items-center gap-2 text-purple-600 font-medium">
                              <Check className="w-5 h-5" />
                              Auto-Linked by System
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
