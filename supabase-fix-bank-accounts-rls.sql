-- Fix RLS policy for bank_accounts to allow authenticated users to update
-- The existing policy only allows 'owner' role, but we want all authenticated users to manage accounts

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Owners can manage bank accounts" ON bank_accounts;

-- Create new policy that allows all authenticated users to insert, update, delete
CREATE POLICY "Authenticated users can manage bank accounts"
  ON bank_accounts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Note: If you want to keep the owner-only restriction, you can modify this to:
-- CREATE POLICY "Authenticated users can insert and update bank accounts"
--   ON bank_accounts
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (true);
-- 
-- CREATE POLICY "Authenticated users can update bank accounts"
--   ON bank_accounts
--   FOR UPDATE
--   TO authenticated
--   USING (true)
--   WITH CHECK (true);
