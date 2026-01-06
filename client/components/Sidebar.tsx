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
  GitMerge,
  ChevronRight,
  Inbox,
  BarChart3,
  SearchCheck,
  Settings,
  UserCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface SidebarItem {
  label: string;
  href: string;
  badge?: "hitl" | "transfers";
}

interface SidebarSection {
  id: string;
  icon: any;
  label: string;
  items: SidebarItem[];
}

const sidebarSections: SidebarSection[] = [
  {
    id: "import",
    icon: Inbox,
    label: "Import & Upload",
    items: [
      { label: "Upload Statements", href: "/upload" },
      { label: "Upload Receipts", href: "/receipts/upload" },
      { label: "Statement Queue", href: "/upload/queue" },
      { label: "Receipt Queue", href: "/receipts/queue" },
    ],
  },
  {
    id: "financial",
    icon: BarChart3,
    label: "Financial Data",
    items: [
      { label: "Transactions", href: "/transactions" },
      { label: "Statements", href: "/statements" },
      { label: "Statement Status", href: "/statements/status" },
      { label: "Receipts", href: "/receipts" },
    ],
  },
  {
    id: "review",
    icon: SearchCheck,
    label: "Review & Matching",
    items: [
      { label: "HITL Review Queue", href: "/review-queue", badge: "hitl" },
      { label: "Transfer Matches", href: "/transfers/review", badge: "transfers" },
    ],
  },
  {
    id: "settings",
    icon: Settings,
    label: "Settings",
    items: [
      { label: "Accounts", href: "/accounts" },
      { label: "Categories", href: "/categories" },
      { label: "Knowledge Base", href: "/admin/knowledge-base" },
    ],
  },
  {
    id: "contacts",
    icon: UserCircle,
    label: "Contacts",
    items: [
      { label: "Clients", href: "/clients" },
      { label: "Vendors", href: "/vendors" },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();
  const { signOut, profile, user } = useAuth();
  
  // Badge counts
  const [badgeCounts, setBadgeCounts] = useState({
    hitl: 0,
    transfers: 0,
  });

  // Accordion state - default expand Financial Data and Review sections
  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    // Try to load from localStorage
    const saved = localStorage.getItem("sidebar-expanded");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return ["financial", "review"];
      }
    }
    return ["financial", "review"];
  });

  // Auto-expand section containing current route
  useEffect(() => {
    const currentPath = location.pathname;
    const activeSection = sidebarSections.find((section) =>
      section.items.some((item) => 
        currentPath === item.href || currentPath.startsWith(item.href + "/")
      )
    );
    
    if (activeSection && !expandedSections.includes(activeSection.id)) {
      setExpandedSections((prev) => [...prev, activeSection.id]);
    }
  }, [location.pathname]);

  // Persist expanded state to localStorage
  useEffect(() => {
    localStorage.setItem("sidebar-expanded", JSON.stringify(expandedSections));
  }, [expandedSections]);

  // Fetch badge counts
  useEffect(() => {
    const fetchCounts = async () => {
      if (!user) return;

      try {
        // HITL Review Queue count
        const { count: hitlCount } = await supabase
          .from("transactions")
          .select("*", { count: "exact", head: true })
          .eq("needs_review", true);

        // Transfer matches count
        const { count: transferCount } = await supabase
          .from("transfer_candidates")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending");

        setBadgeCounts({
          hitl: hitlCount || 0,
          transfers: transferCount || 0,
        });
      } catch (err) {
        console.error("Error fetching badge counts:", err);
      }
    };

    fetchCounts();

    // Refresh every 30 seconds
    const interval = setInterval(fetchCounts, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(href + "/");

  const getBadgeCount = (badgeType?: "hitl" | "transfers"): number => {
    if (!badgeType) return 0;
    return badgeCounts[badgeType];
  };

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
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {/* Dashboard - Standalone */}
        <Link
          to="/dashboard"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
            isActive("/dashboard")
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          )}
        >
          <LayoutDashboard className="h-5 w-5" />
          Dashboard
        </Link>

        {/* Accordion Sections */}
        {sidebarSections.map((section) => {
          const isExpanded = expandedSections.includes(section.id);
          const hasActiveItem = section.items.some((item) => isActive(item.href));

          return (
            <div key={section.id} className="mt-1">
              {/* Section Header */}
              <button
                onClick={() => toggleSection(section.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  hasActiveItem
                    ? "text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <span className="flex items-center gap-3">
                  <section.icon className="h-5 w-5" />
                  <span>{section.label}</span>
                </span>
                <ChevronRight
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isExpanded ? "rotate-90" : ""
                  )}
                />
              </button>

              {/* Section Items */}
              {isExpanded && (
                <div className="mt-1 ml-6 space-y-1 border-l-2 border-sidebar-border pl-4">
                  {section.items.map((item) => {
                    const itemIsActive = isActive(item.href);
                    const badgeCount = getBadgeCount(item.badge);

                    return (
                      <Link
                        key={item.href}
                        to={item.href}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
                          itemIsActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <span className="w-1 h-1 rounded-full bg-current opacity-50" />
                          {item.label}
                        </span>
                        {item.badge && badgeCount > 0 && (
                          <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                            {badgeCount}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
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
