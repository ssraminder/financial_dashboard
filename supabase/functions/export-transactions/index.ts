// =============================================================================
// export-transactions - Background CSV Export
// Version: 1.0.0
// Date: February 26, 2026
// =============================================================================
//
// PURPOSE:
// Export ALL transactions matching given filters as CSV, stored in Supabase
// Storage. Tracks progress via the exports table so users can download later.
//
// USAGE:
// POST {
//   export_id: "uuid",         // pre-created exports row ID
//   filters: {
//     from_date?: "YYYY-MM-DD",
//     to_date?: "YYYY-MM-DD",
//     bank_account_id?: "uuid",
//     company_id?: "uuid",
//     category_id?: "uuid" | "uncategorized",
//     status?: "pending" | "auto_categorized" | "hitl_required" | "reviewed" | "exported",
//     needs_review?: boolean,
//     search_term?: string,
//     show_unconfirmed?: boolean,
//   }
// }
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExportRequest {
  export_id: string;
  filters: {
    from_date?: string;
    to_date?: string;
    bank_account_id?: string;
    company_id?: string;
    category_id?: string;
    status?: string;
    needs_review?: boolean;
    search_term?: string;
    show_unconfirmed?: boolean;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify the caller's auth token to get user_id
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ success: false, error: "Missing authorization" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body: ExportRequest = await req.json();
    const { export_id, filters } = body;

    if (!export_id) {
      throw new Error("export_id is required");
    }

    // Helper to build a filtered query (reused for each page)
    const selectFields = `
        id,
        transaction_date,
        description,
        payee_name,
        amount,
        transaction_type,
        gst_amount,
        has_gst,
        needs_review,
        linked_to,
        link_type,
        is_edited,
        currency,
        category:categories!category_id(name),
        bank_account:bank_accounts!bank_account_id(nickname),
        company:companies(name),
        statement:statement_imports(import_status)
    `;

    const applyFilters = (query: any) => {
      if (filters.from_date) {
        query = query.gte("transaction_date", filters.from_date);
      }
      if (filters.to_date) {
        query = query.lte("transaction_date", filters.to_date);
      }
      if (filters.bank_account_id) {
        query = query.eq("bank_account_id", filters.bank_account_id);
      }
      if (filters.company_id) {
        query = query.eq("company_id", filters.company_id);
      }
      if (filters.category_id === "uncategorized") {
        query = query.is("category_id", null);
      } else if (filters.category_id) {
        query = query.eq("category_id", filters.category_id);
      }
      if (filters.status) {
        query = query.eq("status", filters.status);
      }
      if (filters.needs_review) {
        query = query.eq("needs_review", true);
      }
      if (!filters.show_unconfirmed) {
        query = query.eq("statement.import_status", "confirmed");
      }
      return query;
    };

    // Fetch ALL matching transactions in batches (Supabase caps at 1000 per request)
    const PAGE_SIZE = 5000;
    let allTransactions: any[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from("transactions")
        .select(selectFields)
        .order("transaction_date", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      query = applyFilters(query);

      const { data, error: queryError } = await query;

      if (queryError) {
        throw new Error(`Query failed: ${queryError.message}`);
      }

      const batch = data || [];
      allTransactions = allTransactions.concat(batch);
      offset += PAGE_SIZE;
      hasMore = batch.length === PAGE_SIZE;
    }

    let rows = allTransactions;

    // Apply client-side search filter (same as Transactions page)
    if (filters.search_term) {
      const term = filters.search_term.toLowerCase();
      rows = rows.filter(
        (t: any) =>
          t.description?.toLowerCase().includes(term) ||
          t.payee_name?.toLowerCase().includes(term),
      );
    }

    // Build CSV
    const headers = [
      "Date",
      "Payee",
      "Description",
      "Type",
      "Debit",
      "Credit",
      "Currency",
      "Category",
      "Account",
      "Company",
      "GST",
      "Needs Review",
      "Linked",
      "Edited",
    ];

    const csvRows = rows.map((t: any) => {
      const amount = Math.abs(t.amount ?? 0).toFixed(2);
      return [
        t.transaction_date || "",
        t.payee_name || "",
        t.description || "",
        t.transaction_type || "",
        t.transaction_type === "debit" ? amount : "",
        t.transaction_type === "credit" ? amount : "",
        t.currency || "CAD",
        t.category?.name || "",
        t.bank_account?.nickname || "",
        t.company?.name || "",
        t.gst_amount ? t.gst_amount.toFixed(2) : "",
        t.needs_review ? "Yes" : "No",
        t.linked_to ? "Yes" : "No",
        t.is_edited ? "Yes" : "No",
      ];
    });

    const csv = [headers, ...csvRows]
      .map((row) => row.map((cell: string) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const csvBytes = new TextEncoder().encode(csv);

    // Upload to storage: exports/{user_id}/{export_id}.csv
    const filePath = `${user.id}/${export_id}.csv`;
    const { error: uploadError } = await supabase.storage
      .from("exports")
      .upload(filePath, csvBytes, {
        contentType: "text/csv",
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Update exports record to completed
    const { error: updateError } = await supabase
      .from("exports")
      .update({
        status: "completed",
        file_path: filePath,
        file_size: csvBytes.length,
        row_count: rows.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", export_id);

    if (updateError) {
      throw new Error(`Failed to update export record: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        export_id,
        row_count: rows.length,
        file_size: csvBytes.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Export error:", error);

    // Try to mark the export as failed
    try {
      const { export_id } = await req.clone().json();
      if (export_id) {
        await supabase
          .from("exports")
          .update({
            status: "failed",
            error_message: error.message,
            completed_at: new Date().toISOString(),
          })
          .eq("id", export_id);
      }
    } catch {
      // Ignore cleanup errors
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
