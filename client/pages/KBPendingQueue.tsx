import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertCircle, Trash2 } from "lucide-react";
import { KBPendingCard } from "@/components/KBPendingCard";
import { KBRejectReasonModal } from "@/components/KBRejectReasonModal";

interface PendingQueueItem {
  id: string;
  source: string;
  proposed_payee_pattern: string;
  proposed_payee_display_name?: string;
  proposed_payee_type?: string;
  proposed_category_id: string;
  proposed_has_gst: boolean;
  proposed_gst_rate: number;
  proposed_has_tip: boolean;
  confidence_score: number;
  match_count: number;
  sample_transactions?: unknown[];
  created_at: string;
  expires_at: string;
  status: "pending" | "approved" | "rejected" | "expired";
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

type TabStatus = "pending" | "approved" | "rejected" | "expired";

export default function KBPendingQueue() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [items, setItems] = useState<PendingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabStatus>("pending");
  const [error, setError] = useState<string | null>(null);

  // Reject modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedItemForReject, setSelectedItemForReject] =
    useState<PendingQueueItem | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  // Auth check
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login");
    }
  }, [user, authLoading, navigate]);

  // Fetch items
  useEffect(() => {
    if (user) {
      fetchItems();
    }
  }, [user, activeTab]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("kb_pending_queue")
        .select("*")
        .order("created_at", { ascending: false });

      // Filter by status
      if (activeTab !== "pending") {
        query = query.eq("status", activeTab);
      } else {
        query = query.eq("status", "pending");
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      setItems((data as PendingQueueItem[]) || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch pending items",
      );
      console.error("Error fetching pending items:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (item: PendingQueueItem) => {
    try {
      // Call kb-pending-review to approve using supabase.functions.invoke()
      // This automatically handles authentication with user's session token and anon key
      const { data, error } = await supabase.functions.invoke(
        "kb-pending-review",
        {
          body: {
            action: "approve",
            id: item.id,
            user_email: user?.email,
          },
        },
      );

      if (error) {
        throw error;
      }

      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve item");
      console.error("Error approving item:", err);
    }
  };

  const handleRejectClick = (item: PendingQueueItem) => {
    setSelectedItemForReject(item);
    setRejectModalOpen(true);
  };

  const handleRejectConfirm = async (
    quickReasons: string[],
    customReason: string,
  ) => {
    if (!selectedItemForReject) return;

    try {
      setIsRejecting(true);

      // Call kb-pending-review to reject using supabase.functions.invoke()
      // This automatically handles authentication with user's session token and anon key
      const { data, error } = await supabase.functions.invoke(
        "kb-pending-review",
        {
          body: {
            action: "reject",
            id: selectedItemForReject.id,
            user_email: user?.email,
            quick_reasons: quickReasons,
            rejection_reason: customReason,
          },
        },
      );

      if (error) {
        throw error;
      }

      setRejectModalOpen(false);
      setSelectedItemForReject(null);
      fetchItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject item");
      console.error("Error rejecting item:", err);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleExpireOld = async () => {
    if (
      !confirm(
        "Are you sure you want to expire all pending items older than 30 days? This cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { error: updateError } = await supabase
        .from("kb_pending_queue")
        .update({ status: "expired" })
        .eq("status", "pending")
        .lt("created_at", thirtyDaysAgo.toISOString());

      if (updateError) throw updateError;

      fetchItems();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to expire old items",
      );
      console.error("Error expiring old items:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pendingCount = items.filter((i) => i.status === "pending").length;
  const approvedCount = items.filter((i) => i.status === "approved").length;
  const rejectedCount = items.filter((i) => i.status === "rejected").length;
  const expiredCount = items.filter((i) => i.status === "expired").length;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />

      <div className="flex-1 overflow-auto">
        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                KB Pending Approvals
              </h1>
              <p className="text-muted-foreground mt-1">
                Review and approve knowledge base suggestions
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleExpireOld}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              Expire Old
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Pending
                  </p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Approved
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {approvedCount}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Rejected
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {rejectedCount}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">
                    Expired
                  </p>
                  <p className="text-2xl font-bold text-amber-600">
                    {expiredCount}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as TabStatus)}
          >
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="pending">
                Pending ({pendingCount})
              </TabsTrigger>
              <TabsTrigger value="approved">
                Approved ({approvedCount})
              </TabsTrigger>
              <TabsTrigger value="rejected">
                Rejected ({rejectedCount})
              </TabsTrigger>
              <TabsTrigger value="expired">
                Expired ({expiredCount})
              </TabsTrigger>
            </TabsList>

            {/* Pending Tab */}
            <TabsContent value="pending" className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : items.filter((i) => i.status === "pending").length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      No pending items to review
                    </p>
                  </CardContent>
                </Card>
              ) : (
                items
                  .filter((i) => i.status === "pending")
                  .map((item) => (
                    <KBPendingCard
                      key={item.id}
                      item={item}
                      onApprove={handleApprove}
                      onReject={handleRejectClick}
                      isLoading={false}
                    />
                  ))
              )}
            </TabsContent>

            {/* Approved Tab */}
            <TabsContent value="approved" className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : items.filter((i) => i.status === "approved").length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      No approved items yet
                    </p>
                  </CardContent>
                </Card>
              ) : (
                items
                  .filter((i) => i.status === "approved")
                  .map((item) => (
                    <KBPendingCard
                      key={item.id}
                      item={item}
                      onApprove={() => {}}
                      onReject={() => {}}
                      isLoading={false}
                      readonly
                    />
                  ))
              )}
            </TabsContent>

            {/* Rejected Tab */}
            <TabsContent value="rejected" className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : items.filter((i) => i.status === "rejected").length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      No rejected items yet
                    </p>
                  </CardContent>
                </Card>
              ) : (
                items
                  .filter((i) => i.status === "rejected")
                  .map((item) => (
                    <KBPendingCard
                      key={item.id}
                      item={item}
                      onApprove={() => {}}
                      onReject={() => {}}
                      isLoading={false}
                      readonly
                    />
                  ))
              )}
            </TabsContent>

            {/* Expired Tab */}
            <TabsContent value="expired" className="space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : items.filter((i) => i.status === "expired").length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No expired items</p>
                  </CardContent>
                </Card>
              ) : (
                items
                  .filter((i) => i.status === "expired")
                  .map((item) => (
                    <KBPendingCard
                      key={item.id}
                      item={item}
                      onApprove={() => {}}
                      onReject={() => {}}
                      isLoading={false}
                      readonly
                    />
                  ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Reject Reason Modal */}
      <KBRejectReasonModal
        isOpen={rejectModalOpen}
        isLoading={isRejecting}
        onClose={() => {
          setRejectModalOpen(false);
          setSelectedItemForReject(null);
        }}
        onConfirm={handleRejectConfirm}
      />
    </div>
  );
}
