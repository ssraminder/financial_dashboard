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
            <Card className="bg-white">
              <CardHeader>
                <CardTitle>Statement Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No transactions found for this statement.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="text-left p-3 font-semibold">Date</th>
                          <th className="text-left p-3 font-semibold">
                            Description
                          </th>
                          <th className="text-right p-3 font-semibold">
                            Cheques & Debits ($)
                          </th>
                          <th className="text-right p-3 font-semibold">
                            Deposits & Credits ($)
                          </th>
                          <th className="text-right p-3 font-semibold">
                            Balance ($)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Opening Balance Row */}
                        <tr className="bg-blue-50 font-semibold border-b">
                          <td className="p-3">
                            {formatDate(
                              selectedStatement.statement_period_start,
                            )}
                          </td>
                          <td className="p-3">Opening Balance</td>
                          <td className="p-3"></td>
                          <td className="p-3"></td>
                          <td className="p-3 text-right font-mono">
                            {formatCurrency(selectedStatement.opening_balance)}
                          </td>
                        </tr>

                        {/* Transaction Rows */}
                        {transactions.map((t, index) => (
                          <tr
                            key={t.id}
                            className={`
                              ${
                                index % 2 === 0 ? "bg-white" : "bg-gray-50"
                              } ${t.needs_review ? "bg-yellow-50" : ""}
                              hover:bg-blue-50 cursor-pointer border-b
                            `}
                            onClick={() => {
                              setSelectedTransaction(t);
                              setIsModalOpen(true);
                            }}
                          >
                            <td className="p-3">
                              {formatDateShort(t.transaction_date)}
                            </td>
                            <td className="p-3">
                              <div>{t.description}</div>
                              {t.payee_name &&
                                t.payee_name !== t.description && (
                                  <div className="text-sm text-gray-500">
                                    {t.payee_name}
                                  </div>
                                )}
                              {t.needs_review && (
                                <div className="text-xs text-yellow-600 font-semibold">
                                  ⚠️ Needs Review
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-right font-mono text-red-600">
                              {t.transaction_type === "debit"
                                ? formatNumber(t.total_amount)
                                : ""}
                            </td>
                            <td className="p-3 text-right font-mono text-green-600">
                              {t.transaction_type === "credit"
                                ? formatNumber(t.total_amount)
                                : ""}
                            </td>
                            <td className="p-3 text-right font-mono">
                              {t.running_balance !== null
                                ? formatCurrency(t.running_balance)
                                : "-"}
                            </td>
                          </tr>
                        ))}

                        {/* Closing Balance Row */}
                        <tr className="bg-blue-50 font-semibold border-t-2">
                          <td className="p-3">
                            {formatDate(selectedStatement.statement_period_end)}
                          </td>
                          <td className="p-3">Closing Balance</td>
                          <td className="p-3"></td>
                          <td className="p-3"></td>
                          <td className="p-3 text-right font-mono">
                            {formatCurrency(selectedStatement.closing_balance)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
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
