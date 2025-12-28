-- Migration: Add bank_name, currency, and is_active to bank_accounts table
-- This adds the missing fields required for the Upload page dropdown

ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CAD',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add comments for documentation
COMMENT ON COLUMN bank_accounts.bank_name IS 'Financial institution name (e.g., Royal Bank, TD Bank)';
COMMENT ON COLUMN bank_accounts.currency IS 'Account currency (e.g., CAD, USD)';
COMMENT ON COLUMN bank_accounts.is_active IS 'Whether the account is currently active';

-- Create index for filtering active accounts
CREATE INDEX IF NOT EXISTS idx_bank_accounts_is_active ON bank_accounts(is_active);

-- Update existing records with default values
-- You can update these manually in Supabase dashboard or with specific data
UPDATE bank_accounts 
SET bank_name = COALESCE(bank_name, 'Unknown Bank'),
    currency = COALESCE(currency, 'CAD'),
    is_active = COALESCE(is_active, TRUE)
WHERE bank_name IS NULL OR currency IS NULL OR is_active IS NULL;
