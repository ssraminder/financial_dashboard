-- AI Prompts Management Schema
-- This allows editing AI chatbot prompts without redeploying the edge function

-- Main prompts table
CREATE TABLE IF NOT EXISTS ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_key TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  prompt_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Version history table
CREATE TABLE IF NOT EXISTS ai_prompts_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES ai_prompts(id) ON DELETE CASCADE,
  prompt_key TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  version INTEGER NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ai_prompts_key ON ai_prompts(prompt_key);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_active ON ai_prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_prompts_history_prompt_id ON ai_prompts_history(prompt_id);

-- Function to save prompt history on update
CREATE OR REPLACE FUNCTION save_ai_prompt_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only save to history if prompt_text actually changed
  IF OLD.prompt_text IS DISTINCT FROM NEW.prompt_text THEN
    INSERT INTO ai_prompts_history (
      prompt_id,
      prompt_key,
      prompt_text,
      version,
      changed_by
    ) VALUES (
      OLD.id,
      OLD.prompt_key,
      OLD.prompt_text,
      OLD.version,
      auth.uid()
    );
    
    -- Increment version
    NEW.version := OLD.version + 1;
  END IF;
  
  -- Update timestamp
  NEW.updated_at := NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS ai_prompts_history_trigger ON ai_prompts;
CREATE TRIGGER ai_prompts_history_trigger
  BEFORE UPDATE ON ai_prompts
  FOR EACH ROW
  EXECUTE FUNCTION save_ai_prompt_history();

-- Enable Row Level Security
ALTER TABLE ai_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_prompts_history ENABLE ROW LEVEL SECURITY;

-- Policies for ai_prompts
CREATE POLICY "Allow authenticated users to read prompts"
  ON ai_prompts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow admins to update prompts"
  ON ai_prompts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

CREATE POLICY "Allow admins to insert prompts"
  ON ai_prompts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
    )
  );

-- Policies for ai_prompts_history
CREATE POLICY "Allow authenticated users to read prompt history"
  ON ai_prompts_history FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow system to insert prompt history"
  ON ai_prompts_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Insert initial prompts
INSERT INTO ai_prompts (prompt_key, name, description, prompt_text) VALUES
(
  'ai_chat_system',
  'System Instructions',
  'Main system prompt for the AI chat assistant',
  E'You are a helpful financial assistant for Cethos Financial Dashboard.

Your role is to help users understand and analyze their financial data including:
- Bank accounts and balances
- Transactions and expenses
- Categories and budgets
- Statements and receipts
- Clients and vendors
- Transfers between accounts

When answering questions:
1. Be concise and professional
2. Use the provided database schema to write accurate SQL queries
3. Format currency values in CAD ($)
4. Highlight important insights
5. Ask for clarification if the question is ambiguous

Always prioritize data accuracy and user privacy.'
),
(
  'ai_chat_schema',
  'Database Schema Context',
  'Database schema information for SQL generation',
  E'DATABASE SCHEMA:

CORE TABLES:
1. companies - Client companies and their information
2. bank_accounts - Bank accounts with balances and account numbers
3. transactions - All financial transactions with amounts, dates, and categories
4. bank_statements - PDF statements and their processing status
5. receipts - Receipt images and OCR data
6. categories - Expense/income categories with hierarchical structure
7. vendors - Vendor information and metadata
8. transfer_candidates - Detected transfers between accounts

KEY COLUMNS:
- transactions: id, company_id, account_id, transaction_date, amount, description, category_id, vendor_id, needs_review
- bank_accounts: id, company_id, account_name, account_number, current_balance, currency
- categories: id, name, type (income/expense), parent_id
- receipts: id, transaction_id, file_url, ocr_status, extracted_data

Use proper JOINs and always filter by the user''s accessible data.'
),
(
  'ai_chat_examples',
  'Example Queries',
  'Example questions and responses to guide the AI',
  E'EXAMPLE QUERIES:

Q: "What''s my total cash balance?"
A: Execute: SELECT account_name, current_balance FROM bank_accounts WHERE currency = ''CAD''
   Response: "Here are your current account balances: [table]"

Q: "Show expenses by category this month"
A: Execute: SELECT c.name, SUM(t.amount) as total FROM transactions t JOIN categories c ON t.category_id = c.id WHERE t.transaction_date >= date_trunc(''month'', CURRENT_DATE) AND t.amount < 0 GROUP BY c.name ORDER BY total
   Response: "Here''s a breakdown of your expenses this month: [table]"

Q: "How many items need review?"
A: Execute: SELECT COUNT(*) as count FROM transactions WHERE needs_review = true
   Response: "You have X transactions that need review."

Q: "Find all payments to contractors"
A: Execute: SELECT transaction_date, description, amount, account_name FROM transactions t JOIN bank_accounts a ON t.account_id = a.id WHERE description ILIKE ''%contractor%'' ORDER BY transaction_date DESC
   Response: "Here are all contractor payments: [table]"'
)
ON CONFLICT (prompt_key) DO NOTHING;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ai_prompts TO authenticated;
GRANT ALL ON ai_prompts_history TO authenticated;

-- Comments for documentation
COMMENT ON TABLE ai_prompts IS 'Stores AI chatbot prompts that can be edited without redeploying';
COMMENT ON TABLE ai_prompts_history IS 'Version history for AI prompts';
COMMENT ON COLUMN ai_prompts.prompt_key IS 'Unique identifier used by the edge function';
COMMENT ON COLUMN ai_prompts.is_active IS 'Whether this prompt is currently active';
COMMENT ON COLUMN ai_prompts.version IS 'Auto-incremented version number';
