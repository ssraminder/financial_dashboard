import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ClipboardList,
  Upload,
  Building2,
  Users,
  Package,
  LogOut,
  FileText,
  Sheet,
  Archive,
  Database,
  ArrowLeftRight,
  Tag,
  Receipt,
  Calendar,
  GitMerge,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "HITL Review Queue", href: "/review-queue", icon: ClipboardList },
  {
    name: "Upload",
    href: "/upload",
    icon: Upload,
    subItems: [
      { name: "Upload Statements", href: "/upload" },
      { name: "Processing Queue", href: "/upload/queue" },
    ],
  },
  {
    name: "Receipts",
    href: "/receipts",
    icon: Receipt,
    subItems: [
      { name: "View Receipts", href: "/receipts" },
      { name: "Upload Receipts", href: "/receipts/upload" },
      { name: "Processing Queue", href: "/receipts/queue" },
    ],
  },
  { name: "Transactions", href: "/transactions", icon: Sheet },
  {
    name: "Statements",
    href: "/statements",
    icon: Archive,
    subItems: [
      { name: "View Statements", href: "/statements" },
      { name: "Statement Status", href: "/statements/status" },
    ],
  },
  { name: "Transfers", href: "/transfers", icon: ArrowLeftRight },
  {
    name: "Transfer Matches",
    href: "/transfers/review",
    icon: GitMerge,
    showBadge: true,
  },
  { name: "Categories", href: "/categories", icon: Tag },
  { name: "Accounts", href: "/accounts", icon: Building2 },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Vendors", href: "/vendors", icon: Package },
  { name: "Knowledge Base", href: "/admin/knowledge-base", icon: Database },
];

export function Sidebar() {
  const location = useLocation();
  const { signOut, profile, user } = useAuth();
  const [pendingCount, setPendingCount] = useState<number>(0);

  // Fetch pending transfer candidates count
  useEffect(() => {
    const fetchPendingCount = async () => {
      if (!user) return;

      try {
        const { count, error } = await supabase
          .from("transfer_candidates")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        if (error) throw error;
        setPendingCount(count || 0);
      } catch (err) {
        console.error("Error fetching pending transfer count:", err);
      }
    };

    fetchPendingCount();

    // Refresh count every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);

    return () => clearInterval(interval);
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <FileText className="h-8 w-8 text-sidebar-primary" />
          <div>
            <h1 className="text-xl font-bold text-sidebar-foreground">
              Cethos
            </h1>
            <p className="text-xs text-sidebar-foreground/60">
              Financial Dashboard
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item: any) => {
          const isActive = location.pathname === item.href;
          const isSubActive = item.subItems?.some(
            (sub: any) => location.pathname === sub.href,
          );

          return item.subItems ? (
            <div key={item.name}>
              {/* Parent item with sub-items */}
              <Link
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive || isSubActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>

              {/* Sub-items */}
              <div className="ml-6 mt-1 space-y-1">
                {item.subItems.map((sub: any) => {
                  const subIsActive = location.pathname === sub.href;
                  return (
                    <Link
                      key={sub.href}
                      to={sub.href}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
                        subIsActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                      )}
                    >
                      <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                      {sub.name}
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            // Regular nav item (no sub-items)
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="flex-1">{item.name}</span>
              {item.showBadge && pendingCount > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section: Notifications + User Profile */}
      <div className="border-t border-sidebar-border p-4">
        {/* Notification Bell - opens upward */}
        <div className="mb-4 pb-4 border-b border-sidebar-border">
          <NotificationBell dropdownPosition="top" />
        </div>

        {/* User Profile */}
        <div className="mb-3">
          <p className="text-sm font-medium text-sidebar-foreground">
            {profile?.full_name || profile?.email || "User"}
          </p>
          <p className="text-xs text-sidebar-foreground/60 capitalize">
            {profile?.role || "Loading..."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSignOut}
          className="w-full justify-start gap-2 bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}
