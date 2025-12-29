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
  const [errorDetails, setErrorDetails] = useState<
    Array<{ name: string; error: string }>
  >([]);

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
    contractor_type: "Contractor",
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
    let headerIndex = lines.findIndex((line) => line.startsWith("Legal Name;"));
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
      const vendors = parseXTRFVendorCSV(csvText);
      setImportProgress((prev) => ({ ...prev, total: vendors.length }));

      let added = 0;
      let updated = 0;
      let errors = 0;
      const errorDetailsList: Array<{ name: string; error: string }> = [];

      // Process one by one to catch individual errors
      for (let i = 0; i < vendors.length; i++) {
        const v = vendors[i];

        try {
          // Parse evaluation safely
          let evaluation = null;
          if (v.overall_evaluation && v.overall_evaluation !== "-") {
            const parsed = parseFloat(v.overall_evaluation);
            if (!isNaN(parsed)) {
              evaluation = parsed;
            }
          }

          const { data, error } = await supabase
            .from("vendors")
            .upsert(
              {
                legal_name: v.legal_name,
                status: v.status || "Active",
                overall_evaluation: evaluation,
                availability: v.availability || null,
                language_combinations: v.language_combinations || null,
                country: v.country || null,
                city: v.city || null,
                email: v.email || null,
                email_3: v.email_3 || null,
                phone: v.phone || null,
                phone_2: v.phone_2 || null,
                phone_3: v.phone_3 || null,
                last_synced_at: new Date().toISOString(),
                is_active: v.status === "Active",
              },
              {
                onConflict: "legal_name",
              },
            )
            .select();

          if (error) {
            errors++;
            errorDetailsList.push({ name: v.legal_name, error: error.message });
            console.error(`Error importing ${v.legal_name}:`, error);
          } else {
            updated++;
          }
        } catch (err: any) {
          errors++;
          errorDetailsList.push({ name: v.legal_name, error: err.message });
          console.error(`Exception importing ${v.legal_name}:`, err);
        }

        setImportProgress((prev) => ({
          ...prev,
          current: i + 1,
          added,
          updated,
          errors,
        }));
      }

      // Log error details for debugging
      if (errorDetailsList.length > 0) {
        console.log("Import errors:", errorDetailsList);
      }

      // Mark missing as inactive if option selected
      if (importOptions.markMissing) {
        const importedNames = vendors.map((v) => v.legal_name).filter(Boolean);
        await supabase
          .from("vendors")
          .update({ is_active: false, status: "Inactive" })
          .not("legal_name", "in", `(${importedNames.join(",")})`);
      }

      setImportComplete(true);
      setErrorDetails(errorDetailsList); // Store for display
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

      {/* Import CSV Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Vendors from XTRF</DialogTitle>
          </DialogHeader>

          {!importing && !importComplete && (
            <>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload your XTRF vendor export CSV file.
                </p>

                <div
                  className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary transition-colors cursor-pointer"
                  onClick={() => document.getElementById("csv-upload")?.click()}
                >
                  <FileTextIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm font-medium mb-1">
                    Drag & drop your CSV file here
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Accepts: .csv files from XTRF
                  </p>
                  <input
                    id="csv-upload"
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setCsvFile(file);
                    }}
                  />
                </div>

                {csvFile && (
                  <Card className="bg-muted/50">
                    <CardContent className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium">
                          {csvFile.name}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setCsvFile(null)}
                      >
                        Remove
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-3">
                  <p className="text-sm font-medium">Import Options:</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="update-existing"
                        checked={importOptions.updateExisting}
                        onCheckedChange={(checked) =>
                          setImportOptions((prev) => ({
                            ...prev,
                            updateExisting: checked === true,
                          }))
                        }
                      />
                      <Label htmlFor="update-existing" className="text-sm">
                        Update existing vendors (match by Legal Name)
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="add-new"
                        checked={importOptions.addNew}
                        onCheckedChange={(checked) =>
                          setImportOptions((prev) => ({
                            ...prev,
                            addNew: checked === true,
                          }))
                        }
                      />
                      <Label htmlFor="add-new" className="text-sm">
                        Add new vendors
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="mark-missing"
                        checked={importOptions.markMissing}
                        onCheckedChange={(checked) =>
                          setImportOptions((prev) => ({
                            ...prev,
                            markMissing: checked === true,
                          }))
                        }
                      />
                      <Label htmlFor="mark-missing" className="text-sm">
                        Mark missing vendors as inactive
                      </Label>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowImportModal(false);
                    setCsvFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={!csvFile}>
                  Import Vendors
                </Button>
              </DialogFooter>
            </>
          )}

          {importing && (
            <div className="py-6 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Processing...</span>
                  <span>
                    {importProgress.current} / {importProgress.total}
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full transition-all duration-300"
                    style={{
                      width: `${(importProgress.current / importProgress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>

              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Added: {importProgress.added}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span>Updated: {importProgress.updated}</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <span>Errors: {importProgress.errors}</span>
                </div>
              </div>
            </div>
          )}

          {importComplete && (
            <>
              <div className="py-8 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-4">
                  <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Import Complete</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Successfully imported vendors!
                </p>
                <div className="space-y-1 text-sm">
                  <p>Added: {importProgress.added} new vendors</p>
                  <p>Updated: {importProgress.updated} existing vendors</p>
                  {importProgress.errors > 0 && (
                    <p className="text-destructive">
                      Errors: {importProgress.errors}
                    </p>
                  )}
                </div>

                {errorDetails && errorDetails.length > 0 && (
                  <div className="mt-4">
                    <details className="text-sm">
                      <summary className="cursor-pointer text-red-600 font-medium hover:underline">
                        View {errorDetails.length} errors
                      </summary>
                      <div className="mt-2 max-h-40 overflow-y-auto bg-red-50 dark:bg-red-950 p-2 rounded text-left">
                        {errorDetails.slice(0, 10).map((err, i) => (
                          <div key={i} className="text-xs mb-1">
                            <span className="font-medium">{err.name}:</span>{" "}
                            {err.error}
                          </div>
                        ))}
                        {errorDetails.length > 10 && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                            ... and {errorDetails.length - 10} more
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportComplete(false);
                    setCsvFile(null);
                    setErrorDetails([]);
                    setImportProgress({
                      current: 0,
                      total: 0,
                      added: 0,
                      updated: 0,
                      errors: 0,
                    });
                  }}
                >
                  Done
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Vendor Modal */}
      <Dialog
        open={showAddModal || showEditModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddModal(false);
            setShowEditModal(false);
            setSelectedVendor(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {showEditModal ? "Edit Vendor" : "Add New Vendor"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {showEditModal && selectedVendor && (
              <div className="flex items-center justify-between pb-4 border-b">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1"
                  >
                    <span>{statusConfig[selectedVendor.status]?.emoji}</span>
                    {selectedVendor.status}
                  </Badge>
                  {selectedVendor.is_preferred && (
                    <Badge
                      variant="secondary"
                      className="flex items-center gap-1"
                    >
                      <Award className="h-3 w-3" />
                      Preferred
                    </Badge>
                  )}
                </div>
                {selectedVendor.overall_evaluation && (
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span className="font-medium">
                      {selectedVendor.overall_evaluation.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Basic Information</h3>

              <div className="space-y-2">
                <Label htmlFor="legal-name">
                  Legal Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="legal-name"
                  value={formData.legal_name}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      legal_name: e.target.value,
                    }))
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={formData.country || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        country: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={formData.city || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, city: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: Vendor["status"]) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold">Contact Information</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email-3">Email 2</Label>
                  <Input
                    id="email-3"
                    type="email"
                    value={formData.email_3 || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        email_3: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone-2">Phone 2</Label>
                  <Input
                    id="phone-2"
                    value={formData.phone_2 || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        phone_2: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>

            {/* Financial Settings */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold">Financial Settings</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 h-10">
                    <Checkbox
                      id="gst-registered"
                      checked={formData.gst_registered}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          gst_registered: checked === true,
                        }))
                      }
                    />
                    <Label htmlFor="gst-registered">GST Registered</Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gst-rate">GST Rate (%)</Label>
                  <Input
                    id="gst-rate"
                    type="number"
                    step="0.01"
                    value={formData.gst_rate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        gst_rate: parseFloat(e.target.value),
                      }))
                    }
                    disabled={!formData.gst_registered}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gst-number">GST Number</Label>
                <Input
                  id="gst-number"
                  value={formData.gst_number || ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      gst_number: e.target.value,
                    }))
                  }
                  disabled={!formData.gst_registered}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value: Vendor["category"]) =>
                      setFormData((prev) => ({ ...prev, category: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="payment-terms">Payment Terms</Label>
                  <Select
                    value={formData.payment_terms}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, payment_terms: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTermsOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Preferred Currency</Label>
                <Select
                  value={formData.preferred_currency}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      preferred_currency: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="preferred"
                  checked={formData.is_preferred}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      is_preferred: checked === true,
                    }))
                  }
                />
                <Label htmlFor="preferred">Preferred Vendor</Label>
              </div>
            </div>

            {/* Language Pairs (Read-only from XTRF) */}
            {showEditModal && selectedVendor?.language_combinations && (
              <div className="space-y-2 pt-4 border-t">
                <Label>Language Pairs (from XTRF)</Label>
                <p className="text-sm text-muted-foreground">
                  {selectedVendor.language_combinations}
                </p>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={3}
              />
            </div>

            {showEditModal && selectedVendor?.last_synced_at && (
              <p className="text-xs text-muted-foreground pt-4 border-t">
                Last synced from XTRF:{" "}
                {new Date(selectedVendor.last_synced_at).toLocaleString()}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setShowEditModal(false);
                setSelectedVendor(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={showEditModal ? handleEditVendor : handleAddVendor}
            >
              {showEditModal ? "Save Changes" : "Add Vendor"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Vendor</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{selectedVendor?.legal_name}</span>?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setSelectedVendor(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteVendor}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
