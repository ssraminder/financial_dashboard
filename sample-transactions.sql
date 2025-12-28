-- Sample Data for Testing HITL Review Queue
-- Run this AFTER the main schema (supabase-schema.sql) has been executed

-- Note: This assumes you have:
-- 1. At least one user created in Supabase Auth
-- 2. Companies created from the main schema
-- 3. Categories created from the main schema

-- First, let's create a bank account (you'll need a company_id)
-- Replace 'YOUR_COMPANY_ID_HERE' with an actual company ID from your companies table

DO $$
DECLARE
  company_id_var UUID;
  bank_account_id_var UUID;
  translation_cat_id UUID;
  rent_cat_id UUID;
  software_cat_id UUID;
BEGIN
  -- Get the first company ID
  SELECT id INTO company_id_var FROM companies LIMIT 1;
  
  -- Get category IDs
  SELECT id INTO translation_cat_id FROM categories WHERE name = 'Translation Services' LIMIT 1;
  SELECT id INTO rent_cat_id FROM categories WHERE name = 'Office Rent' LIMIT 1;
  SELECT id INTO software_cat_id FROM categories WHERE name = 'Software Subscriptions' LIMIT 1;

  -- Create a bank account if none exists
  INSERT INTO bank_accounts (name, account_number, company_id)
  VALUES ('Business Checking - RBC', '****1234', company_id_var)
  ON CONFLICT DO NOTHING
  RETURNING id INTO bank_account_id_var;

  -- If no bank account was created, get an existing one
  IF bank_account_id_var IS NULL THEN
    SELECT id INTO bank_account_id_var FROM bank_accounts LIMIT 1;
  END IF;

  -- Insert sample transactions needing review
  INSERT INTO transactions (date, description, amount, category_id, company_id, bank_account_id, needs_review)
  VALUES
    -- Income transactions
    (CURRENT_DATE - INTERVAL '1 day', 'Translation project - ABC Corporation', 5500.00, translation_cat_id, company_id_var, bank_account_id_var, true),
    (CURRENT_DATE - INTERVAL '3 days', 'Consulting services - XYZ Inc', 3200.00, translation_cat_id, company_id_var, bank_account_id_var, true),
    (CURRENT_DATE - INTERVAL '5 days', 'Document translation - Legal Dept', 1800.00, NULL, NULL, bank_account_id_var, true),
    (CURRENT_DATE - INTERVAL '7 days', 'Website localization project', 4500.00, NULL, company_id_var, bank_account_id_var, true),
    
    -- Expense transactions (negative amounts)
    (CURRENT_DATE - INTERVAL '2 days', 'Office rent payment', -2500.00, rent_cat_id, company_id_var, bank_account_id_var, true),
    (CURRENT_DATE - INTERVAL '4 days', 'Adobe Creative Cloud subscription', -79.99, software_cat_id, NULL, bank_account_id_var, true),
    (CURRENT_DATE - INTERVAL '6 days', 'Microsoft 365 Business', -149.99, software_cat_id, company_id_var, bank_account_id_var, true),
    (CURRENT_DATE - INTERVAL '8 days', 'Freelance translator payment', -850.00, NULL, NULL, bank_account_id_var, true),
    (CURRENT_DATE - INTERVAL '10 days', 'Marketing materials', -320.00, NULL, company_id_var, bank_account_id_var, true),
    (CURRENT_DATE - INTERVAL '12 days', 'Office supplies - Staples', -156.43, NULL, NULL, bank_account_id_var, true),
    
    -- More varied transactions
    (CURRENT_DATE - INTERVAL '15 days', 'Translation project - Government Contract', 12500.00, translation_cat_id, NULL, bank_account_id_var, true),
    (CURRENT_DATE - INTERVAL '18 days', 'Cloud hosting - AWS', -245.67, software_cat_id, company_id_var, bank_account_id_var, true),
    (CURRENT_DATE - INTERVAL '20 days', 'Conference registration', -599.00, NULL, NULL, bank_account_id_var, true),
    (CURRENT_DATE - INTERVAL '22 days', 'Client payment - Urgent translation', 2100.00, NULL, company_id_var, bank_account_id_var, true),
    (CURRENT_DATE - INTERVAL '25 days', 'Professional development course', -450.00, NULL, NULL, bank_account_id_var, true)
  ON CONFLICT DO NOTHING;

END $$;

-- Verify the data was inserted
SELECT 
  COUNT(*) as total_transactions_needing_review,
  SUM(CASE WHEN amount > 0 THEN 1 ELSE 0 END) as income_count,
  SUM(CASE WHEN amount < 0 THEN 1 ELSE 0 END) as expense_count
FROM transactions 
WHERE needs_review = true;

-- Show a sample of the transactions
SELECT 
  date,
  description,
  amount,
  COALESCE(c.name, 'Not Assigned') as category,
  COALESCE(co.name, 'Not Assigned') as company,
  needs_review
FROM transactions t
LEFT JOIN categories c ON t.category_id = c.id
LEFT JOIN companies co ON t.company_id = co.id
WHERE needs_review = true
ORDER BY date DESC
LIMIT 10;
