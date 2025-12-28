import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Use placeholder values if credentials are not set to prevent errors
// The app will show a setup message instead of crashing
const url = supabaseUrl || "https://placeholder.supabase.co";
const key = supabaseAnonKey || "placeholder-key";

// Create client without strict typing to allow flexible updates
export const supabase = createClient(url, key);

// Export a typed version for type-safe queries
export const supabaseTyped = createClient<Database>(url, key);

// Export a flag to check if Supabase is properly configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
