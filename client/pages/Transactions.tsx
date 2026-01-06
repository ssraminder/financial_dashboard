import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { TransactionEditModal } from "@/components/TransactionEditModal";
import { SearchableDropdown } from "@/components/SearchableDropdown";
import { ReanalyzeProgressIndicator } from "@/components/ReanalyzeProgressIndicator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit,
  Eye,
  Link2,
  Loader2,
  Pencil,
  Search,
  X as XIcon,
  Lock,
  LockOpen,
} from "lucide-react";
import { format, subDays } from "date-fns";
import { formatDate } from "@/lib/dateUtils";

interface Transaction {
  id: string;
  transaction_date: string;
  posting_date?: string;
  description: string;
  payee_name?: string;
  amount: number;
  transaction_type?: "debit" | "credit";
  category_id: string;
  bank_account_id: string;
  company_id?: string;
  currency?: string;
  needs_review: boolean;
  review_reason?: string;
  gst_amount?: number;
  has_gst?: boolean;
  linked_to?: string;
  link_type?: string;
  is_edited?: boolean;
  edited_at?: string;
  manually_locked?: boolean;
  manually_locked_at?: string;
  manually_locked_by?: string;
  is_locked?: boolean;
  category?: {
    id: string;
    code: string;
    name: string;
    category_type: string;
  };
  bank_account?: {
    id: string;
    name: string;
    nickname: string;
    bank_name: string;
    account_number?: string;
    balance_type?: "asset" | "liability";
  };
  company?: {
    id: string;
    name: string;
  };
  linked_transaction?: {
    id: string;
    description: string;
    amount: number;
    transaction_date: string;
  };
  statement?: {
    id: string;
    import_status: string;
    confirmed_at: string | null;
  };
}

interface FilterOptions {
  bankAccounts: Array<{ id: string; name: string; nickname: string }>;
  companies: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; code: string }>;
}

export default function Transactions() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    bankAccounts: [],
    companies: [],
    categories: [],
  });
  const [loading, setLoading] = useState(true);

  // Filter state
  const [fromDate, setFromDate] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd"),
  );
  const [toDate, setToDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedBankAccount, setSelectedBankAccount] = useState("all");
  const [selectedCompany, setSelectedCompany] = useState("all");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [showNeedsReview, setShowNeedsReview] = useState(
    searchParams.get("filter") === "needs_review",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [showUnconfirmed, setShowUnconfirmed] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Modal state
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Re-analyze feature states
  const [selectedTransactions, setSelectedTransactions] = useState<string[]>(
    [],
  );
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [reanalyzeDropdownOpen, setReanalyzeDropdownOpen] = useState(false);
  const [reanalyzeResult, setReanalyzeResult] = useState<{
    total: number;
    kb_matched: number;
    ai_matched: number;
    unmatched: number;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Fetch filter options and transactions
  useEffect(() => {
    if (user) {
      fetchFilterOptions();
      fetchTransactions();
    }
  }, [user]);

  // Re-fetch when filters change
  useEffect(() => {
    if (user) {
      fetchTransactions();
      setCurrentPage(1);
    }
  }, [
    fromDate,
    toDate,
    selectedBankAccount,
    selectedCompany,
    selectedCategory,
    selectedStatus,
    showNeedsReview,
    searchTerm,
    showUnconfirmed,
  ]);

  const fetchFilterOptions = async () => {
    try {
      // Fetch bank accounts
      const { data: bankAccountsData } = await supabase
        .from("bank_accounts")
        .select("id, name, nickname")
        .eq("is_active", true)
        .order("name");

      // Fetch companies
      const { data: companiesData } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");

      // Fetch categories
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("id, name, code")
        .eq("is_active", true)
        .order("name");

      setFilterOptions({
        bankAccounts: bankAccountsData || [],
        companies: companiesData || [],
        categories: categoriesData || [],
      });
    } catch (err) {
      console.error("Error fetching filter options:", err);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from("transactions")
        .select(
          `*,
          category:categories!category_id(id, code, name, category_type),
          bank_account:bank_accounts(id, name, nickname, bank_name, account_number, balance_type),
          company:companies(id, name),
          linked_transaction:transactions!linked_to(id, description, amount, transaction_date),
          statement:statement_imports(id, import_status, confirmed_at)`,
        )
        .order("transaction_date", { ascending: false })
        .limit(500);

      // Apply date filter
      if (fromDate) {
        query = query.gte("transaction_date", fromDate);
      }
      if (toDate) {
        query = query.lte("transaction_date", toDate);
      }

      // Apply bank account filter
      if (selectedBankAccount !== "all") {
        query = query.eq("bank_account_id", selectedBankAccount);
      }

      // Apply company filter
      if (selectedCompany !== "all") {
        query = query.eq("company_id", selectedCompany);
      }

      // Apply category filter
      if (selectedCategory !== "all") {
        query = query.eq("category_id", selectedCategory);
      }

      // Apply status filter
      if (selectedStatus !== "all") {
        query = query.eq("status", selectedStatus);
      }

      // Apply needs review filter
      if (showNeedsReview) {
        query = query.eq("needs_review", true);
      }

      // Apply confirmation status filter (default: only confirmed statements)
      if (!showUnconfirmed) {
        query = query.eq("statement.import_status", "confirmed");
      }

      const { data, error } = await query;

      if (error) throw error;

      // Apply search filter locally
      let filteredData = data || [];
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filteredData = filteredData.filter(
          (t) =>
            t.description?.toLowerCase().includes(term) ||
            t.payee_name?.toLowerCase().includes(term),
        );
      }

      setTransactions(filteredData);
    } catch (err) {
      console.error("Error fetching transactions:", err);
    } finally {
      setLoading(false);
    }
  };

  // Re-analyze selected transactions
  const handleReanalyzeSelected = async () => {
    if (selectedTransactions.length === 0) {
      toast({
        title: "Error",
        description: "No transactions selected",
        variant: "destructive",
      });
      return;
    }

    setIsReanalyzing(true);
    setReanalyzeDropdownOpen(false);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recategorize-transactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            transaction_ids: selectedTransactions,
            kb_only: false,
          }),
        },
      );

      const result = await response.json();

      if (result.success) {
        setReanalyzeResult(result.summary);
        toast({
          title: "Success",
          description: `Re-analyzed ${result.summary.total} transactions: ${result.summary.kb_matched} KB matches, ${result.summary.ai_matched} AI matches`,
        });
        fetchTransactions();
        setSelectedTransactions([]);
      } else {
        toast({
          title: "Error",
          description: result.error || "Re-analyze failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Re-analyze error:", error);
      toast({
        title: "Error",
        description: "Failed to re-analyze transactions",
        variant: "destructive",
      });
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Re-analyze all filtered transactions
  const handleReanalyzeFiltered = async () => {
    setIsReanalyzing(true);
    setReanalyzeDropdownOpen(false);

    // Build filter object from current filter state
    const filter: any = {};

    if (selectedBankAccount !== "all") {
      filter.bank_account_id = selectedBankAccount;
    }
    if (selectedCategory !== "all") {
      const category = filterOptions.categories.find(
        (c) => c.id === selectedCategory,
      );
      if (category) filter.category_code = category.code;
    }
    if (selectedStatus !== "all") {
      filter.status = selectedStatus;
    }
    if (showNeedsReview) {
      filter.needs_review = true;
    }
    if (fromDate) {
      filter.date_from = fromDate;
    }
    if (toDate) {
      filter.date_to = toDate;
    }
    if (searchTerm) {
      filter.description_contains = searchTerm;
    }

    // Safety check - require at least one filter
    if (Object.keys(filter).length === 0) {
      toast({
        title: "Error",
        description: "Please apply at least one filter before re-analyzing all",
        variant: "destructive",
      });
      setIsReanalyzing(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recategorize-transactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            filter,
            kb_only: false,
            max_transactions: 500,
          }),
        },
      );

      const result = await response.json();

      if (result.success) {
        setReanalyzeResult(result.summary);
        toast({
          title: "Success",
          description: `Re-analyzed ${result.summary.total} transactions: ${result.summary.kb_matched} KB matches, ${result.summary.ai_matched} AI matches`,
        });
        fetchTransactions();
      } else {
        toast({
          title: "Error",
          description: result.error || "Re-analyze failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Re-analyze error:", error);
      toast({
        title: "Error",
        description: "Failed to re-analyze transactions",
        variant: "destructive",
      });
    } finally {
      setIsReanalyzing(false);
    }
  };

  // KB-only re-analyze (faster, no AI)
  const handleReanalyzeKBOnly = async (useSelected: boolean) => {
    setIsReanalyzing(true);
    setReanalyzeDropdownOpen(false);

    const payload: any = { kb_only: true };

    if (useSelected) {
      if (selectedTransactions.length === 0) {
        toast({
          title: "Error",
          description: "No transactions selected",
          variant: "destructive",
        });
        setIsReanalyzing(false);
        return;
      }
      payload.transaction_ids = selectedTransactions;
    } else {
      // Build filter from current state
      const filter: any = {};
      if (selectedBankAccount !== "all") {
        filter.bank_account_id = selectedBankAccount;
      }
      if (selectedCategory !== "all") {
        const category = filterOptions.categories.find(
          (c) => c.id === selectedCategory,
        );
        if (category) filter.category_code = category.code;
      }
      if (selectedStatus !== "all") {
        filter.status = selectedStatus;
      }
      if (showNeedsReview) {
        filter.needs_review = true;
      }
      if (fromDate) {
        filter.date_from = fromDate;
      }
      if (toDate) {
        filter.date_to = toDate;
      }
      if (searchTerm) {
        filter.description_contains = searchTerm;
      }

      if (Object.keys(filter).length === 0) {
        toast({
          title: "Error",
          description: "Please apply at least one filter",
          variant: "destructive",
        });
        setIsReanalyzing(false);
        return;
      }
      payload.filter = filter;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recategorize-transactions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify(payload),
        },
      );

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Success",
          description: `KB matched ${result.summary.kb_matched} of ${result.summary.total} transactions`,
        });
        fetchTransactions();
        if (useSelected) setSelectedTransactions([]);
      } else {
        toast({
          title: "Error",
          description: result.error || "Re-analyze failed",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Re-analyze error:", error);
      toast({
        title: "Error",
        description: "Failed to re-analyze",
        variant: "destructive",
      });
    } finally {
      setIsReanalyzing(false);
    }
  };

  // Helper function to determine amount color based on transaction type
  const getAmountColor = (transaction: Transaction) => {
    const { transaction_type } = transaction;

    // Green = good for you (credit = money in)
    // Red = bad for you (debit = money out)
    if (transaction_type === "credit") {
      return "text-green-600";
    }
    return "text-red-600";
  };

  // Pagination
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return transactions.slice(startIndex, endIndex);
  }, [transactions, currentPage]);

  const totalPages = Math.ceil(transactions.length / itemsPerPage);

  // Clear all filters
  const clearFilters = () => {
    setFromDate(format(subDays(new Date(), 30), "yyyy-MM-dd"));
    setToDate(format(new Date(), "yyyy-MM-dd"));
    setSelectedBankAccount("all");
    setSelectedCompany("all");
    setSelectedCategory("all");
    setSelectedStatus("all");
    setShowNeedsReview(false);
    setSearchTerm("");
    setShowUnconfirmed(false);
    setCurrentPage(1);
  };

  // Count active filters
  const activeFilterCount = [
    selectedBankAccount !== "all",
    selectedCompany !== "all",
    selectedCategory !== "all",
    selectedStatus !== "all",
    showNeedsReview,
    showUnconfirmed,
  ].filter(Boolean).length;

  // Bulk lock selected transactions
  const handleBulkLock = async () => {
    if (selectedTransactions.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select transactions to lock",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          manually_locked: true,
          manually_locked_at: new Date().toISOString(),
        })
        .in("id", selectedTransactions);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${selectedTransactions.length} transaction${selectedTransactions.length > 1 ? "s" : ""} locked`,
      });

      fetchTransactions();
      setSelectedTransactions([]);
    } catch (error) {
      console.error("Bulk lock error:", error);
      toast({
        title: "Error",
        description: "Failed to lock transactions",
        variant: "destructive",
      });
    }
  };

  // Bulk unlock selected transactions
  const handleBulkUnlock = async () => {
    if (selectedTransactions.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select transactions to unlock",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("transactions")
        .update({
          manually_locked: false,
          manually_locked_at: null,
          manually_locked_by: null,
        })
        .in("id", selectedTransactions);

      if (error) throw error;

      toast({
        title: "Success",
        description: `${selectedTransactions.length} transaction${selectedTransactions.length > 1 ? "s" : ""} unlocked`,
      });

      fetchTransactions();
      setSelectedTransactions([]);
    } catch (error) {
      console.error("Bulk unlock error:", error);
      toast({
        title: "Error",
        description: "Failed to unlock transactions",
        variant: "destructive",
      });
    }
  };

  // Export CSV
  const exportCSV = () => {
    const headers = [
      "Date",
      "Payee",
      "Description",
      "Amount",
      "Category",
      "Account",
      "GST",
      "Needs Review",
      "Linked",
      "Edited",
    ];

    const rows = transactions.map((t) => [
      formatDate(t.transaction_date),
      t.payee_name || "",
      t.description || "",
      (t.amount ?? 0).toFixed(2),
      t.category?.name || "",
      t.bank_account?.nickname || "",
      t.gst_amount ? `$${t.gst_amount.toFixed(2)}` : "",
      t.needs_review ? "Yes" : "No",
      t.linked_to ? "Yes" : "No",
      t.is_edited ? "Yes" : "No",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
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
        <div className="p-8 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold text-foreground">Transactions</h1>
            <p className="text-muted-foreground mt-1">
              View and manage all transactions
            </p>
          </div>

          {/* Re-Analyze Progress Indicator */}
          <ReanalyzeProgressIndicator
            onComplete={() => {
              // Refresh transactions when re-analysis completes
              fetchTransactions();
            }}
          />

          {/* Filters Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Filters</span>
                <div className="flex gap-2 items-center">
                  {/* Re-analyze Dropdown */}
                  <div className="relative">
                    <button
                      onClick={() =>
                        setReanalyzeDropdownOpen(!reanalyzeDropdownOpen)
                      }
                      disabled={isReanalyzing}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isReanalyzing ? (
                        <>
                          <svg
                            className="animate-spin h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                          <span>Re-analyzing...</span>
                        </>
                      ) : (
                        <>
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                          </svg>
                          <span>Re-analyze</span>
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </>
                      )}
                    </button>

                    {/* Dropdown Menu */}
                    {reanalyzeDropdownOpen && (
                      <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                        <div className="p-2">
                          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                            Selected ({selectedTransactions.length})
                          </div>
                          <button
                            onClick={handleReanalyzeSelected}
                            disabled={selectedTransactions.length === 0}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Re-analyze Selected (KB + AI)
                          </button>
                          <button
                            onClick={() => handleReanalyzeKBOnly(true)}
                            disabled={selectedTransactions.length === 0}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            Re-analyze Selected (KB Only)
                          </button>

                          <div className="border-t border-gray-200 my-2" />

                          <button
                            onClick={handleBulkLock}
                            disabled={selectedTransactions.length === 0}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                          >
                            <Lock className="h-4 w-4" />
                            Lock Selected
                          </button>
                          <button
                            onClick={handleBulkUnlock}
                            disabled={selectedTransactions.length === 0}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                          >
                            <LockOpen className="h-4 w-4" />
                            Unlock Selected
                          </button>

                          <div className="border-t border-gray-200 my-2" />

                          <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase">
                            All Filtered ({transactions.length})
                          </div>
                          <button
                            onClick={handleReanalyzeFiltered}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors"
                          >
                            Re-analyze All Filtered (KB + AI)
                          </button>
                          <button
                            onClick={() => handleReanalyzeKBOnly(false)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 rounded transition-colors"
                          >
                            Re-analyze All Filtered (KB Only)
                          </button>
                        </div>

                        <div className="border-t border-gray-200 px-3 py-2 bg-gray-50 rounded-b-lg">
                          <p className="text-xs text-gray-500">
                            KB Only: Faster, uses Knowledge Base patterns only.
                            KB + AI: More thorough, uses AI for unmatched.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Click outside to close dropdown */}
                    {reanalyzeDropdownOpen && (
                      <div
                        className="fixed inset-0 z-40"
                        onClick={() => setReanalyzeDropdownOpen(false)}
                      />
                    )}
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={exportCSV}
                    disabled={transactions.length === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Export CSV
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main Filter Bar */}
              <div className="flex flex-wrap gap-3 items-center">
                <SearchableDropdown
                  options={[
                    { value: "all", label: "All Bank Accounts" },
                    ...filterOptions.bankAccounts.map((acc) => ({
                      value: acc.id,
                      label: acc.name,
                    })),
                  ]}
                  value={selectedBankAccount}
                  onChange={setSelectedBankAccount}
                  placeholder="Bank Account"
                  className="w-[180px]"
                />

                <SearchableDropdown
                  options={[
                    { value: "all", label: "All Companies" },
                    ...filterOptions.companies.map((c) => ({
                      value: c.id,
                      label: c.name,
                    })),
                  ]}
                  value={selectedCompany}
                  onChange={setSelectedCompany}
                  placeholder="Company"
                  className="w-[180px]"
                />

                <SearchableDropdown
                  options={[
                    { value: "all", label: "All Categories" },
                    {
                      value: "group-expense",
                      label: "── Expenses ──",
                      disabled: true,
                    },
                    ...filterOptions.categories
                      .filter((c) => c.category_type === "expense")
                      .map((c) => ({
                        value: c.id,
                        label: c.name,
                        group: "expense",
                      })),
                    {
                      value: "group-revenue",
                      label: "── Revenue ──",
                      disabled: true,
                    },
                    ...filterOptions.categories
                      .filter((c) => c.category_type === "revenue")
                      .map((c) => ({
                        value: c.id,
                        label: c.name,
                        group: "revenue",
                      })),
                  ]}
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                  placeholder="Category"
                  className="w-[180px]"
                />

                <SearchableDropdown
                  options={[
                    { value: "all", label: "All Statuses" },
                    { value: "pending", label: "Pending" },
                    { value: "auto_categorized", label: "Auto Categorized" },
                    { value: "hitl_required", label: "Needs Review" },
                    { value: "reviewed", label: "Reviewed" },
                    { value: "exported", label: "Exported" },
                  ]}
                  value={selectedStatus}
                  onChange={setSelectedStatus}
                  placeholder="Status"
                  className="w-[180px]"
                />

                {/* Date Range */}
                <div className="flex gap-2 items-center">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-[130px] text-sm"
                    title="From date"
                  />
                  <span className="text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-[130px] text-sm"
                    title="To date"
                  />
                </div>

                {/* Clear Filters Button */}
                {activeFilterCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    <XIcon className="h-4 w-4 mr-1" />
                    Clear ({activeFilterCount})
                  </Button>
                )}
              </div>

              {/* Search and Needs Review Row */}
              <div className="flex gap-3 items-center">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Search description or payee..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="needs-review"
                    checked={showNeedsReview}
                    onCheckedChange={(checked) =>
                      setShowNeedsReview(checked as boolean)
                    }
                  />
                  <label
                    htmlFor="needs-review"
                    className="text-sm cursor-pointer"
                  >
                    Needs review only
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="show-unconfirmed"
                    checked={showUnconfirmed}
                    onCheckedChange={(checked) =>
                      setShowUnconfirmed(checked as boolean)
                    }
                  />
                  <label
                    htmlFor="show-unconfirmed"
                    className="text-sm cursor-pointer"
                  >
                    Show unconfirmed
                  </label>
                  {showUnconfirmed && (
                    <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
                      ⚠️
                    </span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Transactions ({transactions.length})
                {showUnconfirmed && (
                  <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full font-normal">
                    Including unconfirmed statements
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No transactions found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              selectedTransactions.length ===
                              paginatedTransactions.length
                            }
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedTransactions(
                                  paginatedTransactions.map((t) => t.id),
                                );
                              } else {
                                setSelectedTransactions([]);
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead className="w-24">Date</TableHead>
                        <TableHead className="w-32">Payee</TableHead>
                        <TableHead className="w-48">Description</TableHead>
                        <TableHead className="w-24 text-right">
                          Amount
                        </TableHead>
                        <TableHead className="w-32">Category</TableHead>
                        <TableHead className="w-24">Account</TableHead>
                        <TableHead className="w-20 text-right">GST</TableHead>
                        <TableHead className="w-20">Review</TableHead>
                        <TableHead className="w-16">Linked</TableHead>
                        <TableHead className="w-16">Edited</TableHead>
                        <TableHead className="w-16">Lock</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTransactions.map((transaction) => (
                        <TableRow
                          key={transaction.id}
                          className={
                            transaction.needs_review
                              ? "bg-orange-50 hover:bg-orange-100/50"
                              : ""
                          }
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedTransactions.includes(
                                transaction.id,
                              )}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedTransactions([
                                    ...selectedTransactions,
                                    transaction.id,
                                  ]);
                                } else {
                                  setSelectedTransactions(
                                    selectedTransactions.filter(
                                      (id) => id !== transaction.id,
                                    ),
                                  );
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {formatDate(transaction.transaction_date)}
                              {transaction.statement?.import_status !==
                                "confirmed" && (
                                <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
                                  Pending
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {transaction.payee_name || "—"}
                          </TableCell>
                          <TableCell className="text-sm truncate max-w-xs">
                            <span title={transaction.description}>
                              {transaction.description}
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <span className={getAmountColor(transaction)}>
                              {transaction.transaction_type === "credit"
                                ? "+"
                                : "-"}
                              $
                              {Math.abs(transaction.amount ?? 0).toLocaleString(
                                "en-CA",
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                },
                              )}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {transaction.category?.name || "Uncategorized"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {transaction.bank_account?.nickname || "—"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {transaction.gst_amount &&
                            transaction.gst_amount > 0
                              ? `$${transaction.gst_amount.toFixed(2)}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {transaction.needs_review && (
                              <Badge
                                variant="destructive"
                                className="bg-orange-600"
                              >
                                HITL
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {transaction.linked_to && (
                              <Link2
                                className="h-4 w-4 text-blue-600"
                                title={`Linked: ${transaction.link_type}`}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {transaction.is_edited && (
                              <Pencil
                                className="h-4 w-4 text-gray-600"
                                title={`Edited: ${
                                  transaction.edited_at
                                    ? format(
                                        new Date(transaction.edited_at),
                                        "MMM dd, HH:mm",
                                      )
                                    : ""
                                }`}
                              />
                            )}
                          </TableCell>
                          <TableCell>
                            {(transaction.is_locked || transaction.manually_locked) && (
                              <Lock
                                className="h-4 w-4 text-gray-600"
                                title={
                                  transaction.is_locked
                                    ? "Statement confirmed - locked"
                                    : "Manually locked"
                                }
                              />
                            )}
                          </TableCell>
                          <TableCell className="space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setSelectedTransaction(transaction);
                                setIsModalOpen(true);
                              }}
                              title="Edit transaction"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                navigate(`/transactions/${transaction.id}/view`)
                              }
                              title="View details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-6 pt-6 border-t">
                      <div className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages} (
                        {transactions.length} total)
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) => Math.max(1, p - 1))
                          }
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter(
                            (page) =>
                              page === 1 ||
                              page === totalPages ||
                              (page >= currentPage - 1 &&
                                page <= currentPage + 1),
                          )
                          .map((page, index, arr) => (
                            <div key={page}>
                              {index > 0 && arr[index - 1] !== page - 1 && (
                                <span className="px-2">...</span>
                              )}
                              <Button
                                variant={
                                  page === currentPage ? "default" : "outline"
                                }
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                              >
                                {page}
                              </Button>
                            </div>
                          ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setCurrentPage((p) => Math.min(totalPages, p + 1))
                          }
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Re-analyze Result Modal */}
      {reanalyzeResult && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Re-analyze Complete</h3>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Processed:</span>
                <span className="font-medium">{reanalyzeResult.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">KB Matched:</span>
                <span className="font-medium text-green-600">
                  {reanalyzeResult.kb_matched}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">AI Matched:</span>
                <span className="font-medium text-blue-600">
                  {reanalyzeResult.ai_matched}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Unmatched:</span>
                <span className="font-medium text-orange-600">
                  {reanalyzeResult.unmatched}
                </span>
              </div>
            </div>

            <button
              onClick={() => setReanalyzeResult(null)}
              className="mt-6 w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Transaction Edit Modal */}
      <TransactionEditModal
        transaction={selectedTransaction}
        categories={filterOptions.categories}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedTransaction(null);
        }}
        onSave={() => {
          fetchTransactions();
        }}
      />
    </div>
  );
}
