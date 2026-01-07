import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Trash2,
  Loader2,
  ArrowRight,
  Eye,
  AlertCircle,
} from "lucide-react";

interface PendingTransfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  description: string;
  notes: string | null;
  status: "pending" | "partial" | "matched" | "cancelled";
  from_transaction_id: string | null;
  to_transaction_id: string | null;
  created_at: string;
  matched_at: string | null;
  from_account: {
    name: string;
    nickname: string | null;
    bank_name: string;
    account_number_last4: string;
  };
  to_account: {
    name: string;
    nickname: string | null;
    bank_name: string;
    account_number_last4: string;
  };
  from_transaction?: {
    id: string;
    description: string;
    transaction_date: string;
  };
  to_transaction?: {
    id: string;
    description: string;
    transaction_date: string;
  };
}

export default function PendingTransfers() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [transfers, setTransfers] = useState<PendingTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransfer, setSelectedTransfer] =
    useState<PendingTransfer | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // Wait for auth to load before checking
    if (authLoading) return;

    if (!user) {
      navigate("/login");
      return;
    }
    fetchPendingTransfers();
  }, [user, authLoading, navigate]);

  const fetchPendingTransfers = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("pending_transfers")
        .select(
          `
          *,
          from_account:bank_accounts!from_account_id(name, nickname, bank_name, account_number_last4),
          to_account:bank_accounts!to_account_id(name, nickname, bank_name, account_number_last4),
          from_transaction:transactions!from_transaction_id(id, description, transaction_date),
          to_transaction:transactions!to_transaction_id(id, description, transaction_date)
        `,
        )
        .order("transfer_date", { ascending: false });

      if (error) throw error;
      setTransfers(data || []);
    } catch (err) {
      console.error("Error fetching pending transfers:", err);
      toast.error("Failed to load pending transfers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelTransfer = async () => {
    if (!selectedTransfer) return;

    setIsDeleting(true);
    try {
      // If status is pending or cancelled, delete the record
      // Otherwise, just mark as cancelled
      if (selectedTransfer.status === "pending") {
        const { error } = await supabase
          .from("pending_transfers")
          .delete()
          .eq("id", selectedTransfer.id);

        if (error) throw error;
        toast.success("Transfer deleted successfully");
      } else {
        const { error } = await supabase
          .from("pending_transfers")
          .update({ status: "cancelled" })
          .eq("id", selectedTransfer.id);

        if (error) throw error;
        toast.success("Transfer cancelled successfully");
      }

      setIsDeleteDialogOpen(false);
      setSelectedTransfer(null);
      fetchPendingTransfers();
    } catch (err) {
      console.error("Error cancelling transfer:", err);
      toast.error("Failed to cancel transfer");
    } finally {
      setIsDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "matched":
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Matched
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      case "cancelled":
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <XCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const pendingCount = transfers.filter(
    (t) => t.status === "pending" || t.status === "partial",
  ).length;
  const matchedCount = transfers.filter((t) => t.status === "matched").length;

  // Show loading while checking authentication
  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Pending Transfers
              </h1>
              <p className="text-gray-600">
                Track manual transfers and their matching status with imported
                statements
              </p>
              <div className="flex gap-4 mt-3">
                <div className="text-sm">
                  <span className="font-semibold text-blue-600">
                    {pendingCount}
                  </span>{" "}
                  <span className="text-gray-600">pending/partial</span>
                </div>
                <div className="text-sm">
                  <span className="font-semibold text-green-600">
                    {matchedCount}
                  </span>{" "}
                  <span className="text-gray-600">matched</span>
                </div>
              </div>
            </div>
            <Button onClick={() => navigate("/manual-transfer")}>
              <Plus className="h-4 w-4 mr-2" />
              New Transfer
            </Button>
          </div>

          {/* Transfers Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : transfers.length === 0 ? (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No Pending Transfers
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Record a manual transfer to track it across bank statements
                  </p>
                  <Button onClick={() => navigate("/manual-transfer")}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create First Transfer
                  </Button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>From Account</TableHead>
                        <TableHead>To Account</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transfers.map((transfer) => (
                        <TableRow key={transfer.id}>
                          <TableCell className="font-medium">
                            {formatDate(transfer.transfer_date)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="font-medium text-sm">
                                  {transfer.from_account.bank_name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {transfer.from_account.nickname ||
                                    transfer.from_account.name}{" "}
                                  (••••
                                  {transfer.from_account.account_number_last4})
                                </div>
                              </div>
                              {transfer.from_transaction_id ? (
                                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              <div>
                                <div className="font-medium text-sm">
                                  {transfer.to_account.bank_name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {transfer.to_account.nickname ||
                                    transfer.to_account.name}{" "}
                                  (••••
                                  {transfer.to_account.account_number_last4})
                                </div>
                              </div>
                              {transfer.to_transaction_id ? (
                                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                              ) : (
                                <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold">
                            {formatCurrency(transfer.amount)}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(transfer.status)}
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="truncate text-sm">
                              {transfer.description}
                            </div>
                            {transfer.notes && (
                              <div className="text-xs text-gray-500 truncate mt-1">
                                {transfer.notes}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {transfer.status === "matched" &&
                                transfer.from_transaction_id && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      navigate(
                                        `/transactions?highlight=${transfer.from_transaction_id}`,
                                      )
                                    }
                                    title="View matched transaction"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                              {transfer.status !== "matched" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setSelectedTransfer(transfer);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Info Box */}
          {transfers.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Understanding Status
              </h3>
              <ul className="space-y-1 text-sm text-blue-800">
                <li>
                  <span className="font-semibold">Pending:</span> Waiting for
                  both sides to be imported
                </li>
                <li>
                  <span className="font-semibold">Partial:</span> One side
                  matched, waiting for the other
                </li>
                <li>
                  <span className="font-semibold">Matched:</span> Both sides
                  found and linked together
                </li>
                <li>
                  <span className="font-semibold">Cancelled:</span> Transfer was
                  cancelled by user
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Pending Transfer?</DialogTitle>
            <DialogDescription>
              {selectedTransfer?.status === "pending" ? (
                <>
                  This will permanently delete this pending transfer record.
                  <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm">
                    <div className="font-medium text-gray-900">
                      {formatCurrency(selectedTransfer?.amount || 0)}
                    </div>
                    <div className="text-gray-600">
                      {formatDate(selectedTransfer?.transfer_date || "")}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  This transfer has been partially matched. Cancelling will mark
                  it as cancelled but preserve the record.
                  <div className="mt-4 p-3 bg-gray-50 rounded-md text-sm">
                    <div className="font-medium text-gray-900">
                      {formatCurrency(selectedTransfer?.amount || 0)}
                    </div>
                    <div className="text-gray-600">
                      {formatDate(selectedTransfer?.transfer_date || "")}
                    </div>
                  </div>
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Keep Transfer
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelTransfer}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : selectedTransfer?.status === "pending" ? (
                "Delete Transfer"
              ) : (
                "Cancel Transfer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
