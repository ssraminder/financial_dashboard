import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  ArrowLeftRight,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

interface BankAccount {
  id: string;
  name: string;
  nickname: string | null;
  bank_name: string;
  account_number_last4: string;
  account_type: string;
  currency: string;
}

export default function ManualTransferEntry() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Wait for auth to load before checking
    if (authLoading) return;

    if (!user) {
      navigate("/login");
      return;
    }
    fetchBankAccounts();
  }, [user, authLoading, navigate]);

  const fetchBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select(
          "id, name, nickname, bank_name, account_number_last4, account_type, currency",
        )
        .eq("is_active", true)
        .order("bank_name", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (err) {
      console.error("Error fetching bank accounts:", err);
      toast.error("Failed to load bank accounts");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fromAccountId || !toAccountId || !amount || !transferDate) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (fromAccountId === toAccountId) {
      toast.error("Source and destination accounts must be different");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Amount must be a positive number");
      return;
    }

    setIsSubmitting(true);
    try {
      const fromAccount = bankAccounts.find((acc) => acc.id === fromAccountId);
      const toAccount = bankAccounts.find((acc) => acc.id === toAccountId);

      const { error } = await supabase.from("pending_transfers").insert({
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: amountNum,
        transfer_date: transferDate,
        description:
          description ||
          `Transfer from ${fromAccount?.name} to ${toAccount?.name}`,
        notes: notes || null,
        status: "pending",
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success(
        "Transfer recorded! It will be matched when statements are imported.",
      );

      // Reset form
      setFromAccountId("");
      setToAccountId("");
      setAmount("");
      setTransferDate("");
      setDescription("");
      setNotes("");

      // Navigate to pending transfers page
      setTimeout(() => {
        navigate("/pending-transfers");
      }, 1500);
    } catch (err) {
      console.error("Error creating transfer:", err);
      toast.error("Failed to create transfer");
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <div className="max-w-2xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <ArrowLeftRight className="h-8 w-8 text-blue-600" />
                <h1 className="text-3xl font-bold text-gray-900">
                  Record Manual Transfer
                </h1>
              </div>
              <p className="text-gray-600">
                Record a transfer between your accounts. It will automatically
                be matched when you import bank statements.
              </p>
            </div>

            {/* Form Card */}
            <Card>
              <CardHeader>
                <CardTitle>Transfer Details</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* From Account */}
                  <div className="space-y-2">
                    <Label htmlFor="from-account">
                      From Account (Money Out){" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={fromAccountId}
                      onValueChange={setFromAccountId}
                      disabled={isLoading || isSubmitting}
                    >
                      <SelectTrigger id="from-account">
                        <SelectValue placeholder="Select source account" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts
                          .filter((acc) => acc.id !== toAccountId)
                          .map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.bank_name} - {acc.nickname || acc.name} (••••
                              {acc.account_number_last4}) - {acc.currency}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* To Account */}
                  <div className="space-y-2">
                    <Label htmlFor="to-account">
                      To Account (Money In){" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={toAccountId}
                      onValueChange={setToAccountId}
                      disabled={isLoading || isSubmitting}
                    >
                      <SelectTrigger id="to-account">
                        <SelectValue placeholder="Select destination account" />
                      </SelectTrigger>
                      <SelectContent>
                        {bankAccounts
                          .filter((acc) => acc.id !== fromAccountId)
                          .map((acc) => (
                            <SelectItem key={acc.id} value={acc.id}>
                              {acc.bank_name} - {acc.nickname || acc.name} (••••
                              {acc.account_number_last4}) - {acc.currency}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <Label htmlFor="amount">
                      Amount <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        $
                      </span>
                      <Input
                        id="amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        className="pl-7"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  {/* Date */}
                  <div className="space-y-2">
                    <Label htmlFor="date">
                      Transfer Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="date"
                      type="date"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                      disabled={isSubmitting}
                      max={new Date().toISOString().split("T")[0]}
                    />
                  </div>

                  {/* Description (Optional) */}
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Input
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g., Monthly transfer for payroll"
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Notes (Optional) */}
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add any additional notes about this transfer..."
                      rows={3}
                      disabled={isSubmitting}
                    />
                  </div>

                  {/* Info Box */}
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      This creates a pending transfer record. When you import
                      bank statements containing this transfer, it will
                      automatically be matched and linked to prevent duplicates.
                    </AlertDescription>
                  </Alert>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4">
                    <Button
                      type="submit"
                      disabled={
                        !fromAccountId ||
                        !toAccountId ||
                        !amount ||
                        !transferDate ||
                        isSubmitting ||
                        isLoading
                      }
                      className="flex-1"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Recording Transfer...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Record Transfer
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => navigate("/pending-transfers")}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Help Text */}
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">
                How it works:
              </h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Record the transfer with the date and amount</li>
                <li>
                  Import your bank statements as usual (one or both accounts)
                </li>
                <li>
                  The system will automatically detect and link the matching
                  transactions
                </li>
                <li>
                  View the status on the{" "}
                  <button
                    onClick={() => navigate("/pending-transfers")}
                    className="underline font-medium hover:text-blue-900"
                  >
                    Pending Transfers
                  </button>{" "}
                  page
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
