import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PendingReviewRequest {
  action: "approve" | "reject" | "edit_and_approve";
  id: string;
  user_email: string;
  rejection_reason?: string;
  quick_reasons?: string[];
  overrides?: Record<string, unknown>;
}

interface PendingQueueItem {
  id: string;
  source: string;
  proposed_payee_pattern: string;
  proposed_category_id: string;
  proposed_has_gst: boolean;
  proposed_gst_rate: number;
  proposed_has_tip: boolean;
  proposed_payee_display_name?: string;
  proposed_payee_type?: string;
  confidence_score: number;
  match_count: number;
  created_at: string;
  expires_at: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: PendingReviewRequest = await req.json();

    if (!body.action || !body.id || !body.user_email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: action, id, user_email",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Verify user has permission
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("email", body.user_email)
      .single();

    if (
      !userProfile ||
      (userProfile.role !== "admin" && userProfile.role !== "owner")
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Insufficient permissions",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Fetch the pending item
    const { data: pendingItem, error: fetchError } = await supabase
      .from("kb_pending_queue")
      .select("*")
      .eq("id", body.id)
      .single();

    if (fetchError || !pendingItem) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Pending item not found",
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    let result = {};

    if (body.action === "approve" || body.action === "edit_and_approve") {
      // Prepare entry data
      const entryData = {
        payee_pattern: (
          body.overrides?.payee_pattern ||
          (pendingItem as PendingQueueItem).proposed_payee_pattern
        )
          .toString()
          .toUpperCase()
          .trim(),
        category_id:
          body.overrides?.category_id ||
          (pendingItem as PendingQueueItem).proposed_category_id,
        default_has_gst:
          body.overrides?.default_has_gst !== undefined
            ? body.overrides.default_has_gst
            : (pendingItem as PendingQueueItem).proposed_has_gst,
        default_gst_rate:
          body.overrides?.default_gst_rate ||
          (pendingItem as PendingQueueItem).proposed_gst_rate,
        default_has_tip:
          body.overrides?.default_has_tip !== undefined
            ? body.overrides.default_has_tip
            : (pendingItem as PendingQueueItem).proposed_has_tip,
        payee_display_name:
          body.overrides?.payee_display_name ||
          (pendingItem as PendingQueueItem).proposed_payee_display_name ||
          "",
        payee_type:
          body.overrides?.payee_type ||
          (pendingItem as PendingQueueItem).proposed_payee_type ||
          "vendor",
        confidence_score:
          body.overrides?.confidence_score ||
          (pendingItem as PendingQueueItem).confidence_score,
        source: (pendingItem as PendingQueueItem).source,
        is_active: true,
      };

      // Check if entry already exists
      const { data: existingEntry } = await supabase
        .from("knowledgebase_payees")
        .select("id")
        .eq("payee_pattern", entryData.payee_pattern)
        .maybeSingle();

      if (existingEntry) {
        // Update existing
        const { error: updateError } = await supabase
          .from("knowledgebase_payees")
          .update(entryData)
          .eq("id", existingEntry.id);

        if (updateError) throw updateError;

        result = {
          action: "updated",
          entry_id: existingEntry.id,
        };
      } else {
        // Create new
        const { data: newEntry, error: insertError } = await supabase
          .from("knowledgebase_payees")
          .insert([entryData])
          .select("id")
          .single();

        if (insertError) throw insertError;

        result = {
          action: "created",
          entry_id: newEntry.id,
        };
      }

      // Record in change history
      await supabase.from("kb_change_history").insert({
        entry_id: result.entry_id || existingEntry?.id,
        action: "create",
        changed_fields: entryData,
        changed_by: body.user_email,
        changed_at: new Date().toISOString(),
      });

      // Mark as approved in queue
      const { error: approveError } = await supabase
        .from("kb_pending_queue")
        .update({
          status: "approved",
          reviewed_by: body.user_email,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", body.id);

      if (approveError) throw approveError;
    } else if (body.action === "reject") {
      // Build rejection reason
      const reasons = [
        ...(body.quick_reasons || []),
        body.rejection_reason && body.rejection_reason.trim(),
      ]
        .filter(Boolean)
        .join(" | ");

      // Mark as rejected
      const { error: rejectError } = await supabase
        .from("kb_pending_queue")
        .update({
          status: "rejected",
          rejection_reason: reasons,
          reviewed_by: body.user_email,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", body.id);

      if (rejectError) throw rejectError;

      result = {
        action: "rejected",
        reason: reasons,
      };
    }

    return new Response(
      JSON.stringify({
        success: true,
        results: result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error processing KB pending review:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
