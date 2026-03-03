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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Loader2,
  RefreshCw,
  Search,
  X,
  FileText,
  DollarSign,
  Receipt,
  TrendingDown,
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

const PAGE_SIZE = 50;

interface APInvoice {
  invoice_xtrf_id: number;
  internal_number: string | null;
  final_number: string | null;
  vendor_name: string | null;
  vendor_xtrf_id: number;
  currency: string;
  invoice_total: number;
  branch_amount: number;
  payment_status: string;
  invoice_date: string | null;
  payment_due_date: string | null;
  payment_date: string | null;
  total_paid: number;
  branch_id: number | null;
  branch_name: string | null;
  branch_clients: string[] | null;
  branch_project_numbers: string[] | null;
  branch_project_count: number;
  total_count: number;
  summary_total_gross: number;
  summary_total_paid: number;
  summary_outstanding: number;
  summary_invoice_count: number;
  amount_cad: number | null;
  tax_cad: number | null;
  gross_cad: number | null;
  exchange_rate_to_cad: number | null;
  summary_gross_cad: number;
  summary_net_cad: number;
  summary_tax_cad: number;
}

interface Branch {
  id: number;
  branch_name: string;
}

interface Currency {
  xtrf_id: number;
  iso_code: string;
  name: string;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  NOT_PAID: {
    label: "Not Paid",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
  FULLY_PAID: {
    label: "Fully Paid",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  PARTIALLY_PAID: {
    label: "Partially Paid",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  },
  OVERDUE: {
    label: "Overdue",
    className: "bg-red-200 text-red-900 dark:bg-red-950 dark:text-red-300",
  },
};

function getStatusBadge(invoice: APInvoice): { label: string; className: string } {
  return STATUS_CONFIG[invoice.payment_status] || STATUS_CONFIG.NOT_PAID;
}

function formatAmount(amount: number | null | undefined, currency?: string): string {
  if (amount == null) return "—";
  const symbols: Record<string, string> = {
    CAD: "$",
    "$": "$",
    USD: "$",
    EUR: "€",
    "€": "€",
    GBP: "£",
    "£": "£",
    INR: "₹",
  };
  const sym = currency ? (symbols[currency] || currency + " ") : "$";
  return `${sym}${new Intl.NumberFormat("en-CA", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

function formatSummaryAmount(amount: number | null | undefined): string {
  if (amount == null) return "—";
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(2)}`;
}

type SortCol = "invoice_date" | "vendor_name" | "branch_amount" | "payment_due_date" | "payment_status";
type SortDir = "asc" | "desc";

export default function APPayables() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Data
  const [invoices, setInvoices] = useState<APInvoice[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Summary from first row
  const [summary, setSummary] = useState({
    total_count: 0,
    summary_total_gross: 0,
    summary_total_paid: 0,
    summary_outstanding: 0,
    summary_invoice_count: 0,
    summary_gross_cad: 0,
    summary_net_cad: 0,
    summary_tax_cad: 0,
  });

  // Filters
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentDateFrom, setPaymentDateFrom] = useState("");
  const [paymentDateTo, setPaymentDateTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortCol, setSortCol] = useState<SortCol>("invoice_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Fetch reference data once
  useEffect(() => {
    const fetchReferenceData = async () => {
      const [branchRes, currencyRes] = await Promise.all([
        supabase
          .from("xtrf_branches")
          .select("id, branch_name")
          .order("branch_name"),
        supabase
          .from("xtrf_new_dict_currencies")
          .select("xtrf_id, iso_code, name")
          .in("xtrf_id", [1, 3, 30, 67]),
      ]);
      if (branchRes.data) setBranches(branchRes.data);
      if (currencyRes.data) setCurrencies(currencyRes.data);
    };
    if (user) fetchReferenceData();
  }, [user]);

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_ap_invoice_payables", {
        p_branch_id: branchFilter !== "all" ? parseInt(branchFilter) : null,
        p_vendor_id: null,
        p_status: statusFilter !== "all" ? statusFilter : null,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
        p_payment_date_from: paymentDateFrom || null,
        p_payment_date_to: paymentDateTo || null,
        p_currency_id: currencyFilter !== "all" ? parseInt(currencyFilter) : null,
        p_search: searchTerm || null,
        p_page: currentPage,
        p_page_size: PAGE_SIZE,
        p_sort_col: sortCol,
        p_sort_dir: sortDir,
      });

      if (error) throw error;

      const rows = (data as APInvoice[]) || [];
      setInvoices(rows);

      if (rows.length > 0) {
        setSummary({
          total_count: rows[0].total_count ?? 0,
          summary_total_gross: rows[0].summary_total_gross ?? 0,
          summary_total_paid: rows[0].summary_total_paid ?? 0,
          summary_outstanding: rows[0].summary_outstanding ?? 0,
          summary_invoice_count: rows[0].summary_invoice_count ?? 0,
          summary_gross_cad: rows[0].summary_gross_cad ?? 0,
          summary_net_cad: rows[0].summary_net_cad ?? 0,
          summary_tax_cad: rows[0].summary_tax_cad ?? 0,
        });
      } else {
        setSummary({
          total_count: 0,
          summary_total_gross: 0,
          summary_total_paid: 0,
          summary_outstanding: 0,
          summary_invoice_count: 0,
          summary_gross_cad: 0,
          summary_net_cad: 0,
          summary_tax_cad: 0,
        });
      }
    } catch (err: any) {
      console.error("Error fetching AP invoices:", err);
      toast({
        title: "Error",
        description: "Failed to load AP invoices: " + (err.message || "Unknown error"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [
    user,
    currentPage,
    branchFilter,
    statusFilter,
    currencyFilter,
    dateFrom,
    dateTo,
    paymentDateFrom,
    paymentDateTo,
    searchTerm,
    sortCol,
    sortDir,
    toast,
  ]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Reset page when filters/sort change
  useEffect(() => {
    setCurrentPage(1);
  }, [branchFilter, statusFilter, currencyFilter, dateFrom, dateTo, paymentDateFrom, paymentDateTo, searchTerm, sortCol, sortDir]);

  // Search debounce (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const totalPages = Math.ceil(summary.total_count / PAGE_SIZE);

  const clearFilters = () => {
    setBranchFilter("all");
    setStatusFilter("all");
    setCurrencyFilter("all");
    setDateFrom("");
    setDateTo("");
    setPaymentDateFrom("");
    setPaymentDateTo("");
    setSearchInput("");
    setSearchTerm("");
    setSortCol("invoice_date");
    setSortDir("desc");
  };

  const clearPaymentDateFilter = () => {
    setPaymentDateFrom("");
    setPaymentDateTo("");
  };

  const hasActiveFilters =
    branchFilter !== "all" ||
    statusFilter !== "all" ||
    currencyFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    paymentDateFrom !== "" ||
    paymentDateTo !== "" ||
    searchTerm !== "";

  const hasPaymentDateFilter = paymentDateFrom !== "" || paymentDateTo !== "";

  // Sort handler
  const handleSort = (col: SortCol) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  const sortIndicator = (col: SortCol) => {
    if (sortCol !== col) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  // CSV Export
  const handleExportCSV = async () => {
    setExporting(true);
    try {
      toast({ title: "Exporting...", description: "Fetching all filtered records." });

      const { data, error } = await supabase.rpc("export_ap_invoice_payables", {
        p_branch_id: branchFilter !== "all" ? parseInt(branchFilter) : null,
        p_vendor_id: null,
        p_status: statusFilter !== "all" ? statusFilter : null,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
        p_payment_date_from: paymentDateFrom || null,
        p_payment_date_to: paymentDateTo || null,
        p_currency_id: currencyFilter !== "all" ? parseInt(currencyFilter) : null,
        p_search: searchTerm || null,
        p_sort_col: sortCol,
        p_sort_dir: sortDir,
      });

      if (error) throw error;

      const rows = (data as any[]) || [];

      const headers = [
        "Internal #",
        "Invoice #",
        "Vendor",
        "Currency",
        "Invoice Total",
        "Branch Amount",
        "Payment Status",
        "Invoice Date",
        "Due Date",
        "Payment Date",
        "Outstanding",
        "Net CAD",
        "Tax CAD",
        "Gross CAD",
        "FX Rate",
        "Branch",
        "Clients",
        "Project Numbers",
      ];

      const csvRows = rows.map((row) => [
        row.internal_number || "",
        row.final_number || "",
        `"${(row.vendor_name || "").replace(/"/g, '""')}"`,
        row.currency || "",
        row.invoice_total?.toFixed(2) ?? "",
        row.branch_amount?.toFixed(2) ?? "",
        row.payment_status || "",
        row.invoice_date || "",
        row.payment_due_date || "",
        row.payment_date || "",
        row.outstanding?.toFixed(2) ?? "",
        row.amount_cad?.toFixed(2) ?? "",
        row.tax_cad?.toFixed(2) ?? "",
        row.gross_cad?.toFixed(2) ?? "",
        row.exchange_rate_to_cad != null ? Number(row.exchange_rate_to_cad).toFixed(4) : "",
        row.branch_name || "",
        `"${(row.clients || "").replace(/"/g, '""')}"`,
        `"${(row.project_numbers || "").replace(/"/g, '""')}"`,
      ]);

      const csvContent = [
        headers.join(","),
        ...csvRows.map((row) => row.join(",")),
      ].join("\n");

      const today = new Date().toISOString().slice(0, 10);
      const filename = `ap-payables-export-${today}.csv`;

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
    } finally {
      setExporting(false);
    }
  };

  // Active branch label
  const activeBranchLabel =
    branchFilter !== "all"
      ? branches.find((b) => b.id === parseInt(branchFilter))?.branch_name
      : null;

  // Amount column header
  const amountHeader = activeBranchLabel
    ? `${activeBranchLabel} Amount`
    : "Invoice Total";

  // Currency display helper — remap symbols to ISO codes for clarity
  const getCurrencyDisplay = (c: Currency) => {
    const isoMap: Record<string, string> = { "$": "USD", "€": "EUR", "£": "GBP" };
    return isoMap[c.iso_code] || c.iso_code;
  };

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
                AP Invoice Payables
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-muted-foreground">
                  Vendor invoices &amp; payables
                </p>
                {activeBranchLabel && (
                  <Badge variant="outline" className="text-xs">
                    Filtered: {activeBranchLabel} — showing branch share only
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
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
                disabled={loading || exporting || summary.total_count === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                {exporting ? "Exporting..." : "Export CSV"}
              </Button>
            </div>
          </div>

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
                  {summary.summary_invoice_count.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net CAD
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatSummaryAmount(summary.summary_net_cad)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tax CAD
                </CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatSummaryAmount(summary.summary_tax_cad)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Gross CAD
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatSummaryAmount(summary.summary_gross_cad)}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.branch_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="NOT_PAID">Not Paid</SelectItem>
                <SelectItem value="FULLY_PAID">Fully Paid</SelectItem>
                <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                <SelectItem value="OVERDUE">Overdue</SelectItem>
              </SelectContent>
            </Select>

            <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Currencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Currencies</SelectItem>
                {currencies.map((c) => (
                  <SelectItem key={c.xtrf_id} value={String(c.xtrf_id)}>
                    {getCurrencyDisplay(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Invoice Date:</span>
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
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Payment Date:</span>
              <Input
                type="date"
                value={paymentDateFrom}
                onChange={(e) => setPaymentDateFrom(e.target.value)}
                className="w-[150px]"
                placeholder="Payment From"
              />
              <span className="text-muted-foreground">to</span>
              <Input
                type="date"
                value={paymentDateTo}
                onChange={(e) => setPaymentDateTo(e.target.value)}
                className="w-[150px]"
                placeholder="Payment To"
              />
              {hasPaymentDateFilter && (
                <Button variant="ghost" size="sm" onClick={clearPaymentDateFilter} className="h-8 px-2">
                  <X className="h-3.5 w-3.5 mr-0.5" />
                  Clear
                </Button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search vendor or invoice #..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9 w-[260px]"
              />
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear All
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
                        <TableHead
                          className="whitespace-nowrap cursor-pointer select-none"
                          onClick={() => handleSort("vendor_name")}
                        >
                          Vendor{sortIndicator("vendor_name")}
                        </TableHead>
                        <TableHead className="whitespace-nowrap">CCY</TableHead>
                        <TableHead
                          className="whitespace-nowrap text-right cursor-pointer select-none"
                          onClick={() => handleSort("branch_amount")}
                        >
                          {amountHeader}{sortIndicator("branch_amount")}
                        </TableHead>
                        <TableHead
                          className="whitespace-nowrap cursor-pointer select-none"
                          onClick={() => handleSort("payment_status")}
                        >
                          Payment Status{sortIndicator("payment_status")}
                        </TableHead>
                        <TableHead className="whitespace-nowrap">Payment Date</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Net CAD</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Tax CAD</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Gross CAD</TableHead>
                        <TableHead className="whitespace-nowrap text-right">FX Rate</TableHead>
                        <TableHead
                          className="whitespace-nowrap cursor-pointer select-none"
                          onClick={() => handleSort("invoice_date")}
                        >
                          Invoice Date{sortIndicator("invoice_date")}
                        </TableHead>
                        <TableHead
                          className="whitespace-nowrap cursor-pointer select-none"
                          onClick={() => handleSort("payment_due_date")}
                        >
                          Due Date{sortIndicator("payment_due_date")}
                        </TableHead>
                        {activeBranchLabel && (
                          <TableHead className="whitespace-nowrap">Branch</TableHead>
                        )}
                        <TableHead className="whitespace-nowrap">Projects</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => {
                        const statusBadge = getStatusBadge(inv);
                        const isSplit =
                          activeBranchLabel &&
                          inv.branch_amount !== inv.invoice_total &&
                          inv.invoice_total > 0;

                        return (
                          <TableRow key={inv.invoice_xtrf_id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              <div>
                                <div>{inv.internal_number || `#${inv.invoice_xtrf_id}`}</div>
                                {inv.final_number && inv.final_number !== inv.internal_number && (
                                  <div className="text-xs text-muted-foreground">
                                    {inv.final_number}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell
                              className="max-w-[200px] truncate"
                              title={inv.vendor_name || ""}
                            >
                              {inv.vendor_name || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <span className="text-xs font-medium text-muted-foreground">
                                {inv.currency}
                              </span>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              <div>
                                <span className="font-medium">
                                  {formatAmount(inv.branch_amount, inv.currency)}
                                </span>
                                {isSplit && (
                                  <div className="text-xs text-muted-foreground">
                                    of {formatAmount(inv.invoice_total, inv.currency)} total
                                  </div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant="secondary"
                                className={`text-xs ${statusBadge.className}`}
                              >
                                {statusBadge.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {inv.payment_date ? formatDate(inv.payment_date) : "—"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              {inv.amount_cad != null ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>{formatAmount(inv.amount_cad, "CAD")}</span>
                                  </TooltipTrigger>
                                  {activeBranchLabel && (
                                    <TooltipContent side="top">
                                      <span className="text-xs">Full invoice CAD value</span>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              {inv.tax_cad != null && inv.tax_cad !== 0
                                ? formatAmount(inv.tax_cad, "CAD")
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums font-medium">
                              {inv.gross_cad != null ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>{formatAmount(inv.gross_cad, "CAD")}</span>
                                  </TooltipTrigger>
                                  {activeBranchLabel && (
                                    <TooltipContent side="top">
                                      <span className="text-xs">Full invoice CAD value</span>
                                    </TooltipContent>
                                  )}
                                </Tooltip>
                              ) : "—"}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums text-sm text-muted-foreground">
                              {inv.exchange_rate_to_cad != null
                                ? Number(inv.exchange_rate_to_cad).toFixed(4)
                                : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {inv.invoice_date ? formatDate(inv.invoice_date) : "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {inv.payment_due_date ? formatDate(inv.payment_due_date) : "—"}
                            </TableCell>
                            {activeBranchLabel && (
                              <TableCell className="whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className="text-xs font-normal"
                                >
                                  {inv.branch_name || "—"}
                                </Badge>
                              </TableCell>
                            )}
                            <TableCell className="whitespace-nowrap">
                              {inv.branch_project_count > 0 ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-xs text-muted-foreground cursor-help underline decoration-dotted">
                                      {inv.branch_project_count} project{inv.branch_project_count !== 1 ? "s" : ""}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="left" className="max-w-xs">
                                    <div className="space-y-1">
                                      {inv.branch_clients && inv.branch_clients.length > 0 && (
                                        <div>
                                          <span className="font-medium text-xs">Clients: </span>
                                          <span className="text-xs">{inv.branch_clients.join(", ")}</span>
                                        </div>
                                      )}
                                      {inv.branch_project_numbers && inv.branch_project_numbers.length > 0 && (
                                        <div>
                                          <span className="font-medium text-xs">Projects: </span>
                                          <span className="text-xs">{inv.branch_project_numbers.join(", ")}</span>
                                        </div>
                                      )}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
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
                    summary.total_count,
                  ).toLocaleString()}{" "}
                  of {summary.total_count.toLocaleString()}
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
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
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
