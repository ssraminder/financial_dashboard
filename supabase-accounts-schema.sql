-- Account Types table
CREATE TABLE IF NOT EXISTS account_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  badge_color TEXT NOT NULL DEFAULT 'blue',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Institutions table
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  supported_account_types TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add new columns to bank_accounts if not exists
ALTER TABLE bank_accounts 
ADD COLUMN IF NOT EXISTS account_type TEXT,
ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last4_physical TEXT,
ADD COLUMN IF NOT EXISTS last4_wallet TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index for account type filtering
CREATE INDEX IF NOT EXISTS idx_bank_accounts_account_type ON bank_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_is_personal ON bank_accounts(is_personal);

-- Insert account types
INSERT INTO account_types (name, display_name, sort_order, badge_color) VALUES
  ('chequing', 'Chequing', 1, 'blue'),
  ('savings', 'Savings', 2, 'green'),
  ('credit_card', 'Credit Card', 3, 'purple'),
  ('cash_card', 'Cash Card', 4, 'orange'),
  ('payment_processor', 'Payment Processor', 5, 'indigo'),
  ('forex', 'Forex', 6, 'teal'),
  ('line_of_credit', 'Line of Credit', 7, 'red')
ON CONFLICT (name) DO NOTHING;

-- Insert institutions
INSERT INTO institutions (name, supported_account_types, sort_order) VALUES
  -- Banks
  ('RBC - Royal Bank', ARRAY['chequing', 'savings', 'credit_card', 'line_of_credit'], 1),
  ('TD Canada Trust', ARRAY['chequing', 'savings', 'credit_card', 'line_of_credit'], 2),
  ('Scotiabank', ARRAY['chequing', 'savings', 'credit_card', 'line_of_credit'], 3),
  ('BMO - Bank of Montreal', ARRAY['chequing', 'savings', 'credit_card', 'line_of_credit'], 4),
  ('CIBC', ARRAY['chequing', 'savings', 'credit_card', 'line_of_credit'], 5),
  ('National Bank', ARRAY['chequing', 'savings', 'credit_card', 'line_of_credit'], 6),
  ('Desjardins', ARRAY['chequing', 'savings', 'credit_card'], 7),
  ('Tangerine', ARRAY['chequing', 'savings', 'credit_card'], 8),
  ('Simplii Financial', ARRAY['chequing', 'savings'], 9),
  ('EQ Bank', ARRAY['savings'], 10),
  
  -- Credit Cards
  ('American Express', ARRAY['credit_card'], 11),
  ('Visa', ARRAY['credit_card'], 12),
  ('Mastercard', ARRAY['credit_card'], 13),
  
  -- Payment Processors
  ('PayPal', ARRAY['payment_processor'], 14),
  ('Stripe', ARRAY['payment_processor'], 15),
  ('Square', ARRAY['payment_processor'], 16),
  
  -- Forex / Multi-currency
  ('Wise (TransferWise)', ARRAY['forex'], 17),
  ('Airwallex', ARRAY['forex'], 18),
  ('Revolut', ARRAY['forex'], 19),
  
  -- Cash Cards
  ('Koho', ARRAY['cash_card'], 20),
  ('STACK', ARRAY['cash_card'], 21)
ON CONFLICT DO NOTHING;

-- Create view for accounts with type display
CREATE OR REPLACE VIEW bank_accounts_view AS
SELECT 
  ba.*,
  at.display_name as account_type_display,
  at.badge_color as account_type_color,
  c.name as company_name
FROM bank_accounts ba
LEFT JOIN account_types at ON ba.account_type = at.name
LEFT JOIN companies c ON ba.company_id = c.id
WHERE ba.is_active = true
ORDER BY ba.is_personal ASC, ba.account_type, ba.name;

-- Add RLS policies for new tables
ALTER TABLE account_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view account types"
  ON account_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can view institutions"
  ON institutions FOR SELECT
  TO authenticated
  USING (true);

-- Comments for documentation
COMMENT ON TABLE account_types IS 'Types of bank accounts and cards supported by the system';
COMMENT ON TABLE institutions IS 'Financial institutions (banks, payment processors, etc.)';
COMMENT ON COLUMN bank_accounts.account_type IS 'Type of account (references account_types.name)';
COMMENT ON COLUMN bank_accounts.is_personal IS 'True if personal card used for business expenses';
COMMENT ON COLUMN bank_accounts.last4_physical IS 'Last 4 digits of physical card/account number';
COMMENT ON COLUMN bank_accounts.last4_wallet IS 'Last 4 digits of digital wallet version (Apple/Google Pay)';
COMMENT ON COLUMN bank_accounts.notes IS 'Additional notes about the account';
