-- Migration: Create pending_transfers table
-- Purpose: Track manual transfers before they are matched with imported bank statements
-- Date: January 7, 2026

-- Create the pending_transfers table
CREATE TABLE IF NOT EXISTS pending_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Transfer details
  from_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  to_account_id UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  transfer_date DATE NOT NULL,
  description TEXT,
  notes TEXT,
  
  -- Matching status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'matched', 'cancelled')),
  from_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  to_transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  
  -- Audit fields
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  matched_at TIMESTAMPTZ,
  
  -- Matching tolerance settings
  match_tolerance_days INTEGER NOT NULL DEFAULT 5 CHECK (match_tolerance_days >= 0),
  match_tolerance_amount NUMERIC NOT NULL DEFAULT 0.50 CHECK (match_tolerance_amount >= 0),
  
  -- Constraints
  CONSTRAINT different_accounts CHECK (from_account_id != to_account_id),
  CONSTRAINT valid_matched_status CHECK (
    (status = 'matched' AND from_transaction_id IS NOT NULL AND to_transaction_id IS NOT NULL AND matched_at IS NOT NULL) OR
    (status = 'partial' AND (from_transaction_id IS NOT NULL OR to_transaction_id IS NOT NULL)) OR
    (status IN ('pending', 'cancelled'))
  )
);

-- Create indexes for efficient matching queries
CREATE INDEX IF NOT EXISTS idx_pending_transfers_matching 
ON pending_transfers(from_account_id, to_account_id, amount, transfer_date, status)
WHERE status IN ('pending', 'partial');

CREATE INDEX IF NOT EXISTS idx_pending_transfers_from_account 
ON pending_transfers(from_account_id, status)
WHERE status IN ('pending', 'partial');

CREATE INDEX IF NOT EXISTS idx_pending_transfers_to_account 
ON pending_transfers(to_account_id, status)
WHERE status IN ('pending', 'partial');

CREATE INDEX IF NOT EXISTS idx_pending_transfers_date_range 
ON pending_transfers(transfer_date, status)
WHERE status IN ('pending', 'partial');

CREATE INDEX IF NOT EXISTS idx_pending_transfers_created_by 
ON pending_transfers(created_by, created_at DESC);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add trigger to auto-update updated_at
CREATE TRIGGER set_pending_transfers_updated_at
  BEFORE UPDATE ON pending_transfers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE pending_transfers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pending_transfers
-- Users can view pending transfers for their own organization's accounts
CREATE POLICY "Users can view pending transfers for their organization"
  ON pending_transfers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bank_accounts ba
      WHERE ba.id = pending_transfers.from_account_id
      AND ba.client_id IN (
        SELECT client_id FROM user_clients
        WHERE user_id = auth.uid()
      )
    )
  );

-- Users can create pending transfers for accounts in their organization
CREATE POLICY "Users can create pending transfers for their organization"
  ON pending_transfers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bank_accounts ba
      WHERE ba.id = pending_transfers.from_account_id
      AND ba.client_id IN (
        SELECT client_id FROM user_clients
        WHERE user_id = auth.uid()
      )
    )
    AND EXISTS (
      SELECT 1 FROM bank_accounts ba
      WHERE ba.id = pending_transfers.to_account_id
      AND ba.client_id IN (
        SELECT client_id FROM user_clients
        WHERE user_id = auth.uid()
      )
    )
  );

-- Users can update pending transfers they created or have access to
CREATE POLICY "Users can update pending transfers for their organization"
  ON pending_transfers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM bank_accounts ba
      WHERE ba.id = pending_transfers.from_account_id
      AND ba.client_id IN (
        SELECT client_id FROM user_clients
        WHERE user_id = auth.uid()
      )
    )
  );

-- Users can delete pending transfers they created (only if status is pending or cancelled)
CREATE POLICY "Users can delete pending pending transfers"
  ON pending_transfers FOR DELETE
  USING (
    status IN ('pending', 'cancelled')
    AND EXISTS (
      SELECT 1 FROM bank_accounts ba
      WHERE ba.id = pending_transfers.from_account_id
      AND ba.client_id IN (
        SELECT client_id FROM user_clients
        WHERE user_id = auth.uid()
      )
    )
  );

-- Add helpful comments
COMMENT ON TABLE pending_transfers IS 'Tracks manual transfer entries before they are matched with imported bank statements';
COMMENT ON COLUMN pending_transfers.status IS 'pending: not matched yet, partial: one side matched, matched: both sides matched, cancelled: user cancelled';
COMMENT ON COLUMN pending_transfers.from_account_id IS 'Account money is transferred FROM (will show as debit/withdrawal)';
COMMENT ON COLUMN pending_transfers.to_account_id IS 'Account money is transferred TO (will show as credit/deposit)';
COMMENT ON COLUMN pending_transfers.match_tolerance_days IS 'Number of days ± to search for matching transactions';
COMMENT ON COLUMN pending_transfers.match_tolerance_amount IS 'Dollar amount tolerance for matching (e.g., 0.50 = within $0.50)';
