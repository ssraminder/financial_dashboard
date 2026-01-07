import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { FloatingQueueStatus } from "@/components/FloatingQueueStatus";
import { AIChatWidget } from "@/components/AIChatWidget";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ReviewQueue from "./pages/ReviewQueue";
import Upload from "./pages/Upload";
import UploadQueue from "./pages/UploadQueue";
import ReceiptUpload from "./pages/ReceiptUpload";
import Receipts from "./pages/Receipts";
import ReceiptQueue from "./pages/ReceiptQueue";
import Transactions from "./pages/Transactions";
import ViewStatements from "./pages/ViewStatements";
import Transfers from "./pages/Transfers";
import TransferReview from "./pages/TransferReview";
import ManualTransferEntry from "./pages/ManualTransferEntry";
import PendingTransfers from "./pages/PendingTransfers";
import Categories from "./pages/Categories";
import Accounts from "./pages/Accounts";
import Clients from "./pages/Clients";
import Vendors from "./pages/Vendors";
import KBAdmin from "./pages/KBAdmin";
import KBPendingQueue from "./pages/KBPendingQueue";
import Notifications from "./pages/Notifications";
import StatementStatus from "./pages/StatementStatus";
import AdminUsers from "./pages/AdminUsers";
import AcceptInvite from "./pages/AcceptInvite";
import AIPromptsManagement from "./pages/AIPromptsManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <FloatingQueueStatus />
        <AIChatWidget />
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/accept-invite" element={<AcceptInvite />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/review-queue" element={<ReviewQueue />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/upload/queue" element={<UploadQueue />} />
          <Route path="/receipts" element={<Receipts />} />
          <Route path="/receipts/upload" element={<ReceiptUpload />} />
          <Route path="/receipts/queue" element={<ReceiptQueue />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/statements" element={<ViewStatements />} />
          <Route path="/statements/status" element={<StatementStatus />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/transfers/review" element={<TransferReview />} />
          <Route path="/manual-transfer" element={<ManualTransferEntry />} />
          <Route path="/pending-transfers" element={<PendingTransfers />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/admin/knowledge-base" element={<KBAdmin />} />
          <Route
            path="/admin/knowledge-base/pending"
            element={<KBPendingQueue />}
          />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/ai-prompts" element={<AIPromptsManagement />} />
          <Route path="/notifications" element={<Notifications />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

// Prevent double root creation in development HMR
const rootElement = document.getElementById("root")!;

// Check if we're in development mode and use a module-level variable
let root: ReturnType<typeof createRoot>;

if (import.meta.hot) {
  // Development mode with HMR
  if (!import.meta.hot.data.root) {
    import.meta.hot.data.root = createRoot(rootElement);
  }
  root = import.meta.hot.data.root;
} else {
  // Production mode
  root = createRoot(rootElement);
}

root.render(<App />);
