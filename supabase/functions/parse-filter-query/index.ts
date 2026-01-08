import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  if (!anthropicKey) {
    return new Response(
      JSON.stringify({ success: false, error: "AI service not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "Query is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const prompt = `You are a filter parser for a financial transactions page. Parse the user's natural language query into structured filters.

USER QUERY: "${query}"

Return JSON with applicable filters (only include fields that apply):

{
  "date_preset": "today|yesterday|this_week|last_week|this_month|mtd|last_month|this_quarter|last_quarter|ytd|last_year|all",
  "date_from": "YYYY-MM-DD",
  "date_to": "YYYY-MM-DD",
  "category": "category_code",
  "description": "search term",
  "needs_review": true/false,
  "summary": "Brief description of applied filters"
}

CATEGORY CODES:
- revenue_square, revenue_stripe, revenue_etransfer, revenue_wire, revenue_cheque
- contractor, professional_fees, payroll_salary, payroll_fees
- tax_cra, bank_fee, bank_transfer
- utilities_telecom, software_subscription, office_expense
- meals_entertainment (restaurants, coffee, food, dining)
- travel_transport, travel_accommodation, travel_flights
- insurance, loan_payment, loan_proceeds
- personal_expense, uncategorized

RULES:
- "expenses" typically means debits (money out)
- "deposits" or "income" typically means credits (money in)
- Restaurant/food/coffee/dining → category: "meals_entertainment"
- Square/Stripe → category: "revenue_square" or "revenue_stripe"
- "needs review" or "uncategorized" → needs_review: true
- For date ranges, prefer using date_preset when possible
- "this month" → date_preset: "this_month"
- "last month" → date_preset: "last_month"
- "last quarter" → date_preset: "last_quarter"
- Only use date_from/date_to for specific dates mentioned

Return ONLY valid JSON, no markdown.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Anthropic API error:", errorText);
      throw new Error(`API error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const textContent = aiResponse.content.find((c: any) => c.type === "text");

    if (!textContent) {
      throw new Error("No text content in AI response");
    }

    let jsonText = textContent.text.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith("```")) {
      jsonText = jsonText
        .replace(/```json?\n?/g, "")
        .replace(/```$/g, "")
        .trim();
    }

    const filters = JSON.parse(jsonText);

    return new Response(JSON.stringify({ success: true, filters }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Parse filter error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to parse query",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
