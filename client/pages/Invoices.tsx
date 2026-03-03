import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  AlertCircle,
  FileText,
  DollarSign,
  CreditCard,
  Hash,
  CalendarIcon,
} from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
import type {
  PaymentStatus,
  TabType,
  DateFieldOption,
  SortConfig,
} from "@/types/xtrf-invoices";

type DateOperator = "none" | "before" | "after" | "on" | "between";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null, currencyCode: string = "CAD"): string {
  if (value == null) return formatWithCurrency(0, currencyCode);
  return formatWithCurrency(value, currencyCode);
}

function formatAmount(value: number | null, currencyCode: string = "CAD"): string {
  if (value == null) return "\u2014";
  return formatWithCurrency(value, currencyCode);
}

function formatWithCurrency(value: number, currencyCode: string): string {
  try {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Fallback for unrecognized currency codes
    return `${value.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode}`;
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014";
  try {
    return format(parseISO(dateStr), "MMM dd, yyyy");
  } catch {
    return "\u2014";
  }
}

function isOverdue(dueDate: string | null, status: PaymentStatus | null): boolean {
  if (!dueDate || status === "FULLY_PAID") return false;
  try {
    return isAfter(new Date(), parseISO(dueDate));
  } catch {
    return false;
  }
}

function getStatusBadge(status: PaymentStatus | null) {
  switch (status) {
    case "NOT_PAID":
      return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">Unpaid</Badge>;
    case "PARTIALLY_PAID":
      return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">Partial</Badge>;
    case "FULLY_PAID":
      return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">Paid</Badge>;
    case "IRRECOVERABLE":
      return <Badge className="bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-100">Written Off</Badge>;
    default:
      return <Badge variant="outline">{"\u2014"}</Badge>;
  }
}

function displayAmountCAD(row: any): number | null {
  if (row.amount_cad) return row.amount_cad;
  if (row.currency === 'CAD' || row.original_currency === 'CAD') return row.amount_gross;
  return null;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const ALL_STATUSES: PaymentStatus[] = ["NOT_PAID", "PARTIALLY_PAID", "FULLY_PAID", "IRRECOVERABLE"];

const PAYABLE_COLUMNS = [
  { key: "invoice_final_number", label: "Invoice #" },
  { key: "client_name", label: "Client" },
  { key: "client_branch_name", label: "Branch" },
  { key: "vendor_name", label: "Vendor" },
  { key: "vendor_currency", label: "Currency" },
  { key: "amount_gross", label: "Amount (Gross)" },
  { key: "amount_cad", label: "Amount (CAD)" },
  { key: "invoice_date", label: "Invoice Date" },
  { key: "payment_status", label: "Status" },
  { key: "payment_due_date", label: "Due Date" },
  { key: "payment_date", label: "Payment Date" },
] as const;

const RECEIVABLE_COLUMNS = [
  { key: "invoice_final_number", label: "Invoice #" },
  { key: "client_name", label: "Client" },
  { key: "client_branch_name", label: "Branch" },
  { key: "vendor_currency", label: "Currency" },
  { key: "amount_gross", label: "Amount (Gross)" },
  { key: "amount_cad", label: "Amount (CAD)" },
  { key: "invoice_date", label: "Invoice Date" },
  { key: "payment_status", label: "Status" },
  { key: "payment_due_date", label: "Due Date" },
  { key: "payment_date", label: "Payment Date" },
] as const;

const PAGE_SIZES = [25, 50, 100];

// ─── Main Component ─────────────────────────────────────────────────────────

export default function Invoices() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab
  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams.get("tab") as TabType) || "payables",
  );

  // Filters
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [paymentStatuses, setPaymentStatuses] = useState<PaymentStatus[]>(() => {
    const str = searchParams.get("statuses");
    return str ? (str.split(",") as PaymentStatus[]) : [...ALL_STATUSES];
  });

  // Date filter 1
  const [df1Field, setDf1Field] = useState<DateFieldOption>(
    (searchParams.get("df1Field") as DateFieldOption) || "invoice_date",
  );
  const [df1Op, setDf1Op] = useState<DateOperator>(
    (searchParams.get("df1Op") as DateOperator) || "none",
  );
  const [df1Value, setDf1Value] = useState(searchParams.get("df1Value") || "");
  const [df1Value2, setDf1Value2] = useState(searchParams.get("df1Value2") || "");

  // Date filter 2
  const [df2Field, setDf2Field] = useState<DateFieldOption>(
    (searchParams.get("df2Field") as DateFieldOption) || "payment_date",
  );
  const [df2Op, setDf2Op] = useState<DateOperator>(
    (searchParams.get("df2Op") as DateOperator) || "none",
  );
  const [df2Value, setDf2Value] = useState(searchParams.get("df2Value") || "");
  const [df2Value2, setDf2Value2] = useState(searchParams.get("df2Value2") || "");

  // Table state
  const [data, setData] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<SortConfig>({ field: "invoice_date", direction: "desc" });
  const [exportLoading, setExportLoading] = useState(false);

  // Summary
  const [summaryTotal, setSummaryTotal] = useState<number | null>(null);
  const [summaryUnpaid, setSummaryUnpaid] = useState<number | null>(null);
  const [summaryPaid, setSummaryPaid] = useState<number | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  // Sync filters to URL
  useEffect(() => {
    const params: Record<string, string> = { tab: activeTab };
    if (search) params.search = search;
    if (paymentStatuses.length < 4) params.statuses = paymentStatuses.join(",");
    if (df1Op !== "none") {
      params.df1Field = df1Field;
      params.df1Op = df1Op;
      if (df1Value) params.df1Value = df1Value;
      if (df1Value2) params.df1Value2 = df1Value2;
    }
    if (df2Op !== "none") {
      params.df2Field = df2Field;
      params.df2Op = df2Op;
      if (df2Value) params.df2Value = df2Value;
      if (df2Value2) params.df2Value2 = df2Value2;
    }
    setSearchParams(params, { replace: true });
  }, [activeTab, search, paymentStatuses, df1Field, df1Op, df1Value, df1Value2, df2Field, df2Op, df2Value, df2Value2]);

  // Apply a single date filter to a query
  const applyDateFilter = (query: any, field: DateFieldOption, op: DateOperator, val: string, val2: string) => {
    if (op === "none" || !val) return query;
    switch (op) {
      case "before":
        return query.lt(field, val);
      case "after":
        return query.gt(field, val);
      case "on":
        return query.eq(field, val);
      case "between":
        query = query.gte(field, val);
        if (val2) query = query.lte(field, val2);
        return query;
      default:
        return query;
    }
  };

  // Build query helper
  const applyFilters = useCallback((query: any) => {
    // Only show records with invoice numbers
    query = query.not("invoice_final_number", "is", null);

    if (search) {
      const s = search;
      const searchFields = activeTab === "payables"
        ? `invoice_final_number.ilike.%${s}%,client_name.ilike.%${s}%,vendor_name.ilike.%${s}%,client_branch_name.ilike.%${s}%`
        : `invoice_final_number.ilike.%${s}%,client_name.ilike.%${s}%,client_branch_name.ilike.%${s}%`;
      query = query.or(searchFields);
    }

    // Apply date filter 1
    query = applyDateFilter(query, df1Field, df1Op, df1Value, df1Value2);
    // Apply date filter 2
    query = applyDateFilter(query, df2Field, df2Op, df2Value, df2Value2);

    if (paymentStatuses.length > 0 && paymentStatuses.length < 4) {
      query = query.in("payment_status", paymentStatuses);
    }

    return query;
  }, [search, activeTab, df1Field, df1Op, df1Value, df1Value2, df2Field, df2Op, df2Value, df2Value2, paymentStatuses]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const table = activeTab === "payables" ? "xtrf_payable_invoices" : "xtrf_receivable_invoices";
    let query = supabase.from(table).select("*", { count: "exact" });
    query = applyFilters(query);
    query = query
      .order(sort.field, { ascending: sort.direction === "asc", nullsFirst: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    const { data: rows, count, error } = await query;
    if (error) console.error("Error fetching invoices:", error);
    setData(rows || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [user, activeTab, applyFilters, sort, page, pageSize]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    if (!user) return;
    setSummaryLoading(true);

    const table = activeTab === "payables" ? "xtrf_payable_invoices" : "xtrf_receivable_invoices";
    const summaryFields = activeTab === "payables"
      ? "amount_gross, amount_cad, currency, original_currency, payment_status"
      : "amount_gross, amount_cad, currency, payment_status";
    let query = supabase.from(table).select(summaryFields);
    query = applyFilters(query);

    const { data: rows } = await query;
    if (rows) {
      let total = 0, unpaid = 0, paid = 0;
      rows.forEach((r: any) => {
        const amt = displayAmountCAD(r) || 0;
        total += amt;
        if (r.payment_status === "NOT_PAID" || r.payment_status === "PARTIALLY_PAID") unpaid += amt;
        if (r.payment_status === "FULLY_PAID") paid += amt;
      });
      setSummaryTotal(total);
      setSummaryUnpaid(unpaid);
      setSummaryPaid(paid);
    }
    setSummaryLoading(false);
  }, [user, activeTab, applyFilters]);

  useEffect(() => {
    fetchData();
    fetchSummary();
  }, [fetchData, fetchSummary]);

  // Tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
    setPage(0);
  };

  // Sort handler
  const handleSort = (field: string) => {
    setSort((prev) =>
      prev.field === field
        ? { field, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { field, direction: "asc" },
    );
    setPage(0);
  };

  // Export CSV
  const handleExportCSV = async () => {
    if (exportLoading) return;
    setExportLoading(true);
    try {
      const table = activeTab === "payables" ? "xtrf_payable_invoices" : "xtrf_receivable_invoices";
      const PAGE_SIZE = 1000;
      let allRows: any[] = [];
      let from = 0;

      while (true) {
        let query = supabase.from(table).select("*");
        query = applyFilters(query);
        query = query
          .order(sort.field, { ascending: sort.direction === "asc", nullsFirst: false })
          .range(from, from + PAGE_SIZE - 1);

        const { data: rows, error } = await query;
        if (error) break;
        if (!rows || rows.length === 0) break;
        allRows = allRows.concat(rows);
        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (allRows.length === 0) return;

      const headers = Object.keys(allRows[0]);
      const csvContent = [
        headers.join(","),
        ...allRows.map((row: any) =>
          headers.map((h) => {
            const val = h === "amount_cad" ? displayAmountCAD(row) : row[h];
            if (val == null) return "";
            const str = String(val);
            return str.includes(",") || str.includes('"') || str.includes("\n")
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          }).join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `invoices_${activeTab}_${format(new Date(), "yyyy-MM-dd")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportLoading(false);
    }
  };

  // Render cell
  const renderCell = (row: any, colKey: string) => {
    switch (colKey) {
      case "invoice_final_number":
        return <span className="font-mono text-xs">{row.invoice_final_number || "\u2014"}</span>;
      case "client_name":
        return row.client_name || "\u2014";
      case "client_branch_name":
        return row.client_branch_name ? (
          <Badge variant="outline" className="text-xs">{row.client_branch_name}</Badge>
        ) : "\u2014";
      case "vendor_name":
        return row.vendor_name || "\u2014";
      case "vendor_currency": {
        const cur = row.original_currency || row.currency || "CAD";
        return <span className="font-mono text-xs">{cur}</span>;
      }
      case "amount_gross": {
        return (
          <span className="text-right block font-medium tabular-nums">
            {formatAmount(row.amount_gross, row.original_currency || row.currency || "CAD")}
          </span>
        );
      }
      case "amount_cad": {
        const cadVal = displayAmountCAD(row);
        return (
          <span className="text-right block font-medium tabular-nums">
            {formatAmount(cadVal, "CAD")}
          </span>
        );
      }
      case "payment_status":
        return getStatusBadge(row.payment_status);
      case "invoice_date":
        return formatDate(row.invoice_date);
      case "payment_due_date":
        return (
          <span className={isOverdue(row.payment_due_date, row.payment_status) ? "text-red-600 font-medium" : ""}>
            {formatDate(row.payment_due_date)}
          </span>
        );
      case "payment_date":
        return formatDate(row.payment_date);
      default:
        return "\u2014";
    }
  };

  // Pagination
  const columns = activeTab === "payables" ? PAYABLE_COLUMNS : RECEIVABLE_COLUMNS;
  const totalPages = Math.ceil(totalCount / pageSize);
  const showingFrom = totalCount === 0 ? 0 : page * pageSize + 1;
  const showingTo = Math.min((page + 1) * pageSize, totalCount);

  const summaryCards = [
    { title: activeTab === "payables" ? "Total Invoiced" : "Total Revenue", value: summaryLoading ? null : summaryTotal, icon: DollarSign, color: "text-blue-600" },
    { title: "Unpaid", value: summaryLoading ? null : summaryUnpaid, icon: AlertCircle, color: "text-red-600" },
    { title: "Paid", value: summaryLoading ? null : summaryPaid, icon: CreditCard, color: "text-green-600" },
    { title: "Invoice Count", value: summaryLoading ? null : totalCount, icon: Hash, isCount: true },
  ];

  const [pageInput, setPageInput] = useState("");

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
        <div className="p-6 lg:p-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Submitted invoices with client and branch details
              </p>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="mb-4">
              <TabsTrigger value="payables">Payables (AP)</TabsTrigger>
              <TabsTrigger value="receivables">Receivables (AR)</TabsTrigger>
            </TabsList>

            {/* Filters Bar */}
            <div className="mb-4 p-4 bg-muted/50 border rounded-lg space-y-3">
              {/* Row 1: Search + Payment Status */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs font-medium mb-1.5 block">Search</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Invoice #, client, branch..."
                      value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                      className="pl-8 h-9 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Status</Label>
                  <div className="flex items-center gap-2">
                    {([
                      { value: "NOT_PAID" as const, label: "Unpaid", color: "bg-red-100 text-red-800" },
                      { value: "PARTIALLY_PAID" as const, label: "Partial", color: "bg-yellow-100 text-yellow-800" },
                      { value: "FULLY_PAID" as const, label: "Paid", color: "bg-green-100 text-green-800" },
                      { value: "IRRECOVERABLE" as const, label: "Written Off", color: "bg-gray-100 text-gray-600" },
                    ]).map((s) => (
                      <label key={s.value} className="flex items-center gap-1 cursor-pointer">
                        <Checkbox
                          checked={paymentStatuses.includes(s.value)}
                          onCheckedChange={(checked) => {
                            setPaymentStatuses((prev) =>
                              checked ? [...prev, s.value] : prev.filter((v) => v !== s.value),
                            );
                            setPage(0);
                          }}
                        />
                        <Badge className={`${s.color} text-xs border-0`}>{s.label}</Badge>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* Row 2: Date Filter 1 */}
              <DateFilterRow
                label="Date Filter 1"
                field={df1Field}
                op={df1Op}
                value={df1Value}
                value2={df1Value2}
                onFieldChange={(v) => { setDf1Field(v); setPage(0); }}
                onOpChange={(v) => { setDf1Op(v); setPage(0); }}
                onValueChange={(v) => { setDf1Value(v); setPage(0); }}
                onValue2Change={(v) => { setDf1Value2(v); setPage(0); }}
              />

              {/* Row 3: Date Filter 2 */}
              <DateFilterRow
                label="Date Filter 2"
                field={df2Field}
                op={df2Op}
                value={df2Value}
                value2={df2Value2}
                onFieldChange={(v) => { setDf2Field(v); setPage(0); }}
                onOpChange={(v) => { setDf2Op(v); setPage(0); }}
                onValueChange={(v) => { setDf2Value(v); setPage(0); }}
                onValue2Change={(v) => { setDf2Value2(v); setPage(0); }}
              />
            </div>

            <TabsContent value="payables" className="mt-0">
              <InvoiceTable
                data={data}
                loading={loading}
                columns={PAYABLE_COLUMNS}
                totalCount={totalCount}
                page={page}
                pageSize={pageSize}
                totalPages={totalPages}
                showingFrom={showingFrom}
                showingTo={showingTo}
                sort={sort}
                summaryCards={summaryCards}
                summaryLoading={summaryLoading}
                exportLoading={exportLoading}
                pageInput={pageInput}
                onSort={handleSort}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
                onExportCSV={handleExportCSV}
                onPageInputChange={setPageInput}
                renderCell={renderCell}
              />
            </TabsContent>

            <TabsContent value="receivables" className="mt-0">
              <InvoiceTable
                data={data}
                loading={loading}
                columns={RECEIVABLE_COLUMNS}
                totalCount={totalCount}
                page={page}
                pageSize={pageSize}
                totalPages={totalPages}
                showingFrom={showingFrom}
                showingTo={showingTo}
                sort={sort}
                summaryCards={summaryCards}
                summaryLoading={summaryLoading}
                exportLoading={exportLoading}
                pageInput={pageInput}
                onSort={handleSort}
                onPageChange={setPage}
                onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
                onExportCSV={handleExportCSV}
                onPageInputChange={setPageInput}
                renderCell={renderCell}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ─── Date Filter Row ────────────────────────────────────────────────────────

const DATE_OPERATORS: { value: DateOperator; label: string }[] = [
  { value: "none", label: "No filter" },
  { value: "before", label: "Before" },
  { value: "after", label: "After" },
  { value: "on", label: "On" },
  { value: "between", label: "Between" },
];

function DateFilterRow({
  label,
  field,
  op,
  value,
  value2,
  onFieldChange,
  onOpChange,
  onValueChange,
  onValue2Change,
}: {
  label: string;
  field: DateFieldOption;
  op: DateOperator;
  value: string;
  value2: string;
  onFieldChange: (v: DateFieldOption) => void;
  onOpChange: (v: DateOperator) => void;
  onValueChange: (v: string) => void;
  onValue2Change: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="w-[140px]">
        <Label className="text-xs font-medium mb-1.5 block">{label}</Label>
        <Select value={field} onValueChange={(v) => onFieldChange(v as DateFieldOption)}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="invoice_date">Invoice Date</SelectItem>
            <SelectItem value="payment_due_date">Due Date</SelectItem>
            <SelectItem value="payment_date">Payment Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-[130px]">
        <Label className="text-xs font-medium mb-1.5 block">Operator</Label>
        <Select value={op} onValueChange={(v) => onOpChange(v as DateOperator)}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DATE_OPERATORS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {op !== "none" && (
        <div className="w-[150px]">
          <Label className="text-xs font-medium mb-1.5 block">
            {op === "between" ? "From" : "Date"}
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-9 text-xs justify-start font-normal">
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {value ? format(parseISO(value), "MMM dd, yyyy") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value ? parseISO(value) : undefined}
                onSelect={(date) => { if (date) onValueChange(format(date, "yyyy-MM-dd")); }}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}

      {op === "between" && (
        <div className="w-[150px]">
          <Label className="text-xs font-medium mb-1.5 block">To</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full h-9 text-xs justify-start font-normal">
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                {value2 ? format(parseISO(value2), "MMM dd, yyyy") : "Pick date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={value2 ? parseISO(value2) : undefined}
                onSelect={(date) => { if (date) onValue2Change(format(date, "yyyy-MM-dd")); }}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}

// ─── Table Sub-Component ────────────────────────────────────────────────────

interface InvoiceTableProps {
  data: any[];
  loading: boolean;
  columns: readonly { key: string; label: string }[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  showingFrom: number;
  showingTo: number;
  sort: SortConfig;
  summaryCards: { title: string; value: number | null; icon: any; color?: string; isCount?: boolean }[];
  summaryLoading: boolean;
  exportLoading: boolean;
  pageInput: string;
  onSort: (field: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onExportCSV: () => void;
  onPageInputChange: (val: string) => void;
  renderCell: (row: any, colKey: string) => React.ReactNode;
}

function InvoiceTable({
  data,
  loading,
  columns,
  totalCount,
  page,
  pageSize,
  totalPages,
  showingFrom,
  showingTo,
  sort,
  summaryCards,
  summaryLoading,
  exportLoading,
  pageInput,
  onSort,
  onPageChange,
  onPageSizeChange,
  onExportCSV,
  onPageInputChange,
  renderCell,
}: InvoiceTableProps) {
  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {summaryCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <card.icon className={`h-4 w-4 ${card.color || "text-muted-foreground"}`} />
                <span className="text-xs text-muted-foreground font-medium">{card.title}</span>
              </div>
              <p className="text-xl font-bold tabular-nums">
                {card.value == null
                  ? "\u2014"
                  : card.isCount
                    ? card.value.toLocaleString()
                    : formatCurrency(card.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading..." : `Showing ${showingFrom}\u2013${showingTo} of ${totalCount.toLocaleString()} invoices`}
        </p>
        <Button variant="outline" size="sm" onClick={onExportCSV} disabled={exportLoading} className="gap-1.5 text-xs">
          {exportLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {exportLoading ? "Exporting\u2026" : "Export CSV"}
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className="cursor-pointer select-none whitespace-nowrap text-xs hover:bg-muted"
                    onClick={() => onSort(col.key)}
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sort.field === col.key && (
                        sort.direction === "asc"
                          ? <ChevronUp className="h-3 w-3" />
                          : <ChevronDown className="h-3 w-3" />
                      )}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="h-12 w-12 text-muted-foreground/50" />
                      <div>
                        <p className="font-medium">No invoices found</p>
                        <p className="text-sm text-muted-foreground mt-1">Try adjusting your filters</p>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row: any, idx: number) => (
                  <TableRow key={row.id} className={idx % 2 === 1 ? "bg-muted/30" : ""}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className="text-sm py-2.5">
                        {renderCell(row, col.key)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>Rows per page:</span>
            <Select value={pageSize.toString()} onValueChange={(v) => onPageSizeChange(parseInt(v))}>
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={s.toString()}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 0}>
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <div className="flex items-center gap-1.5 text-sm">
              <span>Page</span>
              <Input
                className="h-8 w-16 text-center text-sm"
                value={pageInput || (page + 1).toString()}
                onChange={(e) => onPageInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const num = parseInt(pageInput);
                    if (num >= 1 && num <= totalPages) onPageChange(num - 1);
                    onPageInputChange("");
                  }
                }}
                onBlur={() => onPageInputChange("")}
              />
              <span>of {totalPages}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages - 1}>
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
