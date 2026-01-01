import { useEffect, useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { TransactionEditModal } from "@/components/TransactionEditModal";
import { ExportDropdown } from "@/components/ExportDropdown";
import { DeleteStatementModal } from "@/components/DeleteStatementModal";
import { ConfirmStatementModal } from "@/components/ConfirmStatementModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  XCircle,
  AlertTriangle,
  Pencil,
  Save,
  Filter,
  X as XIcon,
  Trash2,
  Lock,
  Check,
} from "lucide-react";
import { toast as sonnerToast } from "sonner";

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_number?: string;
  account_number_last4?: string;
  currency: string;
  account_type?: string;
  balance_type?: string;
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
  import_status?:
    | "processing"
    | "pending_review"
    | "confirmed"
    | "completed"
    | "error";
  confirmed_at?: string;
  confirmed_by?: string;
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
  posting_date?: string;
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
  is_locked?: boolean;
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
  const [searchParams] = useSearchParams();

  // State
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [selectedBankAccountId, setSelectedBankAccountId] = useState("");
  const [selectedStatementId, setSelectedStatementId] = useState("");
  const [paramsProcessed, setParamsProcessed] = useState(false);
  const [balanceCheck, setBalanceCheck] = useState<BalanceCheck | null>(null);

  // Modal state
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Editable transactions state
  const [editableTransactions, setEditableTransactions] = useState<
    EditableTransaction[]
  >([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savingChanges, setSavingChanges] = useState(false);
  const [editingAmountIndex, setEditingAmountIndex] = useState<number | null>(
    null,
  );
  const [editingAmountValue, setEditingAmountValue] = useState("");

  // Filter state
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterType, setFilterType] = useState<"all" | "credit" | "debit">(
    "all",
  );
  const [filterDescription, setFilterDescription] = useState("");
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "changed" | "needs_review" | "edited"
  >("all");
  const [showFilters, setShowFilters] = useState(false);

  // Delete statement state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Confirm statement state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

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

  // Handle query parameters for auto-selection
  useEffect(() => {
    if (!paramsProcessed && bankAccounts.length > 0) {
      const accountParam = searchParams.get("account");
      const statementParam = searchParams.get("statement");

      if (accountParam && bankAccounts.some((acc) => acc.id === accountParam)) {
        setSelectedBankAccountId(accountParam);
        // Statement will be auto-selected after statements are fetched
        if (statementParam) {
          setSelectedStatementId(statementParam);
        }
        setParamsProcessed(true);
      }
    }
  }, [bankAccounts, searchParams, paramsProcessed]);

  // Fetch statements when bank account changes
  useEffect(() => {
    if (selectedBankAccountId) {
      fetchStatements();
      // Only clear statement if it wasn't explicitly set by query params
      if (!searchParams.get("statement")) {
        setSelectedStatementId("");
      }
      setTransactions([]);
      setBalanceCheck(null);
    }
  }, [selectedBankAccountId, searchParams]);

  // Fetch transactions when statement changes
  useEffect(() => {
    if (selectedStatement?.id) {
      fetchTransactions();
    } else {
      setTransactions([]);
      setBalanceCheck(null);
    }
  }, [selectedStatement?.id]);

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
        })),
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
        .select(
          "id, name, bank_name, account_number, account_number_last4, currency, account_type, balance_type",
        )
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
          "id, statement_period_start, statement_period_end, opening_balance, closing_balance, total_transactions, total_credits, total_debits, file_name, imported_at, import_status, confirmed_at, confirmed_by",
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
    // Guard: need a selected statement
    if (!selectedStatement?.id) {
      console.log("No statement ID, returning early");
      setTransactions([]);
      setBalanceCheck(null);
      return;
    }

    console.log("fetchTransactions called");
    console.log("selectedStatement:", selectedStatement);
    console.log("selectedStatement.id:", selectedStatement?.id);

    try {
      setLoading(true);

      // Fetch transactions by statement_import_id
      const { data: transactions, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("statement_import_id", selectedStatement.id)
        .order("transaction_date", { ascending: true });

      if (error) {
        console.error("Transactions query error:", error);
        throw error;
      }

      console.log("Query result:", transactions);
      console.log("Transaction count:", transactions?.length);

      // Fetch categories separately
      const { data: categoriesData } = await supabase
        .from("categories")
        .select("id, code, name, category_type");

      const categoryMap = new Map(categoriesData?.map((c) => [c.id, c]) || []);

      // Add category info - use running_balance from database
      const transactionsWithCategory = (transactions || []).map((t) => {
        return {
          ...t,
          category: categoryMap.get(t.category_id) || null,
        };
      });

      setTransactions(transactionsWithCategory);

      // Calculate balance check using last transaction's running_balance from database
      const check = calculateBalanceCheckFromDatabase(
        transactionsWithCategory,
        selectedStatement,
      );
      setBalanceCheck(check);
    } catch (err) {
      console.error("Error fetching transactions:", err);
      toast({
        title: "Error",
        description: "Failed to load transactions",
        variant: "destructive",
      });
      setTransactions([]);
      setBalanceCheck(null);
    } finally {
      setLoading(false);
    }
  };

  const calculateBalanceCheckFromDatabase = (
    txns: Transaction[],
    statement: Statement,
  ): BalanceCheck => {
    // Use the last transaction's running_balance from the database
    const calculatedBalance =
      txns.length > 0 && txns[txns.length - 1].running_balance !== undefined
        ? Math.round((txns[txns.length - 1].running_balance || 0) * 100) / 100
        : statement.opening_balance;

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

  // Timezone-safe date formatting - parses date string directly without Date() conversion
  const formatDateSafe = (dateStr: string, options?: { short?: boolean }) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;

    const months = options?.short
      ? [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ]
      : [
          "January",
          "February",
          "March",
          "April",
          "May",
          "June",
          "July",
          "August",
          "September",
          "October",
          "November",
          "December",
        ];

    return `${months[parseInt(month) - 1]} ${parseInt(day)}, ${year}`;
  };

  const formatDate = (dateStr: string) =>
    formatDateSafe(dateStr, { short: true });

  const formatDateShort = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    if (!year || !month || !day) return dateStr;
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[parseInt(month) - 1]} ${parseInt(day)}`;
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

    const isLiability = selectedAccount?.balance_type === "liability";
    let runningBalance = selectedStatement.opening_balance;

    return editableTransactions.map((t, index) => {
      const amount = t.edited_amount;

      if (isLiability) {
        // Credit Card, LOC: debits increase balance, credits decrease
        if (t.edited_type === "debit") {
          runningBalance += amount;
        } else {
          runningBalance -= amount;
        }
      } else {
        // Chequing, Savings: credits increase balance, debits decrease
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

  // Apply filters to transactions
  const filteredTransactions = useMemo(() => {
    let filtered = calculateRunningBalances;

    // Date filter
    if (filterDateFrom) {
      filtered = filtered.filter((t) => t.transaction_date >= filterDateFrom);
    }
    if (filterDateTo) {
      filtered = filtered.filter((t) => t.transaction_date <= filterDateTo);
    }

    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter((t) => t.edited_type === filterType);
    }

    // Description filter (fuzzy search)
    if (filterDescription.trim()) {
      const searchTerm = filterDescription.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.description?.toLowerCase().includes(searchTerm) ||
          t.payee_name?.toLowerCase().includes(searchTerm),
      );
    }

    // Amount filter (fuzzy range)
    if (filterAmountMin) {
      const min = parseFloat(filterAmountMin);
      if (!isNaN(min)) {
        filtered = filtered.filter((t) => t.edited_amount >= min);
      }
    }
    if (filterAmountMax) {
      const max = parseFloat(filterAmountMax);
      if (!isNaN(max)) {
        filtered = filtered.filter((t) => t.edited_amount <= max);
      }
    }

    // Status filter
    if (filterStatus !== "all") {
      if (filterStatus === "changed") {
        filtered = filtered.filter((t) => t.changed);
      } else if (filterStatus === "needs_review") {
        filtered = filtered.filter((t) => t.needs_review);
      } else if (filterStatus === "edited") {
        filtered = filtered.filter((t) => t.is_edited && !t.changed);
      }
    }

    return filtered;
  }, [
    calculateRunningBalances,
    filterDateFrom,
    filterDateTo,
    filterType,
    filterDescription,
    filterAmountMin,
    filterAmountMax,
    filterStatus,
  ]);

  // Check if final balance matches statement closing
  const lastTransaction = transactions[transactions.length - 1];
  const hasEdits = editableTransactions.some((t) => t.changed);
  const calculatedClosing =
    lastTransaction && !hasEdits
      ? lastTransaction.running_balance || 0
      : calculateRunningBalances.length > 0
        ? calculateRunningBalances[calculateRunningBalances.length - 1]
            .calculated_balance || 0
        : 0;
  const expectedClosing = selectedStatement?.closing_balance || 0;
  const isBalanced = Math.abs(calculatedClosing - expectedClosing) < 0.02;

  // Count active filters
  const activeFilterCount = [
    filterDateFrom,
    filterDateTo,
    filterType !== "all",
    filterDescription,
    filterAmountMin,
    filterAmountMax,
    filterStatus !== "all",
  ].filter(Boolean).length;

  // Clear all filters
  const clearAllFilters = () => {
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterType("all");
    setFilterDescription("");
    setFilterAmountMin("");
    setFilterAmountMax("");
    setFilterStatus("all");
  };

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
      }),
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
        }),
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
        sonnerToast.success(
          `${changedTransactions.length} transactions updated`,
        );

        // Reset changed flags
        setEditableTransactions((prev) =>
          prev.map((t) => ({
            ...t,
            original_type: t.edited_type,
            original_amount: t.edited_amount,
            changed: false,
          })),
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
      })),
    );
    setHasUnsavedChanges(false);
    setEditingAmountIndex(null);
  };

  // Confirm statement
  const handleConfirmStatement = async () => {
    if (!selectedStatement) return;

    setIsConfirming(true);

    try {
      // 1. Update statement status to confirmed
      const { error: stmtError } = await supabase
        .from("statement_imports")
        .update({
          import_status: "confirmed",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", selectedStatement.id);

      if (stmtError) throw stmtError;

      // 2. Lock all transactions in this statement
      const { error: txError } = await supabase
        .from("transactions")
        .update({ is_locked: true })
        .eq("statement_import_id", selectedStatement.id);

      if (txError) throw txError;

      // Success
      sonnerToast.success("Statement confirmed successfully");
      setShowConfirmModal(false);

      // Refresh statement data
      await fetchStatements();

      // Refresh transactions to get is_locked status
      await fetchTransactions();
    } catch (error) {
      console.error("Error confirming statement:", error);
      sonnerToast.error("Failed to confirm statement. Please try again.");
    } finally {
      setIsConfirming(false);
    }
  };

  // Delete statement
  const handleDeleteStatement = async () => {
    if (!selectedStatement) return;

    setIsDeleting(true);

    try {
      // Delete transactions first (foreign key constraint)
      const { error: txError } = await supabase
        .from("transactions")
        .delete()
        .eq("statement_import_id", selectedStatement.id);

      if (txError) throw txError;

      // Delete statement import
      const { error: stmtError } = await supabase
        .from("statement_imports")
        .delete()
        .eq("id", selectedStatement.id);

      if (stmtError) throw stmtError;

      // Success
      sonnerToast.success("Statement deleted successfully");
      setShowDeleteModal(false);

      // Refresh statements list
      await fetchStatements();

      // Clear selection
      setSelectedStatementId("");
      setTransactions([]);
      setBalanceCheck(null);
    } catch (error) {
      console.error("Error deleting statement:", error);
      sonnerToast.error("Failed to delete statement. Please try again.");
    } finally {
      setIsDeleting(false);
    }
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
                      {account.account_number_last4 || "****"})
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

          {/* Statement Header with Export */}
          {selectedStatement && selectedAccount && (
            <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-6">
              {/* Header Bar */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
                <div className="flex justify-between items-center">
                  <div className="text-white">
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-xl font-bold">
                        Account Activity Details
                      </h2>

                      {/* Status Badge */}
                      {selectedStatement?.import_status ===
                        "pending_review" && (
                        <span className="px-2 py-1 bg-yellow-500 text-yellow-900 text-xs font-medium rounded">
                          Pending Review
                        </span>
                      )}
                      {selectedStatement?.import_status === "confirmed" && (
                        <span className="px-2 py-1 bg-green-500 text-white text-xs font-medium rounded flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Confirmed
                        </span>
                      )}
                    </div>
                    <p className="text-blue-100">
                      {selectedAccount.bank_name} - Account ••••
                      {selectedAccount.account_number_last4 || "****"}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <ExportDropdown
                      statement={selectedStatement}
                      transactions={
                        filteredTransactions.length > 0
                          ? filteredTransactions
                          : editableTransactions.length > 0
                            ? editableTransactions
                            : transactions
                      }
                      bankAccount={selectedAccount}
                    />

                    {/* Confirm Button - only for unconfirmed statements */}
                    {(selectedStatement?.import_status === "pending_review" ||
                      selectedStatement?.import_status === "processing") && (
                      <button
                        onClick={() => setShowConfirmModal(true)}
                        disabled={!isBalanced}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 font-medium transition-colors ${
                          isBalanced
                            ? "bg-green-600 text-white hover:bg-green-700"
                            : "bg-gray-200 text-gray-500 cursor-not-allowed"
                        }`}
                        title={
                          !isBalanced
                            ? "Statement must be balanced before confirming"
                            : "Confirm statement"
                        }
                      >
                        <Check className="w-5 h-5" />
                        Confirm Statement
                      </button>
                    )}

                    {/* Confirmed Badge - for confirmed statements */}
                    {selectedStatement?.import_status === "confirmed" && (
                      <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 px-3 py-1.5 rounded-lg">
                        <Lock className="w-4 h-4" />
                        <span className="font-medium">Confirmed</span>
                        {selectedStatement.confirmed_at && (
                          <span className="text-green-600 text-sm">
                            {formatDateSafe(
                              selectedStatement.confirmed_at.split("T")[0],
                              { short: true },
                            )}
                          </span>
                        )}
                      </div>
                    )}

                    <button
                      onClick={() => setShowDeleteModal(true)}
                      className="text-red-50 hover:bg-red-700 px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors"
                      title="Delete this statement"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>

              {/* Statement Period - FROM statement_imports TABLE */}
              <div className="px-6 py-4 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">Statement Period</p>
                    <p className="text-lg font-bold text-gray-800">
                      {formatDateSafe(selectedStatement.statement_period_start)}{" "}
                      &mdash;{" "}
                      {formatDateSafe(selectedStatement.statement_period_end)}
                    </p>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>
                      Imported:{" "}
                      {formatDateSafe(
                        selectedStatement.imported_at.split("T")[0],
                        { short: true },
                      )}
                    </p>
                    <p>
                      {selectedStatement.total_transactions ||
                        transactions?.length ||
                        0}{" "}
                      transactions
                    </p>
                  </div>
                </div>
              </div>

              {/* Balance Discrepancy Alert */}
              {balanceCheck && !balanceCheck.isBalanced && (
                <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
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

              {/* Balance Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6">
                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <p className="text-sm text-blue-600 font-medium">
                    Opening Balance
                  </p>
                  <p className="text-2xl font-bold text-blue-800">
                    $
                    {selectedStatement.opening_balance?.toLocaleString(
                      "en-CA",
                      {
                        minimumFractionDigits: 2,
                      },
                    ) || "0.00"}
                  </p>
                </div>

                <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                  <p className="text-sm text-green-600 font-medium">
                    Total Credits
                  </p>
                  <p className="text-2xl font-bold text-green-700">
                    +$
                    {selectedStatement.total_credits?.toLocaleString("en-CA", {
                      minimumFractionDigits: 2,
                    }) || "0.00"}
                  </p>
                </div>

                <div className="bg-red-50 rounded-lg p-4 border border-red-100">
                  <p className="text-sm text-red-600 font-medium">
                    Total Debits
                  </p>
                  <p className="text-2xl font-bold text-red-700">
                    -$
                    {selectedStatement.total_debits?.toLocaleString("en-CA", {
                      minimumFractionDigits: 2,
                    }) || "0.00"}
                  </p>
                </div>

                <div className="bg-gray-100 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm text-gray-600 font-medium">
                    Closing Balance
                  </p>
                  <p className="text-2xl font-bold text-gray-800">
                    $
                    {selectedStatement.closing_balance?.toLocaleString(
                      "en-CA",
                      {
                        minimumFractionDigits: 2,
                      },
                    ) || "0.00"}
                  </p>
                  {balanceCheck && (
                    <div className="mt-2">
                      {balanceCheck.isBalanced ? (
                        <div className="flex items-center text-green-600 text-xs font-semibold">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Balanced ✓
                        </div>
                      ) : (
                        <div className="flex items-center text-red-600 text-xs font-semibold">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Off by ${Math.abs(balanceCheck.difference).toFixed(2)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Transactions Table */}
          {selectedStatement && (
            <>
              {/* Filter Toggle and Summary */}
              <div className="mb-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  {showFilters ? "Hide Filters" : "Show Filters"}
                  {activeFilterCount > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>

                {activeFilterCount > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">
                      Showing {filteredTransactions.length} of{" "}
                      {calculateRunningBalances.length} transactions
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <XIcon className="h-3 w-3" />
                      Clear All
                    </Button>
                  </div>
                )}
              </div>

              {/* Filter Panel */}
              {showFilters && (
                <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Date From */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="filter-date-from"
                        className="text-xs font-medium text-gray-700"
                      >
                        Date From
                      </Label>
                      <Input
                        id="filter-date-from"
                        type="date"
                        value={filterDateFrom}
                        onChange={(e) => setFilterDateFrom(e.target.value)}
                        className="text-sm"
                      />
                    </div>

                    {/* Date To */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="filter-date-to"
                        className="text-xs font-medium text-gray-700"
                      >
                        Date To
                      </Label>
                      <Input
                        id="filter-date-to"
                        type="date"
                        value={filterDateTo}
                        onChange={(e) => setFilterDateTo(e.target.value)}
                        className="text-sm"
                      />
                    </div>

                    {/* Type */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="filter-type"
                        className="text-xs font-medium text-gray-700"
                      >
                        Type
                      </Label>
                      <Select
                        value={filterType}
                        onValueChange={(val: any) => setFilterType(val)}
                      >
                        <SelectTrigger id="filter-type" className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="credit">Credit (IN)</SelectItem>
                          <SelectItem value="debit">Debit (OUT)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Status */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="filter-status"
                        className="text-xs font-medium text-gray-700"
                      >
                        Status
                      </Label>
                      <Select
                        value={filterStatus}
                        onValueChange={(val: any) => setFilterStatus(val)}
                      >
                        <SelectTrigger id="filter-status" className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="changed">
                            Changed (Unsaved)
                          </SelectItem>
                          <SelectItem value="needs_review">
                            Needs Review
                          </SelectItem>
                          <SelectItem value="edited">
                            Previously Edited
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Description */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="filter-description"
                        className="text-xs font-medium text-gray-700"
                      >
                        Description (fuzzy search)
                      </Label>
                      <Input
                        id="filter-description"
                        type="text"
                        placeholder="Search description or payee..."
                        value={filterDescription}
                        onChange={(e) => setFilterDescription(e.target.value)}
                        className="text-sm"
                      />
                    </div>

                    {/* Amount Min */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="filter-amount-min"
                        className="text-xs font-medium text-gray-700"
                      >
                        Amount Min ($)
                      </Label>
                      <Input
                        id="filter-amount-min"
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={filterAmountMin}
                        onChange={(e) => setFilterAmountMin(e.target.value)}
                        className="text-sm"
                      />
                    </div>

                    {/* Amount Max */}
                    <div className="space-y-2">
                      <Label
                        htmlFor="filter-amount-max"
                        className="text-xs font-medium text-gray-700"
                      >
                        Amount Max ($)
                      </Label>
                      <Input
                        id="filter-amount-max"
                        type="number"
                        step="0.01"
                        placeholder="9999.99"
                        value={filterAmountMax}
                        onChange={(e) => setFilterAmountMax(e.target.value)}
                        className="text-sm"
                      />
                    </div>
                  </div>

                  {/* Filter Explanations */}
                  <div className="pt-2 border-t border-gray-300">
                    <p className="text-xs text-gray-500">
                      <strong>Status filters:</strong>
                      <span className="ml-1">
                        <strong>Changed</strong> = Unsaved edits (yellow rows) •
                        <strong className="ml-1">Needs Review</strong> = Flagged
                        for manual review •
                        <strong className="ml-1">Previously Edited</strong> =
                        Saved edits from past sessions
                      </span>
                    </p>
                  </div>
                </div>
              )}

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
                          { minimumFractionDigits: 2 },
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
                          2,
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetAllChanges}
                    >
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
              ) : filteredTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Filter className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                  <p className="font-medium">
                    No transactions match your filters
                  </p>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={clearAllFilters}
                    className="mt-2"
                  >
                    Clear all filters
                  </Button>
                </div>
              ) : (
                <>
                  <div className="bg-white rounded-lg shadow overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-[auto_1fr_auto_4fr_2fr_2fr_auto] gap-2 px-4 py-3 bg-gray-100 border-b font-medium text-sm text-gray-600">
                      <div className="w-12 text-center">#</div>
                      <div>Date</div>
                      <div className="w-24">Type</div>
                      <div>Description</div>
                      <div className="text-right">Amount</div>
                      <div className="text-right">Balance</div>
                      <div className="w-20 text-center">Status</div>
                    </div>

                    {/* Transaction Rows */}
                    <div className="divide-y">
                      {filteredTransactions.map((t, index) => (
                        <div
                          key={t.id}
                          className={`grid grid-cols-[auto_1fr_auto_4fr_2fr_2fr_auto] gap-2 px-4 py-3 items-center text-sm
                            ${
                              t.changed
                                ? "bg-yellow-50 border-l-4 border-l-yellow-400"
                                : "hover:bg-gray-50"
                            }
                            ${t.needs_review ? "bg-orange-50" : ""}
                          `}
                        >
                          {/* Serial Number */}
                          <div className="w-12 text-center text-gray-400 font-mono text-xs">
                            {index + 1}
                          </div>

                          {/* Date */}
                          <div className="text-gray-600">
                            {formatDateShort(t.transaction_date)}
                          </div>

                          {/* Type Toggle Button */}
                          <div className="w-24">
                            <button
                              onClick={() => toggleTransactionDirection(index)}
                              disabled={t.is_locked}
                              className={`px-2 py-1 rounded text-xs font-bold transition-all w-full
                                ${
                                  t.is_locked
                                    ? "bg-gray-300 text-gray-500 cursor-not-allowed opacity-60"
                                    : `${
                                        t.edited_type === "credit"
                                          ? "bg-green-500 hover:bg-green-600 text-white hover:scale-105"
                                          : "bg-red-500 hover:bg-red-600 text-white hover:scale-105"
                                      }`
                                }
                              `}
                              title={
                                t.is_locked
                                  ? "Locked - statement confirmed"
                                  : "Click to flip direction"
                              }
                            >
                              {t.edited_type === "credit" ? "↓ IN" : "↑ OUT"}
                              {t.is_locked && (
                                <Lock className="w-3 h-3 ml-1 inline" />
                              )}
                            </button>
                          </div>

                          {/* Description */}
                          <div className="truncate" title={t.description}>
                            <span className="font-medium">
                              {t.payee_name || t.description}
                            </span>
                            {t.payee_name && t.payee_name !== t.description && (
                              <span className="text-gray-400 text-xs block truncate">
                                {t.description}
                              </span>
                            )}
                          </div>

                          {/* Editable Amount */}
                          <div className="text-right">
                            {editingAmountIndex === index && !t.is_locked ? (
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
                                    if (e.key === "Enter")
                                      saveEditAmount(index);
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
                                onDoubleClick={() => {
                                  if (!t.is_locked) {
                                    startEditAmount(index, t.edited_amount);
                                  }
                                }}
                                className={`px-2 py-1 rounded font-mono font-medium
                                  ${
                                    t.is_locked
                                      ? "text-gray-500 cursor-not-allowed opacity-60"
                                      : `${
                                          t.edited_type === "credit"
                                            ? "text-green-600 cursor-pointer hover:bg-gray-100"
                                            : "text-red-600 cursor-pointer hover:bg-gray-100"
                                        }`
                                  }
                                `}
                                title={
                                  t.is_locked
                                    ? "Locked - statement confirmed"
                                    : "Double-click to edit amount"
                                }
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
                          <div className="text-right font-mono">
                            $
                            {(t.changed
                              ? t.calculated_balance
                              : t.running_balance || 0
                            ).toLocaleString("en-CA", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>

                          {/* Status Indicators */}
                          <div className="w-20 text-center flex items-center justify-center gap-1">
                            {t.is_locked && (
                              <Lock
                                className="h-4 w-4 text-gray-400"
                                title="Locked - statement confirmed"
                              />
                            )}
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
                      <div className="grid grid-cols-[auto_1fr_auto_4fr_2fr_2fr_auto] gap-2 text-sm">
                        <div className="w-12"></div>
                        <div className="col-span-3 font-medium">
                          {activeFilterCount > 0 ? "Filtered Totals" : "Totals"}
                          {activeFilterCount > 0 && (
                            <span className="ml-2 text-xs text-gray-500">
                              ({filteredTransactions.length} of{" "}
                              {calculateRunningBalances.length})
                            </span>
                          )}
                        </div>
                        <div className="text-right font-mono">
                          <span className="text-red-600">
                            -$
                            {filteredTransactions
                              .filter((t) => t.edited_type === "debit")
                              .reduce((sum, t) => sum + t.edited_amount, 0)
                              .toLocaleString("en-CA", {
                                minimumFractionDigits: 2,
                              })}
                          </span>
                          <br />
                          <span className="text-green-600">
                            +$
                            {filteredTransactions
                              .filter((t) => t.edited_type === "credit")
                              .reduce((sum, t) => sum + t.edited_amount, 0)
                              .toLocaleString("en-CA", {
                                minimumFractionDigits: 2,
                              })}
                          </span>
                        </div>
                        <div className="text-right font-mono font-bold">
                          $
                          {calculatedClosing.toLocaleString("en-CA", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                        <div className="w-20"></div>
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

      {/* Confirm Statement Modal */}
      {selectedStatement && (
        <ConfirmStatementModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={handleConfirmStatement}
          statement={selectedStatement}
          transactionCount={
            selectedStatement?.total_transactions || transactions?.length || 0
          }
          isConfirming={isConfirming}
        />
      )}

      {/* Delete Statement Modal */}
      <DeleteStatementModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteStatement}
        statementInfo={{
          fileName: selectedStatement?.file_name || "",
          periodStart: formatDateSafe(
            selectedStatement?.statement_period_start,
          ),
          periodEnd: formatDateSafe(selectedStatement?.statement_period_end),
          transactionCount: selectedStatement?.total_transactions || 0,
          accountName: selectedAccount?.name || "",
        }}
        isDeleting={isDeleting}
      />
    </div>
  );
}
