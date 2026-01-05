import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  Receipt,
  Link as LinkIcon,
  AlertCircle,
  FileText,
  ArrowLeftRight,
  CheckCircle,
} from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type:
    | "receipt_processed"
    | "receipt_matched"
    | "receipt_needs_review"
    | "statement_processed"
    | "transfer_matched"
    | "batch_complete"
    | "system";
  reference_type: "receipt" | "transaction" | "statement" | "batch" | null;
  reference_id: string | null;
  is_read: boolean;
  created_at: string;
  user_id: string;
}

interface NotificationBellProps {
  dropdownPosition?: 'top' | 'bottom';
}

export function NotificationBell({ dropdownPosition = 'bottom' }: NotificationBellProps = {}) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch recent notifications
      const { data: notifData, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      setNotifications(notifData || []);

      // Calculate unread count
      const unread = notifData?.filter((n) => !n.is_read).length || 0;
      setUnreadCount(unread);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time subscription
  useEffect(() => {
    const setupSubscription = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel("notifications")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "notifications",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotif = payload.new as Notification;
            // Add new notification to the list
            setNotifications((prev) => [newNotif, ...prev].slice(0, 10));
            setUnreadCount((prev) => prev + 1);

            // Show toast for new notification
            toast(newNotif.title, {
              description: newNotif.message,
            });
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupSubscription();
  }, []);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (notificationIds: string[]) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .in("id", notificationIds)
        .eq("user_id", user.id);

      if (error) throw error;

      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          notificationIds.includes(n.id) ? { ...n, is_read: true } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - notificationIds.length));
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length > 0) {
      await markAsRead(unreadIds);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    if (!notification.is_read) {
      await markAsRead([notification.id]);
    }

    // Navigate to reference
    if (notification.reference_type && notification.reference_id) {
      switch (notification.reference_type) {
        case "receipt":
          navigate(`/receipts?id=${notification.reference_id}`);
          break;
        case "transaction":
          navigate(`/transactions?id=${notification.reference_id}`);
          break;
        case "statement":
          navigate(`/statements?id=${notification.reference_id}`);
          break;
        default:
          break;
      }
    }

    setIsOpen(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "receipt_processed":
        return <Receipt className="w-5 h-5 text-blue-500" />;
      case "receipt_matched":
        return <LinkIcon className="w-5 h-5 text-green-500" />;
      case "receipt_needs_review":
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case "statement_processed":
        return <FileText className="w-5 h-5 text-purple-500" />;
      case "transfer_matched":
        return <ArrowLeftRight className="w-5 h-5 text-green-500" />;
      case "batch_complete":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getTimeAgo = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-full flex items-center gap-3 p-2 hover:bg-sidebar-accent rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-sidebar-foreground/70" />
        <span className="text-sm font-medium text-sidebar-foreground/70">Notifications</span>

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-xs font-medium rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className={`absolute right-0 w-80 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50 ${
          dropdownPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
        }`}>
          {/* Header */}
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Notifications</h3>
            {notifications.some((n) => !n.is_read) && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                <p className="text-sm">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                <BellOff className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No notifications</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-gray-50 transition-colors ${
                    !notification.is_read ? "bg-blue-50" : ""
                  }`}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={`text-sm ${!notification.is_read ? "font-medium" : ""}`}
                      >
                        {notification.title}
                      </p>
                      {!notification.is_read && (
                        <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {notification.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {getTimeAgo(notification.created_at)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-3 border-t bg-gray-50">
              <button
                onClick={() => {
                  navigate("/notifications");
                  setIsOpen(false);
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-700"
              >
                View All Notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
