import "./global.css";

import { Toaster } from "@/components/ui/toaster";
import { createRoot } from "react-dom/client";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ReviewQueue from "./pages/ReviewQueue";
import Upload from "./pages/Upload";
import Transactions from "./pages/Transactions";
import ViewStatements from "./pages/ViewStatements";
import Transfers from "./pages/Transfers";
import Accounts from "./pages/Accounts";
import Clients from "./pages/Clients";
import Vendors from "./pages/Vendors";
import KBAdmin from "./pages/KBAdmin";
import KBPendingQueue from "./pages/KBPendingQueue";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/review-queue" element={<ReviewQueue />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/statements" element={<ViewStatements />} />
          <Route path="/transfers" element={<Transfers />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/vendors" element={<Vendors />} />
          <Route path="/admin/knowledge-base" element={<KBAdmin />} />
          <Route
            path="/admin/knowledge-base/pending"
            element={<KBPendingQueue />}
          />
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
