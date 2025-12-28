export interface Company {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  name: string;
  account_number: string;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category_id: string | null;
  company_id: string | null;
  bank_account_id: string;
  needs_review: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: "owner" | "accountant";
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  revenue: number;
  expenses: number;
  netIncome: number;
  pendingReviews: number;
}

export interface Client {
  id: string;
  xtrf_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  province: string | null;
  status: "Active" | "Potential" | "Inactive";
  is_active: boolean;
  gst_rate: number;
  gst_exempt: boolean;
  preferred_currency: string;
  payment_terms: string;
  client_type: "Individual" | "Business" | "Organization";
  is_recurring: boolean;
  notes: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Vendor {
  id: string;
  legal_name: string;
  status: "Active" | "Inactive";
  is_active: boolean;
  country: string | null;
  city: string | null;
  email: string | null;
  email_3: string | null;
  phone: string | null;
  phone_2: string | null;
  phone_3: string | null;
  overall_evaluation: number | null;
  availability: string | null;
  language_combinations: string | null;
  gst_registered: boolean;
  gst_rate: number;
  gst_number: string | null;
  category: "Contractor" | "Agency" | "Freelancer" | "Employee";
  payment_terms: string;
  preferred_currency: string;
  is_preferred: boolean;
  notes: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}
