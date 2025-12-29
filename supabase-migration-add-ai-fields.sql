-- Migration: Add AI suggestion fields to transactions and create transaction_patterns table

-- Add new columns to transactions table
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS payee_normalized TEXT,
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'categorized', 'approved')),
ADD COLUMN IF NOT EXISTS ai_reasoning TEXT,
ADD COLUMN IF NOT EXISTS ai_confidence_score INTEGER CHECK (ai_confidence_score >= 0 AND ai_confidence_score <= 100),
ADD COLUMN IF NOT EXISTS human_notes TEXT,
ADD COLUMN IF NOT EXISTS human_decision_reason TEXT;

-- Create transaction_patterns table for ML knowledge base
CREATE TABLE IF NOT EXISTS transaction_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payee_pattern TEXT NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL,
  contractor_type TEXT,
  reasoning TEXT,
  notes TEXT,
  confidence_score INTEGER DEFAULT 100 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  frequency INTEGER DEFAULT 1,
  last_matched_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(payee_pattern, category_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_transaction_patterns_payee ON transaction_patterns(payee_pattern);
CREATE INDEX IF NOT EXISTS idx_transaction_patterns_category ON transaction_patterns(category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_patterns_vendor ON transaction_patterns(vendor_id);
CREATE INDEX IF NOT EXISTS idx_transactions_vendor ON transactions(vendor_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_payee ON transactions(payee_normalized);

-- Enable RLS on transaction_patterns
ALTER TABLE transaction_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policy for transaction_patterns (all authenticated users can read/write)
CREATE POLICY "Authenticated users can manage transaction patterns"
  ON transaction_patterns FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
