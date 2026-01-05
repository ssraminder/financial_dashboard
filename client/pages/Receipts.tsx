import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Sidebar } from "@/components/Sidebar";
import { ReceiptDetailModal } from "@/components/ReceiptDetailModal";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Search,
  Receipt,
  CheckCircle,
  AlertCircle,
  Clock,
  Copy,
  MinusCircle,
  Link as LinkIcon,
  MoreVertical,
  X,
  Upload,
  Loader2,
} from "lucide-react";

interface ReceiptData {
  id: string;
  file_path: string;
  file_name: string;
  vendor_name: string | null;
  vendor_gst_number: string | null;
  receipt_date: string | null;
  total_amount: number | null;
  subtotal: number | null;
  gst_amount: number;
  pst_amount: number;
  hst_amount: number;
  tip_amount: number;
  currency: string;
  status:
    | "pending"
    | "matched"
    | "unmatched"
    | "manual"
    | "duplicate"
    | "no_match_expected"
    | "error";
  needs_review: boolean;
  review_reason: string | null;
  matched_transaction_id: string | null;
  match_confidence: number | null;
  ai_confidence_score: number | null;
  company_id: string;
  created_at: string;
  companies?: { name: string };
  transactions?: {
    id: string;
    description: string;
    total_amount: number;
    transaction_date: string;
  };
}

interface Filters {
  search: string;
  companyId: string;
  status: string;
  dateFrom: string;
  dateTo: string;
}

interface Company {
  id: string;
  name: string;
}

interface Stats {
  total: number;
  pending: number;
  matched: number;
  needsReview: number;
}

const PAGE_SIZE = 20;

export default function Receipts() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [receipts, setReceipts] = useState<ReceiptData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    search: "",
    companyId: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptData | null>(
    null,
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    pending: 0,
    matched: 0,
    needsReview: 0,
  });
  const [companies, setCompanies] = useState<Company[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const fetchCompanies = async () => {
      const { data } = await supabase
        .from("companies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");

      setCompanies(data || []);
    };
    fetchCompanies();
  }, []);

  const fetchStats = async () => {
    try {
      // Get counts for each status
      const { data: allReceipts } = await supabase
        .from("receipts")
        .select("id, status, needs_review");

      if (allReceipts) {
        const totals = allReceipts.reduce(
          (acc, r) => ({
            total: acc.total + 1,
            pending:
              acc.pending +
              (r.status === "pending" || r.status === "unmatched" ? 1 : 0),
            matched: acc.matched + (r.status === "matched" ? 1 : 0),
            needsReview: acc.needsReview + (r.needs_review ? 1 : 0),
          }),
          { total: 0, pending: 0, matched: 0, needsReview: 0 },
        );

        setStats(totals);
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchReceipts = async () => {
    setLoading(true);

    try {
      let query = supabase
        .from("receipts")
        .select(
          `
          *,
          companies(name),
          transactions(id, description, total_amount, transaction_date)
        `,
          { count: "exact" },
        )
        .order("created_at", { ascending: false })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      // Apply filters
      if (filters.search) {
        query = query.ilike("vendor_name", `%${filters.search}%`);
      }
      if (filters.companyId) {
        query = query.eq("company_id", filters.companyId);
      }
      if (filters.status) {
        if (filters.status === "needs_review") {
          query = query.eq("needs_review", true);
        } else {
          query = query.eq("status", filters.status);
        }
      }
      if (filters.dateFrom) {
        query = query.gte("receipt_date", filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte("receipt_date", filters.dateTo);
      }

      const { data, count, error } = await query;

      if (error) throw error;

      setReceipts(data || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching receipts:", error);
      toast.error("Failed to load receipts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceipts();
  }, [page, filters]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleBulkDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete ${selectedIds.size} receipt(s)? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("receipts")
        .delete()
        .in("id", Array.from(selectedIds));

      if (error) throw error;

      toast.success(`${selectedIds.size} receipt(s) deleted`);
      setSelectedIds(new Set());
      fetchReceipts();
      fetchStats();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete receipts");
    }
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      companyId: "",
      status: "",
      dateFrom: "",
      dateTo: "",
    });
    setPage(1);
  };

  const hasActiveFilters =
    filters.search ||
    filters.companyId ||
    filters.status ||
    filters.dateFrom ||
    filters.dateTo;

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleOpenReceipt = (receipt: ReceiptData) => {
    setSelectedReceipt(receipt);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedReceipt(null), 300); // Delay clearing to allow animation
  };

  const handleReceiptUpdate = (updatedReceipt: ReceiptData) => {
    // Refresh the list
    fetchReceipts();
    fetchStats();
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
        <div className="p-8">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Receipt className="h-8 w-8" />
                Receipts
              </h1>
              <p className="text-muted-foreground mt-1">
                View and manage all uploaded receipts
              </p>
            </div>
            <Button
              onClick={() => navigate("/receipts/upload")}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Receipts
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <button
              onClick={() => {
                setFilters((f) => ({ ...f, status: "" }));
                setPage(1);
              }}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                !filters.status
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <p className="text-sm text-gray-600">All Receipts</p>
              <p
                className={`text-2xl font-bold ${
                  !filters.status ? "text-blue-600" : "text-gray-900"
                }`}
              >
                {stats.total.toLocaleString()}
              </p>
            </button>

            <button
              onClick={() => {
                setFilters((f) => ({ ...f, status: "pending" }));
                setPage(1);
              }}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                filters.status === "pending"
                  ? "border-yellow-500 bg-yellow-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <p className="text-sm text-gray-600">Pending</p>
              <p
                className={`text-2xl font-bold ${
                  filters.status === "pending"
                    ? "text-yellow-600"
                    : "text-gray-900"
                }`}
              >
                {stats.pending.toLocaleString()}
              </p>
            </button>

            <button
              onClick={() => {
                setFilters((f) => ({ ...f, status: "matched" }));
                setPage(1);
              }}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                filters.status === "matched"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <p className="text-sm text-gray-600">Matched</p>
              <p
                className={`text-2xl font-bold ${
                  filters.status === "matched"
                    ? "text-green-600"
                    : "text-gray-900"
                }`}
              >
                {stats.matched.toLocaleString()}
              </p>
            </button>

            <button
              onClick={() => {
                setFilters((f) => ({ ...f, status: "needs_review" }));
                setPage(1);
              }}
              className={`p-4 rounded-lg border-2 transition-all text-left ${
                filters.status === "needs_review"
                  ? "border-orange-500 bg-orange-50"
                  : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <p className="text-sm text-gray-600">Needs Review</p>
              <p
                className={`text-2xl font-bold ${
                  filters.status === "needs_review"
                    ? "text-orange-600"
                    : "text-gray-900"
                }`}
              >
                {stats.needsReview.toLocaleString()}
              </p>
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search vendor..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, search: e.target.value }))
                  }
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {/* Company */}
            <select
              value={filters.companyId}
              onChange={(e) =>
                setFilters((f) => ({ ...f, companyId: e.target.value }))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Date Range */}
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateFrom: e.target.value }))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="From"
            />
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) =>
                setFilters((f) => ({ ...f, dateTo: e.target.value }))
              }
              className="px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="To"
            />

            {/* Clear Filters */}
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-3 py-2 text-gray-600 hover:text-gray-800"
              >
                Clear
              </button>
            )}
          </div>

          {/* Receipt Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={
                            selectedIds.size === receipts.length &&
                            receipts.length > 0
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedIds(
                                new Set(receipts.map((r) => r.id)),
                              );
                            } else {
                              setSelectedIds(new Set());
                            }
                          }}
                          className="rounded"
                        />
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">
                        Vendor
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                        Amount
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                        Status
                      </th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">
                        Matched
                      </th>
                      <th className="w-10 px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                        </td>
                      </tr>
                    ) : receipts.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center">
                          <Receipt className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                          <p className="text-gray-500">No receipts found</p>
                        </td>
                      </tr>
                    ) : (
                      receipts.map((receipt) => (
                        <ReceiptRow
                          key={receipt.id}
                          receipt={receipt}
                          selected={selectedIds.has(receipt.id)}
                          onSelect={(selected) => {
                            const newIds = new Set(selectedIds);
                            if (selected) {
                              newIds.add(receipt.id);
                            } else {
                              newIds.delete(receipt.id);
                            }
                            setSelectedIds(newIds);
                          }}
                          onClick={() => handleOpenReceipt(receipt)}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!loading && receipts.length > 0 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <p className="text-sm text-gray-600">
                    Showing {(page - 1) * PAGE_SIZE + 1} -{" "}
                    {Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
                  </p>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>

                    <span className="text-sm text-gray-600">
                      Page {page} of {totalPages}
                    </span>

                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bulk Actions Bar */}
          {selectedIds.size > 0 && (
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-4 z-50">
              <span>{selectedIds.size} selected</span>

              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 bg-red-600 rounded-full hover:bg-red-700"
              >
                Delete
              </button>

              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1 hover:bg-gray-700 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Detail Modal */}
      <ReceiptDetailModal
        receipt={selectedReceipt}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onUpdate={handleReceiptUpdate}
      />
    </div>
  );
}

// Receipt Row Component
function ReceiptRow({
  receipt,
  selected,
  onSelect,
  onClick,
}: {
  receipt: ReceiptData;
  selected: boolean;
  onSelect: (selected: boolean) => void;
  onClick: () => void;
}) {
  const getStatusBadge = (receipt: ReceiptData) => {
    if (receipt.needs_review) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs">
          <AlertCircle className="w-3 h-3" />
          Review
        </span>
      );
    }

    switch (receipt.status) {
      case "matched":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">
            <CheckCircle className="w-3 h-3" />
            Matched
          </span>
        );
      case "pending":
      case "unmatched":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case "duplicate":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs">
            <Copy className="w-3 h-3" />
            Duplicate
          </span>
        );
      case "no_match_expected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
            <MinusCircle className="w-3 h-3" />
            No Match
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs">
            {receipt.status}
          </span>
        );
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatAmount = (amount: number | null) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(amount);
  };

  return (
    <tr
      className={`hover:bg-gray-50 cursor-pointer ${selected ? "bg-blue-50" : ""}`}
      onClick={onClick}
    >
      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(e.target.checked)}
          className="rounded"
        />
      </td>
      <td className="px-4 py-3 text-sm text-gray-900">
        {formatDate(receipt.receipt_date)}
      </td>
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-gray-900">
          {receipt.vendor_name || "Unknown Vendor"}
        </p>
        {receipt.vendor_gst_number && (
          <p className="text-xs text-gray-500">
            GST: {receipt.vendor_gst_number}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <p className="text-sm font-medium text-gray-900">
          {formatAmount(receipt.total_amount)}
        </p>
        {(receipt.gst_amount > 0 || receipt.hst_amount > 0) && (
          <p className="text-xs text-gray-500">
            {receipt.hst_amount > 0
              ? `HST: ${formatAmount(receipt.hst_amount)}`
              : `GST: ${formatAmount(receipt.gst_amount)}`}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-center">{getStatusBadge(receipt)}</td>
      <td className="px-4 py-3 text-center">
        {receipt.matched_transaction_id ? (
          <span className="inline-flex items-center gap-1 text-green-600 text-sm">
            <LinkIcon className="w-4 h-4" />
            Linked
          </span>
        ) : receipt.needs_review &&
          receipt.review_reason?.includes("matches") ? (
          <span className="text-orange-600 text-sm">
            {receipt.review_reason}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        <button className="p-1 hover:bg-gray-100 rounded">
          <MoreVertical className="w-4 h-4 text-gray-400" />
        </button>
      </td>
    </tr>
  );
}
