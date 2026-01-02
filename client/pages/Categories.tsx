import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  ChevronRight,
  Loader2,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Category {
  id: string;
  code: string;
  name: string;
  account_number: string;
  account_type:
    | "asset"
    | "liability"
    | "equity"
    | "income"
    | "expense"
    | "header";
  category_type: "revenue" | "expense" | "transfer";
  normal_balance: "debit" | "credit";
  tax_deductible_percent: number;
  tax_line: string;
  description: string;
  is_active: boolean;
  is_system: boolean;
  display_order: number;
  parent_id: string | null;
  transaction_count?: number;
}

const ACCOUNT_TYPES = [
  { value: "asset", label: "Asset", range: "1000-1999", color: "blue" },
  { value: "liability", label: "Liability", range: "2000-2999", color: "red" },
  { value: "equity", label: "Equity", range: "3000-3999", color: "purple" },
  { value: "income", label: "Income", range: "4000-4999", color: "green" },
  { value: "expense", label: "Expense", range: "5000-6999", color: "orange" },
];

export default function CategoriesPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTypes, setExpandedTypes] = useState<string[]>([
    "asset",
    "liability",
    "equity",
    "income",
    "expense",
  ]);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(
    null,
  );

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCategories();
    }
  }, [user, showInactive]);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      // Get categories
      let query = supabase
        .from("categories")
        .select("*")
        .order("display_order", { ascending: true })
        .order("account_number", { ascending: true });

      if (!showInactive) {
        query = query.eq("is_active", true);
      }

      const { data: cats, error } = await query;
      if (error) throw error;

      // Get transaction counts per category
      const { data: counts, error: countError } = await supabase
        .from("transactions")
        .select("category_id");

      if (!countError && counts) {
        const countMap = counts.reduce(
          (acc: Record<string, number>, t: any) => {
            if (t.category_id) {
              acc[t.category_id] = (acc[t.category_id] || 0) + 1;
            }
            return acc;
          },
          {},
        );

        const catsWithCounts = cats?.map((cat) => ({
          ...cat,
          transaction_count: countMap[cat.id] || 0,
        }));
        setCategories(catsWithCounts || []);
      } else {
        setCategories(cats || []);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast({
        title: "Error",
        description: "Failed to load categories",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter categories
  const filteredCategories = categories.filter((cat) => {
    if (filterType !== "all" && cat.account_type !== filterType) return false;
    if (
      searchQuery &&
      !cat.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !cat.code.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !cat.account_number?.includes(searchQuery)
    )
      return false;
    return true;
  });

  // Group by account type
  const groupedCategories = ACCOUNT_TYPES.reduce(
    (acc, type) => {
      acc[type.value] = filteredCategories.filter(
        (cat) =>
          cat.account_type === type.value && cat.account_type !== "header",
      );
      return acc;
    },
    {} as Record<string, Category[]>,
  );

  // Toggle expand/collapse
  const toggleType = (type: string) => {
    setExpandedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  // Handle add category
  const handleAdd = () => {
    setSelectedCategory(null);
    setShowAddModal(true);
  };

  // Handle edit
  const handleEdit = (category: Category) => {
    setSelectedCategory(category);
    setShowEditModal(true);
  };

  // Handle delete
  const handleDelete = (category: Category) => {
    if (category.is_system) {
      toast({
        title: "Error",
        description: "Cannot delete system categories",
        variant: "destructive",
      });
      return;
    }
    if (category.transaction_count && category.transaction_count > 0) {
      toast({
        title: "Error",
        description: `Cannot delete: ${category.transaction_count} transactions use this category`,
        variant: "destructive",
      });
      return;
    }
    setSelectedCategory(category);
    setShowDeleteModal(true);
  };

  // Confirm delete
  const confirmDelete = async () => {
    if (!selectedCategory) return;

    try {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", selectedCategory.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Category deleted",
      });
      fetchCategories();
    } catch (error) {
      console.error("Delete error:", error);
      toast({
        title: "Error",
        description: "Failed to delete category",
        variant: "destructive",
      });
    } finally {
      setShowDeleteModal(false);
      setSelectedCategory(null);
    }
  };

  const getColorClass = (type: string) => {
    const colors: Record<
      string,
      { bg: string; text: string; border: string; hover: string }
    > = {
      blue: {
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-200",
        hover: "hover:bg-blue-100",
      },
      red: {
        bg: "bg-red-50",
        text: "text-red-700",
        border: "border-red-200",
        hover: "hover:bg-red-100",
      },
      purple: {
        bg: "bg-purple-50",
        text: "text-purple-700",
        border: "border-purple-200",
        hover: "hover:bg-purple-100",
      },
      green: {
        bg: "bg-green-50",
        text: "text-green-700",
        border: "border-green-200",
        hover: "hover:bg-green-100",
      },
      orange: {
        bg: "bg-orange-50",
        text: "text-orange-700",
        border: "border-orange-200",
        hover: "hover:bg-orange-100",
      },
    };

    const found = ACCOUNT_TYPES.find((t) => t.value === type);
    return colors[found?.color || "gray"] || colors.blue;
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
        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Categories</h1>
              <p className="text-muted-foreground mt-1">Chart of Accounts</p>
            </div>
            <Button onClick={handleAdd} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Category
            </Button>
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="type-filter" className="text-sm">
                    Account Type
                  </Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger id="type-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      {ACCOUNT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label} ({type.range})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end gap-2">
                  <Checkbox
                    id="show-inactive"
                    checked={showInactive}
                    onCheckedChange={(checked) =>
                      setShowInactive(checked as boolean)
                    }
                  />
                  <Label htmlFor="show-inactive" className="cursor-pointer">
                    Show Inactive
                  </Label>
                </div>

                <div className="flex-1 min-w-[250px]">
                  <Label htmlFor="search" className="text-sm">
                    Search
                  </Label>
                  <Input
                    id="search"
                    placeholder="Search by name, code, or account number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Categories List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              {ACCOUNT_TYPES.map((type) => {
                const typeCats = groupedCategories[type.value] || [];
                if (filterType !== "all" && filterType !== type.value)
                  return null;

                const colors = getColorClass(type.color);

                return (
                  <Card key={type.value} className={`border ${colors.border}`}>
                    {/* Type Header */}
                    <button
                      onClick={() => toggleType(type.value)}
                      className={`w-full flex items-center justify-between px-6 py-4 ${colors.bg} ${colors.hover} transition-colors rounded-t-lg`}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronRight
                          className={`h-5 w-5 transition-transform ${
                            expandedTypes.includes(type.value)
                              ? "rotate-90"
                              : ""
                          }`}
                        />
                        <span className={`font-semibold ${colors.text}`}>
                          {type.label.toUpperCase()}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          ({type.range})
                        </span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {typeCats.length} categories
                      </span>
                    </button>

                    {/* Type Categories */}
                    {expandedTypes.includes(type.value) && (
                      <div className="divide-y divide-border">
                        {typeCats.length === 0 ? (
                          <div className="px-6 py-8 text-center text-muted-foreground">
                            No categories in this type
                          </div>
                        ) : (
                          typeCats.map((cat) => (
                            <div
                              key={cat.id}
                              className={`flex items-center justify-between px-6 py-4 hover:bg-muted/50 transition-colors ${
                                !cat.is_active ? "opacity-50" : ""
                              }`}
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <span className="font-mono text-sm text-muted-foreground w-16">
                                  {cat.account_number || "—"}
                                </span>
                                <div>
                                  <span className="font-medium text-foreground">
                                    {cat.name}
                                  </span>
                                  <span className="ml-2 text-sm text-muted-foreground">
                                    ({cat.code})
                                  </span>
                                  {cat.is_system && (
                                    <span className="ml-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                                      System
                                    </span>
                                  )}
                                  {!cat.is_active && (
                                    <span className="ml-2 text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">
                                      Inactive
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                {cat.tax_deductible_percent !== 100 &&
                                  cat.tax_deductible_percent != null && (
                                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                                      {cat.tax_deductible_percent}% deductible
                                    </span>
                                  )}
                                <span className="text-sm text-muted-foreground w-20 text-right">
                                  {cat.transaction_count || 0} txns
                                </span>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEdit(cat)}
                                    className="p-1 text-muted-foreground hover:text-blue-600 transition-colors"
                                    title="Edit"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(cat)}
                                    disabled={
                                      cat.is_system ||
                                      (cat.transaction_count || 0) > 0
                                    }
                                    className="p-1 text-muted-foreground hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title={
                                      cat.is_system
                                        ? "System category"
                                        : (cat.transaction_count || 0) > 0
                                          ? "Has transactions"
                                          : "Delete"
                                    }
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {(showAddModal || showEditModal) && (
        <CategoryModal
          category={selectedCategory}
          onClose={() => {
            setShowAddModal(false);
            setShowEditModal(false);
            setSelectedCategory(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setShowEditModal(false);
            setSelectedCategory(null);
            fetchCategories();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4 border border-border">
            <h3 className="text-lg font-semibold">Delete Category</h3>
            <p className="text-muted-foreground mt-2">
              Are you sure you want to delete "{selectedCategory.name}"? This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CategoryModalProps {
  category: Category | null;
  onClose: () => void;
  onSave: () => void;
}

function CategoryModal({ category, onClose, onSave }: CategoryModalProps) {
  const { toast } = useToast();
  const isEditing = !!category;

  const [formData, setFormData] = useState({
    code: category?.code || "",
    name: category?.name || "",
    account_number: category?.account_number || "",
    account_type: category?.account_type || "expense",
    category_type: category?.category_type || "expense",
    normal_balance: category?.normal_balance || "debit",
    tax_deductible_percent: category?.tax_deductible_percent ?? 100,
    tax_line: category?.tax_line || "",
    description: category?.description || "",
    is_active: category?.is_active ?? true,
  });

  const [saving, setSaving] = useState(false);

  // Auto-set normal_balance based on account_type
  useEffect(() => {
    if (["asset", "expense"].includes(formData.account_type)) {
      setFormData((prev) => ({ ...prev, normal_balance: "debit" }));
    } else {
      setFormData((prev) => ({ ...prev, normal_balance: "credit" }));
    }

    // Also set category_type for legacy compatibility
    if (["income"].includes(formData.account_type)) {
      setFormData((prev) => ({ ...prev, category_type: "revenue" }));
    } else if (["expense"].includes(formData.account_type)) {
      setFormData((prev) => ({ ...prev, category_type: "expense" }));
    } else {
      setFormData((prev) => ({ ...prev, category_type: "transfer" }));
    }
  }, [formData.account_type]);

  // Generate code from name
  const generateCode = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const dataToSave = {
        ...formData,
        code: formData.code || generateCode(formData.name),
        display_order: parseInt(formData.account_number) || 9999,
      };

      if (isEditing && category) {
        const { error } = await supabase
          .from("categories")
          .update(dataToSave)
          .eq("id", category.id);
        if (error) throw error;
        toast({
          title: "Success",
          description: "Category updated",
        });
      } else {
        const { error } = await supabase.from("categories").insert(dataToSave);
        if (error) throw error;
        toast({
          title: "Success",
          description: "Category created",
        });
      }

      onSave();
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save category",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Category" : "Add Category"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update category details"
              : "Create a new category for your chart of accounts"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account Type */}
          <div className="space-y-2">
            <Label htmlFor="account-type">Account Type *</Label>
            <Select
              value={formData.account_type}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, account_type: value }))
              }
            >
              <SelectTrigger id="account-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asset">Asset (1000-1999)</SelectItem>
                <SelectItem value="liability">Liability (2000-2999)</SelectItem>
                <SelectItem value="equity">Equity (3000-3999)</SelectItem>
                <SelectItem value="income">Income (4000-4999)</SelectItem>
                <SelectItem value="expense">Expense (5000-6999)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Account Number */}
          <div className="space-y-2">
            <Label htmlFor="account-number">Account Number *</Label>
            <Input
              id="account-number"
              value={formData.account_number}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  account_number: e.target.value,
                }))
              }
              placeholder="e.g., 6100"
              required
            />
            <p className="text-xs text-muted-foreground">
              {formData.account_type === "asset" && "Assets: 1000-1999"}
              {formData.account_type === "liability" &&
                "Liabilities: 2000-2999"}
              {formData.account_type === "equity" && "Equity: 3000-3999"}
              {formData.account_type === "income" && "Income: 4000-4999"}
              {formData.account_type === "expense" && "Expenses: 5000-6999"}
            </p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, name: e.target.value }))
              }
              placeholder="e.g., Professional Fees"
              required
            />
          </div>

          {/* Code */}
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              value={formData.code}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, code: e.target.value }))
              }
              placeholder="Auto-generated from name"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to auto-generate
            </p>
          </div>

          {/* Tax Deductible (for expenses only) */}
          {formData.account_type === "expense" && (
            <div className="space-y-2">
              <Label htmlFor="tax-deductible">Tax Deductible %</Label>
              <Input
                id="tax-deductible"
                type="number"
                min="0"
                max="100"
                value={formData.tax_deductible_percent}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    tax_deductible_percent: parseInt(e.target.value),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                50% for meals & entertainment, 100% for most expenses
              </p>
            </div>
          )}

          {/* Tax Line (for expenses only) */}
          {formData.account_type === "expense" && (
            <div className="space-y-2">
              <Label htmlFor="tax-line">CRA Tax Line</Label>
              <Input
                id="tax-line"
                value={formData.tax_line}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    tax_line: e.target.value,
                  }))
                }
                placeholder="e.g., T2-S8-8860"
              />
            </div>
          )}

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={2}
            />
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="is-active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  is_active: checked as boolean,
                }))
              }
            />
            <Label htmlFor="is-active" className="cursor-pointer">
              Active
            </Label>
          </div>

          {/* Buttons */}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : isEditing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
