import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X as XIcon } from "lucide-react";
import { KBFilters, PayeeType, KBSource } from "@/types/knowledge-base";
import { supabase } from "@/lib/supabase";

interface KBFiltersComponentProps {
  filters: KBFilters;
  onFiltersChange: (filters: KBFilters) => void;
}

interface Category {
  id: string;
  name: string;
  category_type: string;
}

export function KBFiltersComponent({
  filters,
  onFiltersChange,
}: KBFiltersComponentProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(
    null,
  );

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const { data } = await supabase
        .from("categories")
        .select("id, name, category_type")
        .eq("is_active", true)
        .order("name");

      setCategories(data || []);
    } catch (err) {
      console.error("Error fetching categories:", err);
    } finally {
      setLoadingCategories(false);
    }
  };

  const handleSearchChange = (value: string) => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    const timeout = setTimeout(() => {
      onFiltersChange({
        ...filters,
        search: value,
        page: 1,
      });
    }, 300);

    setSearchTimeout(timeout);
  };

  const handleCategoryChange = (value: string) => {
    onFiltersChange({
      ...filters,
      category_id: value || undefined,
      page: 1,
    });
  };

  const handlePayeeTypeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      payee_type: (value || undefined) as PayeeType | undefined,
      page: 1,
    });
  };

  const handleSourceChange = (value: string) => {
    onFiltersChange({
      ...filters,
      source: (value || undefined) as KBSource | undefined,
      page: 1,
    });
  };

  const handleShowInactiveChange = (checked: boolean) => {
    onFiltersChange({
      ...filters,
      is_active: checked ? undefined : true,
      page: 1,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      search: undefined,
      category_id: undefined,
      payee_type: undefined,
      source: undefined,
      is_active: true,
      page: 1,
      pageSize: 20,
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.category_id ||
    filters.payee_type ||
    filters.source ||
    filters.is_active === undefined;

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        {/* Main Filter Row */}
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patterns..."
              onChange={(e) => handleSearchChange(e.target.value)}
              defaultValue={filters.search || ""}
              className="pl-10"
            />
          </div>

          {/* Category Filter */}
          <Select
            value={filters.category_id || ""}
            onValueChange={handleCategoryChange}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {loadingCategories ? (
                <div className="p-2 text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : (
                categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>

          {/* Payee Type Filter */}
          <Select
            value={filters.payee_type || ""}
            onValueChange={handlePayeeTypeChange}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="vendor">Vendor</SelectItem>
              <SelectItem value="client">Client</SelectItem>
              <SelectItem value="contractor">Contractor</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
              <SelectItem value="government">Government</SelectItem>
              <SelectItem value="financial">Financial</SelectItem>
              <SelectItem value="utility">Utility</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>

          {/* Source Filter */}
          <Select
            value={filters.source || ""}
            onValueChange={handleSourceChange}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="hitl_correction">HITL Correction</SelectItem>
              <SelectItem value="auto_suggest">Auto-Suggested</SelectItem>
              <SelectItem value="csv_import">CSV Import</SelectItem>
              <SelectItem value="receipt_ocr">Receipt OCR</SelectItem>
              <SelectItem value="xtrf_sync">XTRF Sync</SelectItem>
              <SelectItem value="legacy_migration">Legacy</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Secondary Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Checkbox
              id="show-inactive"
              checked={filters.is_active === undefined}
              onCheckedChange={handleShowInactiveChange}
            />
            <Label htmlFor="show-inactive" className="cursor-pointer text-sm">
              Show Inactive
            </Label>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-xs text-muted-foreground hover:text-foreground gap-1"
            >
              <XIcon className="h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
