import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { TransactionEditModal } from "@/components/TransactionEditModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, CheckCircle, Loader2, XCircle, AlertTriangle, Pencil, Save } from "lucide-react";
import { toast as sonnerToast } from "sonner";

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_number?: string;
  currency: string;
  account_type?: string;
}

interface Statement {
  id: string;
  statement_period_start: string;
  statement_period_end: string;
  opening_balance: number;
  closing_balance: number;
  total_transactions: number;
  total_credits: number;
  total_debits: number;
  file_name: string;
  imported_at: string;
}

interface Category {
  id: string;
  code: string;
  name: string;
  category_type: string;
}

interface Transaction {
  id: string;
  transaction_date: string;
  description: string;
  payee_name?: string;
  amount: number;
  total_amount: number;
  transaction_type: "credit" | "debit";
  running_balance: number;
  category?: Category;
  needs_review: boolean;
  bank_account?: {
    id: string;
    name: string;
    nickname: string;
    account_number?: string;
  };
  has_gst?: boolean;
  gst_amount?: number;
  category_id: string;
  is_edited?: boolean;
  edited_at?: string;
}

interface EditableTransaction extends Transaction {
  original_type: "credit" | "debit";
  original_amount: number;
  edited_type: "credit" | "debit";
  edited_amount: number;
  changed: boolean;
  calculated_balance?: number;
  index?: number;
}

interface BalanceCheck {
  calculatedBalance: number;
  difference: number;
  isBalanced: boolean;
}

export default function ViewStatements() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [selectedStatementId, setSelectedStatementId] = useState("");
  const [balanceCheck, setBalanceCheck] = useState<BalanceCheck | null>(null);

  // Modal state
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Editable transactions state
  const [editableTransactions, setEditableTransactions] = useState<EditableTransaction[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [editingAmountIndex, setEditingAmountIndex] = useState<number | null>(null);
  const [editingAmountValue, setEditingAmountValue] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Fetch bank accounts and categories on mount
  useEffect(() => {
    if (user) {
      fetchBankAccounts();
      fetchCategories();
    }
  }, [user]);

  // Fetch statements when bank account changes
  useEffect(() => {
    if (selectedBankAccountId) {
      fetchStatements();
      setSelectedStatementId("");
      setTransactions([]);
      setBalanceCheck(null);
    }
  }, [selectedBankAccountId]);

  // Fetch transactions when statement changes
  useEffect(() => {
    if (selectedStatementId) {
      fetchTransactions();
    }
  }, [selectedStatementId]);

  // Initialize editableTransactions when transactions load
  useEffect(() => {
    if (transactions && transactions.length > 0) {
      setEditableTransactions(
        transactions.map((t) => ({
          ...t,
          original_type: t.transaction_type,
          original_amount: t.total_amount || Math.abs(t.amount) || 0,
          edited_type: t.transaction_type,
          edited_amount: t.total_amount || Math.abs(t.amount) || 0,
          changed: false,
        }))
      );
      setHasUnsavedChanges(false);
    } else {
      setEditableTransactions([]);
    }
  }, [transactions]);

  const fetchBankAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, name, bank_name, account_number, currency, account_type")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (err) {
      console.error("Error fetching bank accounts:", err);
      toast({
        title: "Error",
        description: "Failed to load bank accounts",
        variant: "destructive",
      });
    }
  };

  const fetchStatements = async () => {
    if (!selectedBankAccountId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("statement_imports")
        .select(
          "id, statement_period_start, statement_period_end, opening_balance, closing_balance, total_transactions, total_credits, total_debits, file_name, imported_at",
        )
        .eq("bank_account_id", selectedBankAccountId)
        .order("statement_period_end", { ascending: false });

      if (error) throw error;
      setStatements(data || []);
    } catch (err) {
      console.error("Error fetching statements:", err);
      toast({
        title: "Error",
        description: "Failed to load statements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("categories")
        .select("id, code, name, category_type")
        .eq("is_active", true)
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const fetchTransactions = async () => {
    if (!selectedStatementId) return;

    try {
      setLoading(true);

      // Get the statement details for date filtering
      const statement = statements.find((s) => s.id === selectedStatementId);
      if (!statement) return;

      // Fetch transactions without joins
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select(
          `id,
           transaction_date,
           description,
           payee_name,
           total_amount,
           transaction_type,
           needs_review,
           category_id`,
        )
        .eq("bank_account_id", selectedBankAccountId)
        .gte("transaction_date", statement.statement_period_start)
        .lte("transaction_date", statement.statement_period_end)
        .order("transaction_date", { ascending: true })
        .order("id", { ascending: true });

      if (error) {
        console.error("Transactions query error:", error);
        throw error;
      }

      // Fetch categories separately
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("id, code, name, category_type");

      const categoryMap = new Map(categoriesData?.map((c) => [c.id, c]) || []);

      // Calculate running balance and add category info
      const selectedAccount = bankAccounts.find(
        (a) => a.id === selectedBankAccountId,
      );
      const isCreditCard =
        selectedAccount?.account_type?.toLowerCase() === "credit card";

      let runningBalance = statement.opening_balance;
      const transactionsWithCategory = (transactions || []).map((t) => {
        const amount = Math.abs(t.total_amount);
        if (isCreditCard) {
          // Credit card: debits increase balance, credits decrease
          if (t.transaction_type === "debit") {
            runningBalance += amount;
          } else {
            runningBalance -= amount;
          }
        } else {
          // Bank account: credits increase balance, debits decrease
          if (t.transaction_type === "credit") {
            runningBalance += amount;
          } else {
            runningBalance -= amount;
          }
        }

        return {
          ...t,
          category: categoryMap.get(t.category_id) || null,
          running_balance: runningBalance,
        };
      });

      setTransactions(transactionsWithCategory);

      // Calculate balance check
      const check = calculateBalanceCheck(
        transactionsWithCategory,
        statement,
        isCreditCard,
      );
      setBalanceCheck(check);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateBalanceCheck = (
    txns: Transaction[],
    statement: Statement,
    isCreditCard: boolean,
  ): BalanceCheck => {
    let calculatedBalance = statement.opening_balance;

    txns.forEach((t) => {
      const amount = Math.abs(t.total_amount);
      if (isCreditCard) {
        // Credit card: debits increase balance, credits decrease
        if (t.transaction_type === "debit") {
          calculatedBalance += amount;
        } else {
          calculatedBalance -= amount;
        }
      } else {
        // Bank account: credits increase balance, debits decrease
        if (t.transaction_type === "credit") {
          calculatedBalance += amount;
        } else {
          calculatedBalance -= amount;
        }
      }
    });

    calculatedBalance = Math.round(calculatedBalance * 100) / 100;
    const difference =
      Math.round((statement.closing_balance - calculatedBalance) * 100) / 100;
    const isBalanced = Math.abs(difference) < 0.02;

    return { calculatedBalance, difference, isBalanced };
  };

  // Helper functions
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(amount || 0);
  };

  const formatNumber = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Math.abs(amount || 0));
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-CA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateShort = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const selectedStatement = statements.find(
    (s) => s.id === selectedStatementId,
  );
  const selectedAccount = bankAccounts.find(
    (a) => a.id === selectedBankAccountId,
  );

  // Calculate running balances with current edits applied
  const calculateRunningBalances = useMemo(() => {
    if (!selectedStatement || editableTransactions.length === 0) return [];

    const isCreditCard =
      selectedAccount?.account_type?.toLowerCase() === "credit card";
    let runningBalance = selectedStatement.opening_balance;

    return editableTransactions.map((t, index) => {
      const amount = t.edited_amount;

      if (isCreditCard) {
        // Credit card: debits increase balance, credits decrease
        if (t.edited_type === "debit") {
          runningBalance += amount;
        } else {
          runningBalance -= amount;
        }
      } else {
        // Bank account: credits increase balance, debits decrease
        if (t.edited_type === "credit") {
          runningBalance += amount;
        } else {
          runningBalance -= amount;
        }
      }

      return {
        ...t,
        calculated_balance: Math.round(runningBalance * 100) / 100,
        index,
      };
    });
  }, [editableTransactions, selectedStatement, selectedAccount]);

  // Check if final balance matches statement closing
  const calculatedClosing =
    calculateRunningBalances.length > 0
      ? calculateRunningBalances[calculateRunningBalances.length - 1]
          .calculated_balance || 0
      : 0;
  const expectedClosing = selectedStatement?.closing_balance || 0;
  const isBalanced = Math.abs(calculatedClosing - expectedClosing) < 0.02;

  // Toggle transaction direction
  const toggleTransactionDirection = (index: number) => {
    setEditableTransactions((prev) =>
      prev.map((t, i) => {
        if (i === index) {
          const newType = t.edited_type === "credit" ? "debit" : "credit";
          return {
            ...t,
            edited_type: newType,
            changed:
              newType !== t.original_type ||
              t.edited_amount !== t.original_amount,
          };
        }
        return t;
      })
    );
    setHasUnsavedChanges(true);
  };

  // Start editing amount
  const startEditAmount = (index: number, currentAmount: number) => {
    setEditingAmountIndex(index);
    setEditingAmountValue(currentAmount.toString());
  };

  // Save edited amount
  const saveEditAmount = (index: number) => {
    const newAmount = parseFloat(editingAmountValue);
    if (!isNaN(newAmount) && newAmount >= 0) {
      setEditableTransactions((prev) =>
        prev.map((t, i) => {
          if (i === index) {
            return {
              ...t,
              edited_amount: newAmount,
              changed:
                t.edited_type !== t.original_type ||
                newAmount !== t.original_amount,
            };
          }
          return t;
        })
      );
      setHasUnsavedChanges(true);
    }
    setEditingAmountIndex(null);
    setEditingAmountValue("");
  };

  // Save all changes to database
  const saveAllChanges = async () => {
    const changedTransactions = editableTransactions.filter((t) => t.changed);

    if (changedTransactions.length === 0) {
      sonnerToast.info("No changes to save");
      return;
    }

    setSavingChanges(true);

    try {
      // Update each changed transaction
      const updates = changedTransactions.map((t) => {
        const signedAmount =
          t.edited_type === "credit" ? t.edited_amount : -t.edited_amount;

        return supabase
          .from("transactions")
          .update({
            transaction_type: t.edited_type,
            total_amount: t.edited_amount,
            amount: signedAmount,
            is_edited: true,
            edited_at: new Date().toISOString(),
          })
          .eq("id", t.id);
      });

      const results = await Promise.all(updates);

      const errors = results.filter((r) => r.error);
      if (errors.length > 0) {
        console.error("Some updates failed:", errors);
        sonnerToast.error(`${errors.length} transactions failed to save`);
      } else {
        sonnerToast.success(`${changedTransactions.length} transactions updated`);

        // Reset changed flags
        setEditableTransactions((prev) =>
          prev.map((t) => ({
            ...t,
            original_type: t.edited_type,
            original_amount: t.edited_amount,
            changed: false,
          }))
        );
        setHasUnsavedChanges(false);

        // Refresh transactions from database
        await fetchTransactions();
      }
    } catch (err) {
      console.error("Save error:", err);
      sonnerToast.error("Failed to save changes");
    }

    setSavingChanges(false);
  };

  // Reset all changes
  const resetAllChanges = () => {
    setEditableTransactions((prev) =>
      prev.map((t) => ({
        ...t,
        edited_type: t.original_type,
        edited_amount: t.original_amount,
        changed: false,
      }))
    );
    setHasUnsavedChanges(false);
    setEditingAmountIndex(null);
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

      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b bg-card px-8 py-6">
          <h1 className="text-2xl font-bold">View Statements</h1>
          <p className="text-muted-foreground">
            Browse imported bank statements
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-8 py-6">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="space-y-2">
              <Label htmlFor="bank-account">Select Bank Account</Label>
              <Select
                value={selectedBankAccountId}
                onValueChange={setSelectedBankAccountId}
              >
                <SelectTrigger id="bank-account">
                  <SelectValue placeholder="Choose a bank account..." />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.bank_name} - {account.name} ( ••••
                      {account.account_number?.slice(-4) || "****"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="statement">Select Statement</Label>
              <Select
                value={selectedStatementId}
                onValueChange={setSelectedStatementId}
                disabled={!selectedBankAccountId}
              >
                <SelectTrigger id="statement">
                  <SelectValue placeholder="Choose a statement..." />
                </SelectTrigger>
                <SelectContent>
                  {statements.map((statement) => (
                    <SelectItem key={statement.id} value={statement.id}>
                      {formatDate(statement.statement_period_start)} to{" "}
                      {formatDate(statement.statement_period_end)} (
                      {statement.total_transactions} txns)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Statement Summary Card */}
          {selectedStatement && (
            <Card className="mb-6 bg-white">
              <CardHeader>
                <CardTitle>Statement Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Balance Discrepancy Alert */}
                {balanceCheck && !balanceCheck.isBalanced && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-800 flex items-center">
                      <AlertCircle className="w-5 h-5 mr-2" />
                      Balance Discrepancy Detected
                    </h3>
                    <div className="mt-2 text-sm text-red-700 space-y-1">
                      <p>
                        Statement Closing Balance:{" "}
                        {formatCurrency(selectedStatement.closing_balance)}
                      </p>
                      <p>
                        Calculated from Transactions:{" "}
                        {formatCurrency(balanceCheck.calculatedBalance)}
                      </p>
                      <p className="font-semibold">
                        Difference: {formatCurrency(balanceCheck.difference)}
                      </p>
                    </div>
                    <p className="mt-2 text-sm text-red-600">
                      This may indicate a missing transaction, incorrect amount,
                      or wrong transaction type (debit/credit).
                    </p>
                  </div>
                )}

                {/* First row - Key metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Statement Period</p>
                    <p className="text-lg font-semibold">
                      {formatDate(selectedStatement.statement_period_start)} -{" "}
                      {formatDate(selectedStatement.statement_period_end)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Opening Balance</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(selectedStatement.opening_balance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Closing Balance</p>
                    <p className="text-lg font-semibold">
                      {formatCurrency(selectedStatement.closing_balance)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Balance Check</p>
                    {balanceCheck ? (
                      balanceCheck.isBalanced ? (
                        <div className="flex items-center text-green-600 font-semibold">
                          <CheckCircle className="w-5 h-5 mr-1" />
                          Balanced ✓
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <div className="flex items-center text-red-600 font-semibold">
                            <AlertCircle className="w-5 h-5 mr-1" />
                            Mismatch
                          </div>
                          <p className="text-xs text-red-600">
                            ${Math.abs(balanceCheck.difference).toFixed(2)}
                          </p>
                        </div>
                      )
                    ) : null}
                  </div>
                </div>

                {/* Second row - Totals */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-gray-500">Total Credits</p>
                    <p className="text-lg font-semibold text-green-600">
                      +{formatCurrency(selectedStatement.total_credits)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Total Debits</p>
                    <p className="text-lg font-semibold text-red-600">
                      -{formatCurrency(selectedStatement.total_debits)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Transactions</p>
                    <p className="text-lg font-semibold">
                      {selectedStatement.total_transactions}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Imported</p>
                    <p className="text-lg font-semibold">
                      {formatDateTime(selectedStatement.imported_at)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transactions Table */}
          {selectedStatement && (
            <>
              {/* Balance Status Bar */}
              <div
                className={`mb-4 p-4 rounded-lg ${
                  isBalanced
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <span className="text-sm text-gray-600">Opening:</span>
                      <span className="ml-2 font-bold">
                        $
                        {selectedStatement.opening_balance?.toLocaleString(
                          "en-CA",
                          { minimumFractionDigits: 2 }
                        )}
                      </span>
                    </div>
                    <span className="text-gray-400">→</span>
                    <div>
                      <span className="text-sm text-gray-600">
                        Expected Closing:
                      </span>
                      <span className="ml-2 font-bold">
                        $
                        {expectedClosing.toLocaleString("en-CA", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                    <span className="text-gray-400">→</span>
                    <div>
                      <span className="text-sm text-gray-600">Calculated:</span>
                      <span
                        className={`ml-2 font-bold ${
                          isBalanced ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        $
                        {calculatedClosing.toLocaleString("en-CA", {
                          minimumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isBalanced ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <CheckCircle className="h-4 w-4" /> Balanced
                      </span>
                    ) : (
                      <span className="text-red-600 flex items-center gap-1">
                        <XCircle className="h-4 w-4" /> Off by $
                        {Math.abs(calculatedClosing - expectedClosing).toFixed(
                          2
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Unsaved Changes Bar */}
              {hasUnsavedChanges && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center justify-between">
                  <span className="text-yellow-800 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {editableTransactions.filter((t) => t.changed).length}{" "}
                    transaction(s) have unsaved changes
                  </span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetAllChanges}>
                      Reset
                    </Button>
                    <Button
                      size="sm"
                      onClick={saveAllChanges}
                      disabled={savingChanges}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      {savingChanges ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                          Saving...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" /> Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Interactive Transaction Table */}
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : editableTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found for this statement.
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-gray-100 border-b font-medium text-sm text-gray-600">
                      <div className="col-span-1">Date</div>
                      <div className="col-span-1">Type</div>
                      <div className="col-span-5">Description</div>
                      <div className="col-span-2 text-right">Amount</div>
                      <div className="col-span-2 text-right">Balance</div>
                      <div className="col-span-1 text-center">Status</div>
                    </div>

                    {/* Transaction Rows */}
                    <div className="divide-y">
                      {calculateRunningBalances.map((t, index) => (
                        <div
                          key={t.id}
                          className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm
                            ${
                              t.changed
                                ? "bg-yellow-50 border-l-4 border-l-yellow-400"
                                : "hover:bg-gray-50"
                            }
                            ${t.needs_review ? "bg-orange-50" : ""}
                          `}
                        >
                          {/* Date */}
                          <div className="col-span-1 text-gray-600">
                            {new Date(t.transaction_date).toLocaleDateString(
                              "en-CA",
                              { month: "short", day: "numeric" }
                            )}
                          </div>

                          {/* Type Toggle Button */}
                          <div className="col-span-1">
                            <button
                              onClick={() => toggleTransactionDirection(index)}
                              className={`px-2 py-1 rounded text-xs font-bold transition-all hover:scale-105 w-full
                                ${
                                  t.edited_type === "credit"
                                    ? "bg-green-500 hover:bg-green-600 text-white"
                                    : "bg-red-500 hover:bg-red-600 text-white"
                                }
                              `}
                              title="Click to flip direction"
                            >
                              {t.edited_type === "credit" ? "↓ IN" : "↑ OUT"}
                            </button>
                          </div>

                          {/* Description */}
                          <div className="col-span-5 truncate" title={t.description}>
                            <span className="font-medium">
                              {t.payee_name || t.description}
                            </span>
                            {t.payee_name &&
                              t.payee_name !== t.description && (
                                <span className="text-gray-400 text-xs block truncate">
                                  {t.description}
                                </span>
                              )}
                          </div>

                          {/* Editable Amount */}
                          <div className="col-span-2 text-right">
                            {editingAmountIndex === index ? (
                              <div className="flex items-center justify-end gap-1">
                                <span className="text-gray-400">$</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={editingAmountValue}
                                  onChange={(e) =>
                                    setEditingAmountValue(e.target.value)
                                  }
                                  onBlur={() => saveEditAmount(index)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") saveEditAmount(index);
                                    if (e.key === "Escape") {
                                      setEditingAmountIndex(null);
                                      setEditingAmountValue("");
                                    }
                                  }}
                                  className="w-24 px-2 py-1 border rounded text-right text-sm focus:ring-2 focus:ring-blue-500"
                                  autoFocus
                                />
                              </div>
                            ) : (
                              <span
                                onDoubleClick={() =>
                                  startEditAmount(index, t.edited_amount)
                                }
                                className={`cursor-pointer hover:bg-gray-100 px-2 py-1 rounded font-mono font-medium
                                  ${
                                    t.edited_type === "credit"
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }
                                `}
                                title="Double-click to edit amount"
                              >
                                {t.edited_type === "credit" ? "+" : "-"}$
                                {t.edited_amount.toLocaleString("en-CA", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            )}
                          </div>

                          {/* Running Balance */}
                          <div className="col-span-2 text-right font-mono">
                            $
                            {(t.calculated_balance || 0).toLocaleString("en-CA", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>

                          {/* Status Indicators */}
                          <div className="col-span-1 text-center flex items-center justify-center gap-1">
                            {t.changed && (
                              <span
                                className="w-2 h-2 rounded-full bg-yellow-400"
                                title="Unsaved changes"
                              />
                            )}
                            {t.needs_review && (
                              <AlertTriangle
                                className="h-4 w-4 text-orange-500"
                                title="Needs review"
                              />
                            )}
                            {t.is_edited && !t.changed && (
                              <Pencil
                                className="h-3 w-3 text-blue-400"
                                title="Previously edited"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Table Footer */}
                    <div className="px-4 py-3 bg-gray-50 border-t">
                      <div className="grid grid-cols-12 gap-2 text-sm">
                        <div className="col-span-7 font-medium">Totals</div>
                        <div className="col-span-2 text-right font-mono">
                          <span className="text-red-600">
                            -$
                            {editableTransactions
                              .filter((t) => t.edited_type === "debit")
                              .reduce((sum, t) => sum + t.edited_amount, 0)
                              .toLocaleString("en-CA", {
                                minimumFractionDigits: 2,
                              })}
                          </span>
                          <br />
                          <span className="text-green-600">
                            +$
                            {editableTransactions
                              .filter((t) => t.edited_type === "credit")
                              .reduce((sum, t) => sum + t.edited_amount, 0)
                              .toLocaleString("en-CA", {
                                minimumFractionDigits: 2,
                              })}
                          </span>
                        </div>
                        <div className="col-span-2 text-right font-mono font-bold">
                          $
                          {calculatedClosing.toLocaleString("en-CA", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div className="col-span-1"></div>
                      </div>
                    </div>
                  </div>

                  {/* Help Text */}
                  <p className="text-xs text-gray-500 mt-4 text-center">
                    💡 Click direction button to flip IN ↔ OUT • Double-click
                    amount to edit • Changes update balance in real-time
                  </p>
                </>
              )}
            </>
          )}

          {/* Empty state */}
          {!selectedStatement && (
            <Card className="bg-white">
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <p className="text-lg mb-2">
                    Select a bank account and statement to view details
                  </p>
                  <p className="text-sm">
                    Statements are imported from CSV uploads and displayed in
                    bank statement format.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Transaction Edit Modal */}
      {selectedTransaction && (
        <TransactionEditModal
          transaction={selectedTransaction}
          categories={categories}
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTransaction(null);
          }}
          onSave={() => {
            fetchTransactions();
          }}
        />
      )}
    </div>
  );
}
