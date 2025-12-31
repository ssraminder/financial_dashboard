import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatDateSafe } from "@/lib/dateUtils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface KBEntryEditorHistoryProps {
  entryId: string;
}

interface HistoryRecord {
  id: string;
  entry_id: string;
  action: "create" | "update" | "activate" | "deactivate";
  changed_fields: Record<string, unknown>;
  ai_interpretation?: string;
  changed_by: string;
  changed_at: string;
}

export function KBEntryEditorHistory({ entryId }: KBEntryEditorHistoryProps) {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, [entryId]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from("kb_change_history")
        .select("*")
        .eq("entry_id", entryId)
        .order("changed_at", { ascending: false });

      if (fetchError) throw fetchError;

      setHistory((data as HistoryRecord[]) || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch history");
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No change history yet</p>
      </div>
    );
  }

  const actionColors: Record<string, string> = {
    create: "bg-green-100 text-green-800",
    update: "bg-blue-100 text-blue-800",
    activate: "bg-green-100 text-green-800",
    deactivate: "bg-red-100 text-red-800",
  };

  const actionLabels: Record<string, string> = {
    create: "Created",
    update: "Updated",
    activate: "Activated",
    deactivate: "Deactivated",
  };

  return (
    <div className="space-y-3">
      {history.map((record) => (
        <Card key={record.id} className="p-4">
          <div className="space-y-2">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Badge
                  className={`${actionColors[record.action] || "bg-slate-100 text-slate-800"}`}
                  variant="outline"
                >
                  {actionLabels[record.action] || record.action}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {formatDateSafe(record.changed_at.split("T")[0])}
                  {" at "}
                  {new Date(record.changed_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <span className="text-sm font-medium text-muted-foreground">
                {record.changed_by}
              </span>
            </div>

            {/* Changed Fields */}
            {record.action === "update" &&
              Object.keys(record.changed_fields || {}).length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Changed Fields:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(record.changed_fields || {}).map(
                      ([field, value]) => (
                        <div
                          key={field}
                          className="text-xs bg-muted/50 rounded p-2"
                        >
                          <span className="font-mono text-muted-foreground">
                            {field}
                          </span>
                          <span className="text-foreground ml-1">
                            →{" "}
                            {typeof value === "boolean"
                              ? value
                                ? "Yes"
                                : "No"
                              : typeof value === "number"
                                ? value.toString()
                                : String(value)}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

            {/* AI Interpretation */}
            {record.ai_interpretation && (
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-2">
                  AI Interpretation:
                </p>
                <p className="text-sm text-foreground bg-muted/30 rounded p-2 whitespace-pre-wrap">
                  {record.ai_interpretation}
                </p>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
