import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Edit,
  MoreVertical,
} from "lucide-react";
import { KBEntry } from "@/types/knowledge-base";

interface KBEntriesTableProps {
  entries: KBEntry[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEdit: (entry: KBEntry) => void;
  onDeactivate: (entry: KBEntry) => void;
}

const SOURCE_COLORS: Record<string, string> = {
  manual: "bg-slate-100 text-slate-800",
  hitl_correction: "bg-blue-100 text-blue-800",
  auto_suggest: "bg-purple-100 text-purple-800",
  csv_import: "bg-orange-100 text-orange-800",
  receipt_ocr: "bg-green-100 text-green-800",
  xtrf_sync: "bg-cyan-100 text-cyan-800",
  legacy_migration: "bg-slate-50 text-slate-600",
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual",
  hitl_correction: "HITL",
  auto_suggest: "Auto-Suggest",
  csv_import: "CSV Import",
  receipt_ocr: "OCR",
  xtrf_sync: "XTRF",
  legacy_migration: "Legacy",
};

const PAYEE_TYPE_COLORS: Record<string, string> = {
  vendor: "bg-blue-100 text-blue-800",
  client: "bg-green-100 text-green-800",
  contractor: "bg-purple-100 text-purple-800",
  employee: "bg-amber-100 text-amber-800",
  government: "bg-slate-100 text-slate-800",
  financial: "bg-indigo-100 text-indigo-800",
  utility: "bg-cyan-100 text-cyan-800",
  transfer: "bg-pink-100 text-pink-800",
};

export function KBEntriesTable({
  entries,
  isLoading,
  currentPage,
  totalPages,
  onPageChange,
  onEdit,
  onDeactivate,
}: KBEntriesTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-pulse text-muted-foreground">
            Loading entries...
          </div>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No entries found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-24">Pattern</TableHead>
              <TableHead className="w-32">Display Name</TableHead>
              <TableHead className="w-32">Category</TableHead>
              <TableHead className="w-20">GST</TableHead>
              <TableHead className="w-24">Type</TableHead>
              <TableHead className="w-24">Source</TableHead>
              <TableHead className="w-16 text-right">Usage</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow
                key={entry.id}
                className={!entry.is_active ? "opacity-60" : ""}
              >
                {/* Pattern */}
                <TableCell className="font-mono text-sm">
                  <div className="flex items-center gap-2">
                    {entry.payee_pattern}
                    {!entry.is_active && (
                      <Badge variant="secondary" className="text-xs">
                        Inactive
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* Display Name */}
                <TableCell className="text-sm">
                  {entry.payee_display_name || "—"}
                </TableCell>

                {/* Category */}
                <TableCell className="text-sm">
                  {entry.category?.name || "Uncategorized"}
                </TableCell>

                {/* GST */}
                <TableCell className="text-sm">
                  {entry.default_has_gst ? (
                    <div className="flex items-center gap-1">
                      <span className="text-green-600">✓</span>
                      <span className="text-xs text-muted-foreground">
                        {(entry.default_gst_rate * 100).toFixed(0)}%
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Payee Type */}
                <TableCell>
                  <Badge
                    className={`text-xs ${PAYEE_TYPE_COLORS[entry.payee_type] || "bg-slate-100 text-slate-800"}`}
                    variant="outline"
                  >
                    {entry.payee_type}
                  </Badge>
                </TableCell>

                {/* Source */}
                <TableCell>
                  <Badge
                    className={`text-xs ${SOURCE_COLORS[entry.source] || "bg-slate-100 text-slate-800"}`}
                    variant="outline"
                  >
                    {SOURCE_LABELS[entry.source] || entry.source}
                  </Badge>
                </TableCell>

                {/* Usage Count */}
                <TableCell className="text-right text-sm font-medium">
                  {entry.usage_count.toLocaleString()}
                </TableCell>

                {/* Actions */}
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEdit(entry)}
                      title="Edit entry"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onDeactivate(entry)}
                          className="text-destructive focus:text-destructive"
                        >
                          {entry.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <div className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
