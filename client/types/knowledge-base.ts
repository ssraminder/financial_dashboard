/**
 * Knowledge Base Types and Interfaces
 */

export type PatternType =
  | "exact"
  | "starts_with"
  | "ends_with"
  | "contains"
  | "regex";
export type PayeeType =
  | "vendor"
  | "client"
  | "contractor"
  | "employee"
  | "government"
  | "financial"
  | "utility"
  | "transfer";
export type KBSource =
  | "manual"
  | "hitl_correction"
  | "csv_import"
  | "auto_suggest"
  | "receipt_ocr"
  | "xtrf_sync"
  | "legacy_migration";
export type TransactionTypeFilter = "debit" | "credit" | null;

export interface KBEntry {
  id: string;
  payee_pattern: string;
  pattern_type: PatternType;
  payee_display_name: string;
  payee_type: PayeeType;
  category_id: string;
  category?: {
    id: string;
    code: string;
    name: string;
    category_type: string;
  };
  company_id?: string;
  company?: {
    id: string;
    name: string;
  };
  vendor_id?: string;
  vendor?: {
    id: string;
    legal_name: string;
  };
  client_id?: string;
  client?: {
    id: string;
    name: string;
  };
  default_has_gst: boolean;
  default_gst_rate: number;
  default_has_tip: boolean;
  amount_min?: number;
  amount_max?: number;
  transaction_type: TransactionTypeFilter;
  confidence_score: number;
  notes?: string;
  source: KBSource;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
  updated_by: string;
}

export interface KBFilters {
  search?: string;
  category_id?: string;
  payee_type?: PayeeType;
  source?: KBSource;
  is_active?: boolean;
  page: number;
  pageSize: number;
}

export interface AIInterpretationResult {
  action: "create" | "update";
  existing_entry?: KBEntry | null;
  proposed: {
    payee_pattern: string;
    pattern_type?: PatternType;
    payee_display_name?: string;
    payee_type?: PayeeType;
    category_code?: string;
    default_has_gst?: boolean;
    default_gst_rate?: number;
    default_has_tip?: boolean;
  };
  ai_interpretation: string;
  changes_summary?: string[];
  confidence: number;
}

export interface KBListResponse {
  entries: KBEntry[];
  total_count: number;
  pending_count: number;
}
