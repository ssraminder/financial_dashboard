import { useState, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuth } from "@/hooks/useAuth";
import type { Client } from "@/types";
import {
  Users,
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
} from "lucide-react";

const PAGE_SIZE = 20;

const statusOptions = [
  { value: "all", label: "All Statuses" },
  { value: "Active", label: "Active" },
  { value: "Potential", label: "Potential" },
  { value: "Inactive", label: "Inactive" },
];

const statusConfig = {
  Active: { color: "bg-green-500", emoji: "🟢" },
  Potential: { color: "bg-yellow-500", emoji: "🟡" },
  Inactive: { color: "bg-red-500", emoji: "🔴" },
};

export default function Clients() {
  const { user } = useAuth();
  const { toast } = useToast();

  // State
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

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
  const [formData, setFormData] = useState<Partial<Client>>({
    name: "",
    email: "",
    phone: "",
    country: "",
    province: "",
    status: "Active",
    gst_rate: 5.0,
    gst_exempt: false,
    preferred_currency: "CAD",
    payment_terms: "Net 30",
    client_type: "Individual",
    is_recurring: false,
    notes: "",
  });

  // Fetch clients
  const fetchClients = async (
    page = 1,
    search = "",
    statusFilterValue = "all",
  ) => {
    if (!user) return;

    setLoading(true);
    try {
      let query = supabase
        .from("clients")
        .select("*", { count: "exact" })
        .eq("user_id", user.id)
        .order("name", { ascending: true })
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

      // Search filter
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,email.ilike.%${search}%,xtrf_id.ilike.%${search}%`,
        );
      }

      // Status filter
      if (statusFilterValue !== "all") {
        query = query.eq("status", statusFilterValue);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("Error fetching clients:", error);
        toast({
          title: "Error",
          description: "Failed to load clients",
          variant: "destructive",
        });
        return;
      }

      setClients(data || []);
      setTotalCount(count || 0);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchClients(1, searchTerm, statusFilter);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, statusFilter, user]);

  // Initial load and page changes
  useEffect(() => {
    fetchClients(currentPage, searchTerm, statusFilter);
  }, [currentPage]);

  // CSV parsing
  const parseXTRFClientCSV = (csvText: string) => {
    const lines = csvText.split("\n");

    // Find header line
    let headerIndex = lines.findIndex((line) => line.startsWith("ID;Name;"));
    if (headerIndex === -1) {
      throw new Error("Invalid CSV format: Could not find header row");
    }

    const headers = lines[headerIndex].split(";");
    const dataLines = lines
      .slice(headerIndex + 1)
      .filter((line) => line.trim());

    // Map column indexes
    const colMap = {
      id: headers.findIndex((h) => h === "ID"),
      name: headers.findIndex((h) => h === "Name"),
      status: headers.findIndex((h) => h === "Status"),
      country: headers.findIndex((h) => h.includes("Country")),
      phone: headers.findIndex((h) => h.includes("Phone")),
      email: headers.findIndex((h) => h.includes("E-mail")),
    };

    // Parse each row
    const parsedClients = dataLines
      .map((line) => {
        const cols = line.split(";");
        return {
          xtrf_id: cols[colMap.id]?.trim(),
          name: cols[colMap.name]?.trim(),
          status: (cols[colMap.status]?.trim() || "Active") as Client["status"],
          country: cols[colMap.country]?.trim() || null,
          phone: cols[colMap.phone]?.trim() || null,
          email: cols[colMap.email]?.trim() || null,
        };
      })
      .filter((c) => c.xtrf_id && c.name);

    return parsedClients;
  };

  // Handle CSV import
  const handleImport = async () => {
    if (!csvFile || !user) return;

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
      const parsedClients = parseXTRFClientCSV(csvText);
      setImportProgress((prev) => ({ ...prev, total: parsedClients.length }));

      let added = 0;
      let updated = 0;
      let errors = 0;

      // Process in batches of 50
      const BATCH_SIZE = 50;
      for (let i = 0; i < parsedClients.length; i += BATCH_SIZE) {
        const batch = parsedClients.slice(i, i + BATCH_SIZE);

        const { data, error } = await supabase
          .from("clients")
          .upsert(
            batch.map((c) => ({
              user_id: user.id,
              xtrf_id: c.xtrf_id,
              name: c.name,
              status: c.status,
              country: c.country,
              phone: c.phone,
              email: c.email,
              last_synced_at: new Date().toISOString(),
              is_active: c.status === "Active",
            })),
            {
              onConflict: "xtrf_id",
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
          current: Math.min(i + BATCH_SIZE, parsedClients.length),
          added,
          updated,
          errors,
        }));
      }

      // Mark missing as inactive if option selected
      if (importOptions.markMissing) {
        const importedIds = parsedClients.map((c) => c.xtrf_id).filter(Boolean);
        await supabase
          .from("clients")
          .update({ is_active: false, status: "Inactive" })
          .eq("user_id", user.id)
          .not("xtrf_id", "in", `(${importedIds.join(",")})`);
      }

      setImportComplete(true);
      toast({
        title: "Import Complete",
        description: `Successfully imported ${updated} clients`,
      });
      fetchClients(currentPage, searchTerm, statusFilter);
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

  // Generate local ID for non-XTRF clients
  const generateLocalId = async () => {
    const { data } = await supabase
      .from("clients")
      .select("xtrf_id")
      .like("xtrf_id", "LOCAL%")
      .order("xtrf_id", { ascending: false })
      .limit(1);

    if (data && data.length > 0) {
      const lastNum =
        parseInt(data[0].xtrf_id?.replace("LOCAL", "") || "0") || 0;
      return `LOCAL${String(lastNum + 1).padStart(3, "0")}`;
    }
    return "LOCAL001";
  };

  // Handle add client
  const handleAddClient = async () => {
    if (!user || !formData.name) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const xtrfId = formData.xtrf_id || (await generateLocalId());

      const { error } = await supabase.from("clients").insert({
        user_id: user.id,
        ...formData,
        xtrf_id: xtrfId,
        is_active: formData.status === "Active",
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client added successfully",
      });

      setShowAddModal(false);
      resetForm();
      fetchClients(currentPage, searchTerm, statusFilter);
    } catch (err: any) {
      console.error("Add error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to add client",
        variant: "destructive",
      });
    }
  };

  // Handle edit client
  const handleEditClient = async () => {
    if (!selectedClient || !formData.name) {
      toast({
        title: "Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("clients")
        .update({
          ...formData,
          is_active: formData.status === "Active",
        })
        .eq("id", selectedClient.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client updated successfully",
      });

      setShowEditModal(false);
      setSelectedClient(null);
      resetForm();
      fetchClients(currentPage, searchTerm, statusFilter);
    } catch (err: any) {
      console.error("Update error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to update client",
        variant: "destructive",
      });
    }
  };

  // Handle delete client
  const handleDeleteClient = async () => {
    if (!selectedClient) return;

    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", selectedClient.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Client deleted successfully",
      });

      setShowDeleteDialog(false);
      setSelectedClient(null);
      fetchClients(currentPage, searchTerm, statusFilter);
    } catch (err: any) {
      console.error("Delete error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to delete client",
        variant: "destructive",
      });
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: "",
      email: "",
      phone: "",
      country: "",
      province: "",
      status: "Active",
      gst_rate: 5.0,
      gst_exempt: false,
      preferred_currency: "CAD",
      payment_terms: "Net 30",
      client_type: "Individual",
      is_recurring: false,
      notes: "",
    });
  };

  // Open edit modal
  const openEditModal = (client: Client) => {
    setSelectedClient(client);
    setFormData(client);
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
                <Users className="h-8 w-8" />
                Clients
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your client database
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
                Add Client
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
                    placeholder="Search clients..."
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
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="mb-4">
            <CardContent className="py-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {totalCount === 0 ? 0 : startIndex} - {endIndex} of{" "}
                {totalCount} clients
              </span>
              {clients.some((c) => c.last_synced_at) && (
                <span className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Last sync:{" "}
                  {new Date(
                    clients.find((c) => c.last_synced_at)!.last_synced_at!,
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
                <p className="mt-2 text-muted-foreground">Loading clients...</p>
              </CardContent>
            </Card>
          ) : clients.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
                <p className="text-muted-foreground mb-6">
                  Import your clients from XTRF or add them manually.
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
                    Add Client
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
                        <th className="text-left p-4 font-medium">XTRF ID</th>
                        <th className="text-left p-4 font-medium">Email</th>
                        <th className="text-left p-4 font-medium">Country</th>
                        <th className="text-left p-4 font-medium">Status</th>
                        <th className="text-right p-4 font-medium w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((client) => (
                        <tr
                          key={client.id}
                          className="border-b hover:bg-muted/50 cursor-pointer"
                          onClick={() => openEditModal(client)}
                        >
                          <td className="p-4 font-medium">{client.name}</td>
                          <td className="p-4 text-muted-foreground">
                            {client.xtrf_id}
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {client.email ? (
                              <span className="truncate max-w-xs inline-block">
                                {client.email.length > 20
                                  ? `${client.email.substring(0, 20)}...`
                                  : client.email}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="p-4 text-muted-foreground">
                            {client.country || "—"}
                          </td>
                          <td className="p-4">
                            <Badge
                              variant="secondary"
                              className="flex items-center gap-1 w-fit"
                            >
                              <span>{statusConfig[client.status]?.emoji}</span>
                              {client.status}
                            </Badge>
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
                                  onClick={() => openEditModal(client)}
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedClient(client);
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
            <DialogTitle>Import Clients from XTRF</DialogTitle>
          </DialogHeader>

          {!importing && !importComplete && (
            <>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Upload your XTRF client export CSV file.
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
                        Update existing clients (match by XTRF ID)
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
                        Add new clients
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
                        Mark missing clients as inactive
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
                  Import Clients
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
                  Successfully imported clients!
                </p>
                <div className="space-y-1 text-sm">
                  <p>Added: {importProgress.added} new clients</p>
                  <p>Updated: {importProgress.updated} existing clients</p>
                  {importProgress.errors > 0 && (
                    <p className="text-destructive">
                      Errors: {importProgress.errors}
                    </p>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  onClick={() => {
                    setShowImportModal(false);
                    setImportComplete(false);
                    setCsvFile(null);
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

      {/* Add/Edit Client Modal */}
      <Dialog
        open={showAddModal || showEditModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddModal(false);
            setShowEditModal(false);
            setSelectedClient(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {showEditModal ? "Edit Client" : "Add New Client"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {showEditModal && selectedClient && (
              <div className="flex items-center justify-between pb-4 border-b">
                <div>
                  <p className="text-sm text-muted-foreground">XTRF ID</p>
                  <p className="font-medium">{selectedClient.xtrf_id}</p>
                </div>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <span>{statusConfig[selectedClient.status]?.emoji}</span>
                  {selectedClient.status}
                </Badge>
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Basic Information</h3>

              {showAddModal && (
                <div className="space-y-2">
                  <Label htmlFor="xtrf-id">XTRF ID (optional)</Label>
                  <Input
                    id="xtrf-id"
                    value={formData.xtrf_id || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        xtrf_id: e.target.value,
                      }))
                    }
                    placeholder="Leave blank to auto-generate"
                  />
                  <p className="text-xs text-muted-foreground">
                    For clients not managed in XTRF
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  required
                />
              </div>

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
                  <Label htmlFor="province">Province</Label>
                  <Input
                    id="province"
                    value={formData.province || ""}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        province: e.target.value,
                      }))
                    }
                    placeholder="For Canadian clients"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: Client["status"]) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Potential">Potential</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Financial Settings */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold">Financial Settings</h3>

              <div className="grid grid-cols-2 gap-4">
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
                  />
                </div>

                <div className="space-y-2">
                  <Label className="invisible">GST Exempt</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Checkbox
                      id="gst-exempt"
                      checked={formData.gst_exempt}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          gst_exempt: checked === true,
                        }))
                      }
                    />
                    <Label htmlFor="gst-exempt">GST Exempt</Label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                      <SelectItem value="Due on Receipt">
                        Due on Receipt
                      </SelectItem>
                      <SelectItem value="Net 15">Net 15</SelectItem>
                      <SelectItem value="Net 30">Net 30</SelectItem>
                      <SelectItem value="Net 60">Net 60</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="client-type">Client Type</Label>
                  <Select
                    value={formData.client_type}
                    onValueChange={(value: Client["client_type"]) =>
                      setFormData((prev) => ({ ...prev, client_type: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Individual">Individual</SelectItem>
                      <SelectItem value="Business">Business</SelectItem>
                      <SelectItem value="Organization">Organization</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="invisible">Recurring</Label>
                  <div className="flex items-center gap-2 h-10">
                    <Checkbox
                      id="recurring"
                      checked={formData.is_recurring}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({
                          ...prev,
                          is_recurring: checked === true,
                        }))
                      }
                    />
                    <Label htmlFor="recurring">Recurring Client</Label>
                  </div>
                </div>
              </div>
            </div>

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

            {showEditModal && selectedClient?.last_synced_at && (
              <p className="text-xs text-muted-foreground pt-4 border-t">
                Last synced from XTRF:{" "}
                {new Date(selectedClient.last_synced_at).toLocaleString()}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setShowEditModal(false);
                setSelectedClient(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={showEditModal ? handleEditClient : handleAddClient}
            >
              {showEditModal ? "Save Changes" : "Add Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Client</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-semibold">{selectedClient?.name}</span>? This
            action cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setSelectedClient(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteClient}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
