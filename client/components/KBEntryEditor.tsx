import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { KBEntry, PatternType, PayeeType } from "@/types/knowledge-base";
import { KBEntryEditorDetails } from "./KBEntryEditor/Details";
import { KBEntryEditorMatching } from "./KBEntryEditor/MatchingRules";
import { KBEntryEditorHistory } from "./KBEntryEditor/History";

interface KBEntryEditorProps {
  isOpen: boolean;
  mode: "create" | "edit";
  entry?: KBEntry | null;
  onClose: () => void;
  onSave: () => void;
}

export interface FormData {
  payee_pattern: string;
  pattern_type: PatternType;
  payee_display_name: string;
  payee_type: PayeeType;
  category_id: string;
  company_id?: string;
  vendor_id?: string;
  client_id?: string;
  default_has_gst: boolean;
  default_gst_rate: number;
  default_has_tip: boolean;
  amount_min?: number;
  amount_max?: number;
  transaction_type: "debit" | "credit" | null;
  confidence_score: number;
  notes?: string;
}

export function KBEntryEditor({
  isOpen,
  mode,
  entry,
  onClose,
  onSave,
}: KBEntryEditorProps) {
  const [formData, setFormData] = useState<FormData>({
    payee_pattern: "",
    pattern_type: "contains",
    payee_display_name: "",
    payee_type: "vendor",
    category_id: "",
    default_has_gst: false,
    default_gst_rate: 0.05,
    default_has_tip: false,
    transaction_type: null,
    confidence_score: 100,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("details");

  // Initialize form with entry data in edit mode
  useEffect(() => {
    if (mode === "edit" && entry) {
      setFormData({
        payee_pattern: entry.payee_pattern,
        pattern_type: entry.pattern_type,
        payee_display_name: entry.payee_display_name,
        payee_type: entry.payee_type,
        category_id: entry.category_id,
        company_id: entry.company_id,
        vendor_id: entry.vendor_id,
        client_id: entry.client_id,
        default_has_gst: entry.default_has_gst,
        default_gst_rate: entry.default_gst_rate,
        default_has_tip: entry.default_has_tip,
        amount_min: entry.amount_min,
        amount_max: entry.amount_max,
        transaction_type: entry.transaction_type,
        confidence_score: entry.confidence_score,
        notes: entry.notes,
      });
      setActiveTab("details");
    } else if (mode === "create") {
      setFormData({
        payee_pattern: "",
        pattern_type: "contains",
        payee_display_name: "",
        payee_type: "vendor",
        category_id: "",
        default_has_gst: false,
        default_gst_rate: 0.05,
        default_has_tip: false,
        transaction_type: null,
        confidence_score: 100,
      });
    }
    setErrors({});
    setError(null);
  }, [isOpen, mode, entry]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.payee_pattern.trim()) {
      newErrors.payee_pattern = "Pattern is required";
    }

    if (!formData.category_id) {
      newErrors.category_id = "Category is required";
    }

    if (
      formData.amount_min !== undefined &&
      formData.amount_max !== undefined &&
      formData.amount_min > formData.amount_max
    ) {
      newErrors.amount_range = "Minimum amount cannot be greater than maximum";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setIsSaving(true);
      setError(null);

      const payload = {
        ...formData,
        payee_pattern: formData.payee_pattern.toUpperCase().trim(),
      };

      if (mode === "create") {
        const { error: insertError } = await supabase
          .from("knowledge_base")
          .insert([payload]);

        if (insertError) throw insertError;
      } else if (mode === "edit" && entry) {
        const { error: updateError } = await supabase
          .from("knowledge_base")
          .update(payload)
          .eq("id", entry.id);

        if (updateError) throw updateError;
      }

      onClose();
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
      console.error("Error saving entry:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    setActiveTab("details");
    setErrors({});
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create New" : "Edit"} KB Entry
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a new knowledge base entry for transaction categorization"
              : "Edit the knowledge base entry details and settings"}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="matching">Matching Rules</TabsTrigger>
            {mode === "edit" && (
              <TabsTrigger value="history">History</TabsTrigger>
            )}
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-4">
            <KBEntryEditorDetails
              formData={formData}
              setFormData={setFormData}
              errors={errors}
            />
          </TabsContent>

          {/* Matching Rules Tab */}
          <TabsContent value="matching" className="space-y-4">
            <KBEntryEditorMatching
              formData={formData}
              setFormData={setFormData}
              errors={errors}
            />
          </TabsContent>

          {/* History Tab */}
          {mode === "edit" && entry && (
            <TabsContent value="history" className="space-y-4">
              <KBEntryEditorHistory entryId={entry.id} />
            </TabsContent>
          )}
        </Tabs>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Entry
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
