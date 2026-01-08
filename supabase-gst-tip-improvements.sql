-- Migration: Add GST rate and tip fields to transactions table
-- Date: 2026-01-08
-- Description: Adds gst_rate, has_tip, and tip_amount fields to support improved GST calculation and tip tracking

-- Add GST rate field (default 0.05 for 5% GST)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,4) DEFAULT 0.05;

-- Add tip tracking fields
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS has_tip BOOLEAN DEFAULT false;

ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS tip_amount NUMERIC(12,2) DEFAULT 0;

-- Update existing transactions with GST to have default 5% rate
UPDATE transactions
SET gst_rate = 0.05
WHERE has_gst = true AND (gst_rate IS NULL OR gst_rate = 0);

-- Add tip fields to knowledgebase_payees for default values
ALTER TABLE knowledgebase_payees 
ADD COLUMN IF NOT EXISTS default_has_tip BOOLEAN DEFAULT false;

ALTER TABLE knowledgebase_payees 
ADD COLUMN IF NOT EXISTS default_tip_percent NUMERIC(5,2) DEFAULT 0;

ALTER TABLE knowledgebase_payees 
ADD COLUMN IF NOT EXISTS default_gst_rate NUMERIC(5,4) DEFAULT 0.05;

-- Update existing meals_entertainment KB entries to have tip defaults
UPDATE knowledgebase_payees
SET 
  default_has_gst = true,
  default_gst_rate = 0.05,
  default_has_tip = true
WHERE category_id IN (
  SELECT id FROM categories WHERE code = 'meals_entertainment'
);

-- Add comments for documentation
COMMENT ON COLUMN transactions.gst_rate IS 'GST/HST rate as decimal (0.05 for 5%, 0.13 for 13%, 0.15 for 15%)';
COMMENT ON COLUMN transactions.has_tip IS 'Whether this transaction includes a tip (primarily for meals/restaurants)';
COMMENT ON COLUMN transactions.tip_amount IS 'Tip amount in dollars';

COMMENT ON COLUMN knowledgebase_payees.default_has_tip IS 'Default tip checkbox state for this payee';
COMMENT ON COLUMN knowledgebase_payees.default_tip_percent IS 'Default tip percentage (e.g., 15.00 for 15%)';
COMMENT ON COLUMN knowledgebase_payees.default_gst_rate IS 'Default GST/HST rate for this payee';
