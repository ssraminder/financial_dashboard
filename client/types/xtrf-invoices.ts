export type PayableStatusValue =
  | "complete"
  | "pending_ap_entry"
  | "no_invoice_submitted";

export interface XtrfPayableInvoice {
  id: string;
  project_number: string | null;
  project_name: string | null;
  client_name: string | null;
  client_branch_name: string | null;
  vendor_name: string | null;
  language_combination: string | null;
  invoice_final_number: string | null;
  invoice_internal_number: string | null;
  amount_gross: number | null;
  amount_cad: number | null;
  amount_paid: number | null;
  currency: string | null;
  original_currency: string | null;
  payment_status: PaymentStatus | null;
  payable_status: PayableStatusValue | null;
  invoice_date: string | null;
  payment_due_date: string | null;
  payment_date: string | null;
  job_type_id: string | null;
  job_description: string | null;
  rate: number | null;
  quantity: number | null;
  notes_from_vendor: string | null;
  last_synced_at: string | null;
}

export interface XtrfReceivableInvoice {
  id: string;
  project_number: string | null;
  project_name: string | null;
  client_name: string | null;
  client_branch_name: string | null;
  language_combination: string | null;
  invoice_final_number: string | null;
  invoice_internal_number: string | null;
  amount_gross: number | null;
  amount_cad: number | null;
  amount_paid: number | null;
  currency: string | null;
  payment_status: PaymentStatus | null;
  invoice_date: string | null;
  payment_due_date: string | null;
  payment_date: string | null;
  last_synced_at: string | null;
}

export type PaymentStatus =
  | "NOT_PAID"
  | "PARTIALLY_PAID"
  | "FULLY_PAID"
  | "IRRECOVERABLE";

export interface XtrfSyncLog {
  sync_type: string;
  status: "running" | "completed" | "failed";
  notes: string | null;
  completed_at: string | null;
  started_at: string | null;
  backfill_complete?: boolean;
}

export type DateFieldOption = "invoice_date" | "payment_due_date" | "payment_date";

export type DatePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "last_year"
  | "all_time"
  | "custom"
  | string; // dynamic year values like "2026", "2025", etc.

export interface XtrfInvoiceFilters {
  search: string;
  dateField: DateFieldOption;
  datePreset: DatePreset;
  dateFrom: string;
  dateTo: string;
  paymentStatuses: PaymentStatus[];
  branches: string[];
  vendorsOrClients: string[];
  minAmount: string;
  maxAmount: string;
  invoiceNumber: string;
  languages: string[];
  hasInvoiceOnly: boolean;
}

export const DEFAULT_FILTERS: XtrfInvoiceFilters = {
  search: "",
  dateField: "invoice_date",
  datePreset: "this_month",
  dateFrom: "",
  dateTo: "",
  paymentStatuses: ["NOT_PAID", "PARTIALLY_PAID", "FULLY_PAID", "IRRECOVERABLE"],
  branches: [],
  vendorsOrClients: [],
  minAmount: "",
  maxAmount: "",
  invoiceNumber: "",
  languages: [],
  hasInvoiceOnly: false,
};

export type TabType = "payables" | "receivables";

export type SortDirection = "asc" | "desc";

export interface SortConfig {
  field: string;
  direction: SortDirection;
}
