import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { FormData } from "../KBEntryEditor";
import { PatternType, PayeeType } from "@/types/knowledge-base";

interface KBEntryEditorDetailsProps {
  formData: FormData;
  setFormData: (data: FormData) => void;
  errors: Record<string, string>;
}

interface Category {
  id: string;
  name: string;
  code: string;
}

interface Company {
  id: string;
  name: string;
}

interface Vendor {
  id: string;
  legal_name: string;
}

interface Client {
  id: string;
  name: string;
}

export function KBEntryEditorDetails({
  formData,
  setFormData,
  errors,
}: KBEntryEditorDetailsProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoadingCategories(true);

      const [categoriesRes, companiesRes, vendorsRes, clientsRes] =
        await Promise.all([
          supabase
            .from("categories")
            .select("id, name, code")
            .eq("is_active", true)
            .order("name"),
          supabase.from("companies").select("id, name").order("name"),
          supabase.from("vendors").select("id, legal_name").order("legal_name"),
          supabase.from("clients").select("id, name").order("name"),
        ]);

      if (categoriesRes.data) setCategories(categoriesRes.data);
      if (companiesRes.data) setCompanies(companiesRes.data);
      if (vendorsRes.data) setVendors(vendorsRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoadingCategories(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="pattern" className="required">
                Pattern *
              </Label>
              <Input
                id="pattern"
                value={formData.payee_pattern}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payee_pattern: e.target.value.toUpperCase(),
                  })
                }
                placeholder="e.g., AMAZON"
                className={errors.payee_pattern ? "border-red-500" : ""}
              />
              {errors.payee_pattern && (
                <p className="text-sm text-red-600">{errors.payee_pattern}</p>
              )}
              <p className="text-xs text-muted-foreground">
                The text pattern to match in transaction descriptions
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pattern-type">Pattern Type</Label>
              <Select
                value={formData.pattern_type}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    pattern_type: value as PatternType,
                  })
                }
              >
                <SelectTrigger id="pattern-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">Exact Match</SelectItem>
                  <SelectItem value="starts_with">Starts With</SelectItem>
                  <SelectItem value="ends_with">Ends With</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="regex">Regex (Advanced)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <Input
                id="display-name"
                value={formData.payee_display_name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    payee_display_name: e.target.value,
                  })
                }
                placeholder="e.g., Amazon"
              />
              <p className="text-xs text-muted-foreground">
                Clean name for display purposes
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="payee-type">Payee Type</Label>
              <Select
                value={formData.payee_type}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    payee_type: value as PayeeType,
                  })
                }
              >
                <SelectTrigger id="payee-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
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
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categorization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Categorization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category" className="required">
                Category *
              </Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, category_id: value })
                }
              >
                <SelectTrigger
                  id="category"
                  className={errors.category_id ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
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
              {errors.category_id && (
                <p className="text-sm text-red-600">{errors.category_id}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company (Optional)</Label>
              <Select
                value={formData.company_id || ""}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    company_id: value || undefined,
                  })
                }
              >
                <SelectTrigger id="company">
                  <SelectValue placeholder="Select company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {companies.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                For shared accounts, assign to specific company
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor">Link to Vendor (Optional)</Label>
              <Select
                value={formData.vendor_id || ""}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    vendor_id: value || undefined,
                  })
                }
              >
                <SelectTrigger id="vendor">
                  <SelectValue placeholder="Search vendors..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {vendors.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.legal_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="client">Link to Client (Optional)</Label>
              <Select
                value={formData.client_id || ""}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    client_id: value || undefined,
                  })
                }
              >
                <SelectTrigger id="client">
                  <SelectValue placeholder="Search clients..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tax Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tax Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Checkbox
              id="has-gst"
              checked={formData.default_has_gst}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  default_has_gst: checked as boolean,
                })
              }
            />
            <Label htmlFor="has-gst" className="cursor-pointer">
              Has GST
            </Label>
          </div>

          {formData.default_has_gst && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="gst-rate">GST Rate</Label>
              <Select
                value={formData.default_gst_rate.toString()}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    default_gst_rate: parseFloat(value),
                  })
                }
              >
                <SelectTrigger id="gst-rate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.05">5% (GST)</SelectItem>
                  <SelectItem value="0.13">13% (HST - Ontario)</SelectItem>
                  <SelectItem value="0.15">15% (HST - Atlantic)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Checkbox
              id="has-tip"
              checked={formData.default_has_tip}
              onCheckedChange={(checked) =>
                setFormData({
                  ...formData,
                  default_has_tip: checked as boolean,
                })
              }
            />
            <Label htmlFor="has-tip" className="cursor-pointer">
              Typically Has Tip
            </Label>
          </div>
          <p className="text-xs text-muted-foreground pl-6">
            For restaurants, cafes, etc.
          </p>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.notes || ""}
            onChange={(e) =>
              setFormData({ ...formData, notes: e.target.value })
            }
            placeholder="Add any additional notes or context..."
            rows={3}
          />
        </CardContent>
      </Card>
    </div>
  );
}
