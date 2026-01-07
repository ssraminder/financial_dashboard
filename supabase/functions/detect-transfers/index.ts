// =============================================================================
// detect-transfers - Find Internal Transfer Pairs
// Version: 1.1.0
// Date: January 7, 2026
// =============================================================================
//
// PURPOSE:
// Detect internal transfers between bank accounts by matching debits to credits.
// Auto-links high-confidence same-company transfers, queues others for HITL.
// NOW ALSO: Matches imported transactions with pending manual transfers.
//
// CHANGELOG:
// v1.1.0 - Added pending transfer matching logic
// v1.0.1 - Added keywords: LOAN, LOC, WITHDRAWAL, DEPOSIT, LINE OF CREDIT, WWW TFR, VIN0
// v1.0.0 - Initial release
//
// USAGE:
// POST {
//   transaction_ids: ["uuid1", "uuid2", ...],  // specific transactions
//   // OR
//   filter: { statement_import_id: "uuid", date_from: "2025-01-01", ... },
//   auto_link_threshold: 95,  // default 95
//   date_tolerance_days: 3    // default 3
// }
//
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// =============================================================================
// TYPES
// =============================================================================

interface DetectTransfersRequest {
  transaction_ids?: string[];
  filter?: {
    statement_import_id?: string;
    bank_account_id?: string;
    date_from?: string;
    date_to?: string;
  };
  auto_link_threshold?: number;  // Default 95
  date_tolerance_days?: number;  // Default 3
  batch_id?: string;             // Link to reanalyze batch
  dry_run?: boolean;             // Don't save, just detect
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  total_amount: number;
  transaction_type: 'debit' | 'credit';
  transaction_date: string;
  posting_date: string;
  bank_account_id: string;
  company_id: string;
  currency: string;
  bank_account?: {
    id: string;
    bank_name: string;
    nickname: string;
    currency: string;
    company_id: string;
  };
}

interface TransferCandidate {
  from_transaction: Transaction;
  to_transaction: Transaction;
  confidence_score: number;
  confidence_factors: {
    amount_match: boolean;
    amount_match_type: 'exact' | 'forex_1pct' | 'forex_2pct' | 'no_match';
    date_diff_days: number;
    same_company: boolean;
    has_transfer_keywords: boolean;
  };
  exchange_rate_used?: number;
  exchange_rate_source?: string;
  is_cross_company: boolean;
}

interface PendingTransfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  transfer_date: string;
  from_transaction_id: string | null;
  to_transaction_id: string | null;
  status: string;
  match_tolerance_days: number;
  match_tolerance_amount: number;
}

// Transfer-related keywords
const TRANSFER_KEYWORDS = [
  'TRANSFER', 'TFR', 'BR TO BR', 'ONLINE BANKING', 
  'E-TRANSFER', 'ETRANSFER', 'INTERAC', 'PAYMENT',
  'WIRE', 'FX', 'FOREX', 'CONVERSION',
  'LOAN', 'LOC', 'WITHDRAWAL', 'DEPOSIT',
  'LINE OF CREDIT', 'WWW TFR', 'VIN0'
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function hasTransferKeywords(description: string): boolean {
  const upper = description.toUpperCase();
  return TRANSFER_KEYWORDS.some(kw => upper.includes(kw));
}

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

async function getExchangeRate(
  supabase: SupabaseClient,
  supabaseUrl: string,
  date: string,
  fromCurrency: string,
  toCurrency: string
): Promise<{ rate: number; source: string } | null> {
  if (fromCurrency.toUpperCase() === toCurrency.toUpperCase()) {
    return { rate: 1.0, source: 'same_currency' };
  }

  const { data: cached } = await supabase
    .from('exchange_rates_cache')
    .select('rate, source')
    .eq('rate_date', date)
    .eq('from_currency', fromCurrency.toUpperCase())
    .eq('to_currency', toCurrency.toUpperCase())
    .single();

  if (cached) {
    return { rate: cached.rate, source: cached.source + '_cached' };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/get-exchange-rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        from_currency: fromCurrency,
        to_currency: toCurrency
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        return { rate: data.rate, source: data.source };
      }
    }
  } catch (error) {
    console.error('Exchange rate fetch error:', error);
  }

  return null;
}

function calculateConfidenceScore(
  amountMatchType: 'exact' | 'forex_1pct' | 'forex_2pct' | 'no_match',
  dateDiffDays: number,
  sameCompany: boolean,
  hasKeywords: boolean
): number {
  let score = 0;

  switch (amountMatchType) {
    case 'exact': score += 40; break;
    case 'forex_1pct': score += 35; break;
    case 'forex_2pct': score += 25; break;
    default: score += 0;
  }

  switch (dateDiffDays) {
    case 0: score += 30; break;
    case 1: score += 20; break;
    case 2: score += 10; break;
    case 3: score += 5; break;
    default: score += 0;
  }

  if (sameCompany) score += 20;
  if (hasKeywords) score += 10;

  return score;
}

// =============================================================================
// PENDING TRANSFER MATCHING
// =============================================================================

async function matchPendingTransfers(
  supabase: SupabaseClient,
  transactions: Transaction[]
): Promise<{ matched: number; partial: number }> {
  let matchedCount = 0;
  let partialCount = 0;

  console.log(`Checking ${transactions.length} transactions against pending transfers...`);

  // Get transfer category
  const { data: transferCategory } = await supabase
    .from('categories')
    .select('id')
    .eq('code', 'bank_transfer')
    .single();

  const transferCategoryId = transferCategory?.id;

  for (const txn of transactions) {
    const txnDate = new Date(txn.posting_date || txn.transaction_date);
    const txnAmount = Math.abs(txn.total_amount || txn.amount);

    // Look for pending transfers involving this account
    const { data: pendingMatches, error } = await supabase
      .from("pending_transfers")
      .select("*")
      .or(`from_account_id.eq.${txn.bank_account_id},to_account_id.eq.${txn.bank_account_id}`)
      .in("status", ["pending", "partial"]);

    if (error || !pendingMatches?.length) {
      continue;
    }

    for (const pending of pendingMatches as PendingTransfer[]) {
      const pendingDate = new Date(pending.transfer_date);
      const toleranceDays = pending.match_tolerance_days || 5;
      const toleranceAmount = pending.match_tolerance_amount || 0.50;

      // Check date tolerance
      const startDate = new Date(pendingDate);
      startDate.setDate(startDate.getDate() - toleranceDays);
      const endDate = new Date(pendingDate);
      endDate.setDate(endDate.getDate() + toleranceDays);

      if (txnDate < startDate || txnDate > endDate) {
        continue;
      }

      // Check amount tolerance
      const amountDiff = Math.abs(pending.amount - txnAmount);
      if (amountDiff > toleranceAmount) {
        continue;
      }

      // Determine if this is the FROM or TO side
      const isFromSide = pending.from_account_id === txn.bank_account_id;
      const isToSide = pending.to_account_id === txn.bank_account_id;

      // Verify transaction type matches expected direction
      const expectedType = isFromSide ? 'debit' : 'credit';
      if (txn.transaction_type !== expectedType) {
        continue;
      }

      // Check if this side is already matched
      if (isFromSide && pending.from_transaction_id) continue;
      if (isToSide && pending.to_transaction_id) continue;

      console.log(`Match found! Pending transfer ${pending.id} with transaction ${txn.id} (${isFromSide ? 'FROM' : 'TO'} side)`);

      // Update pending transfer
      const updateData: any = {
        ...(isFromSide ? { from_transaction_id: txn.id } : {}),
        ...(isToSide ? { to_transaction_id: txn.id } : {}),
      };

      // Check if both sides are now matched
      const fromMatched = isFromSide ? true : !!pending.from_transaction_id;
      const toMatched = isToSide ? true : !!pending.to_transaction_id;

      if (fromMatched && toMatched) {
        updateData.status = 'matched';
        updateData.matched_at = new Date().toISOString();

        // Link the two transactions together
        const otherTxnId = isFromSide ? pending.to_transaction_id : pending.from_transaction_id;

        if (otherTxnId) {
          // Update both transactions to link to each other
          await supabase
            .from("transactions")
            .update({
              linked_to: otherTxnId,
              link_type: 'transfer',
              transfer_status: 'matched',
              category_id: transferCategoryId,
              needs_review: false,
            })
            .eq("id", txn.id);

          await supabase
            .from("transactions")
            .update({
              linked_to: txn.id,
              link_type: 'transfer',
              transfer_status: 'matched',
              category_id: transferCategoryId,
              needs_review: false,
            })
            .eq("id", otherTxnId);

          matchedCount++;
          console.log(`✓ Both sides matched! Linked ${txn.id} ↔ ${otherTxnId}`);
        }
      } else {
        updateData.status = 'partial';
        partialCount++;
        console.log(`↻ Partial match (${isFromSide ? 'FROM' : 'TO'} side only)`);

        // Update the current transaction category to transfer
        await supabase
          .from("transactions")
          .update({
            category_id: transferCategoryId,
            needs_review: false,
          })
          .eq("id", txn.id);
      }

      // Update the pending transfer record
      await supabase
        .from("pending_transfers")
        .update(updateData)
        .eq("id", pending.id);

      // Only match once per transaction
      break;
    }
  }

  console.log(`Pending transfer matching complete: ${matchedCount} matched, ${partialCount} partial`);
  return { matched: matchedCount, partial: partialCount };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  console.log("=== detect-transfers v1.1.0 ===");

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: DetectTransfersRequest = await req.json();
    const {
      transaction_ids,
      filter,
      auto_link_threshold = 95,
      date_tolerance_days = 3,
      batch_id,
      dry_run = false
    } = body;

    console.log("Request:", { 
      transaction_ids_count: transaction_ids?.length, 
      filter, 
      auto_link_threshold,
      date_tolerance_days,
      dry_run
    });

    // ===========================================
    // STEP 1: Load transactions
    // ===========================================

    let query = supabase
      .from("transactions")
      .select(`
        id, description, amount, total_amount, transaction_type,
        transaction_date, posting_date, bank_account_id, company_id, currency,
        bank_account:bank_accounts(id, bank_name, nickname, currency, company_id)
      `)
      .in('transaction_type', ['debit', 'credit']);

    if (transaction_ids && transaction_ids.length > 0) {
      query = query.in("id", transaction_ids);
    } else if (filter) {
      if (filter.statement_import_id) {
        query = query.eq("statement_import_id", filter.statement_import_id);
      }
      if (filter.bank_account_id) {
        query = query.eq("bank_account_id", filter.bank_account_id);
      }
      if (filter.date_from) {
        query = query.gte("transaction_date", filter.date_from);
      }
      if (filter.date_to) {
        query = query.lte("transaction_date", filter.date_to);
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Must provide transaction_ids or filter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: transactions, error: txError } = await query;

    if (txError) {
      throw new Error(`Failed to load transactions: ${txError.message}`);
    }

    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "No transactions found",
          summary: { analyzed: 0, candidates: 0, auto_linked: 0, pending_hitl: 0, pending_transfers_matched: 0, pending_transfers_partial: 0 }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Loaded ${transactions.length} transactions`);

    // ===========================================
    // STEP 1.5: Check pending transfers FIRST
    // ===========================================

    let pendingTransfersResult = { matched: 0, partial: 0 };
    if (!dry_run) {
      pendingTransfersResult = await matchPendingTransfers(supabase, transactions as Transaction[]);
    }

    // ===========================================
    // STEP 2: Separate debits and credits
    // ===========================================

    const debits = transactions.filter(t => t.transaction_type === 'debit');
    const credits = transactions.filter(t => t.transaction_type === 'credit');

    console.log(`Debits: ${debits.length}, Credits: ${credits.length}`);

    // ===========================================
    // STEP 3: Find matching pairs
    // ===========================================

    const candidates: TransferCandidate[] = [];
    const matchedDebitIds = new Set<string>();
    const matchedCreditIds = new Set<string>();

    for (const debit of debits) {
      if (matchedDebitIds.has(debit.id)) continue;

      const debitAmount = Math.abs(debit.total_amount || debit.amount);
      const debitDate = debit.posting_date || debit.transaction_date;
      const debitCurrency = debit.currency || debit.bank_account?.currency || 'CAD';
      const debitCompanyId = debit.company_id || debit.bank_account?.company_id;

      for (const credit of credits) {
        if (matchedCreditIds.has(credit.id)) continue;
        if (debit.bank_account_id === credit.bank_account_id) continue;

        const creditAmount = Math.abs(credit.total_amount || credit.amount);
        const creditDate = credit.posting_date || credit.transaction_date;
        const creditCurrency = credit.currency || credit.bank_account?.currency || 'CAD';
        const creditCompanyId = credit.company_id || credit.bank_account?.company_id;

        const dateDiff = daysBetween(debitDate, creditDate);
        if (dateDiff > date_tolerance_days) continue;

        let amountMatchType: 'exact' | 'forex_1pct' | 'forex_2pct' | 'no_match' = 'no_match';
        let exchangeRateUsed: number | undefined;
        let exchangeRateSource: string | undefined;

        if (debitCurrency === creditCurrency) {
          const diff = Math.abs(debitAmount - creditAmount);
          const tolerance = debitAmount * 0.001;
          if (diff <= tolerance) {
            amountMatchType = 'exact';
          }
        } else {
          const rateResult = await getExchangeRate(
            supabase,
            supabaseUrl,
            debitDate,
            debitCurrency,
            creditCurrency
          );

          if (rateResult) {
            const expectedCreditAmount = debitAmount * rateResult.rate;
            const diff = Math.abs(creditAmount - expectedCreditAmount);
            const diffPercent = (diff / expectedCreditAmount) * 100;

            exchangeRateUsed = rateResult.rate;
            exchangeRateSource = rateResult.source;

            if (diffPercent <= 1) {
              amountMatchType = 'forex_1pct';
            } else if (diffPercent <= 2) {
              amountMatchType = 'forex_2pct';
            }
          }
        }

        if (amountMatchType === 'no_match') continue;

        const sameCompany = debitCompanyId === creditCompanyId;
        const hasKeywordsDebit = hasTransferKeywords(debit.description);
        const hasKeywordsCredit = hasTransferKeywords(credit.description);
        const hasKeywords = hasKeywordsDebit || hasKeywordsCredit;

        const confidenceScore = calculateConfidenceScore(
          amountMatchType,
          dateDiff,
          sameCompany,
          hasKeywords
        );

        candidates.push({
          from_transaction: debit as Transaction,
          to_transaction: credit as Transaction,
          confidence_score: confidenceScore,
          confidence_factors: {
            amount_match: true,
            amount_match_type: amountMatchType,
            date_diff_days: dateDiff,
            same_company: sameCompany,
            has_transfer_keywords: hasKeywords
          },
          exchange_rate_used: exchangeRateUsed,
          exchange_rate_source: exchangeRateSource,
          is_cross_company: !sameCompany
        });

        if (confidenceScore >= auto_link_threshold && sameCompany) {
          matchedDebitIds.add(debit.id);
          matchedCreditIds.add(credit.id);
          break;
        }
      }
    }

    console.log(`Found ${candidates.length} transfer candidates`);

    // ===========================================
    // STEP 4: Process candidates
    // ===========================================

    const autoLinked: TransferCandidate[] = [];
    const pendingHitl: TransferCandidate[] = [];

    const { data: transferCategory } = await supabase
      .from('categories')
      .select('id')
      .eq('code', 'bank_transfer')
      .single();

    const transferCategoryId = transferCategory?.id;

    for (const candidate of candidates) {
      const shouldAutoLink = 
        candidate.confidence_score >= auto_link_threshold && 
        !candidate.is_cross_company;

      if (shouldAutoLink && !dry_run) {
        const { error: linkError1 } = await supabase
          .from('transactions')
          .update({
            linked_to: candidate.to_transaction.id,
            link_type: 'transfer_out',
            category_id: transferCategoryId,
            transfer_status: 'matched',
            updated_at: new Date().toISOString()
          })
          .eq('id', candidate.from_transaction.id);

        const { error: linkError2 } = await supabase
          .from('transactions')
          .update({
            linked_to: candidate.from_transaction.id,
            link_type: 'transfer_in',
            category_id: transferCategoryId,
            transfer_status: 'matched',
            updated_at: new Date().toISOString()
          })
          .eq('id', candidate.to_transaction.id);

        if (!linkError1 && !linkError2) {
          autoLinked.push(candidate);
        } else {
          console.error('Link error:', linkError1 || linkError2);
          pendingHitl.push(candidate);
        }
      } else {
        pendingHitl.push(candidate);
      }
    }

    // ===========================================
    // STEP 5: Save HITL candidates to database
    // ===========================================

    if (!dry_run && pendingHitl.length > 0) {
      const candidateRecords = pendingHitl.map(c => ({
        batch_id: batch_id || null,
        from_transaction_id: c.from_transaction.id,
        to_transaction_id: c.to_transaction.id,
        amount_from: Math.abs(c.from_transaction.total_amount || c.from_transaction.amount),
        amount_to: Math.abs(c.to_transaction.total_amount || c.to_transaction.amount),
        currency_from: c.from_transaction.currency || c.from_transaction.bank_account?.currency || 'CAD',
        currency_to: c.to_transaction.currency || c.to_transaction.bank_account?.currency || 'CAD',
        exchange_rate_used: c.exchange_rate_used,
        exchange_rate_source: c.exchange_rate_source,
        date_from: c.from_transaction.posting_date || c.from_transaction.transaction_date,
        date_to: c.to_transaction.posting_date || c.to_transaction.transaction_date,
        date_diff_days: c.confidence_factors.date_diff_days,
        from_account_id: c.from_transaction.bank_account_id,
        to_account_id: c.to_transaction.bank_account_id,
        from_company_id: c.from_transaction.company_id || c.from_transaction.bank_account?.company_id,
        to_company_id: c.to_transaction.company_id || c.to_transaction.bank_account?.company_id,
        is_cross_company: c.is_cross_company,
        confidence_score: c.confidence_score,
        confidence_factors: c.confidence_factors,
        status: 'pending'
      }));

      const { error: insertError } = await supabase
        .from('transfer_candidates')
        .upsert(candidateRecords, {
          onConflict: 'from_transaction_id,to_transaction_id',
          ignoreDuplicates: true
        });

      if (insertError) {
        console.error('Insert candidates error:', insertError);
      }
    }

    // ===========================================
    // STEP 6: Update batch if provided
    // ===========================================

    if (batch_id && !dry_run) {
      await supabase
        .from('reanalyze_batches')
        .update({
          transfers_detected: candidates.length,
          transfers_auto_linked: autoLinked.length,
          transfers_pending_hitl: pendingHitl.length
        })
        .eq('id', batch_id);
    }

    // ===========================================
    // STEP 7: Return results
    // ===========================================

    const summary = {
      analyzed: transactions.length,
      debits: debits.length,
      credits: credits.length,
      candidates: candidates.length,
      auto_linked: autoLinked.length,
      pending_hitl: pendingHitl.length,
      cross_company: candidates.filter(c => c.is_cross_company).length,
      pending_transfers_matched: pendingTransfersResult.matched,
      pending_transfers_partial: pendingTransfersResult.partial
    };

    console.log("Transfer detection complete:", summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        auto_linked: autoLinked.map(c => ({
          from_id: c.from_transaction.id,
          to_id: c.to_transaction.id,
          amount: Math.abs(c.from_transaction.total_amount || c.from_transaction.amount),
          confidence: c.confidence_score
        })),
        pending_hitl: pendingHitl.map(c => ({
          from_id: c.from_transaction.id,
          from_description: c.from_transaction.description,
          from_amount: Math.abs(c.from_transaction.total_amount || c.from_transaction.amount),
          from_date: c.from_transaction.posting_date || c.from_transaction.transaction_date,
          to_id: c.to_transaction.id,
          to_description: c.to_transaction.description,
          to_amount: Math.abs(c.to_transaction.total_amount || c.to_transaction.amount),
          to_date: c.to_transaction.posting_date || c.to_transaction.transaction_date,
          confidence: c.confidence_score,
          is_cross_company: c.is_cross_company,
          exchange_rate: c.exchange_rate_used
        }))
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Detect transfers error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// =============================================================================
// END OF FILE
// Document: detect-transfers/index.ts
// Version: 1.1.0
// =============================================================================
