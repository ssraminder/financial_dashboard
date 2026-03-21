import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Download,
  Loader2,
  RefreshCw,
  Search,
  X,
  FileText,
  DollarSign,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import SyncPaymentsButton from "@/components/SyncPaymentsButton";

const PAGE_SIZE = 50;

interface ARInvoice {
  invoice_xtrf_id: number;
  invoice_number: string | null;
  customer_name: string | null;
  product_company_branch: string | null;
  currency: string;
  invoice_total: number;
  payment_status: string | null;
  invoice_status: string | null;
  invoice_date: string | null;
  payment_due_date: string | null;
  payment_date: string | null;
  total_paid: number;
  amount_outstanding: number;
  branch_id: number;
  branch_name: string;
  amount_cad: number;
  tax_cad: number;
  gross_cad: number;
  exchange_rate_to_cad: number;
  total_count: number;
  summary_total_gross: number;
  summary_total_paid: number;
  summary_outstanding: number;
  summary_invoice_count: number;
  summary_gross_cad: number;
  summary_net_cad: number;
  summary_tax_cad: number;
}

interface Branch {
  id: number;
  branch_name: string;
}

interface Summary {
  invoice_count: number;
  net_cad: number;
  tax_cad: number;
  gross_cad: number;
  total_paid: number;
  outstanding: number;
}

const PAYMENT_STATUS_BADGES: Record<string, { label: string; className: string }> = {
  PAID: {
    label: "Paid",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  PARTIALLY_PAID: {
    label: "Partial",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  NOT_PAID: {
    label: "Not Paid",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  OVERDUE: {
    label: "Overdue",
    className: "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-300",
  },
};

const INVOICE_STATUS_BADGES: Record<string, { label: string; className: string }> = {
  SENT: {
    label: "Sent",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  READY: {
    label: "Ready",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  NOT_READY: {
    label: "Not Ready",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  },
};

function formatCurrency(amount: number | null | undefined, decimals = 2): string {
  if (amount == null) return "—";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
    .format(amount)
    .replace("CA$", "$");
}

function formatOriginalCurrency(
  amount: number | null | undefined,
  currency: string,
): string {
  if (amount == null) return "—";
  const symbols: Record<string, string> = {
    CAD: "$",
    USD: "$",
    EUR: "€",
    GBP: "£",
  };
  const sym = symbols[currency] || currency + " ";
  return `${sym}${new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

function formatFxRate(rate: number | null | undefined, currency: string): string {
  if (rate == null) return "—";
  if (currency === "CAD") return "1.00";
  return rate.toFixed(4);
}

export default function ARReceivables() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Data
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [summary, setSummary] = useState<Summary>({
    invoice_count: 0,
    net_cad: 0,
    tax_cad: 0,
    gross_cad: 0,
    total_paid: 0,
    outstanding: 0,
  });
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [payStatusFilter, setPayStatusFilter] = useState("all");
  const [invStatusFilter, setInvStatusFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [selectedCompanyBranch, setSelectedCompanyBranch] = useState<string | null>(null);
  const [companyBranchOptions, setCompanyBranchOptions] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortCol, setSortCol] = useState("invoice_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Fetch branches once
  useEffect(() => {
    const fetchBranches = async () => {
      const { data } = await supabase
        .from("xtrf_branches")
        .select("id, branch_name")
        .order("branch_name");
      if (data) setBranches(data);
    };
    if (user) fetchBranches();
  }, [user]);

  // Fetch company branch options via dedicated RPC (no params).
  const fetchCompanyBranchOptions = useCallback(async () => {
    const { data } = await supabase.rpc("get_ar_company_branches");
    if (data) {
      setCompanyBranchOptions(
        (data as { company_branch: string }[]).map((r) => r.company_branch),
      );
    }
  }, []);

  useEffect(() => {
    if (user) fetchCompanyBranchOptions();
  }, [user, fetchCompanyBranchOptions]);

  // Build RPC params from current filter state
  const buildRpcParams = useCallback(
    (page: number, pageSize: number) => ({
      p_branch_id: selectedBranches.length === 1 ? parseInt(selectedBranches[0]) : null,
      p_customer_id: null,
      p_pay_status: payStatusFilter !== "all" ? payStatusFilter : null,
      p_inv_status: invStatusFilter !== "all" ? invStatusFilter : null,
      p_date_from: dateFrom || null,
      p_date_to: dateTo || null,
      p_currency_id: currencyFilter !== "all" ? parseInt(currencyFilter) : null,
      p_search: searchTerm || null,
      p_company_branch: selectedCompanyBranch,
      p_page: page,
      p_page_size: pageSize,
      p_sort_col: sortCol,
      p_sort_dir: sortDir,
    }),
    [selectedBranches, payStatusFilter, invStatusFilter, currencyFilter, dateFrom, dateTo, searchTerm, selectedCompanyBranch, sortCol, sortDir],
  );

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        "get_ar_invoice_receivables",
        buildRpcParams(currentPage, PAGE_SIZE),
      );

      if (error) throw error;

      let rows = (data as ARInvoice[]) || [];

      // Client-side filter when multiple (but not all) branches selected
      if (selectedBranches.length > 1) {
        const branchIds = new Set(selectedBranches.map(Number));
        rows = rows.filter(
          (r) => r.branch_id != null && branchIds.has(r.branch_id),
        );
      }

      setInvoices(rows);

      if (rows.length > 0) {
        const first = rows[0];
        setTotalCount(first.total_count ?? 0);
        setSummary({
          invoice_count: first.summary_invoice_count ?? 0,
          net_cad: first.summary_net_cad ?? 0,
          tax_cad: first.summary_tax_cad ?? 0,
          gross_cad: first.summary_gross_cad ?? 0,
          total_paid: first.summary_total_paid ?? 0,
          outstanding: first.summary_outstanding ?? 0,
        });
      } else {
        setTotalCount(0);
        setSummary({
          invoice_count: 0,
          net_cad: 0,
          tax_cad: 0,
          gross_cad: 0,
          total_paid: 0,
          outstanding: 0,
        });
      }
    } catch (err: any) {
      console.error("Error fetching AR invoices:", err);
      toast({
        title: "Error",
        description: "Failed to load AR invoices: " + (err.message || "Unknown error"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, currentPage, buildRpcParams, selectedBranches, toast]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBranches, payStatusFilter, invStatusFilter, currencyFilter, selectedCompanyBranch, dateFrom, dateTo, searchTerm]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const clearFilters = () => {
    setSelectedBranches([]);
    setPayStatusFilter("all");
    setInvStatusFilter("all");
    setCurrencyFilter("all");
    setSelectedCompanyBranch(null);
    setDateFrom("");
    setDateTo("");
    setSearchInput("");
    setSearchTerm("");
  };

  const hasActiveFilters =
    selectedBranches.length > 0 ||
    payStatusFilter !== "all" ||
    invStatusFilter !== "all" ||
    currencyFilter !== "all" ||
    selectedCompanyBranch !== null ||
    dateFrom !== "" ||
    dateTo !== "" ||
    searchTerm !== "";

  // CSV Export
  const handleExportCSV = async () => {
    try {
      toast({ title: "Exporting...", description: "Fetching all filtered records for export." });

      const { data, error } = await supabase.rpc(
        "get_ar_invoice_receivables",
        buildRpcParams(1, 100000),
      );

      if (error) throw error;

      let rows = (data as ARInvoice[]) || [];

      // Client-side filter when multiple branches selected
      if (selectedBranches.length > 1) {
        const branchIds = new Set(selectedBranches.map(Number));
        rows = rows.filter(
          (r) => r.branch_id != null && branchIds.has(r.branch_id),
        );
      }

      const headers = [
        "Invoice #",
        "Customer",
        "Company Branch",
        "Currency",
        "Invoice Total",
        "Total Paid",
        "Outstanding",
        "Amount CAD",
        "Tax CAD",
        "Gross CAD",
        "FX Rate",
        "Payment Status",
        "Invoice Status",
        "Invoice Date",
        "Due Date",
        "Payment Date",
        "Branch",
      ];

      const csvRows = rows.map((inv) => [
        inv.invoice_number || "",
        `"${(inv.customer_name || "").replace(/"/g, '""')}"`,
        `"${(inv.product_company_branch || "").replace(/"/g, '""')}"`,
        inv.currency,
        inv.invoice_total?.toFixed(2) ?? "",
        inv.total_paid?.toFixed(2) ?? "",
        inv.amount_outstanding?.toFixed(2) ?? "",
        inv.amount_cad?.toFixed(2) ?? "",
        inv.tax_cad?.toFixed(2) ?? "",
        inv.gross_cad?.toFixed(2) ?? "",
        inv.exchange_rate_to_cad != null ? formatFxRate(inv.exchange_rate_to_cad, inv.currency) : "",
        inv.payment_status || "",
        inv.invoice_status || "",
        inv.invoice_date || "",
        inv.payment_due_date || "",
        inv.payment_date || "",
        inv.branch_name,
      ]);

      const csvContent = [
        headers.join(","),
        ...csvRows.map((row) => row.join(",")),
      ].join("\n");

      const branchLabel =
        selectedBranches.length > 0
          ? selectedBranches
              .map((id) => branches.find((b) => b.id === parseInt(id))?.branch_name || id)
              .join("-")
          : "all";
      const fromLabel = dateFrom || "start";
      const toLabel = dateTo || "end";
      const filename = `ar_receivables_${branchLabel}_${fromLabel}_${toLabel}.csv`;

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export complete",
        description: `Exported ${rows.length} invoices to ${filename}`,
      });
    } catch (err: any) {
      console.error("Export error:", err);
      toast({
        title: "Export failed",
        description: err.message || "Unknown error",
        variant: "destructive",
      });
    }
  };

  // Active filter labels for header
  const activeBranchLabels =
    selectedBranches.length > 0
      ? selectedBranches
          .map((id) => branches.find((b) => b.id === parseInt(id))?.branch_name)
          .filter(Boolean) as string[]
      : [];

  const activeBranchLabel =
    activeBranchLabels.length === 1 ? activeBranchLabels[0] : null;

  // Branch toggle handler
  const toggleBranch = (branchId: string) => {
    setSelectedBranches((prev) =>
      prev.includes(branchId)
        ? prev.filter((id) => id !== branchId)
        : [...prev, branchId],
    );
  };

  // Branch filter display text
  const branchFilterLabel =
    selectedBranches.length === 0
      ? "All Branches"
      : selectedBranches.length === 1
        ? activeBranchLabel || "1 Branch"
        : `${selectedBranches.length} Branches`;

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                AR Invoice Receivables
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-muted-foreground">
                  Outgoing client invoices
                </p>
                {activeBranchLabels.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Filtered: {activeBranchLabels.join(", ")}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Sync Payments
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[520px] p-0 border-none bg-transparent">
                  <SyncPaymentsButton />
                </DialogContent>
              </Dialog>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchInvoices}
                disabled={loading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCSV}
                disabled={loading || totalCount === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Export CSV
              </Button>
            </div>
          </div>

          {/* Active Company Branch filter label */}
          {selectedCompanyBranch && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-md border bg-muted/50 px-4 py-2 text-sm">
              <span className="font-medium">Company Branch:</span> {selectedCompanyBranch}
              <button
                onClick={() => setSelectedCompanyBranch(null)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Invoices
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {summary.invoice_count.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Agreed (CAD)
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.net_cad)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Paid
                </CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.total_paid)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Outstanding
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.outstanding)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-[180px] justify-between font-normal"
                >
                  <span className="truncate">{branchFilterLabel}</span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-2" align="start">
                <div className="flex items-center justify-between px-2 pb-2 border-b mb-2">
                  <span className="text-xs font-medium text-muted-foreground">Branches</span>
                  {selectedBranches.length > 0 && (
                    <button
                      onClick={() => setSelectedBranches([])}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  {branches.map((b) => (
                    <label
                      key={b.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent cursor-pointer text-sm"
                    >
                      <Checkbox
                        checked={selectedBranches.includes(String(b.id))}
                        onCheckedChange={() => toggleBranch(String(b.id))}
                      />
                      {b.branch_name}
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Select value={payStatusFilter} onValueChange={setPayStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
                <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                <SelectItem value="NOT_PAID">Not Paid</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
              </SelectContent>
            </Select>

            <Select value={invStatusFilter} onValueChange={setInvStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Invoice Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Invoice</SelectItem>
                <SelectItem value="SENT">Sent</SelectItem>
                <SelectItem value="READY">Ready</SelectItem>
                <SelectItem value="NOT_READY">Not Ready</SelectItem>
              </SelectContent>
            </Select>

            <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All Currencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Currencies</SelectItem>
                <SelectItem value="30">CAD</SelectItem>
                <SelectItem value="3">USD</SelectItem>
                <SelectItem value="2">GBP</SelectItem>
                <SelectItem value="1">EUR</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={selectedCompanyBranch ?? "all"}
              onValueChange={(v) => setSelectedCompanyBranch(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Company Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Company Branches</SelectItem>
                <SelectItem value="__null__">No Branch (Unassigned)</SelectItem>
                {companyBranchOptions.map((branch) => (
                  <SelectItem key={branch} value={branch}>
                    {branch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px]"
              placeholder="From"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px]"
              placeholder="To"
            />

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search invoice # or customer..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 w-[260px]"
              />
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium text-muted-foreground">
                  No invoices found
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Try adjusting your filters
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Invoice #</TableHead>
                        <TableHead className="whitespace-nowrap">Customer</TableHead>
                        <TableHead className="whitespace-nowrap" style={{ width: 160 }}>Company Branch</TableHead>
                        <TableHead className="whitespace-nowrap">CCY</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Invoice Total</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Total Paid</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Outstanding</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Net CAD</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Tax CAD</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Gross CAD</TableHead>
                        <TableHead className="whitespace-nowrap">Payment</TableHead>
                        <TableHead className="whitespace-nowrap">Invoice</TableHead>
                        <TableHead className="whitespace-nowrap text-right">FX Rate</TableHead>
                        <TableHead className="whitespace-nowrap">Invoice Date</TableHead>
                        <TableHead className="whitespace-nowrap">Due Date</TableHead>
                        <TableHead className="whitespace-nowrap">Payment Date</TableHead>
                        <TableHead className="whitespace-nowrap">Branch</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => {
                        const payBadge = inv.payment_status
                          ? PAYMENT_STATUS_BADGES[inv.payment_status] || {
                              label: inv.payment_status,
                              className: "bg-gray-100 text-gray-600",
                            }
                          : null;
                        const invBadge = inv.invoice_status
                          ? INVOICE_STATUS_BADGES[inv.invoice_status] || {
                              label: inv.invoice_status,
                              className: "bg-gray-100 text-gray-600",
                            }
                          : null;

                        return (
                          <TableRow key={inv.invoice_xtrf_id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {inv.invoice_number || `#${inv.invoice_xtrf_id}`}
                            </TableCell>
                            <TableCell
                              className="max-w-[200px] truncate"
                              title={inv.customer_name || ""}
                            >
                              {inv.customer_name || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {inv.product_company_branch ? (
                                inv.product_company_branch
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <span className="text-xs font-medium text-muted-foreground">
                                {inv.currency}
                              </span>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              {formatOriginalCurrency(inv.invoice_total, inv.currency)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              {formatOriginalCurrency(inv.total_paid, inv.currency)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums font-medium">
                              {formatOriginalCurrency(inv.amount_outstanding, inv.currency)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              {formatCurrency(inv.amount_cad)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              {inv.tax_cad && inv.tax_cad !== 0
                                ? formatCurrency(inv.tax_cad)
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums font-medium">
                              {formatCurrency(inv.gross_cad)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {payBadge && (
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${payBadge.className}`}
                                >
                                  {payBadge.label}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              {invBadge && (
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${invBadge.className}`}
                                >
                                  {invBadge.label}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums text-muted-foreground text-xs">
                              {formatFxRate(inv.exchange_rate_to_cad, inv.currency)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {inv.invoice_date
                                ? formatDate(inv.invoice_date)
                                : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {inv.payment_due_date
                                ? formatDate(inv.payment_due_date)
                                : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {inv.payment_date
                                ? formatDate(inv.payment_date)
                                : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant="outline"
                                className="text-xs font-normal"
                              >
                                {inv.branch_name}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              {/* Pagination */}
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing{" "}
                  {((currentPage - 1) * PAGE_SIZE + 1).toLocaleString()}–
                  {Math.min(
                    currentPage * PAGE_SIZE,
                    totalCount,
                  ).toLocaleString()}{" "}
                  of {totalCount.toLocaleString()}
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setCurrentPage((p) => Math.max(1, p - 1))
                    }
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-3 text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages || 1}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
