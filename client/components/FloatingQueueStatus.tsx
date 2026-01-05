import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Loader2, ChevronRight } from "lucide-react";

export function FloatingQueueStatus() {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState({ queued: 0, processing: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data } = await supabase
          .from("receipt_upload_queue")
          .select("status")
          .in("status", ["queued", "processing"]);

        const queued = data?.filter((r) => r.status === "queued").length || 0;
        const processing =
          data?.filter((r) => r.status === "processing").length || 0;

        setStats({ queued, processing });
        setIsVisible(queued > 0 || processing > 0);
      } catch (error) {
        console.error("Error fetching queue stats:", error);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, []);

  // Hide on queue page itself
  if (location.pathname === "/receipts/queue") return null;
  if (!isVisible) return null;

  return (
    <button
      onClick={() => navigate("/receipts/queue")}
      className="fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 shadow-lg rounded-full hover:shadow-xl transition-all z-50 hover:scale-105"
    >
      <div className="relative">
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
      </div>
      <div className="text-left">
        <p className="text-sm font-medium text-gray-900">Processing Receipts</p>
        <p className="text-xs text-gray-500">
          {stats.processing > 0 ? `${stats.processing} active` : ""}
          {stats.processing > 0 && stats.queued > 0 ? " • " : ""}
          {stats.queued > 0 ? `${stats.queued} queued` : ""}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400" />
    </button>
  );
}
