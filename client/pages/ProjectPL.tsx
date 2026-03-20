import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
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
  ArrowUp,
  ArrowDown,
  Download,
  Loader2,
  Search,
  RotateCcw,
  DollarSign,
  Hash,
  TrendingUp,
  Percent,
} from "lucide-react";

const PAGE_SIZE = 50;

// --- Types ---

interface ProjectPLRow {
  project_xtrf_id: number;
  project_number: string;
  project_name: string;
  client_name: string;
  branch_id: number;
  branch_name: string;
  project_status: string;
  ordered_on: string | null;
  source_language: string | null;
  target_languages: string | null;
  revenue_cad: number;
  cost_cad: number;
  profit_cad: number;
  margin_pct: number | null;
  has_no_cost: boolean;
  total_count: number;
  summary_revenue_cad: number;
  summary_cost_cad: number;
  summary_profit_cad: number;
}

interface Branch {
  id: number;
  branch_name: string;
}

interface Language {
  xtrf_id: number;
  name: string;
}

interface Filters {
  branch_id: number | null;
  status: string | null;
  client_search: string;
  vendor_search: string;
  source_lang_id: number | null;
  target_lang_id: number | null;
  date_from: string | null;
  date_to: string | null;
}

const INITIAL_FILTERS: Filters = {
  branch_id: null,
  status: null,
  client_search: "",
  vendor_search: "",
  source_lang_id: null,
  target_lang_id: null,
  date_from: null,
  date_to: null,
};

// --- Formatting helpers ---

const formatCAD = (val: number | null | undefined): string =>
  val == null
    ? "—"
    : `$${Number(val).toLocaleString("en-CA", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

const formatMargin = (val: number | null | undefined): string =>
  val == null ? "—" : `${Number(val).toFixed(2)}%`;

const formatOrderDate = (ts: string | null): string => {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
};

const profitColor = (val: number | null | undefined): string =>
  val != null && Number(val) < 0 ? "#DC2626" : "inherit";

// --- Status badge config ---

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  OPEN: {
    label: "Open",
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  CLOSED: {
    label: "Closed",
    className: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
};

// --- Searchable language dropdown ---

function SearchableLanguageDropdown({
  languages,
  value,
  onChange,
  placeholder,
}: {
  languages: Language[];
  value: number | null;
  onChange: (val: number | null) => void;
  placeholder: string;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const filtered = languages.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase())
  );

  const selectedName = value
    ? languages.find((l) => l.xtrf_id === value)?.name
    : null;

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div
        className="flex h-9 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-sm cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <span className={selectedName ? "text-foreground" : "text-muted-foreground"}>
          {selectedName || placeholder}
        </span>
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="p-2">
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            <div
              className="px-3 py-1.5 text-sm cursor-pointer hover:bg-accent"
              onClick={() => {
                onChange(null);
                setOpen(false);
                setSearch("");
              }}
            >
              All
            </div>
            {filtered.map((l) => (
              <div
                key={l.xtrf_id}
                className={`px-3 py-1.5 text-sm cursor-pointer hover:bg-accent ${
                  value === l.xtrf_id ? "bg-accent font-medium" : ""
                }`}
                onClick={() => {
                  onChange(l.xtrf_id);
                  setOpen(false);
                  setSearch("");
                }}
              >
                {l.name}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main component ---

export default function ProjectPL() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Filter state (draft = form state, applied = what's sent to RPC)
  const [draftFilters, setDraftFilters] = useState<Filters>({ ...INITIAL_FILTERS });
  const [filters, setFilters] = useState<Filters>({ ...INITIAL_FILTERS });
  const [page, setPage] = useState(1);
  const [sortCol, setSortCol] = useState<string>("ordered_on");
  const [sortDir, setSortDir] = useState<string>("desc");

  // Data
  const [data, setData] = useState<ProjectPLRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  // Summary (from first row)
  const [totalCount, setTotalCount] = useState(0);
  const [summaryRevenue, setSummaryRevenue] = useState(0);
  const [summaryCost, setSummaryCost] = useState(0);
  const [summaryProfit, setSummaryProfit] = useState(0);

  // Lookups
  const [branches, setBranches] = useState<Branch[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) navigate("/login");
  }, [user, authLoading, navigate]);

  // Load lookups
  useEffect(() => {
    if (!user) return;
    const loadLookups = async () => {
      const [branchRes, langRes] = await Promise.all([
        supabase
          .from("xtrf_branches")
          .select("id, branch_name")
          .order("branch_name"),
        supabase
          .from("xtrf_new_dict_languages")
          .select("xtrf_id, name")
          .eq("is_active", true)
          .order("name"),
      ]);
      if (branchRes.data) setBranches(branchRes.data);
      if (langRes.data) setLanguages(langRes.data);
    };
    loadLookups();
  }, [user]);

  // Fetch data
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: result, error } = await supabase.rpc("get_project_pl", {
        p_branch_id: filters.branch_id,
        p_status: filters.status,
        p_client_search: filters.client_search || null,
        p_vendor_search: filters.vendor_search || null,
        p_source_lang_id: filters.source_lang_id,
        p_target_lang_id: filters.target_lang_id,
        p_date_from: filters.date_from,
        p_date_to: filters.date_to,
        p_page: page,
        p_page_size: PAGE_SIZE,
        p_sort_col: sortCol,
        p_sort_dir: sortDir,
      });
      if (error) {
        toast({ title: "Error loading data", description: error.message, variant: "destructive" });
        setData([]);
        return;
      }
      setData(result || []);
      if (result && result.length > 0) {
        setTotalCount(Number(result[0].total_count));
        setSummaryRevenue(Number(result[0].summary_revenue_cad));
        setSummaryCost(Number(result[0].summary_cost_cad));
        setSummaryProfit(Number(result[0].summary_profit_cad));
      } else {
        setTotalCount(0);
        setSummaryRevenue(0);
        setSummaryCost(0);
        setSummaryProfit(0);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, filters, page, sortCol, sortDir, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Apply filters
  const handleApply = () => {
    setFilters({ ...draftFilters });
    setPage(1);
  };

  // Reset filters
  const handleReset = () => {
    setDraftFilters({ ...INITIAL_FILTERS });
    setFilters({ ...INITIAL_FILTERS });
    setPage(1);
    setSortCol("ordered_on");
    setSortDir("desc");
  };

  // Sort
  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("desc");
    }
  };

  // Export CSV
  const handleExport = async () => {
    setExportLoading(true);
    try {
      const { data: exportData, error } = await supabase.rpc("export_project_pl", {
        p_branch_id: filters.branch_id,
        p_status: filters.status,
        p_client_search: filters.client_search || null,
        p_vendor_search: filters.vendor_search || null,
        p_source_lang_id: filters.source_lang_id,
        p_target_lang_id: filters.target_lang_id,
        p_date_from: filters.date_from,
        p_date_to: filters.date_to,
      });
      if (error) {
        toast({ title: "Export failed", description: error.message, variant: "destructive" });
        return;
      }
      if (!exportData || exportData.length === 0) {
        toast({ title: "No data to export", variant: "destructive" });
        return;
      }
      const headers = [
        "Project #",
        "Project Name",
        "Client",
        "Branch",
        "Status",
        "Order Date",
        "Source Lang",
        "Target Lang(s)",
        "Revenue CAD",
        "Cost CAD",
        "Profit/Loss CAD",
        "Margin %",
      ];
      const escapeCSV = (val: any): string => {
        const s = val == null ? "" : String(val);
        if (s.includes(",") || s.includes('"') || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };
      const rows = exportData.map((r: any) =>
        [
          r.project_number,
          r.project_name,
          r.client_name,
          r.branch_name,
          r.project_status,
          r.ordered_on_date,
          r.source_language,
          r.target_languages,
          r.revenue_cad,
          r.cost_cad,
          r.profit_cad,
          r.margin_pct,
        ].map(escapeCSV)
      );
      const csv = [headers.map(escapeCSV), ...rows].map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `project_pl_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "CSV exported successfully" });
    } catch (err: any) {
      toast({ title: "Export error", description: err.message, variant: "destructive" });
    } finally {
      setExportLoading(false);
    }
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const showFrom = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showTo = Math.min(page * PAGE_SIZE, totalCount);

  // Avg margin
  const avgMargin =
    summaryRevenue > 0 ? (summaryProfit / summaryRevenue) * 100 : null;

  // Sortable column header helper
  const SortHeader = ({
    col,
    label,
    align = "left",
  }: {
    col: string;
    label: string;
    align?: "left" | "right";
  }) => (
    <TableHead
      className={`cursor-pointer select-none whitespace-nowrap ${
        align === "right" ? "text-right" : ""
      }`}
      onClick={() => handleSort(col)}
    >
      <div
        className={`inline-flex items-center gap-1 ${
          align === "right" ? "justify-end w-full" : ""
        }`}
      >
        {label}
        {sortCol === col ? (
          sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5" />
          )
        ) : (
          <span className="h-3.5 w-3.5" />
        )}
      </div>
    </TableHead>
  );

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-6 space-y-4">
          {/* Page header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Project P&L</h1>
          </div>

          {/* Section 1: Filter Bar */}
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {/* Date From */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Order Date From
                  </label>
                  <Input
                    type="date"
                    value={draftFilters.date_from || ""}
                    onChange={(e) =>
                      setDraftFilters((f) => ({
                        ...f,
                        date_from: e.target.value || null,
                      }))
                    }
                    className="h-9"
                  />
                </div>
                {/* Date To */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Order Date To
                  </label>
                  <Input
                    type="date"
                    value={draftFilters.date_to || ""}
                    onChange={(e) =>
                      setDraftFilters((f) => ({
                        ...f,
                        date_to: e.target.value || null,
                      }))
                    }
                    className="h-9"
                  />
                </div>
                {/* Branch */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Branch
                  </label>
                  <Select
                    value={draftFilters.branch_id?.toString() || "all"}
                    onValueChange={(v) =>
                      setDraftFilters((f) => ({
                        ...f,
                        branch_id: v === "all" ? null : Number(v),
                      }))
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {branches.map((b) => (
                        <SelectItem key={b.id} value={b.id.toString()}>
                          {b.branch_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Status */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Status
                  </label>
                  <Select
                    value={draftFilters.status || "all"}
                    onValueChange={(v) =>
                      setDraftFilters((f) => ({
                        ...f,
                        status: v === "all" ? null : v,
                      }))
                    }
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="OPEN">Open</SelectItem>
                      <SelectItem value="CLOSED">Closed</SelectItem>
                      <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Client */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Client
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search client..."
                      value={draftFilters.client_search}
                      onChange={(e) =>
                        setDraftFilters((f) => ({
                          ...f,
                          client_search: e.target.value,
                        }))
                      }
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
                {/* Vendor */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Vendor
                  </label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search vendor..."
                      value={draftFilters.vendor_search}
                      onChange={(e) =>
                        setDraftFilters((f) => ({
                          ...f,
                          vendor_search: e.target.value,
                        }))
                      }
                      className="h-9 pl-8"
                    />
                  </div>
                </div>
                {/* Source Language */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Source Language
                  </label>
                  <SearchableLanguageDropdown
                    languages={languages}
                    value={draftFilters.source_lang_id}
                    onChange={(v) =>
                      setDraftFilters((f) => ({ ...f, source_lang_id: v }))
                    }
                    placeholder="All"
                  />
                </div>
                {/* Target Language */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    Target Language
                  </label>
                  <SearchableLanguageDropdown
                    languages={languages}
                    value={draftFilters.target_lang_id}
                    onChange={(v) =>
                      setDraftFilters((f) => ({ ...f, target_lang_id: v }))
                    }
                    placeholder="All"
                  />
                </div>
                {/* Buttons */}
                <div className="flex items-end gap-2">
                  <Button onClick={handleApply} className="h-9">
                    Apply
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="h-9"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Summary Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total Projects</span>
                </div>
                <p className="text-xl font-bold mt-1">
                  {totalCount.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total Revenue</span>
                </div>
                <p className="text-xl font-bold mt-1">
                  {formatCAD(summaryRevenue)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">CAD</span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Total Cost</span>
                </div>
                <p className="text-xl font-bold mt-1">
                  {formatCAD(summaryCost)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">CAD</span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Net Profit / Loss</span>
                </div>
                <p
                  className="text-xl font-bold mt-1"
                  style={{ color: profitColor(summaryProfit) }}
                >
                  {formatCAD(summaryProfit)}{" "}
                  <span className="text-xs font-normal text-muted-foreground">CAD</span>
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Avg Margin</span>
                </div>
                <p
                  className="text-xl font-bold mt-1"
                  style={{ color: avgMargin != null ? profitColor(avgMargin) : "inherit" }}
                >
                  {formatMargin(avgMargin)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Export button + table */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {showFrom}–{showTo} of {totalCount.toLocaleString()} projects
            </p>
            <Button
              variant="outline"
              onClick={handleExport}
              disabled={exportLoading || totalCount === 0}
            >
              {exportLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export CSV
            </Button>
          </div>

          {/* Section 3: Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Project #</TableHead>
                      <TableHead className="whitespace-nowrap">Project Name</TableHead>
                      <TableHead className="whitespace-nowrap">Client</TableHead>
                      <TableHead className="whitespace-nowrap">Branch</TableHead>
                      <TableHead className="whitespace-nowrap">Source Lang</TableHead>
                      <TableHead className="whitespace-nowrap">Target Lang(s)</TableHead>
                      <SortHeader col="ordered_on" label="Order Date" />
                      <TableHead className="whitespace-nowrap text-center">Status</TableHead>
                      <SortHeader col="revenue_cad" label="Revenue (CAD)" align="right" />
                      <SortHeader col="cost_cad" label="Cost (CAD)" align="right" />
                      <SortHeader col="profit_cad" label="Profit / Loss (CAD)" align="right" />
                      <SortHeader col="margin_pct" label="Margin %" align="right" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center py-12 text-muted-foreground">
                          No projects found
                        </TableCell>
                      </TableRow>
                    ) : (
                      data.map((row) => {
                        const hasNoCost = row.has_no_cost;
                        const targetLangs = row.target_languages || "";
                        const truncatedTarget =
                          targetLangs.length > 40
                            ? targetLangs.slice(0, 40) + "..."
                            : targetLangs;
                        const projectName = row.project_name || "";
                        const truncatedName =
                          projectName.length > 50
                            ? projectName.slice(0, 50) + "..."
                            : projectName;

                        return (
                          <Tooltip key={row.project_xtrf_id}>
                            <TooltipTrigger asChild>
                              <TableRow
                                className={
                                  hasNoCost
                                    ? "bg-yellow-50 dark:bg-yellow-950/20 hover:bg-yellow-100 dark:hover:bg-yellow-950/30"
                                    : ""
                                }
                              >
                                <TableCell className="font-mono text-sm whitespace-nowrap">
                                  {row.project_number}
                                </TableCell>
                                <TableCell className="max-w-[200px]">
                                  {truncatedName !== projectName ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="truncate block">{truncatedName}</span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-sm">
                                        {projectName}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span>{projectName}</span>
                                  )}
                                </TableCell>
                                <TableCell>{row.client_name}</TableCell>
                                <TableCell>{row.branch_name}</TableCell>
                                <TableCell>{row.source_language || "—"}</TableCell>
                                <TableCell className="max-w-[200px]">
                                  {truncatedTarget !== targetLangs ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="truncate block">
                                          {truncatedTarget}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="max-w-sm">
                                        {targetLangs}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span>{targetLangs || "—"}</span>
                                  )}
                                </TableCell>
                                <TableCell className="whitespace-nowrap">
                                  {formatOrderDate(row.ordered_on)}
                                </TableCell>
                                <TableCell className="text-center">
                                  <Badge
                                    variant="secondary"
                                    className={
                                      STATUS_CONFIG[row.project_status]?.className || ""
                                    }
                                  >
                                    {STATUS_CONFIG[row.project_status]?.label ||
                                      row.project_status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap font-mono">
                                  {formatCAD(row.revenue_cad)}
                                </TableCell>
                                <TableCell className="text-right whitespace-nowrap font-mono">
                                  {formatCAD(row.cost_cad)}
                                </TableCell>
                                <TableCell
                                  className="text-right whitespace-nowrap font-mono"
                                  style={{ color: profitColor(row.profit_cad) }}
                                >
                                  {formatCAD(row.profit_cad)}
                                </TableCell>
                                <TableCell
                                  className="text-right whitespace-nowrap font-mono"
                                  style={{ color: profitColor(row.margin_pct) }}
                                >
                                  {formatMargin(row.margin_pct)}
                                </TableCell>
                              </TableRow>
                            </TooltipTrigger>
                            {hasNoCost && (
                              <TooltipContent side="top">
                                No vendor cost assigned to this project yet
                              </TooltipContent>
                            )}
                          </Tooltip>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Pagination */}
          {totalCount > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || loading}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
