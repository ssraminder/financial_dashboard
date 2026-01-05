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
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";

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
  { name: "View Statements", href: "/statements", icon: Archive },
  { name: "Transfers", href: "/transfers", icon: ArrowLeftRight },
  { name: "Categories", href: "/categories", icon: Tag },
  { name: "Accounts", href: "/accounts", icon: Building2 },
  { name: "Clients", href: "/clients", icon: Users },
  { name: "Vendors", href: "/vendors", icon: Package },
  { name: "Knowledge Base", href: "/admin/knowledge-base", icon: Database },
];

export function Sidebar() {
  const location = useLocation();
  const { signOut, profile } = useAuth();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-sidebar-border">
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
        <NotificationBell />
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
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="border-t border-sidebar-border p-4">
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
