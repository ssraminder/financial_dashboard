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
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  ClipboardList,
  Loader2,
  Check,
  AlertCircle,
  Zap,
  Search,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type {
  Transaction,
  Category,
  Company,
  BankAccount,
  Vendor,
} from "@/types";

interface TransactionWithRelations extends Transaction {
  categories?: Category | null;
  companies?: Company | null;
  bank_accounts?: BankAccount | null;
}

const contractorTypeOptions = [
  "Language Vendor",
  "Offshore Employee",
  "Legal",
  "Accounting",
  "Consulting",
  "IT/Development",
  "Design",
  "Trades",
  "Cleaning/Maintenance",
  "Virtual Assistant",
  "Other",
];

const countryOptions = ["CA", "US", "UK", "AU", "IN", "PH", "MX", "Other"];

export default function ReviewQueue() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<TransactionWithRelations[]>(
    [],
  );
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Form state for current transaction
  const [currentTransaction, setCurrentTransaction] =
    useState<TransactionWithRelations | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [vendorType, setVendorType] = useState<"regular" | "one-time" | "new">(
    "regular",
  );
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [newVendorName, setNewVendorName] = useState("");
  const [selectedContractorType, setSelectedContractorType] = useState("");
  const [isOffshore, setIsOffshore] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("CA");
  const [userNotes, setUserNotes] = useState("");
  const [reasonForChange, setReasonForChange] = useState("");
  const [searchVendor, setSearchVendor] = useState("");

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
        .select("id, code, name, category_type, description")
        .eq("is_active", true)
        .order("name");

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);

      // Fetch vendors
      const { data: vendorsData, error: vendorsError } = await supabase
        .from("vendors")
        .select("id, legal_name, contractor_type")
        .eq("is_active", true)
        .order("legal_name");

      if (vendorsError) throw vendorsError;
      setVendors(vendorsData || []);

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
      const { data: pendingTransactions, error } = await supabase
        .from("transactions")
        .select(
          `*,
          categories!transactions_category_id_fkey(id, name, code, category_type),
          bank_accounts(id, name, bank_name),
          companies(id, name)`,
        )
        .eq("needs_review", true)
        .order("transaction_date", { ascending: false });

      if (error) {
        console.error("Error fetching HITL transactions:", error);
        throw error;
      }

      console.log("Fetched pending transactions:", pendingTransactions);
      setTransactions(pendingTransactions || []);

      // Set first transaction as current if available
      if (pendingTransactions && pendingTransactions.length > 0) {
        setCurrentTransaction(pendingTransactions[0]);
        resetForm();
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load transactions.",
      });
    }
  };

  const resetForm = () => {
    setSelectedCategoryId("");
    setVendorType("regular");
    setSelectedVendorId("");
    setNewVendorName("");
    setSelectedContractorType("");
    setIsOffshore(false);
    setSelectedCountry("CA");
    setUserNotes("");
    setReasonForChange("");
    setSearchVendor("");
  };

  const handleAcceptSuggestion = () => {
    if (currentTransaction?.category_id) {
      setSelectedCategoryId(currentTransaction.category_id);
      setReasonForChange("");
      toast({
        title: "Success",
        description: "AI suggestion accepted! Review and save when ready.",
      });
    }
  };

  const getConfidenceBadge = (score: number | null) => {
    if (score === null) return null;

    if (score >= 85) {
      return (
        <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
          High Confidence ({score}%)
        </Badge>
      );
    } else if (score >= 70) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
          Medium Confidence ({score}%)
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
          Low Confidence ({score}%)
        </Badge>
      );
    }
  };

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

  const filteredVendors = vendors.filter((v) =>
    v.legal_name.toLowerCase().includes(searchVendor.toLowerCase()),
  );

  const validateForm = (): boolean => {
    if (!selectedCategoryId) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Category must be selected",
      });
      return false;
    }

    const categoryIsContractor =
      selectedCategory?.name?.toLowerCase().includes("contractor") ||
      selectedCategory?.name?.toLowerCase().includes("professional");

    if (categoryIsContractor && vendorType === "regular") {
      if (!selectedVendorId) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Please select a vendor for regular payments",
        });
        return false;
      }
    }

    if (categoryIsContractor && vendorType === "new") {
      if (!newVendorName) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Vendor name is required for new vendors",
        });
        return false;
      }
      if (!selectedContractorType) {
        toast({
          variant: "destructive",
          title: "Validation Error",
          description: "Contractor type is required",
        });
        return false;
      }
    }

    return true;
  };

  const handleApprove = async () => {
    if (!currentTransaction) return;

    if (!validateForm()) return;

    try {
      setApprovingId(currentTransaction.id);

      let finalVendorId = selectedVendorId || null;

      // Create new vendor if needed
      if (vendorType === "new") {
        const { data: newVendor, error: vendorError } = await supabase
          .from("vendors")
          .insert({
            legal_name: newVendorName,
            contractor_type: selectedContractorType,
            country: selectedCountry === "Other" ? null : selectedCountry,
            status: "Active",
            is_active: true,
            gst_registered: false,
            gst_rate: 5.0,
            payment_terms: "Net 30",
            preferred_currency: "CAD",
          })
          .select()
          .single();

        if (vendorError) throw vendorError;
        finalVendorId = newVendor.id;
      }

      // Update transaction
      const { error: updateError } = await supabase
        .from("transactions")
        .update({
          category_id: selectedCategoryId,
          vendor_id: vendorType === "one-time" ? null : finalVendorId,
          needs_review: false,
          status: "categorized",
          human_notes: userNotes || null,
          human_decision_reason:
            reasonForChange || currentTransaction.ai_reasoning || null,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", currentTransaction.id);

      if (updateError) throw updateError;

      // Save to transaction patterns for knowledge base
      const categoryId = selectedCategoryId;
      await supabase.from("transaction_patterns").insert({
        payee_pattern: currentTransaction.payee_normalized,
        category_id: categoryId,
        vendor_id: finalVendorId,
        contractor_type: selectedContractorType || null,
        reasoning: reasonForChange || currentTransaction.ai_reasoning,
        notes: userNotes,
        confidence_score: 100,
      });

      // Remove from UI and move to next
      setTransactions((prev) =>
        prev.filter((t) => t.id !== currentTransaction.id),
      );

      // Set next transaction
      const nextIdx =
        transactions.findIndex((t) => t.id === currentTransaction.id) + 1;
      if (nextIdx < transactions.length) {
        setCurrentTransaction(transactions[nextIdx]);
      } else if (transactions.length > 1) {
        setCurrentTransaction(transactions[0]);
      } else {
        setCurrentTransaction(null);
      }

      resetForm();

      toast({
        title: "Success",
        description: "Transaction approved and saved!",
      });
    } catch (error) {
      console.error("Error approving transaction:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to approve transaction.",
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = () => {
    if (!currentTransaction) return;

    // Move to next transaction
    const currentIdx = transactions.findIndex(
      (t) => t.id === currentTransaction.id,
    );
    if (currentIdx + 1 < transactions.length) {
      setCurrentTransaction(transactions[currentIdx + 1]);
    } else if (currentIdx > 0) {
      setCurrentTransaction(transactions[currentIdx - 1]);
    } else {
      setCurrentTransaction(null);
    }

    resetForm();
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
        <div className="p-8 max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="h-8 w-8" />
              HITL Review Queue
            </h1>
            <p className="text-muted-foreground mt-1">
              Review AI suggestions and categorize transactions
            </p>
          </div>

          {loading ? (
            <Card>
              <CardContent className="py-12 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </CardContent>
            </Card>
          ) : transactions.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  All transactions reviewed!
                </h3>
                <p className="text-muted-foreground">
                  No transactions are pending review at this time.
                </p>
              </CardContent>
            </Card>
          ) : currentTransaction ? (
            <>
              {/* Progress */}
              <div className="mb-6 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  Transaction{" "}
                  {transactions.length -
                    transactions.indexOf(currentTransaction)}{" "}
                  of {transactions.length}
                </span>
                <div className="w-48 bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{
                      width: `${
                        ((transactions.length -
                          transactions.indexOf(currentTransaction)) /
                          transactions.length) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>

              {/* Transaction Card */}
              <Card className="mb-8 border-2">
                <CardHeader className="bg-muted/50 border-b">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {format(
                          new Date(
                            currentTransaction.transaction_date ||
                              currentTransaction.date,
                          ),
                          "MMM d, yyyy",
                        )}
                      </div>
                      <h2 className="text-2xl font-bold mt-1">
                        {currentTransaction.description}
                      </h2>
                      <div className="text-lg font-semibold mt-2">
                        {formatCurrency(currentTransaction.amount)}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground text-right">
                      {currentTransaction.bank_accounts?.name}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-8 space-y-8">
                  {/* AI Suggestion Section */}
                  {currentTransaction.ai_reasoning && (
                    <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 mb-4">
                        <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                          AI's Suggestion
                        </h3>
                      </div>

                      <div className="space-y-3">
                        {currentTransaction.ai_confidence_score !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                              Confidence
                            </span>
                            {getConfidenceBadge(
                              currentTransaction.ai_confidence_score,
                            )}
                          </div>
                        )}

                        <div>
                          <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                            Reasoning:
                          </p>
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            {currentTransaction.ai_reasoning}
                          </p>
                        </div>

                        <Button
                          onClick={handleAcceptSuggestion}
                          className="w-full bg-green-600 hover:bg-green-700 text-white mt-3"
                        >
                          <Check className="h-4 w-4 mr-2" />
                          Accept Suggestion
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Your Decision Section */}
                  <div className="space-y-6">
                    <div>
                      <h3 className="font-semibold text-lg mb-4">
                        Your Decision
                      </h3>

                      {/* Category Selection */}
                      <div className="space-y-2 mb-6">
                        <Label htmlFor="category">Category *</Label>
                        <Select
                          value={selectedCategoryId}
                          onValueChange={setSelectedCategoryId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Vendor Selection - Show if category involves contractors */}
                      {selectedCategory &&
                        (selectedCategory.name
                          .toLowerCase()
                          .includes("contractor") ||
                          selectedCategory.name
                            .toLowerCase()
                            .includes("professional")) && (
                          <div className="space-y-4 mb-6 p-4 bg-muted rounded-lg">
                            <div>
                              <Label className="text-base font-medium mb-3 block">
                                Vendor Type
                              </Label>
                              <RadioGroup
                                value={vendorType}
                                onValueChange={(
                                  value: "regular" | "one-time" | "new",
                                ) => {
                                  setVendorType(value);
                                  setSelectedVendorId("");
                                  setNewVendorName("");
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem
                                    value="regular"
                                    id="vendor-regular"
                                  />
                                  <Label
                                    htmlFor="vendor-regular"
                                    className="font-normal cursor-pointer"
                                  >
                                    Regular Vendor (track for taxes)
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem
                                    value="one-time"
                                    id="vendor-onetime"
                                  />
                                  <Label
                                    htmlFor="vendor-onetime"
                                    className="font-normal cursor-pointer"
                                  >
                                    One-Time Payment (no tracking)
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="new" id="vendor-new" />
                                  <Label
                                    htmlFor="vendor-new"
                                    className="font-normal cursor-pointer"
                                  >
                                    New Vendor (add to database)
                                  </Label>
                                </div>
                              </RadioGroup>
                            </div>

                            {/* Regular Vendor Selection */}
                            {vendorType === "regular" && (
                              <div className="space-y-2 mt-4">
                                <Label htmlFor="vendor-select">
                                  Select Vendor *
                                </Label>
                                <div className="relative">
                                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    placeholder="Search vendors..."
                                    value={searchVendor}
                                    onChange={(e) =>
                                      setSearchVendor(e.target.value)
                                    }
                                    className="pl-10"
                                  />
                                </div>
                                <Select
                                  value={selectedVendorId}
                                  onValueChange={setSelectedVendorId}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Choose a vendor" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {filteredVendors.map((vendor) => (
                                      <SelectItem
                                        key={vendor.id}
                                        value={vendor.id}
                                      >
                                        {vendor.legal_name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            {/* New Vendor Form */}
                            {vendorType === "new" && (
                              <div className="space-y-4 mt-4">
                                <div className="space-y-2">
                                  <Label htmlFor="vendor-name">
                                    Vendor Name *
                                  </Label>
                                  <Input
                                    id="vendor-name"
                                    value={newVendorName}
                                    onChange={(e) =>
                                      setNewVendorName(e.target.value)
                                    }
                                    placeholder="Enter vendor name"
                                  />
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="contractor-type">
                                    Contractor Type *
                                  </Label>
                                  <Select
                                    value={selectedContractorType}
                                    onValueChange={setSelectedContractorType}
                                  >
                                    <SelectTrigger>
                                      <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {contractorTypeOptions.map((type) => (
                                        <SelectItem key={type} value={type}>
                                          {type}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>

                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    id="offshore"
                                    checked={isOffshore}
                                    onChange={(e) =>
                                      setIsOffshore(e.target.checked)
                                    }
                                    className="w-4 h-4"
                                  />
                                  <Label
                                    htmlFor="offshore"
                                    className="font-normal cursor-pointer"
                                  >
                                    Is Offshore?
                                  </Label>
                                </div>

                                <div className="space-y-2">
                                  <Label htmlFor="country">Country</Label>
                                  <Select
                                    value={selectedCountry}
                                    onValueChange={setSelectedCountry}
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {countryOptions.map((country) => (
                                        <SelectItem
                                          key={country}
                                          value={country}
                                        >
                                          {country}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                      {/* Notes Section */}
                      <div className="space-y-4 mb-6">
                        <div className="space-y-2">
                          <Label htmlFor="notes">Your Notes (optional)</Label>
                          <Textarea
                            id="notes"
                            value={userNotes}
                            onChange={(e) => setUserNotes(e.target.value)}
                            placeholder="Add any notes about this transaction..."
                            rows={3}
                          />
                        </div>

                        {selectedCategoryId &&
                          selectedCategoryId !==
                            currentTransaction.category_id && (
                            <div className="space-y-2">
                              <Label htmlFor="reason">
                                Why different from AI? (optional)
                              </Label>
                              <Textarea
                                id="reason"
                                value={reasonForChange}
                                onChange={(e) =>
                                  setReasonForChange(e.target.value)
                                }
                                placeholder="Explain why you chose a different category..."
                                rows={2}
                              />
                            </div>
                          )}
                      </div>
                    </div>
                  </div>
                </CardContent>

                <div className="border-t bg-muted/50 px-6 py-4 flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={handleReject}
                    disabled={approvingId !== null}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Skip
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={approvingId !== null || !selectedCategoryId}
                  >
                    {approvingId ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Approve & Save
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
