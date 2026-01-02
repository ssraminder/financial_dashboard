import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  GitMerge,
  Plus,
  Loader2,
} from "lucide-react";

interface BankAccount {
  id: string;
  name: string;
  bank_name: string;
  account_number_last4?: string;
}

interface Stats {
  unmatchedOutgoing: number;
  unmatchedIncoming: number;
  pendingManual: number;
  potentialMatches: number;
}

export default function Transfers() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Stats
  const [stats, setStats] = useState<Stats>({
    unmatchedOutgoing: 0,
    unmatchedIncoming: 0,
    pendingManual: 0,
    potentialMatches: 0,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      fetchBankAccounts();
    }
  }, [user]);

  const fetchBankAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("id, name, bank_name, account_number_last4")
        .eq("is_active", true)
        .order("bank_name");

      if (error) throw error;
      setBankAccounts(data || []);
    } catch (err) {
      console.error("Error fetching bank accounts:", err);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
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
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ArrowLeftRight className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Transfer Reconciliation
                </h1>
                <p className="text-muted-foreground mt-1">
                  Match and link internal transfers between accounts
                </p>
              </div>
            </div>
            <Button onClick={() => setShowAddModal(true)} size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Log Transfer
            </Button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-4 mb-6">
            {/* Unmatched Outgoing */}
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-600">
                      Unmatched Outgoing
                    </p>
                    <p className="text-3xl font-bold text-red-700 mt-2">
                      {stats.unmatchedOutgoing}
                    </p>
                  </div>
                  <ArrowUpRight className="h-8 w-8 text-red-400" />
                </div>
              </CardContent>
            </Card>

            {/* Unmatched Incoming */}
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">
                      Unmatched Incoming
                    </p>
                    <p className="text-3xl font-bold text-green-700 mt-2">
                      {stats.unmatchedIncoming}
                    </p>
                  </div>
                  <ArrowDownLeft className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            {/* Pending Manual */}
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-600">
                      Pending Manual
                    </p>
                    <p className="text-3xl font-bold text-yellow-700 mt-2">
                      {stats.pendingManual}
                    </p>
                  </div>
                  <Clock className="h-8 w-8 text-yellow-400" />
                </div>
              </CardContent>
            </Card>

            {/* Potential Matches */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">
                      Potential Matches
                    </p>
                    <p className="text-3xl font-bold text-blue-700 mt-2">
                      {stats.potentialMatches}
                    </p>
                  </div>
                  <GitMerge className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar */}
          <div className="mb-6 flex items-center gap-4">
            <Select
              value={selectedAccount || "all"}
              onValueChange={(value) =>
                setSelectedAccount(value === "all" ? null : value)
              }
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Filter by account" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {bankAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.bank_name} - {account.name}
                    {account.account_number_last4 &&
                      ` (${account.account_number_last4})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Main Content - Three Sections */}
          <div className="space-y-6">
            {/* Section 1: Potential Matches */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GitMerge className="h-5 w-5 text-blue-600" />
                  Potential Matches
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <GitMerge className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No potential matches found</p>
                </div>
              </CardContent>
            </Card>

            {/* Section 2: Unmatched Transfers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowLeftRight className="h-5 w-5 text-orange-600" />
                  Unmatched Transfers from Statements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <ArrowLeftRight className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No unmatched transfers</p>
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Manually Logged Transfers */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-600" />
                  Manually Logged Transfers
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>No pending transfers</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
