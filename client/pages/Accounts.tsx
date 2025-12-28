import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Building2,
  CreditCard,
  Wallet,
  Globe,
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  XCircle,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

interface BankAccount {
  id: string;
  name: string;
  account_number: string;
  company_id: string | null;
  bank_name: string;
  currency: string;
  account_type: string | null;
  is_personal: boolean;
  is_active: boolean;
  last4_physical: string | null;
  last4_wallet: string | null;
  notes: string | null;
  account_type_display?: string;
  account_type_color?: string;
  company_name?: string;
}

interface AccountType {
  code: string;
  name: string;
  sort_order: number;
}

interface Institution {
  id: string;
  name: string;
  supported_account_types: string[];
  is_active: boolean;
  sort_order: number;
}

interface Company {
  id: string;
  name: string;
}

const getAccountIcon = (accountType: string | null) => {
  switch (accountType) {
    case "chequing":
    case "savings":
    case "line_of_credit":
      return Building2;
    case "credit_card":
      return CreditCard;
    case "cash_card":
    case "payment_processor":
      return Wallet;
    case "forex":
      return Globe;
    default:
      return Building2;
  }
};

const getBadgeColor = (color: string) => {
  const colors: Record<string, string> = {
    blue: "bg-blue-100 text-blue-800 border-blue-200",
    green: "bg-green-100 text-green-800 border-green-200",
    purple: "bg-purple-100 text-purple-800 border-purple-200",
    orange: "bg-orange-100 text-orange-800 border-orange-200",
    indigo: "bg-indigo-100 text-indigo-800 border-indigo-200",
    teal: "bg-teal-100 text-teal-800 border-teal-200",
    red: "bg-red-100 text-red-800 border-red-200",
  };
  return colors[color] || colors.blue;
};

export default function Accounts() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Data state
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(
    null,
  );
  const [deletingAccount, setDeleteingAccount] = useState<BankAccount | null>(
    null,
  );

  // Form state
  const [formData, setFormData] = useState({
    isPersonal: false,
    accountType: "",
    institution: "",
    accountName: "",
    currency: "CAD",
    last4Physical: "",
    last4Wallet: "",
    last4PhysicalNA: false,
    last4WalletNA: false,
    sameAsPhysical: false,
    companyId: "",
    notes: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    setLoading(true);
    try {
      const [accountsRes, typesRes, institutionsRes, companiesRes] =
        await Promise.all([
          supabase
            .from("bank_accounts")
            .select("*")
            .eq("is_active", true)
            .order("is_personal", { ascending: true })
            .order("account_type")
            .order("name"),
          supabase
            .from("account_types")
            .select("code, name, sort_order")
            .order("sort_order"),
          supabase
            .from("institutions")
            .select("*")
            .eq("is_active", true)
            .order("sort_order"),
          supabase.from("companies").select("id, name").order("name"),
        ]);

      if (typesRes.error) {
        console.error("Error fetching account types:", typesRes.error);
      }

      if (accountsRes.data) setAccounts(accountsRes.data);
      if (typesRes.data) {
        console.log("Account types fetched:", typesRes.data);
        setAccountTypes(typesRes.data);
      }
      if (institutionsRes.data) setInstitutions(institutionsRes.data);
      if (companiesRes.data) setCompanies(companiesRes.data);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError("Failed to load accounts");
    } finally {
      setLoading(false);
    }
  };

  const groupAccounts = (accounts: BankAccount[]) => {
    const groups = {
      business_bank: [] as BankAccount[],
      business_credit: [] as BankAccount[],
      business_processor: [] as BankAccount[],
      business_other: [] as BankAccount[],
      personal: [] as BankAccount[],
    };

    accounts.forEach((account) => {
      if (account.is_personal) {
        groups.personal.push(account);
      } else if (["chequing", "savings"].includes(account.account_type || "")) {
        groups.business_bank.push(account);
      } else if (account.account_type === "credit_card") {
        groups.business_credit.push(account);
      } else if (
        ["payment_processor", "forex"].includes(account.account_type || "")
      ) {
        groups.business_processor.push(account);
      } else {
        groups.business_other.push(account);
      }
    });

    return groups;
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (account: BankAccount) => {
    setEditingAccount(account);
    setFormData({
      isPersonal: account.is_personal,
      accountType: account.account_type || "",
      institution: account.bank_name,
      accountName: account.name,
      currency: account.currency,
      last4Physical: account.last4_physical || "",
      last4Wallet: account.last4_wallet || "",
      last4PhysicalNA: !account.last4_physical,
      last4WalletNA: !account.last4_wallet,
      sameAsPhysical: account.last4_physical === account.last4_wallet,
      companyId: account.company_id || "",
      notes: account.notes || "",
    });
    setShowEditModal(true);
  };

  const openDeleteModal = (account: BankAccount) => {
    setDeleteingAccount(account);
    setShowDeleteModal(true);
  };

  const resetForm = () => {
    setFormData({
      isPersonal: false,
      accountType: "",
      institution: "",
      accountName: "",
      currency: "CAD",
      last4Physical: "",
      last4Wallet: "",
      last4PhysicalNA: false,
      last4WalletNA: false,
      sameAsPhysical: false,
      companyId: "",
      notes: "",
    });
    setFormErrors({});
    setEditingAccount(null);
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.accountType) errors.accountType = "Required";
    if (!formData.institution) errors.institution = "Required";
    if (!formData.accountName.trim()) errors.accountName = "Required";
    if (!formData.currency) errors.currency = "Required";

    // Last 4 physical validation (optional with N/A checkbox)
    if (!formData.last4PhysicalNA && formData.last4Physical) {
      if (!/^\d{4}$/.test(formData.last4Physical)) {
        errors.last4Physical = "Must be exactly 4 digits";
      }
    }

    // Last 4 wallet validation (only for cards)
    const showWalletField = ["credit_card", "cash_card"].includes(
      formData.accountType,
    );
    if (
      showWalletField &&
      !formData.last4WalletNA &&
      !formData.sameAsPhysical &&
      formData.last4Wallet
    ) {
      if (!/^\d{4}$/.test(formData.last4Wallet)) {
        errors.last4Wallet = "Must be exactly 4 digits";
      }
    }

    // Company required for business accounts
    if (!formData.isPersonal && !formData.companyId) {
      errors.company = "Required for business accounts";
    }

    return errors;
  };

  const handleSubmit = async () => {
    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setSubmitting(true);
    setError(null);

    const accountData = {
      name: formData.accountName.trim(),
      bank_name: formData.institution,
      currency: formData.currency,
      account_type: formData.accountType,
      is_personal: formData.isPersonal,
      last4_physical: formData.last4PhysicalNA
        ? null
        : formData.last4Physical || null,
      last4_wallet: formData.last4WalletNA
        ? null
        : formData.sameAsPhysical
          ? formData.last4Physical || null
          : formData.last4Wallet || null,
      company_id: formData.isPersonal ? null : formData.companyId,
      notes: formData.notes.trim() || null,
      is_active: true,
      account_number: "", // Legacy field
    };

    try {
      if (editingAccount) {
        const { error } = await supabase
          .from("bank_accounts")
          .update(accountData)
          .eq("id", editingAccount.id);

        if (error) throw error;
        setSuccess("Account updated successfully");
      } else {
        const { error } = await supabase
          .from("bank_accounts")
          .insert(accountData);

        if (error) throw error;
        setSuccess("Account added successfully");
      }

      await fetchData();
      setTimeout(() => {
        setShowAddModal(false);
        setShowEditModal(false);
        resetForm();
        setSuccess(null);
      }, 1500);
    } catch (err) {
      console.error("Error saving account:", err);
      setError("Failed to save account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAccount) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("bank_accounts")
        .delete()
        .eq("id", deletingAccount.id);

      if (error) throw error;

      setSuccess("Account deleted successfully");
      await fetchData();
      setTimeout(() => {
        setShowDeleteModal(false);
        setDeleteingAccount(null);
        setSuccess(null);
      }, 1500);
    } catch (err) {
      console.error("Error deleting account:", err);
      setError("Failed to delete account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from("bank_accounts")
        .update({ is_active: false })
        .eq("id", accountId);

      if (error) throw error;

      setSuccess("Account deactivated successfully");
      await fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error deactivating account:", err);
      setError("Failed to deactivate account");
    }
  };

  const filteredInstitutions = institutions.filter((inst) =>
    inst.supported_account_types.includes(formData.accountType),
  );

  const showWalletField = ["credit_card", "cash_card"].includes(
    formData.accountType,
  );

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const grouped = groupAccounts(accounts);
  const hasAccounts = accounts.length > 0;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Accounts</h1>
              <p className="text-muted-foreground mt-1">
                Manage bank accounts and credit cards
              </p>
            </div>
            <Button onClick={openAddModal} size="lg">
              <Plus className="h-4 w-4" />
              Add Account
            </Button>
          </div>

          {/* Success/Error Messages */}
          {success && (
            <Alert className="mb-6 bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {success}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Empty State */}
          {!hasAccounts && (
            <Card className="py-16">
              <CardContent className="text-center">
                <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                <h2 className="text-2xl font-semibold mb-2">
                  No accounts added yet
                </h2>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Add your bank accounts and credit cards to start processing
                  statements.
                </p>
                <Button onClick={openAddModal} size="lg">
                  <Plus className="h-4 w-4" />
                  Add Your First Account
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Accounts List */}
          {hasAccounts && (
            <div className="space-y-8">
              {/* Business Accounts Section */}
              {(grouped.business_bank.length > 0 ||
                grouped.business_credit.length > 0 ||
                grouped.business_processor.length > 0 ||
                grouped.business_other.length > 0) && (
                <div>
                  <h2 className="text-xl font-semibold mb-4">
                    BUSINESS ACCOUNTS
                  </h2>

                  {/* Bank Accounts */}
                  {grouped.business_bank.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">
                        Bank Accounts
                      </h3>
                      <div className="space-y-2">
                        {grouped.business_bank.map((account) => (
                          <AccountCard
                            key={account.id}
                            account={account}
                            onEdit={openEditModal}
                            onDelete={openDeleteModal}
                            onDeactivate={handleDeactivate}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Credit Cards */}
                  {grouped.business_credit.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">
                        Credit Cards
                      </h3>
                      <div className="space-y-2">
                        {grouped.business_credit.map((account) => (
                          <AccountCard
                            key={account.id}
                            account={account}
                            onEdit={openEditModal}
                            onDelete={openDeleteModal}
                            onDeactivate={handleDeactivate}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Payment Processors & Forex */}
                  {grouped.business_processor.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">
                        Payment Processors & Forex
                      </h3>
                      <div className="space-y-2">
                        {grouped.business_processor.map((account) => (
                          <AccountCard
                            key={account.id}
                            account={account}
                            onEdit={openEditModal}
                            onDelete={openDeleteModal}
                            onDeactivate={handleDeactivate}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Other Business Accounts */}
                  {grouped.business_other.length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-sm font-medium text-muted-foreground mb-3">
                        Other Accounts
                      </h3>
                      <div className="space-y-2">
                        {grouped.business_other.map((account) => (
                          <AccountCard
                            key={account.id}
                            account={account}
                            onEdit={openEditModal}
                            onDelete={openDeleteModal}
                            onDeactivate={handleDeactivate}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Personal Cards Section */}
              <div>
                <h2 className="text-xl font-semibold mb-4">
                  PERSONAL CARDS (Business Expenses Only)
                </h2>

                {grouped.personal.length > 0 ? (
                  <div className="space-y-2">
                    {grouped.personal.map((account) => (
                      <AccountCard
                        key={account.id}
                        account={account}
                        onEdit={openEditModal}
                        onDelete={openDeleteModal}
                        onDeactivate={handleDeactivate}
                      />
                    ))}
                  </div>
                ) : (
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="py-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-blue-900 mb-1">
                            💳 Track business expenses from personal cards
                          </h3>
                          <p className="text-sm text-blue-700">
                            Add your personal credit cards to capture business
                            expenses paid from personal accounts. All
                            transactions will be flagged for review.
                          </p>
                        </div>
                        <Button
                          onClick={() => {
                            setFormData({ ...formData, isPersonal: true });
                            openAddModal();
                          }}
                          variant="outline"
                          className="ml-4"
                        >
                          <Plus className="h-4 w-4" />
                          Add
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Dialog
        open={showAddModal || showEditModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddModal(false);
            setShowEditModal(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? "Edit Account" : "Add New Account"}
            </DialogTitle>
            <DialogDescription>
              {editingAccount
                ? "Update account information"
                : "Add a new bank account or credit card"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Ownership */}
            <div className="space-y-2">
              <Label>Ownership *</Label>
              <RadioGroup
                value={formData.isPersonal ? "personal" : "business"}
                onValueChange={(value) =>
                  setFormData({ ...formData, isPersonal: value === "personal" })
                }
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="business" id="business" />
                  <Label htmlFor="business" className="font-normal">
                    Business Account
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="personal" id="personal" />
                  <Label htmlFor="personal" className="font-normal">
                    Personal Card (for business expenses only)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Account Type */}
            <div className="space-y-2">
              <Label>Account Type *</Label>
              <Select
                value={formData.accountType}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    accountType: value,
                    institution: "",
                  })
                }
              >
                <SelectTrigger
                  className={formErrors.accountType ? "border-red-500" : ""}
                >
                  <SelectValue placeholder="Select account type..." />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((type) => (
                    <SelectItem key={type.code} value={type.code}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formErrors.accountType && (
                <p className="text-sm text-red-500">{formErrors.accountType}</p>
              )}
            </div>

            {/* Institution */}
            {formData.accountType && (
              <div className="space-y-2">
                <Label>Bank / Institution *</Label>
                <Select
                  value={formData.institution}
                  onValueChange={(value) =>
                    setFormData({ ...formData, institution: value })
                  }
                >
                  <SelectTrigger
                    className={formErrors.institution ? "border-red-500" : ""}
                  >
                    <SelectValue placeholder="Select institution..." />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredInstitutions.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No institutions found for this account type
                      </div>
                    ) : (
                      filteredInstitutions.map((inst) => (
                        <SelectItem key={inst.id} value={inst.name}>
                          {inst.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {formErrors.institution && (
                  <p className="text-sm text-red-500">
                    {formErrors.institution}
                  </p>
                )}
              </div>
            )}

            {/* Account Name */}
            <div className="space-y-2">
              <Label>Account Name *</Label>
              <Input
                placeholder="e.g., RBC Business Chequing"
                value={formData.accountName}
                onChange={(e) =>
                  setFormData({ ...formData, accountName: e.target.value })
                }
                className={formErrors.accountName ? "border-red-500" : ""}
              />
              {formErrors.accountName && (
                <p className="text-sm text-red-500">{formErrors.accountName}</p>
              )}
            </div>

            {/* Currency */}
            <div className="space-y-2">
              <Label>Currency *</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) =>
                  setFormData({ ...formData, currency: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CAD">CAD</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="Multi">Multi</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4">
              <h4 className="font-medium mb-4">Identification Numbers</h4>

              {/* Last 4 Physical */}
              <div className="space-y-2 mb-4">
                <Label>Last 4 digits (physical card/account)</Label>
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="1234"
                    maxLength={4}
                    value={formData.last4Physical}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        last4Physical: e.target.value.replace(/\D/g, ""),
                      })
                    }
                    disabled={formData.last4PhysicalNA}
                    className={formErrors.last4Physical ? "border-red-500" : ""}
                  />
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="last4PhysicalNA"
                      checked={formData.last4PhysicalNA}
                      onCheckedChange={(checked) =>
                        setFormData({
                          ...formData,
                          last4PhysicalNA: checked as boolean,
                          last4Physical: "",
                        })
                      }
                    />
                    <Label htmlFor="last4PhysicalNA" className="font-normal">
                      N/A
                    </Label>
                  </div>
                </div>
                {formErrors.last4Physical && (
                  <p className="text-sm text-red-500">
                    {formErrors.last4Physical}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Optional for payment processors and forex accounts
                </p>
              </div>

              {/* Last 4 Wallet (only for cards) */}
              {showWalletField && (
                <div className="space-y-2">
                  <Label>Last 4 digits (Apple/Google Wallet)</Label>
                  <div className="space-y-2">
                    <Input
                      placeholder="5678"
                      maxLength={4}
                      value={formData.last4Wallet}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          last4Wallet: e.target.value.replace(/\D/g, ""),
                        })
                      }
                      disabled={
                        formData.last4WalletNA || formData.sameAsPhysical
                      }
                      className={formErrors.last4Wallet ? "border-red-500" : ""}
                    />
                    <div className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="sameAsPhysical"
                          checked={formData.sameAsPhysical}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              sameAsPhysical: checked as boolean,
                              last4WalletNA: false,
                            })
                          }
                        />
                        <Label htmlFor="sameAsPhysical" className="font-normal">
                          Same as physical
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="last4WalletNA"
                          checked={formData.last4WalletNA}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              last4WalletNA: checked as boolean,
                              sameAsPhysical: false,
                              last4Wallet: "",
                            })
                          }
                        />
                        <Label htmlFor="last4WalletNA" className="font-normal">
                          N/A
                        </Label>
                      </div>
                    </div>
                  </div>
                  {formErrors.last4Wallet && (
                    <p className="text-sm text-red-500">
                      {formErrors.last4Wallet}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Company (only for business) */}
            {!formData.isPersonal && (
              <div className="space-y-2">
                <Label>Company *</Label>
                <Select
                  value={formData.companyId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, companyId: value })
                  }
                >
                  <SelectTrigger
                    className={formErrors.company ? "border-red-500" : ""}
                  >
                    <SelectValue placeholder="Select company..." />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formErrors.company && (
                  <p className="text-sm text-red-500">{formErrors.company}</p>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Additional information about this account..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            {editingAccount && (
              <Button
                variant="destructive"
                onClick={() => handleDeactivate(editingAccount.id)}
                className="mr-auto"
              >
                Deactivate
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setShowAddModal(false);
                setShowEditModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : editingAccount ? (
                "Save Changes"
              ) : (
                "Add Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Account</DialogTitle>
            <DialogDescription>
              ⚠️ Are you sure you want to delete "{deletingAccount?.name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              This will permanently remove this account. Any transactions linked
              to this account will remain but won't be associated with any
              account.
            </p>
            <p className="text-sm font-medium text-red-600 mt-2">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteingAccount(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Account"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Account Card Component
interface AccountCardProps {
  account: BankAccount;
  onEdit: (account: BankAccount) => void;
  onDelete: (account: BankAccount) => void;
  onDeactivate: (accountId: string) => void;
}

function AccountCard({
  account,
  onEdit,
  onDelete,
  onDeactivate,
}: AccountCardProps) {
  const Icon = getAccountIcon(account.account_type);
  const accountType = account.account_type || "unknown";

  // Get type info for badge
  const badgeColor = (() => {
    switch (accountType) {
      case "chequing":
        return "blue";
      case "savings":
        return "green";
      case "credit_card":
        return "purple";
      case "cash_card":
        return "orange";
      case "payment_processor":
        return "indigo";
      case "forex":
        return "teal";
      case "line_of_credit":
        return "red";
      default:
        return "blue";
    }
  })();

  const displayName = (() => {
    switch (accountType) {
      case "chequing":
        return "Chequing";
      case "savings":
        return "Savings";
      case "credit_card":
        return "Credit Card";
      case "cash_card":
        return "Cash Card";
      case "payment_processor":
        return "Payment Processor";
      case "forex":
        return "Forex";
      case "line_of_credit":
        return "Line of Credit";
      default:
        return accountType;
    }
  })();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <Icon className="h-8 w-8 text-primary" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{account.name}</h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${getBadgeColor(badgeColor)}`}
                >
                  {displayName}
                </span>
                {account.last4_physical && (
                  <span className="text-sm text-muted-foreground">
                    ****{account.last4_physical}
                  </span>
                )}
                <span className="text-sm font-medium text-muted-foreground">
                  {account.currency}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {account.bank_name}
              </p>
              {account.last4_wallet &&
                account.last4_wallet !== account.last4_physical && (
                  <p className="text-xs text-muted-foreground mt-1">
                    └─ Apple Wallet: ****{account.last4_wallet}
                  </p>
                )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onEdit(account)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(account)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDeactivate(account.id)}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Deactivate
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(account)}
                  className="text-red-600"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
