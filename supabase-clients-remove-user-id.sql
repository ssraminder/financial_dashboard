-- ============================================================================
-- REMOVE USER_ID FROM CLIENTS TABLE
-- ============================================================================
-- This migration removes the user_id column and updates RLS policies
-- to make clients a shared business database
-- 
-- Run this AFTER the initial clients table has been created
-- Run this in your Supabase SQL Editor

-- Step 1: Drop existing RLS policies that use user_id
DROP POLICY IF EXISTS "Users can view their own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert their own clients" ON clients;
DROP POLICY IF EXISTS "Users can update their own clients" ON clients;
DROP POLICY IF EXISTS "Users can delete their own clients" ON clients;

-- Step 2: Drop the user_id index
DROP INDEX IF EXISTS idx_clients_user_id;

-- Step 3: Remove the user_id column
ALTER TABLE clients DROP COLUMN IF EXISTS user_id;

-- Step 4: Create new RLS policies for shared business database
-- All authenticated users can view all clients
CREATE POLICY "Authenticated users can view all clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can insert clients
CREATE POLICY "Authenticated users can insert clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- All authenticated users can update clients
CREATE POLICY "Authenticated users can update all clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- All authenticated users can delete clients
CREATE POLICY "Authenticated users can delete clients"
  ON clients
  FOR DELETE
  TO authenticated
  USING (true);

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this to verify the column was removed:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'clients';

-- You should NOT see 'user_id' in the list of columns
