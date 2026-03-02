import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Search,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  X,
  CalendarIcon,
  Columns3,
  Loader2,
  AlertCircle,
  FileText,
  DollarSign,
  CreditCard,
  Hash,
  Info,
} from "lucide-react";
import { format, parseISO, isAfter, startOfMonth, endOfMonth, subMonths, startOfQuarter, endOfQuarter, subQuarters, startOfYear, endOfYear, subYears, differenceInMinutes } from "date-fns";
import type {
  XtrfPayableInvoice,
  XtrfReceivableInvoice,
  XtrfSyncLog,
  PaymentStatus,
  TabType,
  DateFieldOption,
  DatePreset,
  XtrfInvoiceFilters,
  SortConfig,
} from "@/types/xtrf-invoices";
import { DEFAULT_FILTERS } from "@/types/xtrf-invoices";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null): string {
  if (value == null) return "$0.00 CAD";
  return `$${value.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CAD`;
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

function getDateRange(preset: DatePreset): { from: string; to: string } {
  const now = new Date();
  switch (preset) {
    case "this_month":
      return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { from: format(startOfMonth(lm), "yyyy-MM-dd"), to: format(endOfMonth(lm), "yyyy-MM-dd") };
    }
    case "this_quarter":
      return { from: format(startOfQuarter(now), "yyyy-MM-dd"), to: format(endOfQuarter(now), "yyyy-MM-dd") };
    case "last_quarter": {
      const lq = subQuarters(now, 1);
      return { from: format(startOfQuarter(lq), "yyyy-MM-dd"), to: format(endOfQuarter(lq), "yyyy-MM-dd") };
    }
    case "this_year":
      return { from: format(startOfYear(now), "yyyy-MM-dd"), to: format(endOfYear(now), "yyyy-MM-dd") };
    case "last_year": {
      const ly = subYears(now, 1);
      return { from: format(startOfYear(ly), "yyyy-MM-dd"), to: format(endOfYear(ly), "yyyy-MM-dd") };
    }
    case "all_time":
      return { from: "", to: "" };
  }
}

function truncate(str: string | null, max: number): string {
  if (!str) return "\u2014";
  return str.length > max ? str.slice(0, max) + "\u2026" : str;
}

const ALL_STATUSES: PaymentStatus[] = ["NOT_PAID", "PARTIALLY_PAID", "FULLY_PAID", "IRRECOVERABLE"];

const PAYABLE_COLUMNS = [
  { key: "project_number", label: "Project #" },
  { key: "project_name", label: "Project Name" },
  { key: "client_name", label: "Client" },
  { key: "client_branch_name", label: "Branch" },
  { key: "vendor_name", label: "Vendor" },
  { key: "language_combination", label: "Language" },
  { key: "invoice_final_number", label: "Invoice #" },
  { key: "amount_gross", label: "Amount" },
  { key: "payment_status", label: "Status" },
  { key: "invoice_date", label: "Invoice Date" },
  { key: "payment_due_date", label: "Due Date" },
  { key: "payment_date", label: "Payment Date" },
] as const;

const RECEIVABLE_COLUMNS = [
  { key: "project_number", label: "Project #" },
  { key: "project_name", label: "Project Name" },
  { key: "client_name", label: "Client" },
  { key: "client_branch_name", label: "Branch" },
  { key: "language_combination", label: "Language" },
  { key: "invoice_final_number", label: "Invoice #" },
  { key: "amount_gross", label: "Amount" },
  { key: "payment_status", label: "Status" },
  { key: "invoice_date", label: "Invoice Date" },
  { key: "payment_due_date", label: "Due Date" },
  { key: "payment_date", label: "Payment Date" },
] as const;

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "last_quarter", label: "Last Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
  { value: "all_time", label: "All Time" },
];

const PAGE_SIZES = [25, 50, 100];

// ─── Filters to/from URL ────────────────────────────────────────────────────

function filtersToParams(filters: XtrfInvoiceFilters, tab: TabType): Record<string, string> {
  const params: Record<string, string> = { tab };
  if (filters.search) params.search = filters.search;
  if (filters.dateField !== "invoice_date") params.dateField = filters.dateField;
  if (filters.datePreset !== "last_year") params.datePreset = filters.datePreset;
  if (filters.dateFrom) params.dateFrom = filters.dateFrom;
  if (filters.dateTo) params.dateTo = filters.dateTo;
  if (filters.paymentStatuses.length < 4) params.statuses = filters.paymentStatuses.join(",");
  if (filters.branches.length > 0) params.branches = filters.branches.join(",");
  if (filters.vendorsOrClients.length > 0) params.entities = filters.vendorsOrClients.join(",");
  if (filters.minAmount) params.minAmount = filters.minAmount;
  if (filters.maxAmount) params.maxAmount = filters.maxAmount;
  if (filters.invoiceNumber) params.invoiceNum = filters.invoiceNumber;
  if (filters.languages.length > 0) params.languages = filters.languages.join(",");
  if (filters.hasInvoiceOnly) params.hasInvoice = "1";
  return params;
}

function paramsToFilters(params: URLSearchParams): XtrfInvoiceFilters {
  const statusStr = params.get("statuses");
  const branchStr = params.get("branches");
  const entityStr = params.get("entities");
  const langStr = params.get("languages");

  return {
    search: params.get("search") || "",
    dateField: (params.get("dateField") as DateFieldOption) || "invoice_date",
    datePreset: (params.get("datePreset") as DatePreset) || "last_year",
    dateFrom: params.get("dateFrom") || "",
    dateTo: params.get("dateTo") || "",
    paymentStatuses: statusStr ? (statusStr.split(",") as PaymentStatus[]) : [...ALL_STATUSES],
    branches: branchStr ? branchStr.split(",") : [],
    vendorsOrClients: entityStr ? entityStr.split(",") : [],
    minAmount: params.get("minAmount") || "",
    maxAmount: params.get("maxAmount") || "",
    invoiceNumber: params.get("invoiceNum") || "",
    languages: langStr ? langStr.split(",") : [],
    hasInvoiceOnly: params.get("hasInvoice") === "1",
  };
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function XtrfInvoices() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>(
    (searchParams.get("tab") as TabType) || "payables",
  );

  // Filter state
  const [filters, setFilters] = useState<XtrfInvoiceFilters>(() => paramsToFilters(searchParams));
  const [pendingFilters, setPendingFilters] = useState<XtrfInvoiceFilters>(() => paramsToFilters(searchParams));

  // Table state
  const [data, setData] = useState<(XtrfPayableInvoice | XtrfReceivableInvoice)[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [sort, setSort] = useState<SortConfig>({ field: "invoice_date", direction: "desc" });
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Summary card state
  const [summaryTotal, setSummaryTotal] = useState<number | null>(null);
  const [summaryUnpaid, setSummaryUnpaid] = useState<number | null>(null);
  const [summaryPaid, setSummaryPaid] = useState<number | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Sync status
  const [syncLog, setSyncLog] = useState<XtrfSyncLog | null>(null);
  const [backfillComplete, setBackfillComplete] = useState(true);

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("xtrf-visible-columns");
    if (saved) {
      try {
        return new Set(JSON.parse(saved));
      } catch { /* fallback */ }
    }
    return new Set(PAYABLE_COLUMNS.map((c) => c.key));
  });
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);

  // Filter dropdown options
  const [branchOptions, setBranchOptions] = useState<{ value: string; count: number }[]>([]);
  const [entityOptions, setEntityOptions] = useState<string[]>([]);
  const [languageOptions, setLanguageOptions] = useState<string[]>([]);

  // Mobile filter sheet
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Debounce ref for search
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Fetch sync status
  useEffect(() => {
    if (!user) return;
    const fetchSync = async () => {
      const { data } = await supabase
        .from("xtrf_sync_log")
        .select("sync_type, status, notes, completed_at, started_at, backfill_complete")
        .order("started_at", { ascending: false })
        .limit(1)
        .single();
      if (data) {
        setSyncLog(data as XtrfSyncLog);
        setBackfillComplete(data.backfill_complete !== false);
      }
    };
    fetchSync();
  }, [user]);

  // Fetch filter options when tab changes
  useEffect(() => {
    if (!user) return;
    fetchFilterOptions();
  }, [user, activeTab]);

  const fetchFilterOptions = async () => {
    const table = activeTab === "payables" ? "xtrf_payable_invoices" : "xtrf_receivable_invoices";

    // Branches
    const { data: branchData } = await supabase
      .from(table)
      .select("client_branch_name")
      .not("client_branch_name", "is", null);
    if (branchData) {
      const counts: Record<string, number> = {};
      branchData.forEach((r: any) => {
        const b = r.client_branch_name;
        if (b) counts[b] = (counts[b] || 0) + 1;
      });
      setBranchOptions(
        Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([value, count]) => ({ value, count })),
      );
    }

    // Vendor / Client names
    const entityField = activeTab === "payables" ? "vendor_name" : "client_name";
    const { data: entityData } = await supabase
      .from(table)
      .select(entityField)
      .not(entityField, "is", null);
    if (entityData) {
      const counts: Record<string, number> = {};
      entityData.forEach((r: any) => {
        const v = r[entityField];
        if (v) counts[v] = (counts[v] || 0) + 1;
      });
      setEntityOptions(
        Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 50)
          .map(([value]) => value),
      );
    }

    // Languages
    const { data: langData } = await supabase
      .from(table)
      .select("language_combination")
      .not("language_combination", "is", null);
    if (langData) {
      const unique = [...new Set(langData.map((r: any) => r.language_combination).filter(Boolean))];
      setLanguageOptions(unique.sort() as string[]);
    }
  };

  // Compute effective date range from preset or custom
  const effectiveDateRange = useMemo(() => {
    if (filters.dateFrom || filters.dateTo) {
      return { from: filters.dateFrom, to: filters.dateTo };
    }
    return getDateRange(filters.datePreset);
  }, [filters.datePreset, filters.dateFrom, filters.dateTo]);

  // Build and run query
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const table = activeTab === "payables" ? "xtrf_payable_invoices" : "xtrf_receivable_invoices";
    let query = supabase.from(table).select("*", { count: "exact" });

    // Search
    if (filters.search) {
      const s = filters.search;
      const searchFields = activeTab === "payables"
        ? `project_number.ilike.%${s}%,project_name.ilike.%${s}%,client_name.ilike.%${s}%,invoice_final_number.ilike.%${s}%,vendor_name.ilike.%${s}%`
        : `project_number.ilike.%${s}%,project_name.ilike.%${s}%,client_name.ilike.%${s}%,invoice_final_number.ilike.%${s}%`;
      query = query.or(searchFields);
    }

    // Date range
    const { from: dateFrom, to: dateTo } = effectiveDateRange;
    if (dateFrom) query = query.gte(filters.dateField, dateFrom);
    if (dateTo) query = query.lte(filters.dateField, dateTo);

    // Payment status
    if (filters.paymentStatuses.length > 0 && filters.paymentStatuses.length < 4) {
      query = query.in("payment_status", filters.paymentStatuses);
    }

    // Branch
    if (filters.branches.length > 0) {
      query = query.in("client_branch_name", filters.branches);
    }

    // Vendor/Client
    if (filters.vendorsOrClients.length > 0) {
      const field = activeTab === "payables" ? "vendor_name" : "client_name";
      query = query.in(field, filters.vendorsOrClients);
    }

    // Amount range
    if (filters.minAmount) query = query.gte("amount_gross", parseFloat(filters.minAmount));
    if (filters.maxAmount) query = query.lte("amount_gross", parseFloat(filters.maxAmount));

    // Invoice number
    if (filters.invoiceNumber) {
      query = query.ilike("invoice_final_number", `%${filters.invoiceNumber}%`);
    }

    // Has invoice toggle
    if (filters.hasInvoiceOnly) {
      query = query.not("invoice_final_number", "is", null);
    }

    // Language
    if (filters.languages.length > 0) {
      query = query.in("language_combination", filters.languages);
    }

    // Sort & paginate
    query = query
      .order(sort.field, { ascending: sort.direction === "asc", nullsFirst: false })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    const { data: rows, count, error } = await query;
    if (error) {
      console.error("Error fetching XTRF invoices:", error);
    }
    setData(rows || []);
    setTotalCount(count || 0);
    setLoading(false);
  }, [user, activeTab, filters, effectiveDateRange, sort, page, pageSize]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    if (!user) return;
    setSummaryLoading(true);

    const table = activeTab === "payables" ? "xtrf_payable_invoices" : "xtrf_receivable_invoices";
    let query = supabase.from(table).select("amount_gross, payment_status");

    // Apply same filters (except pagination)
    if (filters.search) {
      const s = filters.search;
      const searchFields = activeTab === "payables"
        ? `project_number.ilike.%${s}%,project_name.ilike.%${s}%,client_name.ilike.%${s}%,invoice_final_number.ilike.%${s}%,vendor_name.ilike.%${s}%`
        : `project_number.ilike.%${s}%,project_name.ilike.%${s}%,client_name.ilike.%${s}%,invoice_final_number.ilike.%${s}%`;
      query = query.or(searchFields);
    }
    const { from: dateFrom, to: dateTo } = effectiveDateRange;
    if (dateFrom) query = query.gte(filters.dateField, dateFrom);
    if (dateTo) query = query.lte(filters.dateField, dateTo);
    if (filters.paymentStatuses.length > 0 && filters.paymentStatuses.length < 4) {
      query = query.in("payment_status", filters.paymentStatuses);
    }
    if (filters.branches.length > 0) query = query.in("client_branch_name", filters.branches);
    if (filters.vendorsOrClients.length > 0) {
      const field = activeTab === "payables" ? "vendor_name" : "client_name";
      query = query.in(field, filters.vendorsOrClients);
    }
    if (filters.minAmount) query = query.gte("amount_gross", parseFloat(filters.minAmount));
    if (filters.maxAmount) query = query.lte("amount_gross", parseFloat(filters.maxAmount));
    if (filters.invoiceNumber) query = query.ilike("invoice_final_number", `%${filters.invoiceNumber}%`);
    if (filters.hasInvoiceOnly) query = query.not("invoice_final_number", "is", null);
    if (filters.languages.length > 0) query = query.in("language_combination", filters.languages);

    const { data: rows } = await query;
    if (rows) {
      let total = 0, unpaid = 0, paid = 0;
      rows.forEach((r: any) => {
        const amt = r.amount_gross || 0;
        total += amt;
        if (r.payment_status === "NOT_PAID") unpaid += amt;
        if (r.payment_status === "FULLY_PAID") paid += amt;
      });
      setSummaryTotal(total);
      setSummaryUnpaid(unpaid);
      setSummaryPaid(paid);
    }
    setSummaryLoading(false);
  }, [user, activeTab, filters, effectiveDateRange]);

  // Trigger fetch on filter/sort/page changes
  useEffect(() => {
    fetchData();
    fetchSummary();
  }, [fetchData, fetchSummary]);

  // Sync filters to URL
  useEffect(() => {
    setSearchParams(filtersToParams(filters, activeTab), { replace: true });
  }, [filters, activeTab]);

  // Apply filters from pending
  const applyFilters = () => {
    setFilters({ ...pendingFilters });
    setPage(0);
    setExpandedRow(null);
    setMobileFiltersOpen(false);
  };

  // Clear filters
  const clearFilters = () => {
    const defaults = { ...DEFAULT_FILTERS };
    setPendingFilters(defaults);
    setFilters(defaults);
    setPage(0);
    setExpandedRow(null);
  };

  // Handle search with debounce
  const handleSearchChange = (value: string) => {
    setPendingFilters((f) => ({ ...f, search: value }));
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setFilters((f) => ({ ...f, search: value }));
      setPage(0);
    }, 300);
  };

  // Handle tab change
  const handleTabChange = (tab: string) => {
    setActiveTab(tab as TabType);
    setPage(0);
    setExpandedRow(null);
    // Reset entity filter when switching tabs
    setPendingFilters((f) => ({ ...f, vendorsOrClients: [] }));
    setFilters((f) => ({ ...f, vendorsOrClients: [] }));
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

  // Column toggle
  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      localStorage.setItem("xtrf-visible-columns", JSON.stringify([...next]));
      return next;
    });
  };

  // Date preset handler
  const handlePresetChange = (preset: DatePreset) => {
    const range = getDateRange(preset);
    setPendingFilters((f) => ({
      ...f,
      datePreset: preset,
      dateFrom: range.from,
      dateTo: range.to,
    }));
  };

  // Count active non-default filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (pendingFilters.search) count++;
    if (pendingFilters.datePreset !== "last_year") count++;
    if (pendingFilters.paymentStatuses.length < 4) count++;
    if (pendingFilters.branches.length > 0) count++;
    if (pendingFilters.vendorsOrClients.length > 0) count++;
    if (pendingFilters.minAmount || pendingFilters.maxAmount) count++;
    if (pendingFilters.invoiceNumber) count++;
    if (pendingFilters.languages.length > 0) count++;
    if (pendingFilters.hasInvoiceOnly) count++;
    return count;
  }, [pendingFilters]);

  // Export CSV
  const handleExportCSV = async () => {
    const table = activeTab === "payables" ? "xtrf_payable_invoices" : "xtrf_receivable_invoices";
    let query = supabase.from(table).select("*");

    // Apply same filters
    if (filters.search) {
      const s = filters.search;
      const searchFields = activeTab === "payables"
        ? `project_number.ilike.%${s}%,project_name.ilike.%${s}%,client_name.ilike.%${s}%,invoice_final_number.ilike.%${s}%,vendor_name.ilike.%${s}%`
        : `project_number.ilike.%${s}%,project_name.ilike.%${s}%,client_name.ilike.%${s}%,invoice_final_number.ilike.%${s}%`;
      query = query.or(searchFields);
    }
    const { from: dateFrom, to: dateTo } = effectiveDateRange;
    if (dateFrom) query = query.gte(filters.dateField, dateFrom);
    if (dateTo) query = query.lte(filters.dateField, dateTo);
    if (filters.paymentStatuses.length > 0 && filters.paymentStatuses.length < 4) {
      query = query.in("payment_status", filters.paymentStatuses);
    }
    if (filters.branches.length > 0) query = query.in("client_branch_name", filters.branches);
    if (filters.vendorsOrClients.length > 0) {
      const field = activeTab === "payables" ? "vendor_name" : "client_name";
      query = query.in(field, filters.vendorsOrClients);
    }
    if (filters.minAmount) query = query.gte("amount_gross", parseFloat(filters.minAmount));
    if (filters.maxAmount) query = query.lte("amount_gross", parseFloat(filters.maxAmount));
    if (filters.invoiceNumber) query = query.ilike("invoice_final_number", `%${filters.invoiceNumber}%`);
    if (filters.hasInvoiceOnly) query = query.not("invoice_final_number", "is", null);
    if (filters.languages.length > 0) query = query.in("language_combination", filters.languages);

    query = query.order(sort.field, { ascending: sort.direction === "asc", nullsFirst: false });

    const { data: rows } = await query;
    if (!rows || rows.length === 0) return;

    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(","),
      ...rows.map((row: any) =>
        headers
          .map((h) => {
            const val = row[h];
            if (val == null) return "";
            const str = String(val);
            return str.includes(",") || str.includes('"') || str.includes("\n")
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `xtrf_${activeTab}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Columns for current tab
  const columns = activeTab === "payables" ? PAYABLE_COLUMNS : RECEIVABLE_COLUMNS;

  // Pagination math
  const totalPages = Math.ceil(totalCount / pageSize);
  const showingFrom = totalCount === 0 ? 0 : page * pageSize + 1;
  const showingTo = Math.min((page + 1) * pageSize, totalCount);

  // Sync status badge
  const syncBadge = useMemo(() => {
    if (!syncLog) return null;
    if (syncLog.status === "running") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 gap-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
              Syncing...
            </Badge>
          </TooltipTrigger>
          {syncLog.notes && <TooltipContent>{syncLog.notes}</TooltipContent>}
        </Tooltip>
      );
    }
    if (syncLog.status === "failed") {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Sync failed
            </Badge>
          </TooltipTrigger>
          {syncLog.notes && <TooltipContent>{syncLog.notes}</TooltipContent>}
        </Tooltip>
      );
    }
    if (syncLog.status === "completed" && syncLog.completed_at) {
      const mins = differenceInMinutes(new Date(), parseISO(syncLog.completed_at));
      const isRecent = mins < 20;
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge className={`${isRecent ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-700 border-gray-200"} hover:bg-green-100 gap-1.5`}>
              <span className={`h-2 w-2 rounded-full ${isRecent ? "bg-green-500" : "bg-gray-400"}`} />
              Synced {mins < 1 ? "just now" : `${mins} min ago`}
            </Badge>
          </TooltipTrigger>
          {syncLog.notes && <TooltipContent>{syncLog.notes}</TooltipContent>}
        </Tooltip>
      );
    }
    return null;
  }, [syncLog]);

  // ─── Filter Panel Content (shared between sidebar and sheet) ──────────────

  const filterPanelContent = (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-xs">{activeFilterCount}</Badge>
          )}
        </h3>
        <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">
          Clear All
        </button>
      </div>

      {/* 1. Search */}
      <div>
        <Label className="text-xs font-medium mb-1.5 block">Search</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search project, client, invoice #..."
            value={pendingFilters.search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {/* 2. Date Range */}
      <div>
        <Label className="text-xs font-medium mb-1.5 block">Date Range</Label>
        <Select
          value={pendingFilters.dateField}
          onValueChange={(v) => setPendingFilters((f) => ({ ...f, dateField: v as DateFieldOption }))}
        >
          <SelectTrigger className="h-9 text-sm mb-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="invoice_date">Invoice Date</SelectItem>
            <SelectItem value="payment_due_date">Due Date</SelectItem>
            <SelectItem value="payment_date">Payment Date</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex flex-wrap gap-1.5 mb-2">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => handlePresetChange(p.value)}
              className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                pendingFilters.datePreset === p.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs text-muted-foreground">From</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-9 text-xs justify-start font-normal">
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {pendingFilters.dateFrom ? format(parseISO(pendingFilters.dateFrom), "MMM dd, yy") : "Start"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={pendingFilters.dateFrom ? parseISO(pendingFilters.dateFrom) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setPendingFilters((f) => ({
                        ...f,
                        dateFrom: format(date, "yyyy-MM-dd"),
                        datePreset: "all_time",
                      }));
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">To</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-9 text-xs justify-start font-normal">
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                  {pendingFilters.dateTo ? format(parseISO(pendingFilters.dateTo), "MMM dd, yy") : "End"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={pendingFilters.dateTo ? parseISO(pendingFilters.dateTo) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setPendingFilters((f) => ({
                        ...f,
                        dateTo: format(date, "yyyy-MM-dd"),
                        datePreset: "all_time",
                      }));
                    }
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* 3. Payment Status */}
      <div>
        <Label className="text-xs font-medium mb-1.5 block">Payment Status</Label>
        <div className="space-y-2">
          {([
            { value: "NOT_PAID" as const, label: "Not Paid", color: "bg-red-100 text-red-800" },
            { value: "PARTIALLY_PAID" as const, label: "Partially Paid", color: "bg-yellow-100 text-yellow-800" },
            { value: "FULLY_PAID" as const, label: "Fully Paid", color: "bg-green-100 text-green-800" },
            { value: "IRRECOVERABLE" as const, label: "Irrecoverable", color: "bg-gray-100 text-gray-600" },
          ]).map((s) => (
            <label key={s.value} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={pendingFilters.paymentStatuses.includes(s.value)}
                onCheckedChange={(checked) => {
                  setPendingFilters((f) => ({
                    ...f,
                    paymentStatuses: checked
                      ? [...f.paymentStatuses, s.value]
                      : f.paymentStatuses.filter((v) => v !== s.value),
                  }));
                }}
              />
              <Badge className={`${s.color} text-xs border-0`}>{s.label}</Badge>
            </label>
          ))}
        </div>
      </div>

      {/* 4. Branch */}
      <div>
        <Label className="text-xs font-medium mb-1.5 block">Branch / Company</Label>
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {branchOptions.map((b) => (
            <label key={b.value} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={pendingFilters.branches.includes(b.value)}
                onCheckedChange={(checked) => {
                  setPendingFilters((f) => ({
                    ...f,
                    branches: checked
                      ? [...f.branches, b.value]
                      : f.branches.filter((v) => v !== b.value),
                  }));
                }}
              />
              <span className="truncate">{b.value}</span>
              <span className="text-xs text-muted-foreground ml-auto">({b.count})</span>
            </label>
          ))}
        </div>
      </div>

      {/* 5. Vendor / Client */}
      <div>
        <Label className="text-xs font-medium mb-1.5 block">
          {activeTab === "payables" ? "Vendor" : "Client"}
        </Label>
        <Select
          value={pendingFilters.vendorsOrClients.length === 1 ? pendingFilters.vendorsOrClients[0] : ""}
          onValueChange={(v) => {
            if (v === "__clear__") {
              setPendingFilters((f) => ({ ...f, vendorsOrClients: [] }));
            } else {
              setPendingFilters((f) => ({ ...f, vendorsOrClients: [v] }));
            }
          }}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder={`All ${activeTab === "payables" ? "Vendors" : "Clients"}`} />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__clear__">All</SelectItem>
            {entityOptions.map((e) => (
              <SelectItem key={e} value={e}>{e}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 6. Amount Range */}
      <div>
        <Label className="text-xs font-medium mb-1.5 block">Amount Range (CAD)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Min"
            value={pendingFilters.minAmount}
            onChange={(e) => setPendingFilters((f) => ({ ...f, minAmount: e.target.value }))}
            className="h-9 text-sm"
          />
          <Input
            type="number"
            placeholder="Max"
            value={pendingFilters.maxAmount}
            onChange={(e) => setPendingFilters((f) => ({ ...f, maxAmount: e.target.value }))}
            className="h-9 text-sm"
          />
        </div>
      </div>

      {/* 7. Invoice Number */}
      <div>
        <Label className="text-xs font-medium mb-1.5 block">Invoice Number</Label>
        <Input
          placeholder="Search invoice #..."
          value={pendingFilters.invoiceNumber}
          onChange={(e) => setPendingFilters((f) => ({ ...f, invoiceNumber: e.target.value }))}
          className="h-9 text-sm"
        />
      </div>

      {/* 8. Language Combination */}
      {languageOptions.length > 0 && (
        <div>
          <Label className="text-xs font-medium mb-1.5 block">Language Combination</Label>
          <Select
            value={pendingFilters.languages.length === 1 ? pendingFilters.languages[0] : ""}
            onValueChange={(v) => {
              if (v === "__clear__") {
                setPendingFilters((f) => ({ ...f, languages: [] }));
              } else {
                setPendingFilters((f) => ({
                  ...f,
                  languages: f.languages.includes(v) ? f.languages : [...f.languages, v],
                }));
              }
            }}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="All Languages" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="__clear__">All</SelectItem>
              {languageOptions.map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pendingFilters.languages.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {pendingFilters.languages.map((l) => (
                <Badge key={l} variant="secondary" className="text-xs gap-1">
                  {truncate(l, 20)}
                  <button onClick={() => setPendingFilters((f) => ({ ...f, languages: f.languages.filter((v) => v !== l) }))}>
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 9. Has Invoice # toggle */}
      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={pendingFilters.hasInvoiceOnly}
            onCheckedChange={(checked) =>
              setPendingFilters((f) => ({ ...f, hasInvoiceOnly: !!checked }))
            }
          />
          <span className="text-sm">Has Invoice # only</span>
        </label>
      </div>

      {/* 10. Apply */}
      <div className="space-y-2 pt-2">
        <Button onClick={applyFilters} className="w-full" size="sm">
          Apply Filters
        </Button>
      </div>
    </div>
  );

  // ─── Render Cell ──────────────────────────────────────────────────────────

  const renderCell = (row: any, colKey: string) => {
    switch (colKey) {
      case "project_number":
        return <span className="font-medium">{row.project_number || "\u2014"}</span>;
      case "project_name":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{truncate(row.project_name, 40)}</span>
            </TooltipTrigger>
            {row.project_name && row.project_name.length > 40 && (
              <TooltipContent>{row.project_name}</TooltipContent>
            )}
          </Tooltip>
        );
      case "client_name":
        return row.client_name || "\u2014";
      case "client_branch_name":
        return row.client_branch_name ? (
          <Badge variant="outline" className="text-xs">{row.client_branch_name}</Badge>
        ) : "\u2014";
      case "vendor_name":
        return row.vendor_name || "\u2014";
      case "language_combination":
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>{truncate(row.language_combination, 20)}</span>
            </TooltipTrigger>
            {row.language_combination && row.language_combination.length > 20 && (
              <TooltipContent>{row.language_combination}</TooltipContent>
            )}
          </Tooltip>
        );
      case "invoice_final_number":
        return row.invoice_final_number ? (
          <span className="font-mono text-xs">{row.invoice_final_number}</span>
        ) : "\u2014";
      case "amount_gross":
        return (
          <span className="text-right block font-medium tabular-nums">
            {formatCurrency(row.amount_gross)}
          </span>
        );
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

  // ─── Render ───────────────────────────────────────────────────────────────

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
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">XTRF Invoices</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Payables & Receivables synced from XTRF
              </p>
            </div>
            <div className="flex items-center gap-3">
              {syncBadge}
            </div>
          </div>

          {/* Backfill notice */}
          {!backfillComplete && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
              <Info className="h-4 w-4 flex-shrink-0" />
              Data sync in progress — historical records are still loading
            </div>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="mb-4">
              <TabsTrigger value="payables">Payables (AP)</TabsTrigger>
              <TabsTrigger value="receivables">Receivables (AR)</TabsTrigger>
            </TabsList>

            <div className="flex gap-6">
              {/* Filter Sidebar (desktop) */}
              <div className="hidden lg:block w-64 flex-shrink-0">
                <div className="sticky top-0 bg-muted/50 border rounded-lg p-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
                  {filterPanelContent}
                </div>
              </div>

              {/* Mobile Filter Button */}
              <div className="lg:hidden fixed bottom-4 right-4 z-30">
                <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button size="lg" className="rounded-full shadow-lg gap-2">
                      <Filter className="h-4 w-4" />
                      Filters
                      {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="text-xs ml-1">{activeFilterCount}</Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-80 overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Filters</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4">
                      {filterPanelContent}
                    </div>
                  </SheetContent>
                </Sheet>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 min-w-0">
                <TabsContent value="payables" className="mt-0">
                  <InvoiceTableContent
                    tab="payables"
                    data={data}
                    loading={loading}
                    totalCount={totalCount}
                    page={page}
                    pageSize={pageSize}
                    totalPages={totalPages}
                    showingFrom={showingFrom}
                    showingTo={showingTo}
                    sort={sort}
                    columns={PAYABLE_COLUMNS}
                    visibleColumns={visibleColumns}
                    expandedRow={expandedRow}
                    summaryTotal={summaryTotal}
                    summaryUnpaid={summaryUnpaid}
                    summaryPaid={summaryPaid}
                    summaryLoading={summaryLoading}
                    showColumnDropdown={showColumnDropdown}
                    onSort={handleSort}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
                    onExpandRow={(id) => setExpandedRow((prev) => (prev === id ? null : id))}
                    onToggleColumn={toggleColumn}
                    onToggleColumnDropdown={() => setShowColumnDropdown((v) => !v)}
                    onExportCSV={handleExportCSV}
                    onClearFilters={clearFilters}
                    renderCell={renderCell}
                  />
                </TabsContent>

                <TabsContent value="receivables" className="mt-0">
                  <InvoiceTableContent
                    tab="receivables"
                    data={data}
                    loading={loading}
                    totalCount={totalCount}
                    page={page}
                    pageSize={pageSize}
                    totalPages={totalPages}
                    showingFrom={showingFrom}
                    showingTo={showingTo}
                    sort={sort}
                    columns={RECEIVABLE_COLUMNS}
                    visibleColumns={visibleColumns}
                    expandedRow={expandedRow}
                    summaryTotal={summaryTotal}
                    summaryUnpaid={summaryUnpaid}
                    summaryPaid={summaryPaid}
                    summaryLoading={summaryLoading}
                    showColumnDropdown={showColumnDropdown}
                    onSort={handleSort}
                    onPageChange={setPage}
                    onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
                    onExpandRow={(id) => setExpandedRow((prev) => (prev === id ? null : id))}
                    onToggleColumn={toggleColumn}
                    onToggleColumnDropdown={() => setShowColumnDropdown((v) => !v)}
                    onExportCSV={handleExportCSV}
                    onClearFilters={clearFilters}
                    renderCell={renderCell}
                  />
                </TabsContent>
              </div>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

// ─── Table Content Sub-Component ────────────────────────────────────────────

interface InvoiceTableContentProps {
  tab: TabType;
  data: any[];
  loading: boolean;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  showingFrom: number;
  showingTo: number;
  sort: SortConfig;
  columns: readonly { key: string; label: string }[];
  visibleColumns: Set<string>;
  expandedRow: string | null;
  summaryTotal: number | null;
  summaryUnpaid: number | null;
  summaryPaid: number | null;
  summaryLoading: boolean;
  showColumnDropdown: boolean;
  onSort: (field: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onExpandRow: (id: string) => void;
  onToggleColumn: (key: string) => void;
  onToggleColumnDropdown: () => void;
  onExportCSV: () => void;
  onClearFilters: () => void;
  renderCell: (row: any, colKey: string) => React.ReactNode;
}

function InvoiceTableContent({
  tab,
  data,
  loading,
  totalCount,
  page,
  pageSize,
  totalPages,
  showingFrom,
  showingTo,
  sort,
  columns,
  visibleColumns,
  expandedRow,
  summaryTotal,
  summaryUnpaid,
  summaryPaid,
  summaryLoading,
  showColumnDropdown,
  onSort,
  onPageChange,
  onPageSizeChange,
  onExpandRow,
  onToggleColumn,
  onToggleColumnDropdown,
  onExportCSV,
  onClearFilters,
  renderCell,
}: InvoiceTableContentProps) {
  const isPayables = tab === "payables";

  const summaryCards = [
    {
      title: isPayables ? "Total Amount" : "Total Revenue",
      value: summaryLoading ? null : summaryTotal,
      icon: DollarSign,
      color: "text-blue-600",
    },
    {
      title: isPayables ? "Unpaid" : "Outstanding",
      value: summaryLoading ? null : summaryUnpaid,
      icon: AlertCircle,
      color: "text-red-600",
    },
    {
      title: isPayables ? "Paid" : "Collected",
      value: summaryLoading ? null : summaryPaid,
      icon: CreditCard,
      color: "text-green-600",
    },
    {
      title: "Record Count",
      value: summaryLoading ? null : totalCount,
      icon: Hash,
      isCount: true,
    },
  ];

  const visibleCols = columns.filter((c) => visibleColumns.has(c.key));

  const [pageInput, setPageInput] = useState("");

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

      {/* Table Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground">
          {loading ? "Loading..." : `Showing ${showingFrom}\u2013${showingTo} of ${totalCount.toLocaleString()} results`}
        </p>
        <div className="flex items-center gap-2">
          {/* Column Visibility */}
          <div className="relative">
            <Button variant="outline" size="sm" onClick={onToggleColumnDropdown} className="gap-1.5 text-xs">
              <Columns3 className="h-3.5 w-3.5" />
              Columns
            </Button>
            {showColumnDropdown && (
              <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded-lg shadow-lg p-3 w-52">
                <div className="space-y-2">
                  {columns.map((col) => (
                    <label key={col.key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={visibleColumns.has(col.key)}
                        onCheckedChange={() => onToggleColumn(col.key)}
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={onExportCSV} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Data Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
              <TableRow>
                {visibleCols.map((col) => (
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
                // Skeleton rows
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={`skeleton-${i}`}>
                    {visibleCols.map((col) => (
                      <TableCell key={col.key}>
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                // Empty state
                <TableRow>
                  <TableCell colSpan={visibleCols.length} className="text-center py-16">
                    <div className="flex flex-col items-center gap-3">
                      <FileText className="h-12 w-12 text-muted-foreground/50" />
                      <div>
                        <p className="font-medium">No invoices found</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          Try adjusting your filters
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={onClearFilters}>
                        Clear Filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row: any, idx: number) => (
                  <React.Fragment key={row.id}>
                    <TableRow
                      className={`cursor-pointer transition-colors ${idx % 2 === 1 ? "bg-muted/30" : ""} ${expandedRow === row.id ? "bg-primary/5" : "hover:bg-muted/50"}`}
                      onClick={() => onExpandRow(row.id)}
                    >
                      {visibleCols.map((col) => (
                        <TableCell key={col.key} className="text-sm py-2.5">
                          {renderCell(row, col.key)}
                        </TableCell>
                      ))}
                    </TableRow>
                    {expandedRow === row.id && (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={visibleCols.length} className="p-4">
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground text-xs block">Internal Invoice #</span>
                              <span className="font-mono">{row.invoice_internal_number || "\u2014"}</span>
                            </div>
                            {isPayables && (
                              <>
                                <div>
                                  <span className="text-muted-foreground text-xs block">Job Type</span>
                                  <span>{row.job_type_id || "\u2014"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs block">Job Description</span>
                                  <span>{row.job_description || "\u2014"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs block">Rate x Quantity</span>
                                  <span>
                                    {row.rate != null ? row.rate : "\u2014"} x {row.quantity != null ? row.quantity : "\u2014"}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs block">Amount Paid</span>
                                  <span>{row.amount_paid != null ? formatCurrency(row.amount_paid) : "\u2014"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground text-xs block">Notes from Vendor</span>
                                  <span>{row.notes_from_vendor || "\u2014"}</span>
                                </div>
                              </>
                            )}
                            <div>
                              <span className="text-muted-foreground text-xs block">Last Synced</span>
                              <span>{formatDate(row.last_synced_at)}</span>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
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
            <Select
              value={pageSize.toString()}
              onValueChange={(v) => onPageSizeChange(parseInt(v))}
            >
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => (
                  <SelectItem key={s} value={s.toString()}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>

            <div className="flex items-center gap-1.5 text-sm">
              <span>Page</span>
              <Input
                className="h-8 w-16 text-center text-sm"
                value={pageInput || (page + 1).toString()}
                onChange={(e) => setPageInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const num = parseInt(pageInput);
                    if (num >= 1 && num <= totalPages) {
                      onPageChange(num - 1);
                    }
                    setPageInput("");
                  }
                }}
                onBlur={() => setPageInput("")}
              />
              <span>of {totalPages}</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages - 1}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
