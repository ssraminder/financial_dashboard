import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import {
  CheckCircle,
  AlertCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Building2,
  Upload,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  Filter,
  ChevronDown,
  X,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";

interface StatementStatus {
  bank_account_id: string;
  bank_name: string;
  nickname: string | null;
  account_number_last4: string;
  currency: string;
  statement_frequency: string;
  company_name: string | null;
  period_year: number;
  period_month: number;
  period_month_name: string;
  period_start: string;
  period_end: string;
  status: "confirmed" | "pending_review" | "uploaded" | "missing";
  statement_import_id: string | null;
  actual_start: string | null;
  actual_end: string | null;
  confirmed_at: string | null;
  uploaded_at: string | null;
  reminder_due: boolean;
}

interface MonthlySummary {
  period_year: number;
  period_month: number;
  period_month_name: string;
  total_expected: number;
  confirmed_count: number;
  pending_count: number;
  missing_count: number;
  completion_percent: number;
}

interface DateGap {
  bank_account_id: string;
  bank_name: string;
  nickname: string | null;
  account_number_last4: string;
  gap_start: string;
  gap_end: string;
  gap_days: number;
  gap_status: "gap" | "overlap";
}

export default function StatementStatus() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // State
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [statementStatus, setStatementStatus] = useState<StatementStatus[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([]);
  const [dateGaps, setDateGaps] = useState<DateGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"status" | "gaps">("status");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [exclusions, setExclusions] = useState<
    { bank_account_id: string; period_year: number; period_month: number }[]
  >([]);
  const [exclusionSet, setExclusionSet] = useState<Set<string>>(new Set());

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Fetch data
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [selectedYear, selectedMonth, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch statement status
      let query = supabase
        .from("statement_status_by_month")
        .select("*")
        .eq("period_year", selectedYear)
        .order("period_month", { ascending: false })
        .order("bank_name", { ascending: true });

      if (selectedMonth) {
        query = query.eq("period_month", selectedMonth);
      }

      const { data: statusData, error: statusError } = await query;

      if (statusError) throw statusError;
      setStatementStatus(statusData || []);

      // Fetch monthly summary
      const { data: summaryData, error: summaryError } = await supabase
        .from("missing_statements_summary")
        .select("*")
        .eq("period_year", selectedYear)
        .order("period_month", { ascending: false });

      if (summaryError) throw summaryError;
      setMonthlySummary(summaryData || []);

      // Fetch date gaps
      const { data: gapsData, error: gapsError } = await supabase
        .from("statement_date_gaps")
        .select("*");

      if (gapsError) throw gapsError;
      setDateGaps(gapsData || []);

      // Fetch exclusions
      const { data: exclusionsData } = await supabase
        .from("statement_tracking_exclusions")
        .select("bank_account_id, period_year, period_month")
        .eq("period_year", selectedYear);

      setExclusions(exclusionsData || []);

      // Create a Set for fast lookup
      const newExclusionSet = new Set(
        exclusionsData?.map(
          (e) => `${e.bank_account_id}-${e.period_year}-${e.period_month}`,
        ) || [],
      );
      setExclusionSet(newExclusionSet);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Get unique bank accounts from data
  const bankAccountOptions = useMemo(() => {
    const uniqueAccounts = new Map();
    statementStatus?.forEach((s) => {
      if (!uniqueAccounts.has(s.bank_account_id)) {
        uniqueAccounts.set(s.bank_account_id, {
          id: s.bank_account_id,
          bank_name: s.bank_name,
          nickname: s.nickname,
          account_number_last4: s.account_number_last4,
          label: `${s.bank_name} - ${s.nickname || "Account"} (••••${s.account_number_last4})`,
        });
      }
    });
    return Array.from(uniqueAccounts.values()).sort(
      (a, b) =>
        a.bank_name.localeCompare(b.bank_name) ||
        (a.nickname || "").localeCompare(b.nickname || ""),
    );
  }, [statementStatus]);

  // Apply filters
  const filteredByAccount = useMemo(() => {
    if (selectedAccounts.length === 0) {
      return statementStatus;
    }
    return statementStatus?.filter((s) =>
      selectedAccounts.includes(s.bank_account_id),
    );
  }, [statementStatus, selectedAccounts]);

  // Apply exclusion and status filters
  const displayStatements = useMemo(() => {
    let result = filteredByAccount;

    // Apply exclusion filter (hidden accounts)
    if (!showHidden && exclusionSet.size > 0) {
      result = result?.filter(
        (s) =>
          !exclusionSet.has(
            `${s.bank_account_id}-${s.period_year}-${s.period_month}`,
          ),
      );
    }

    // Apply status filter
    if (filterStatus !== "all") {
      result = result?.filter((s) => {
        if (filterStatus === "pending")
          return s.status === "pending_review" || s.status === "uploaded";
        return s.status === filterStatus;
      });
    }

    return result;
  }, [filteredByAccount, showHidden, exclusionSet, filterStatus]);

  // Calculate totals from filtered/displayed statements
  const totals = {
    confirmed: displayStatements.filter((s) => s.status === "confirmed").length,
    pending: displayStatements.filter(
      (s) => s.status === "pending_review" || s.status === "uploaded",
    ).length,
    missing: displayStatements.filter((s) => s.status === "missing").length,
  };

  // Handler functions
  const handleExcludeAccount = async (item: StatementStatus) => {
    const confirmed = window.confirm(
      `Hide ${item.nickname || item.bank_name} for ${item.period_month_name} ${item.period_year}?\n\nUse this if the account didn't exist during this period.`,
    );

    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from("statement_tracking_exclusions")
        .insert({
          bank_account_id: item.bank_account_id,
          period_year: item.period_year,
          period_month: item.period_month,
          reason: "account_not_open",
          notes: "Hidden from statement status view",
        });

      if (error) throw error;

      fetchData();
      sonnerToast.success(
        `Hidden ${item.nickname || item.bank_name} for ${item.period_month_name}`,
      );
    } catch (err) {
      console.error("Error excluding account:", err);
      sonnerToast.error("Failed to hide account");
    }
  };

  const handleRestoreAccount = async (item: StatementStatus) => {
    try {
      const { error } = await supabase
        .from("statement_tracking_exclusions")
        .delete()
        .eq("bank_account_id", item.bank_account_id)
        .eq("period_year", item.period_year)
        .eq("period_month", item.period_month);

      if (error) throw error;

      fetchData();
      sonnerToast.success(`Restored ${item.nickname || item.bank_name}`);
    } catch (err) {
      console.error("Error restoring account:", err);
      sonnerToast.error("Failed to restore account");
    }
  };

  const handleViewStatement = (statement: StatementStatus) => {
    window.open(
      `/statements?account=${statement.bank_account_id}&statement=${statement.statement_import_id}&autoOpen=true`,
      "_blank",
    );
  };

  // Group by month for display
  const groupedByMonth = displayStatements.reduce(
    (acc, s) => {
      const key = `${s.period_year}-${s.period_month}`;
      if (!acc[key]) {
        acc[key] = {
          year: s.period_year,
          month: s.period_month,
          monthName: s.period_month_name,
          statements: [],
        };
      }
      acc[key].statements.push(s);
      return acc;
    },
    {} as Record<
      string,
      {
        year: number;
        month: number;
        monthName: string;
        statements: StatementStatus[];
      }
    >,
  );

  // Status badge component
  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case "confirmed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Confirmed
          </span>
        );
      case "pending_review":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
            <AlertCircle className="w-3 h-3" />
            Pending Review
          </span>
        );
      case "uploaded":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
            <CheckCircle className="w-3 h-3" />
            Uploaded
          </span>
        );
      case "missing":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            Missing
          </span>
        );
      default:
        return null;
    }
  };

  // Format date safely (timezone-safe)
  const formatDateSafe = (dateStr: string | null) => {
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
        <div className="p-6 max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Statement Status
              </h1>
              <p className="text-gray-500 mt-1">
                Track uploaded and missing statements across all accounts
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={() => navigate("/upload")}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Upload className="w-4 h-4" />
                Upload Statement
              </button>
            </div>
          </div>

          {/* Year Selector */}
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setSelectedYear((y) => y - 1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xl font-semibold">{selectedYear}</span>
            <button
              onClick={() => setSelectedYear((y) => y + 1)}
              disabled={selectedYear >= new Date().getFullYear()}
              className="p-2 hover:bg-gray-100 rounded-lg disabled:opacity-50"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Filter Row - Bank Account Filter */}
          <div className="flex items-center gap-4 mb-4">
            {/* Bank Account Filter */}
            <div className="relative">
              <button
                onClick={() => setFilterOpen(!filterOpen)}
                className="flex items-center gap-2 px-3 py-2 border rounded-lg bg-white hover:bg-gray-50"
              >
                <Filter className="h-4 w-4 text-gray-500" />
                <span className="text-sm">
                  {selectedAccounts.length === 0
                    ? "All Accounts"
                    : selectedAccounts.length === 1
                      ? bankAccountOptions.find(
                          (a) => a.id === selectedAccounts[0],
                        )?.nickname || "Selected"
                      : `${selectedAccounts.length} Accounts`}
                </span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>

              {filterOpen && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-white border rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                  {/* Select All / Clear */}
                  <div className="p-2 border-b flex justify-between">
                    <button
                      onClick={() => setSelectedAccounts([])}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Show All
                    </button>
                    <button
                      onClick={() =>
                        setSelectedAccounts(bankAccountOptions.map((a) => a.id))
                      }
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Select All
                    </button>
                  </div>

                  {/* Account List */}
                  <div className="p-2">
                    {bankAccountOptions.map((account) => (
                      <label
                        key={account.id}
                        className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedAccounts.includes(account.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedAccounts([
                                ...selectedAccounts,
                                account.id,
                              ]);
                            } else {
                              setSelectedAccounts(
                                selectedAccounts.filter(
                                  (id) => id !== account.id,
                                ),
                              );
                            }
                          }}
                          className="rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {account.bank_name}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {account.nickname} • ••••
                            {account.account_number_last4}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {/* Apply Button */}
                  <div className="p-2 border-t">
                    <button
                      onClick={() => setFilterOpen(false)}
                      className="w-full py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    >
                      Apply Filter
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Clear Filter Button (show when filter active) */}
            {selectedAccounts.length > 0 && (
              <button
                onClick={() => setSelectedAccounts([])}
                className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              >
                <X className="h-4 w-4" />
                Clear Filter
              </button>
            )}

            {/* Show Hidden Toggle */}
            <label className="flex items-center gap-2 text-sm text-gray-600 ml-auto">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)}
                className="rounded"
              />
              Show hidden accounts
            </label>
            {exclusions?.length > 0 && (
              <span className="text-xs text-gray-400">
                ({exclusions.length} hidden)
              </span>
            )}
          </div>

          {/* Click outside to close filter */}
          {filterOpen && (
            <div
              className="fixed inset-0 z-40"
              onClick={() => setFilterOpen(false)}
            />
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div
              className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
                filterStatus === "all"
                  ? "ring-2 ring-blue-500"
                  : "hover:border-gray-300"
              }`}
              onClick={() => setFilterStatus("all")}
            >
              <div className="text-3xl font-bold text-gray-900">
                {totals.confirmed + totals.pending + totals.missing}
              </div>
              <div className="text-sm text-gray-500">Total Expected</div>
            </div>
            <div
              className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
                filterStatus === "confirmed"
                  ? "ring-2 ring-green-500"
                  : "hover:border-gray-300"
              }`}
              onClick={() => setFilterStatus("confirmed")}
            >
              <div className="text-3xl font-bold text-green-600">
                {totals.confirmed}
              </div>
              <div className="text-sm text-gray-500">Confirmed</div>
            </div>
            <div
              className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
                filterStatus === "pending"
                  ? "ring-2 ring-yellow-500"
                  : "hover:border-gray-300"
              }`}
              onClick={() => setFilterStatus("pending")}
            >
              <div className="text-3xl font-bold text-yellow-600">
                {totals.pending}
              </div>
              <div className="text-sm text-gray-500">Pending Review</div>
            </div>
            <div
              className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
                filterStatus === "missing"
                  ? "ring-2 ring-red-500"
                  : "hover:border-gray-300"
              }`}
              onClick={() => setFilterStatus("missing")}
            >
              <div className="text-3xl font-bold text-red-600">
                {totals.missing}
              </div>
              <div className="text-sm text-gray-500">Missing</div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b mb-6">
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab("status")}
                className={`px-4 py-2 border-b-2 font-medium ${
                  activeTab === "status"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Monthly Status
              </button>
              <button
                onClick={() => setActiveTab("gaps")}
                className={`px-4 py-2 border-b-2 font-medium ${
                  activeTab === "gaps"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                Date Gaps ({dateGaps.length})
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : activeTab === "status" ? (
            /* Monthly Status Tab */
            <div className="space-y-6">
              {Object.values(groupedByMonth).map((group) => (
                <div
                  key={`${group.year}-${group.month}`}
                  className="bg-white rounded-lg border"
                >
                  <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">
                      {group.monthName.trim()} {group.year}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span className="text-green-600">
                        {
                          group.statements.filter(
                            (s) => s.status === "confirmed",
                          ).length
                        }{" "}
                        confirmed
                      </span>
                      <span>•</span>
                      <span className="text-yellow-600">
                        {
                          group.statements.filter(
                            (s) =>
                              s.status === "pending_review" ||
                              s.status === "uploaded",
                          ).length
                        }{" "}
                        pending
                      </span>
                      <span>•</span>
                      <span className="text-red-600">
                        {
                          group.statements.filter((s) => s.status === "missing")
                            .length
                        }{" "}
                        missing
                      </span>
                    </div>
                  </div>
                  <div className="divide-y">
                    {group.statements.map((statement, idx) => (
                      <div
                        key={`${statement.bank_account_id}-${statement.period_month}-${idx}`}
                        className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-gray-500" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {statement.bank_name}
                              {statement.nickname && (
                                <span className="text-gray-500 font-normal">
                                  {" "}
                                  - {statement.nickname}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500">
                              ••••{statement.account_number_last4} •{" "}
                              {statement.currency}
                              {statement.company_name && (
                                <span> • {statement.company_name}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {statement.actual_start && statement.actual_end && (
                            <div className="text-sm text-gray-500">
                              {formatDateSafe(statement.actual_start)} -{" "}
                              {formatDateSafe(statement.actual_end)}
                            </div>
                          )}

                          {/* Check if this item is hidden */}
                          {showHidden &&
                          exclusionSet.has(
                            `${statement.bank_account_id}-${statement.period_year}-${statement.period_month}`,
                          ) ? (
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-sm italic">
                                Hidden
                              </span>
                              <button
                                onClick={() => handleRestoreAccount(statement)}
                                className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
                                title="Restore - Show this account again"
                              >
                                <Eye className="w-4 h-4" />
                                Restore
                              </button>
                            </div>
                          ) : (
                            <>
                              {/* For pending_review or uploaded status - show badge and View button */}
                              {(statement.status === "pending_review" ||
                                statement.status === "uploaded") &&
                                statement.statement_import_id && (
                                  <>
                                    <StatusBadge status={statement.status} />
                                    <button
                                      onClick={() =>
                                        handleViewStatement(statement)
                                      }
                                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
                                      title="View Statement"
                                    >
                                      <Eye className="w-4 h-4" />
                                      View
                                    </button>
                                  </>
                                )}

                              {/* For confirmed status - show badge and View button */}
                              {statement.status === "confirmed" &&
                                statement.statement_import_id && (
                                  <>
                                    <StatusBadge status={statement.status} />
                                    <button
                                      onClick={() =>
                                        handleViewStatement(statement)
                                      }
                                      className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 flex items-center gap-1"
                                      title="View Statement"
                                    >
                                      <Eye className="w-4 h-4" />
                                    </button>
                                  </>
                                )}

                              {/* For missing status - show Hide and Upload buttons */}
                              {statement.status === "missing" && (
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={statement.status} />
                                  <button
                                    onClick={() =>
                                      handleExcludeAccount(statement)
                                    }
                                    className="px-2 py-1 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1"
                                    title="Hide - Account didn't exist this month"
                                  >
                                    <EyeOff className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() =>
                                      navigate(
                                        `/upload?account=${statement.bank_account_id}`,
                                      )
                                    }
                                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                                  >
                                    Upload
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {Object.keys(groupedByMonth).length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No statement data for {selectedYear}
                </div>
              )}
            </div>
          ) : (
            /* Date Gaps Tab */
            <div className="bg-white rounded-lg border">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="font-semibold text-gray-900">
                  Date Coverage Gaps
                </h3>
                <p className="text-sm text-gray-500">
                  Periods not covered by any uploaded statement
                </p>
              </div>
              {dateGaps.length > 0 ? (
                <div className="divide-y">
                  {dateGaps.map((gap, idx) => (
                    <div
                      key={idx}
                      className="px-4 py-3 flex items-center justify-between hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            gap.gap_status === "gap"
                              ? "bg-red-100"
                              : "bg-yellow-100"
                          }`}
                        >
                          <Calendar
                            className={`w-5 h-5 ${
                              gap.gap_status === "gap"
                                ? "text-red-500"
                                : "text-yellow-500"
                            }`}
                          />
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">
                            {gap.bank_name}
                            {gap.nickname && (
                              <span className="text-gray-500 font-normal">
                                {" "}
                                - {gap.nickname}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">
                            ••••{gap.account_number_last4}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {formatDateSafe(gap.gap_start)} →{" "}
                            {formatDateSafe(gap.gap_end)}
                          </div>
                          <div
                            className={`text-xs ${
                              gap.gap_status === "gap"
                                ? "text-red-600"
                                : "text-yellow-600"
                            }`}
                          >
                            {gap.gap_status === "gap"
                              ? `${gap.gap_days} days missing`
                              : `${Math.abs(gap.gap_days)} days overlap`}
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            navigate(`/upload?account=${gap.bank_account_id}`)
                          }
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Upload
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                  <p>No date gaps detected</p>
                  <p className="text-sm">
                    All statement periods are properly connected
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Monthly Progress Overview */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold mb-4">
              Monthly Overview - {selectedYear}
            </h3>
            <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-12 gap-2">
              {Array.from({ length: 12 }, (_, i) => {
                const month = i + 1;
                const summary = monthlySummary.find(
                  (s) => s.period_month === month,
                );
                const percent = summary?.completion_percent || 0;
                const isPast = new Date(selectedYear, month, 0) < new Date();

                return (
                  <button
                    key={month}
                    onClick={() =>
                      setSelectedMonth(selectedMonth === month ? null : month)
                    }
                    className={`p-2 rounded-lg border text-center transition-all ${
                      selectedMonth === month ? "ring-2 ring-blue-500" : ""
                    } ${!isPast ? "opacity-50" : ""}`}
                  >
                    <div className="text-xs text-gray-500">
                      {
                        [
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
                        ][i]
                      }
                    </div>
                    <div
                      className={`text-sm font-semibold ${
                        percent === 100
                          ? "text-green-600"
                          : percent >= 50
                            ? "text-yellow-600"
                            : percent > 0
                              ? "text-red-600"
                              : "text-gray-400"
                      }`}
                    >
                      {isPast ? `${percent}%` : "-"}
                    </div>
                    {summary && (
                      <div className="text-xs text-gray-400">
                        {summary.missing_count > 0 &&
                          `${summary.missing_count}⚠️`}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
