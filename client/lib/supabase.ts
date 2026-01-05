import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Use placeholder values if credentials are not set to prevent errors
// The app will show a setup message instead of crashing
const url = supabaseUrl || "https://placeholder.supabase.co";
const key = supabaseAnonKey || "placeholder-key";

// Singleton instance stored in module scope
let supabaseInstance: SupabaseClient<Database> | null = null;

// Get or create the Supabase client instance (singleton pattern)
// This prevents "Multiple GoTrueClient instances" warnings
function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    supabaseInstance = createClient<Database>(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabaseInstance;
}

// Export the singleton instance
export const supabase = getSupabaseClient();

// Export the same client with different name for backward compatibility
export const supabaseTyped = supabase;

// Export a flag to check if Supabase is properly configured
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// HMR: Preserve the Supabase instance across hot reloads
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log("🔄 Supabase client preserved across HMR");
  });

  // Store instance in hot data to persist across reloads
  if (import.meta.hot.data.supabase) {
    supabaseInstance = import.meta.hot.data.supabase;
  } else {
    import.meta.hot.data.supabase = supabaseInstance;
  }
}
