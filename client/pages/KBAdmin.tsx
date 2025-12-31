import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Plus, AlertCircle } from "lucide-react";
import { KBNaturalLanguageInput } from "@/components/KBNaturalLanguageInput";
import { KBFiltersComponent } from "@/components/KBFilters";
import { KBEntriesTable } from "@/components/KBEntriesTable";
import { KBInterpretResultModal } from "@/components/KBInterpretResultModal";
import {
  KBEntry,
  KBFilters,
  AIInterpretationResult,
  KBListResponse,
} from "@/types/knowledge-base";

export default function KBAdmin() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // State
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filters, setFilters] = useState<KBFilters>({
    page: 1,
    pageSize: 20,
  });

  // Natural language state
  const [nlInput, setNlInput] = useState("");
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState<string | null>(null);
  const [interpretResult, setInterpretResult] =
    useState<AIInterpretationResult | null>(null);
  const [resultModalOpen, setResultModalOpen] = useState(false);
  const [resultLoading, setResultLoading] = useState(false);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Fetch entries
  useEffect(() => {
    if (user) {
      fetchEntries();
    }
  }, [user, filters]);

  const fetchEntries = async () => {
    try {
      setLoading(true);

      // Build query
      let query = supabase
        .from("knowledge_base")
        .select("*, category:categories(id, code, name, category_type)", {
          count: "exact",
        })
        .order("usage_count", { ascending: false });

      // Apply filters
      if (filters.search) {
        query = query.ilike("payee_pattern", `%${filters.search}%`);
      }

      if (filters.category_id) {
        query = query.eq("category_id", filters.category_id);
      }

      if (filters.payee_type) {
        query = query.eq("payee_type", filters.payee_type);
      }

      if (filters.source) {
        query = query.eq("source", filters.source);
      }

      if (filters.is_active !== undefined) {
        query = query.eq("is_active", filters.is_active);
      }

      // Pagination
      const offset = (filters.page - 1) * filters.pageSize;
      query = query.range(offset, offset + filters.pageSize - 1);

      const { data, count, error } = await query;

      if (error) throw error;

      setEntries((data as KBEntry[]) || []);
      setTotalCount(count || 0);

      // Fetch pending count
      const { count: pending } = await supabase
        .from("kb_pending_queue")
        .select("id", { count: "exact" })
        .eq("status", "pending");

      setPendingCount(pending || 0);
    } catch (err) {
      console.error("Error fetching KB entries:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInterpretNL = async (input: string) => {
    try {
      setNlLoading(true);
      setNlError(null);

      // Call AI interpret function
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kb-ai-interpret`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.id}`,
          },
          body: JSON.stringify({
            instruction: input,
            user_email: user?.email,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`AI interpretation failed: ${response.statusText}`);
      }

      const result: AIInterpretationResult = await response.json();
      setInterpretResult(result);
      setResultModalOpen(true);
      setNlInput("");
    } catch (err) {
      setNlError(
        err instanceof Error ? err.message : "Failed to interpret instruction",
      );
      console.error("Error interpreting instruction:", err);
    } finally {
      setNlLoading(false);
    }
  };

  const handleConfirmInterpret = async () => {
    if (!interpretResult) return;

    try {
      setResultLoading(true);

      // Call kb-entry-manage to save
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kb-entry-manage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${user?.id}`,
          },
          body: JSON.stringify({
            action: interpretResult.action,
            user_email: user?.email,
            entry: interpretResult.proposed,
            ai_interpretation: interpretResult.ai_interpretation,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to save entry: ${response.statusText}`);
      }

      // Refresh entries
      setResultModalOpen(false);
      setInterpretResult(null);
      setFilters({ ...filters, page: 1 });
      fetchEntries();
    } catch (err) {
      setNlError(err instanceof Error ? err.message : "Failed to save entry");
      console.error("Error saving entry:", err);
    } finally {
      setResultLoading(false);
    }
  };

  const handleEditEntry = (entry: KBEntry) => {
    // TODO: Open entry editor modal
    console.log("Edit entry:", entry);
  };

  const handleDeactivateEntry = async (entry: KBEntry) => {
    if (
      !confirm(
        `Are you sure you want to ${entry.is_active ? "deactivate" : "activate"} this entry?`,
      )
    ) {
      return;
    }

    try {
      const { error } = await supabase
        .from("knowledge_base")
        .update({ is_active: !entry.is_active })
        .eq("id", entry.id);

      if (error) throw error;

      fetchEntries();
    } catch (err) {
      console.error("Error updating entry:", err);
    }
  };

  const totalPages = Math.ceil(totalCount / filters.pageSize);

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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Knowledge Base Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage patterns and rules for transaction categorization
              </p>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Entry
            </Button>
          </div>

          {/* Natural Language Input */}
          <KBNaturalLanguageInput
            onInterpret={handleInterpretNL}
            isLoading={nlLoading}
            error={nlError}
          />

          {/* Filters */}
          <KBFiltersComponent filters={filters} onFiltersChange={setFilters} />

          {/* Stats Bar */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Total Entries
                  </p>
                  <p className="text-2xl font-bold">{totalCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Active
                  </p>
                  <p className="text-2xl font-bold">
                    {entries.filter((e) => e.is_active).length}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Pending Approval
                  </p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Total Usage
                  </p>
                  <p className="text-2xl font-bold">
                    {entries
                      .reduce((sum, e) => sum + e.usage_count, 0)
                      .toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* KB Entries Table */}
          <Card>
            <CardHeader>
              <CardTitle>Knowledge Base Entries ({totalCount})</CardTitle>
            </CardHeader>
            <CardContent>
              <KBEntriesTable
                entries={entries}
                isLoading={loading}
                currentPage={filters.page}
                totalPages={totalPages}
                onPageChange={(page) => setFilters({ ...filters, page })}
                onEdit={handleEditEntry}
                onDeactivate={handleDeactivateEntry}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* AI Interpretation Result Modal */}
      <KBInterpretResultModal
        isOpen={resultModalOpen}
        result={interpretResult}
        isLoading={resultLoading}
        onClose={() => {
          setResultModalOpen(false);
          setInterpretResult(null);
        }}
        onConfirm={handleConfirmInterpret}
        onEdit={() => {
          // TODO: Open entry editor with prefilled data
          setResultModalOpen(false);
        }}
      />
    </div>
  );
}
