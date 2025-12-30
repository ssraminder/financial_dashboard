import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { TransactionEditModal } from "@/components/TransactionEditModal";
import { SearchableDropdown } from "@/components/SearchableDropdown";
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
} from "lucide-react";
import { format, subDays } from "date-fns";

interface Transaction {
  id: string;
  transaction_date: string;
  posting_date?: string;
  description: string;
  payee_name?: string;
  amount: number;
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
}

interface FilterOptions {
  bankAccounts: Array<{ id: string; name: string; nickname: string }>;
  companies: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string; code: string }>;
}

export default function Transactions() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
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

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Modal state
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
          category:categories!transactions_category_id_fkey(id, code, name, category_type),
          bank_account:bank_accounts(id, name, nickname, bank_name),
          company:companies(id, name),
          linked_transaction:transactions!linked_to(id, description, amount, transaction_date)`,
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
    setCurrentPage(1);
  };

  // Count active filters
  const activeFilterCount = [
    selectedBankAccount !== "all",
    selectedCompany !== "all",
    selectedCategory !== "all",
    selectedStatus !== "all",
    showNeedsReview,
  ].filter(Boolean).length;

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
      format(new Date(t.transaction_date), "MMM dd, yyyy"),
      t.payee_name || "",
      t.description || "",
      t.amount.toFixed(2),
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

          {/* Filters Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Filters</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={exportCSV}
                  disabled={transactions.length === 0}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
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
                    { value: "group-expense", label: "── Expenses ──", disabled: true },
                    ...filterOptions.categories
                      .filter((c) => c.category_type === "expense")
                      .map((c) => ({
                        value: c.id,
                        label: c.name,
                        group: "expense",
                      })),
                    { value: "group-revenue", label: "── Revenue ──", disabled: true },
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
                  <label htmlFor="needs-review" className="text-sm cursor-pointer">
                    Needs review only
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>Transactions ({transactions.length})</CardTitle>
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
                          <TableCell className="font-medium">
                            {format(
                              new Date(transaction.transaction_date),
                              "MMM dd",
                            )}
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
                            <span
                              className={
                                transaction.amount < 0
                                  ? "text-red-600"
                                  : "text-green-600"
                              }
                            >
                              ${Math.abs(transaction.amount).toFixed(2)}
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
