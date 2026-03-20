-- Fix: Use COALESCE(ai.customer_name, c.name) in get_ar_invoice_receivables
-- so that customer_name falls back to xtrf_new_customers.name when the
-- invoice table column is NULL (105 rows added after the 2026-03-03 backfill).
-- Also backfills the 105 NULL rows directly in xtrf_new_ar_invoices.

-- Backfill missing customer_name values
UPDATE xtrf_new_ar_invoices ai
SET customer_name = c.name
FROM xtrf_new_customers c
WHERE c.xtrf_id = ai.customer_xtrf_id
  AND ai.customer_name IS NULL;

-- Recreate the RPC with COALESCE fallback for customer_name
CREATE OR REPLACE FUNCTION public.get_ar_invoice_receivables(p_branch_id integer DEFAULT NULL::integer, p_customer_id integer DEFAULT NULL::integer, p_pay_status text DEFAULT NULL::text, p_inv_status text DEFAULT NULL::text, p_date_from text DEFAULT NULL::text, p_date_to text DEFAULT NULL::text, p_currency_id integer DEFAULT NULL::integer, p_search text DEFAULT NULL::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50, p_sort_col text DEFAULT 'invoice_date'::text, p_sort_dir text DEFAULT 'desc'::text)
 RETURNS TABLE(invoice_xtrf_id integer, invoice_number text, customer_name text, customer_xtrf_id integer, currency text, currency_xtrf_id integer, invoice_total numeric, payment_status text, invoice_status text, invoice_date date, payment_due_date date, payment_date date, total_paid numeric, amount_outstanding numeric, branch_id integer, branch_name text, amount_cad numeric, tax_cad numeric, gross_cad numeric, exchange_rate_to_cad numeric, total_count bigint, summary_total_gross numeric, summary_total_paid numeric, summary_outstanding numeric, summary_invoice_count bigint, summary_gross_cad numeric, summary_net_cad numeric, summary_tax_cad numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_offset      int;
  v_pay_filter  text;
  v_inv_filter  text;
  v_date_from   date;
  v_date_to     date;
BEGIN
  v_offset     := (GREATEST(p_page, 1) - 1) * p_page_size;
  v_pay_filter := UPPER(COALESCE(p_pay_status, ''));
  v_inv_filter := UPPER(COALESCE(p_inv_status, ''));
  v_date_from  := NULLIF(TRIM(COALESCE(p_date_from, '')), '')::date;
  v_date_to    := NULLIF(TRIM(COALESCE(p_date_to,   '')), '')::date;

  RETURN QUERY
  WITH payments_agg AS (
    SELECT
      p.invoice_xtrf_id,
      SUM(p.amount)       AS total_paid,
      MAX(p.payment_date) AS last_payment_date
    FROM xtrf_new_ar_payments p
    GROUP BY p.invoice_xtrf_id
  ),
  base AS (
    SELECT
      ai.xtrf_id                                               AS b_id,
      ai.invoice_number                                        AS b_invoice_number,
      COALESCE(ai.customer_name, c.name)                       AS b_customer_name,
      ai.customer_xtrf_id                                      AS b_customer_xtrf_id,
      dc.iso_code                                              AS b_currency,
      ai.currency_xtrf_id                                      AS b_currency_xtrf_id,
      ai.total_gross                                           AS b_total_gross,
      ai.status                                                AS b_inv_status,
      COALESCE(ai.invoice_date, ai.final_date)                 AS b_invoice_date,
      ai.payment_due_date                                      AS b_due_date,
      COALESCE(pa.total_paid, 0)                               AS b_paid,
      pa.last_payment_date                                     AS b_payment_date,
      GREATEST(ai.total_gross - COALESCE(pa.total_paid, 0), 0) AS b_outstanding,
      CASE
        WHEN COALESCE(pa.total_paid, 0) >= ai.total_gross AND ai.total_gross > 0 THEN 'PAID'
        WHEN COALESCE(pa.total_paid, 0) > 0               THEN 'PARTIALLY_PAID'
        ELSE 'NOT_PAID'
      END                                                      AS b_pay_status,
      c.branch_id                                              AS b_branch_id,
      b.branch_name                                            AS b_branch_name,
      ai.amount_cad                                            AS b_amount_cad,
      ai.tax_cad                                               AS b_tax_cad,
      ai.gross_cad                                             AS b_gross_cad,
      ai.exchange_rate_to_cad                                  AS b_fx_rate
    FROM xtrf_new_ar_invoices ai
    LEFT JOIN xtrf_new_customers      c  ON c.xtrf_id  = ai.customer_xtrf_id
    LEFT JOIN xtrf_branches           b  ON b.id       = c.branch_id
    LEFT JOIN xtrf_new_dict_currencies dc ON dc.xtrf_id = ai.currency_xtrf_id
    LEFT JOIN payments_agg            pa ON pa.invoice_xtrf_id = ai.xtrf_id
  ),
  filtered AS (
    SELECT b.*
    FROM base b
    WHERE
      (p_branch_id   IS NULL OR b.b_branch_id       = p_branch_id)
      AND (p_customer_id IS NULL OR b.b_customer_xtrf_id = p_customer_id)
      AND (p_currency_id IS NULL OR b.b_currency_xtrf_id = p_currency_id)
      AND (v_date_from   IS NULL OR b.b_invoice_date    >= v_date_from)
      AND (v_date_to     IS NULL OR b.b_invoice_date    <= v_date_to)
      AND (v_inv_filter  = ''    OR b.b_inv_status       = v_inv_filter)
      AND (
        v_pay_filter = '' OR
        (v_pay_filter = 'OVERDUE' AND b.b_pay_status = 'NOT_PAID' AND b.b_due_date < CURRENT_DATE) OR
        (v_pay_filter NOT IN ('','OVERDUE') AND b.b_pay_status = v_pay_filter)
      )
      AND (
        p_search IS NULL OR
        b.b_invoice_number ILIKE '%' || p_search || '%' OR
        b.b_customer_name  ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (SELECT COUNT(*) AS total FROM filtered),
  summary AS (
    SELECT
      ROUND(SUM(b_total_gross), 2) AS s_gross,
      ROUND(SUM(b_paid), 2)        AS s_paid,
      ROUND(SUM(b_outstanding), 2) AS s_outstanding,
      COUNT(*)                     AS s_count,
      ROUND(SUM(b_gross_cad), 2)   AS s_gross_cad,
      ROUND(SUM(b_amount_cad), 2)  AS s_net_cad,
      ROUND(SUM(b_tax_cad), 2)     AS s_tax_cad
    FROM filtered
  ),
  paged AS (
    SELECT f.* FROM filtered f
    ORDER BY
      CASE WHEN p_sort_col='invoice_date'     AND p_sort_dir='asc'  THEN f.b_invoice_date::text END ASC,
      CASE WHEN p_sort_col='invoice_date'     AND p_sort_dir='desc' THEN f.b_invoice_date::text END DESC,
      CASE WHEN p_sort_col='customer_name'    AND p_sort_dir='asc'  THEN f.b_customer_name END ASC,
      CASE WHEN p_sort_col='customer_name'    AND p_sort_dir='desc' THEN f.b_customer_name END DESC,
      CASE WHEN p_sort_col='invoice_total'    AND p_sort_dir='asc'  THEN f.b_total_gross END ASC,
      CASE WHEN p_sort_col='invoice_total'    AND p_sort_dir='desc' THEN f.b_total_gross END DESC,
      CASE WHEN p_sort_col='payment_due_date' AND p_sort_dir='asc'  THEN f.b_due_date::text END ASC,
      CASE WHEN p_sort_col='payment_due_date' AND p_sort_dir='desc' THEN f.b_due_date::text END DESC,
      CASE WHEN p_sort_col='payment_status'   AND p_sort_dir='asc'  THEN f.b_pay_status END ASC,
      CASE WHEN p_sort_col='payment_status'   AND p_sort_dir='desc' THEN f.b_pay_status END DESC,
      f.b_invoice_date DESC NULLS LAST
    LIMIT p_page_size OFFSET v_offset
  )
  SELECT
    p.b_id::integer,
    p.b_invoice_number,
    p.b_customer_name,
    p.b_customer_xtrf_id::integer,
    p.b_currency,
    p.b_currency_xtrf_id::integer,
    p.b_total_gross,
    p.b_pay_status,
    p.b_inv_status,
    p.b_invoice_date,
    p.b_due_date,
    p.b_payment_date,
    p.b_paid,
    p.b_outstanding,
    p.b_branch_id::integer,
    p.b_branch_name,
    p.b_amount_cad,
    p.b_tax_cad,
    p.b_gross_cad,
    p.b_fx_rate,
    c.total,
    sm.s_gross,
    sm.s_paid,
    sm.s_outstanding,
    sm.s_count,
    sm.s_gross_cad,
    sm.s_net_cad,
    sm.s_tax_cad
  FROM paged p CROSS JOIN counted c CROSS JOIN summary sm;
END;
$function$;
