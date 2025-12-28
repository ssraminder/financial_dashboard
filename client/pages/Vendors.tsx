import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import type { Vendor } from "@/types";
import {
  Package,
  Upload,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  FileText as FileTextIcon,
  Check,
  AlertCircle,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Star,
  CheckCircle,
  XCircle,
  Award,
} from "lucide-react";

const PAGE_SIZE = 20;

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

const categoryOptions = [
  { value: "Contractor", label: "Contractor" },
  { value: "Agency", label: "Agency" },
  { value: "Freelancer", label: "Freelancer" },
  { value: "Employee", label: "Employee" },
];

const paymentTermsOptions = [
  { value: "Due on Receipt", label: "Due on Receipt" },
  { value: "Net 15", label: "Net 15" },
  { value: "Net 30", label: "Net 30" },
  { value: "Net 60", label: "Net 60" },
];

const statusConfig = {
  Active: { color: "bg-green-500", emoji: "🟢" },
  Inactive: { color: "bg-red-500", emoji: "🔴" },
};

export default function Vendors() {
  const { toast } = useToast();

  // State
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [countryFilter, setCountryFilter] = useState("all");
  const [countries, setCountries] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  // CSV Import state
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
    added: 0,
    updated: 0,
    errors: 0,
  });
  const [importComplete, setImportComplete] = useState(false);
  const [importOptions, setImportOptions] = useState({
    updateExisting: true,
    addNew: true,
    markMissing: false,
  });

  // Form state
  const [formData, setFormData] = useState<Partial<Vendor>>({
    legal_name: "",
    email: "",
    phone: "",
    country: "",
    city: "",
    status: "Active",
    gst_registered: false,
    gst_rate: 5.0,
    category: "Contractor",
    payment_terms: "Net 30",
    preferred_currency: "CAD",
    is_preferred: false,
    notes: "",
  });

  // Fetch unique countries for filter
  const fetchCountries = async () => {
    const { data } = await supabase
      .from("vendors")
      .select("country")
      .not("country", "is", null)
      .order("country");

    const uniqueCountries = [
      ...new Set(data?.map((v) => v.country).filter(Boolean)),
    ] as string[];
    setCountries(uniqueCountries);
  };

  // Fetch vendors
  const fetchVendors = async (
    page = 1,
    search = "",
    statusFilterValue = "all",
    countryFilterValue = "all",
  ) => {
    setLoading(true);
    try {
      let query = supabase
        .from("vendors")
        .select("*", { count: "exact" })
        .order("legal_name", { ascending: true });

      // Search filter
      if (search) {
        query = query.or(
          `legal_name.ilike.%${search}%,email.ilike.%${search}%,city.ilike.%${search}%`,
        );
      }

      // Status filter
      if (statusFilterValue !== "all") {
        query = query.eq("status", statusFilterValue);
      }

      // Country filter
      if (countryFilterValue !== "all") {
        query = query.eq("country", countryFilterValue);
      }

      query = query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      const { data, error, count } = await query;

      if (error) {
        console.error("Error fetching vendors:", error);
        toast({
          title: "Error",
          description: "Failed to load vendors",
          variant: "destructive",
        });
        return;
      }

      setVendors(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch countries on mount
  useEffect(() => {
    fetchCountries();
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchVendors(1, searchTerm, statusFilter, countryFilter);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, countryFilter]);

  // Initial load and page changes
  useEffect(() => {
    fetchVendors(currentPage, searchTerm, statusFilter, countryFilter);
  }, [currentPage]);

  // CSV parsing for XTRF format
  const parseXTRFVendorCSV = (csvText: string) => {
    const lines = csvText.split("\n");

    // Find header line
    let headerIndex = lines.findIndex((line) =>
      line.startsWith("Legal Name;"),
    );
    if (headerIndex === -1) {
      throw new Error("Invalid CSV format: Could not find header row");
    }

    const dataLines = lines
      .slice(headerIndex + 1)
      .filter((line) => line.trim());

    // XTRF column order (semicolon-delimited)
    const parsedVendors = dataLines
      .map((line) => {
        const cols = line.split(";");
        return {
          legal_name: cols[0]?.trim(),
          status: cols[1]?.trim() || "Active",
          overall_evaluation: cols[2]?.trim() || null,
          availability: cols[3]?.trim() || null,
          language_combinations: cols[4]?.trim() || null,
          country: cols[5]?.trim() || null,
          city: cols[6]?.trim() || null,
          email: cols[7]?.trim() || null,
          email_3: cols[8]?.trim() || null,
          phone: cols[9]?.trim() || null,
          phone_2: cols[10]?.trim() || null,
          phone_3: cols[11]?.trim() || null,
        };
      })
      .filter((v) => v.legal_name);

    return parsedVendors;
  };

  // Handle CSV import
  const handleImport = async () => {
    if (!csvFile) return;

    setImporting(true);
    setImportProgress({
      current: 0,
      total: 0,
      added: 0,
      updated: 0,
      errors: 0,
    });

    try {
      const csvText = await csvFile.text();
      const parsedVendors = parseXTRFVendorCSV(csvText);
      setImportProgress((prev) => ({ ...prev, total: parsedVendors.length }));

      let added = 0;
      let updated = 0;
      let errors = 0;

      // Process in batches of 50
      const BATCH_SIZE = 50;
      for (let i = 0; i < parsedVendors.length; i += BATCH_SIZE) {
        const batch = parsedVendors.slice(i, i + BATCH_SIZE);

        const { data, error } = await supabase
          .from("vendors")
          .upsert(
            batch.map((v) => ({
              legal_name: v.legal_name,
              status: v.status,
              overall_evaluation:
                v.overall_evaluation === "-"
                  ? null
                  : parseFloat(v.overall_evaluation || "0") || null,
              availability: v.availability,
              language_combinations: v.language_combinations,
              country: v.country,
              city: v.city,
              email: v.email,
              email_3: v.email_3,
              phone: v.phone,
              phone_2: v.phone_2,
              phone_3: v.phone_3,
              last_synced_at: new Date().toISOString(),
              is_active: v.status === "Active",
            })),
            {
              onConflict: "legal_name",
              ignoreDuplicates: false,
            },
          )
          .select();

        if (error) {
          console.error("Batch error:", error);
          errors += batch.length;
        } else {
          updated += data.length;
        }

        setImportProgress((prev) => ({
          ...prev,
          current: Math.min(i + BATCH_SIZE, parsedVendors.length),
          added,
          updated,
          errors,
        }));
      }

      // Mark missing as inactive if option selected
      if (importOptions.markMissing) {
        const importedNames = parsedVendors
          .map((v) => v.legal_name)
          .filter(Boolean);
        await supabase
          .from("vendors")
          .update({ is_active: false, status: "Inactive" })
          .not("legal_name", "in", `(${importedNames.join(",")})`);
      }

      setImportComplete(true);
      toast({
        title: "Import Complete",
        description: `Successfully imported ${updated} vendors`,
      });
      fetchCountries();
      fetchVendors(currentPage, searchTerm, statusFilter, countryFilter);
    } catch (err: any) {
      console.error("Import error:", err);
      toast({
        title: "Import Failed",
        description: err.message || "An error occurred during import",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  // Handle add vendor
  const handleAddVendor = async () => {
    if (!formData.legal_name) {
      toast({
        title: "Error",
        description: "Legal Name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("vendors").insert({
        ...formData,
        is_active: formData.status === "Active",
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Vendor added successfully",
      });

      setShowAddModal(false);
      resetForm();
      fetchVendors(currentPage, searchTerm, statusFilter, countryFilter);
    } catch (err: any) {
      console.error("Add error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to add vendor",
        variant: "destructive",
      });
    }
  };

  // Handle edit vendor
  const handleEditVendor = async () => {
    if (!selectedVendor || !formData.legal_name) {
      toast({
        title: "Error",
        description: "Legal Name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("vendors")
        .update({
          ...formData,
          is_active: formData.status === "Active",
        })
        .eq("id", selectedVendor.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Vendor updated successfully",
      });

      setShowEditModal(false);
      setSelectedVendor(null);
      resetForm();
      fetchVendors(currentPage, searchTerm, statusFilter, countryFilter);
    } catch (err: any) {
      console.error("Update error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to update vendor",
        variant: "destructive",
      });
    }
  };

  // Handle delete vendor
  const handleDeleteVendor = async () => {
    if (!selectedVendor) return;

    try {
      const { error } = await supabase
        .from("vendors")
        .delete()
        .eq("id", selectedVendor.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Vendor deleted successfully",
      });

      setShowDeleteDialog(false);
      setSelectedVendor(null);
      fetchVendors(currentPage, searchTerm, statusFilter, countryFilter);
    } catch (err: any) {
      console.error("Delete error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to delete vendor",
        variant: "destructive",
      });
    }
  };

  // Toggle preferred vendor
  const togglePreferred = async (vendor: Vendor) => {
    try {
      const { error } = await supabase
        .from("vendors")
        .update({ is_preferred: !vendor.is_preferred })
        .eq("id", vendor.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: vendor.is_preferred
          ? "Removed from preferred vendors"
          : "Added to preferred vendors",
      });

      fetchVendors(currentPage, searchTerm, statusFilter, countryFilter);
    } catch (err: any) {
      console.error("Toggle preferred error:", err);
      toast({
        title: "Error",
        description: "Failed to update vendor",
        variant: "destructive",
      });
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      legal_name: "",
      email: "",
      phone: "",
      country: "",
      city: "",
      status: "Active",
      gst_registered: false,
      gst_rate: 5.0,
      category: "Contractor",
      payment_terms: "Net 30",
      preferred_currency: "CAD",
      is_preferred: false,
      notes: "",
    });
  };

  // Open edit modal
  const openEditModal = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setFormData(vendor);
    setShowEditModal(true);
  };

  // Calculate pagination
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const startIndex = (currentPage - 1) * PAGE_SIZE + 1;
  const endIndex = Math.min(currentPage * PAGE_SIZE, totalCount);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-6 max-w-7xl">
          {/* Header */}
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <Package className="h-8 w-8" />
                Vendors
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your vendor database
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowImportModal(true)}
                variant="outline"
              >
                <Upload className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Vendor
              </Button>
            </div>
          </div>

          {/* Search and Filters */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search vendors..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={countryFilter}
                  onValueChange={(value) => {
                    setCountryFilter(value);
                    setCurrentPage(1);
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {countries.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="mb-4">
            <CardContent className="py-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {totalCount === 0 ? 0 : startIndex} - {endIndex} of{" "}
                {totalCount} vendors
              </span>
              {vendors.some((v) => v.last_synced_at) && (
                <span className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Last sync:{" "}
                  {new Date(
                    vendors.find((v) => v.last_synced_at)!.last_synced_at!,
                  ).toLocaleDateString()}
                </span>
              )}
            </CardContent>
          </Card>

          {/* Table */}
          {loading ? (
            <Card>
              <CardContent className="py-8 text-center">
                <RefreshCw className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="mt-2 text-muted-foreground">Loading vendors...</p>
              </CardContent>
            </Card>
          ) : vendors.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No vendors yet</h3>
                <p className="text-muted-foreground mb-6">
                  Import your vendors from XTRF or add them manually.
                </p>
                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={() => setShowImportModal(true)}
                    variant="outline"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Import CSV
                  </Button>
                  <Button onClick={() => setShowAddModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Vendor
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b bg-muted/50">
                      <tr>
                        <th className="text-left p-4 font-medium">Name</th>
                        <th className="text-left p-4 font-medium">Country</th>
                        <th className="text-left p-4 font-medium">Email</th>
                        <th className="text-left p-4 font-medium">Rating</th>
                        <th className="text-left p-4 font-medium">GST</th>
                        <th className="text-right p-4 font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendors.map((vendor) => (
                        <tr
                          key={vendor.id}
                          className="border-b hover:bg-muted/50 cursor-pointer"
                          onClick={() => openEditModal(vendor)}
                        >
                          <td className="p-4 font-medium">
                            <div className="flex items-center gap-2">
                              {vendor.legal_name}
                              {vendor.is_preferred && (
                                <Award className="h-4 w-4 text-amber-500" />
                              )}
                            </div>
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {vendor.country || "—"}
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {vendor.email ? (
                              <span className="truncate max-w-xs inline-block">
                                {vendor.email.length > 20
                                  ? `${vendor.email.substring(0, 20)}...`
                                  : vendor.email}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-4">
                            {vendor.overall_evaluation ? (
                              <span className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                                {vendor.overall_evaluation.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-4">
                            {vendor.gst_registered ? (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                {vendor.gst_rate}%
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <XCircle className="h-4 w-4" />
                              </span>
                            )}
                          </td>
                          <td
                            className="p-4 text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => openEditModal(vendor)}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => togglePreferred(vendor)}
                                >
                                  <Award className="h-4 w-4 mr-2" />
                                  {vendor.is_preferred
                                    ? "Remove Preferred"
                                    : "Mark as Preferred"}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedVendor(vendor);
                                    setShowDeleteDialog(true);
                                  }}
                                  className="text-destructive"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Import CSV Modal - Continuing in next part due to length */}
      {/* ... rest of modals ... */}
    </div>
  );
}
