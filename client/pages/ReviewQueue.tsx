import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList,
  Loader2,
  Check,
  Filter,
  Calendar as CalendarIcon,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Transaction, Category, Company, BankAccount } from "@/types";

interface TransactionWithRelations extends Transaction {
  categories?: Category | null;
  companies?: Company | null;
  bank_accounts?: BankAccount | null;
}

export default function ReviewQueue() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<TransactionWithRelations[]>(
    [],
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState<string[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [bankAccountFilter, setBankAccountFilter] = useState<string>("all");

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch categories
      const { data: categoriesData, error: categoriesError } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("*")
        .order("name");

      if (companiesError) throw companiesError;
      setCompanies(companiesData || []);

      // Fetch bank accounts
      const { data: bankAccountsData, error: bankAccountsError } =
        await supabase.from("bank_accounts").select("*").order("name");

      if (bankAccountsError) throw bankAccountsError;
      setBankAccounts(bankAccountsData || []);

      // Fetch transactions needing review
      await fetchTransactions();
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load data. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      let query = supabase
        .from("transactions")
        .select(
          `
          *,
          categories(*),
          companies(*),
          bank_accounts(*)
        `,
        )
        .eq("needs_review", true)
        .order("date", { ascending: false });

      // Apply filters
      if (dateFrom) {
        query = query.gte("date", format(dateFrom, "yyyy-MM-dd"));
      }
      if (dateTo) {
        query = query.lte("date", format(dateTo, "yyyy-MM-dd"));
      }
      if (categoryFilter && categoryFilter !== "all") {
        query = query.eq("category_id", categoryFilter);
      }
      if (bankAccountFilter && bankAccountFilter !== "all") {
        query = query.eq("bank_account_id", bankAccountFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load transactions.",
      });
    }
  };

  const handleCategoryChange = async (
    transactionId: string,
    categoryId: string,
  ) => {
    try {
      const { error } = await (supabase
        .from("transactions")
        .update({ category_id: categoryId })
        .eq("id", transactionId) as any);

      if (error) throw error;

      // Update local state
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId
            ? {
                ...t,
                category_id: categoryId,
                categories: categories.find((c) => c.id === categoryId) || null,
              }
            : t,
        ),
      );

      toast({
        title: "Success",
        description: "Category updated successfully.",
      });
    } catch (error) {
      console.error("Error updating category:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update category.",
      });
    }
  };

  const handleCompanyChange = async (
    transactionId: string,
    companyId: string,
  ) => {
    try {
      const { error } = await (supabase
        .from("transactions")
        .update({ company_id: companyId })
        .eq("id", transactionId) as any);

      if (error) throw error;

      // Update local state
      setTransactions((prev) =>
        prev.map((t) =>
          t.id === transactionId
            ? {
                ...t,
                company_id: companyId,
                companies: companies.find((c) => c.id === companyId) || null,
              }
            : t,
        ),
      );

      toast({
        title: "Success",
        description: "Company updated successfully.",
      });
    } catch (error) {
      console.error("Error updating company:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update company.",
      });
    }
  };

  const handleApprove = async (transactionId: string) => {
    try {
      setApproving((prev) => [...prev, transactionId]);

      const { error } = await (supabase
        .from("transactions")
        .update({
          needs_review: false,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", transactionId) as any);

      if (error) throw error;

      // Remove from local state
      setTransactions((prev) => prev.filter((t) => t.id !== transactionId));
      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(transactionId);
        return newSet;
      });

      toast({
        title: "Success",
        description: "Transaction approved successfully.",
      });
    } catch (error) {
      console.error("Error approving transaction:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve transaction.",
      });
    } finally {
      setApproving((prev) => prev.filter((id) => id !== transactionId));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;

    try {
      const idsArray = Array.from(selectedIds);
      setApproving(idsArray);

      const { error } = await (supabase
        .from("transactions")
        .update({
          needs_review: false,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .in("id", idsArray) as any);

      if (error) throw error;

      // Remove from local state
      setTransactions((prev) => prev.filter((t) => !selectedIds.has(t.id)));
      setSelectedIds(new Set());

      toast({
        title: "Success",
        description: `${idsArray.length} transaction(s) approved successfully.`,
      });
    } catch (error) {
      console.error("Error approving transactions:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve transactions.",
      });
    } finally {
      setApproving([]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const clearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    setCategoryFilter("all");
    setBankAccountFilter("all");
    fetchTransactions();
  };

  const applyFilters = () => {
    fetchTransactions();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(amount);
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

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-foreground">
              HITL Review Queue
            </h1>
            <p className="text-muted-foreground mt-1">
              Review and approve transactions
            </p>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Filters</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Date From */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date From</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateFrom && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFrom ? (
                          format(dateFrom, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateFrom}
                        onSelect={setDateFrom}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Date To */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date To</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !dateTo && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateTo ? (
                          format(dateTo, "PPP")
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={dateTo}
                        onSelect={setDateTo}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Category Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={categoryFilter}
                    onValueChange={setCategoryFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Bank Account Filter */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Bank Account</label>
                  <Select
                    value={bankAccountFilter}
                    onValueChange={setBankAccountFilter}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Accounts" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Accounts</SelectItem>
                      {bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={applyFilters}>
                  <Filter className="h-4 w-4 mr-2" />
                  Apply Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <Card className="mb-6 border-primary">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-base px-3 py-1">
                      {selectedIds.size} selected
                    </Badge>
                  </div>
                  <Button
                    onClick={handleBulkApprove}
                    disabled={approving.length > 0}
                  >
                    {approving.length > 0 ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Approving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Approve Selected
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <CardTitle>
                  Pending Transactions ({transactions.length})
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12">
                  <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No transactions pending review
                  </h3>
                  <p className="text-muted-foreground">
                    All transactions have been reviewed and approved.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              transactions.length > 0 &&
                              selectedIds.size === transactions.length
                            }
                            onCheckedChange={toggleSelectAll}
                          />
                        </TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Company</TableHead>
                        <TableHead>Bank Account</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(transaction.id)}
                              onCheckedChange={() =>
                                toggleSelect(transaction.id)
                              }
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(transaction.date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {transaction.description}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-medium whitespace-nowrap",
                              transaction.amount >= 0
                                ? "text-green-600"
                                : "text-red-600",
                            )}
                          >
                            {formatCurrency(transaction.amount)}
                          </TableCell>
                          <TableCell>
                            <Select
                              value={transaction.category_id || "none"}
                              onValueChange={(value) =>
                                handleCategoryChange(transaction.id, value)
                              }
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">
                                  No Category
                                </SelectItem>
                                {categories.map((category) => (
                                  <SelectItem
                                    key={category.id}
                                    value={category.id}
                                  >
                                    {category.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={transaction.company_id || "none"}
                              onValueChange={(value) =>
                                handleCompanyChange(transaction.id, value)
                              }
                            >
                              <SelectTrigger className="w-[200px]">
                                <SelectValue placeholder="Select company" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">No Company</SelectItem>
                                {companies.map((company) => (
                                  <SelectItem
                                    key={company.id}
                                    value={company.id}
                                  >
                                    {company.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {transaction.bank_accounts?.name || "N/A"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleApprove(transaction.id)}
                              disabled={approving.includes(transaction.id)}
                            >
                              {approving.includes(transaction.id) ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                  Approving...
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
