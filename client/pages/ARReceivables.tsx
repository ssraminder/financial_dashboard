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
  TrendingUp,
} from "lucide-react";
import { formatDate } from "@/lib/dateUtils";

const PAGE_SIZE = 50;

interface ARInvoice {
  xtrf_id: number;
  invoice_number: string | null;
  customer_name: string | null;
  status: string;
  currency: string;
  currency_symbol: string;
  total_netto: number;
  total_gross: number;
  amount_cad: number;
  tax_cad: number;
  gross_cad: number;
  exchange_rate_to_cad: number;
  is_gst_applicable: boolean;
  contributes_to_sbd: boolean;
  invoice_date: string | null;
  payment_due_date: string | null;
  payment_terms_name: string | null;
  branch_id: number;
  branch_name: string;
  total_paid: number;
  last_payment_date: string | null;
}

interface Branch {
  id: number;
  branch_name: string;
}

interface Summary {
  total_count: number;
  sum_net_cad: number;
  sum_tax_cad: number;
  sum_gross_cad: number;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  SENT: {
    label: "Sent",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  READY: {
    label: "Ready",
    className: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
  },
  NOT_READY: {
    label: "Not Ready",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  },
};

const CURRENCY_MAP: Record<number, string> = {
  1: "EUR",
  2: "GBP",
  3: "USD",
  30: "CAD",
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

function getPaymentStatus(
  invoice: ARInvoice,
): { label: string; className: string } | null {
  const today = new Date().toISOString().split("T")[0];
  if (invoice.total_paid >= invoice.total_gross && invoice.total_gross > 0) {
    return {
      label: "Paid",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    };
  }
  if (invoice.total_paid > 0 && invoice.total_paid < invoice.total_gross) {
    return {
      label: "Partial",
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    };
  }
  if (
    invoice.total_paid === 0 &&
    invoice.payment_due_date &&
    invoice.payment_due_date < today &&
    invoice.status === "SENT"
  ) {
    return {
      label: "Overdue",
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    };
  }
  return null;
}

export default function ARReceivables() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Data
  const [invoices, setInvoices] = useState<ARInvoice[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total_count: 0,
    sum_net_cad: 0,
    sum_tax_cad: 0,
    sum_gross_cad: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currencyFilter, setCurrencyFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

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

  // Fetch invoices
  const fetchInvoices = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        p_page: currentPage,
        p_page_size: PAGE_SIZE,
      };
      if (branchFilter !== "all") params.p_branch_id = parseInt(branchFilter);
      if (statusFilter !== "all") params.p_status = statusFilter;
      if (currencyFilter !== "all") params.p_currency = currencyFilter;
      if (dateFrom) params.p_date_from = dateFrom;
      if (dateTo) params.p_date_to = dateTo;
      if (searchTerm) params.p_search = searchTerm;

      const { data, error } = await supabase.rpc(
        "get_ar_invoice_receivables",
        params,
      );

      if (error) throw error;

      const result = data as {
        rows: ARInvoice[];
        total_count: number;
        sum_net_cad: number;
        sum_tax_cad: number;
        sum_gross_cad: number;
      };

      setInvoices(result.rows || []);
      setSummary({
        total_count: result.total_count,
        sum_net_cad: result.sum_net_cad,
        sum_tax_cad: result.sum_tax_cad,
        sum_gross_cad: result.sum_gross_cad,
      });
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
  }, [
    user,
    currentPage,
    branchFilter,
    statusFilter,
    currencyFilter,
    dateFrom,
    dateTo,
    searchTerm,
    toast,
  ]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [branchFilter, statusFilter, currencyFilter, dateFrom, dateTo, searchTerm]);

  // Search debounce
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
    setSearchInput("");
    setSearchTerm("");
  };

  const hasActiveFilters =
    branchFilter !== "all" ||
    statusFilter !== "all" ||
    currencyFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    searchTerm !== "";

  // CSV Export
  const handleExportCSV = async () => {
    try {
      toast({ title: "Exporting...", description: "Fetching all filtered records for export." });

      // Fetch all rows (no pagination) via RPC with large page size
      const params: Record<string, unknown> = {
        p_page: 1,
        p_page_size: 100000,
      };
      if (branchFilter !== "all") params.p_branch_id = parseInt(branchFilter);
      if (statusFilter !== "all") params.p_status = statusFilter;
      if (currencyFilter !== "all") params.p_currency = currencyFilter;
      if (dateFrom) params.p_date_from = dateFrom;
      if (dateTo) params.p_date_to = dateTo;
      if (searchTerm) params.p_search = searchTerm;

      const { data, error } = await supabase.rpc(
        "get_ar_invoice_receivables",
        params,
      );

      if (error) throw error;

      const result = data as { rows: ARInvoice[] };
      const rows = result.rows || [];

      const headers = [
        "Invoice #",
        "Customer",
        "Currency",
        "Net",
        "Gross",
        "Net CAD",
        "Tax CAD",
        "Gross CAD",
        "FX Rate",
        "Status",
        "Invoice Date",
        "Due Date",
        "Branch",
        "GST Applicable",
        "Contributes to SBD",
      ];

      const csvRows = rows.map((inv) => [
        inv.invoice_number || "",
        `"${(inv.customer_name || "").replace(/"/g, '""')}"`,
        inv.currency,
        inv.total_netto?.toFixed(2) ?? "",
        inv.total_gross?.toFixed(2) ?? "",
        inv.amount_cad?.toFixed(2) ?? "",
        inv.tax_cad?.toFixed(2) ?? "",
        inv.gross_cad?.toFixed(2) ?? "",
        inv.exchange_rate_to_cad != null ? formatFxRate(inv.exchange_rate_to_cad, inv.currency) : "",
        inv.status,
        inv.invoice_date || "",
        inv.payment_due_date || "",
        inv.branch_name,
        inv.is_gst_applicable ? "Yes" : "No",
        inv.contributes_to_sbd ? "Yes" : "No",
      ]);

      const csvContent = [
        headers.join(","),
        ...csvRows.map((row) => row.join(",")),
      ].join("\n");

      const branchLabel =
        branchFilter !== "all"
          ? branches.find((b) => b.id === parseInt(branchFilter))?.branch_name || branchFilter
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

  // Active filter label for header
  const activeBranchLabel =
    branchFilter !== "all"
      ? branches.find((b) => b.id === parseInt(branchFilter))?.branch_name
      : null;

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
                {activeBranchLabel && (
                  <Badge variant="outline" className="text-xs">
                    Filtered: {activeBranchLabel}
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
                disabled={loading || summary.total_count === 0}
              >
                <Download className="h-4 w-4 mr-1" />
                Export CSV
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
                  {summary.total_count.toLocaleString()}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Revenue (CAD)
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.sum_net_cad)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tax Collected (CAD)
                </CardTitle>
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.sum_tax_cad)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Gross Invoiced (CAD)
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(summary.sum_gross_cad)}
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
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
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
                        <TableHead className="whitespace-nowrap">CCY</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Net</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Gross</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Net CAD</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Tax CAD</TableHead>
                        <TableHead className="whitespace-nowrap text-right">Gross CAD</TableHead>
                        <TableHead className="whitespace-nowrap">Status</TableHead>
                        <TableHead className="whitespace-nowrap text-right">FX Rate</TableHead>
                        <TableHead className="whitespace-nowrap">Invoice Date</TableHead>
                        <TableHead className="whitespace-nowrap">Due Date</TableHead>
                        <TableHead className="whitespace-nowrap">Branch</TableHead>
                        <TableHead className="whitespace-nowrap text-center">GST</TableHead>
                        <TableHead className="whitespace-nowrap text-center">SBD</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((inv) => {
                        const statusBadge = STATUS_BADGES[inv.status] || {
                          label: inv.status,
                          className: "bg-gray-100 text-gray-600",
                        };
                        const paymentStatus = getPaymentStatus(inv);

                        return (
                          <TableRow key={inv.xtrf_id}>
                            <TableCell className="font-medium whitespace-nowrap">
                              {inv.invoice_number || `#${inv.xtrf_id}`}
                            </TableCell>
                            <TableCell
                              className="max-w-[200px] truncate"
                              title={inv.customer_name || ""}
                            >
                              {inv.customer_name || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <span className="text-xs font-medium text-muted-foreground">
                                {inv.currency}
                              </span>
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              {formatOriginalCurrency(inv.total_netto, inv.currency)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums">
                              {formatOriginalCurrency(inv.total_gross, inv.currency)}
                            </TableCell>
                            <TableCell className="text-right whitespace-nowrap tabular-nums font-medium">
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
                              <div className="flex items-center gap-1">
                                <Badge
                                  variant="secondary"
                                  className={`text-xs ${statusBadge.className}`}
                                >
                                  {statusBadge.label}
                                </Badge>
                                {paymentStatus && (
                                  <Badge
                                    variant="secondary"
                                    className={`text-xs ${paymentStatus.className}`}
                                  >
                                    {paymentStatus.label}
                                  </Badge>
                                )}
                              </div>
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
                            <TableCell className="whitespace-nowrap">
                              <Badge
                                variant="outline"
                                className="text-xs font-normal"
                              >
                                {inv.branch_name}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {inv.is_gst_applicable ? (
                                <span className="text-green-600">&#10003;</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              {inv.contributes_to_sbd ? (
                                <span className="text-green-600">&#10003;</span>
                              ) : (
                                <span className="text-muted-foreground">—</span>
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
