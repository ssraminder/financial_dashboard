-- ============================================================================
-- CLIENTS TABLE SCHEMA (SHARED BUSINESS DATABASE)
-- ============================================================================
-- This migration creates the clients table for managing customer data
-- Compatible with XTRF CSV imports and manual entry
-- This is a SHARED database - all authenticated users can access all clients
-- 
-- Run this in your Supabase SQL Editor

-- Drop existing table if you need to reset (CAUTION: removes all data)
-- DROP TABLE IF EXISTS clients CASCADE;

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- XTRF Integration
  xtrf_id TEXT UNIQUE,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  
  -- Basic Information
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  country TEXT,
  province TEXT, -- For Canadian clients (AB, BC, ON, etc.)
  
  -- Status Management
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Potential', 'Inactive')),
  is_active BOOLEAN DEFAULT true,
  
  -- Financial Settings
  gst_rate DECIMAL(5, 2) DEFAULT 5.00, -- Default 5% GST
  gst_exempt BOOLEAN DEFAULT false,
  preferred_currency TEXT DEFAULT 'CAD',
  payment_terms TEXT DEFAULT 'Net 30',
  client_type TEXT DEFAULT 'Individual' CHECK (client_type IN ('Individual', 'Business', 'Organization')),
  is_recurring BOOLEAN DEFAULT false,
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_clients_xtrf_id ON clients(xtrf_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- Enable Row Level Security
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Shared Business Database
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

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_clients_timestamp
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_clients_updated_at();

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify the table was created successfully:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients';

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================
-- Uncomment to insert sample clients:
/*
INSERT INTO clients (xtrf_id, name, email, country, status, gst_rate, preferred_currency)
VALUES 
  ('C001372', 'Amandine BOIS', 'meca.et.wheels@gmail.com', NULL, 'Active', 5.00, 'CAD'),
  ('C001371', 'Tetiana Puhach', 'tanyajano@gmail.com', NULL, 'Active', 5.00, 'CAD'),
  ('C001370', 'Hassan Cheaib', 'hassan_cheaib@hotmail.com', NULL, 'Active', 5.00, 'CAD'),
  ('C000135', 'Old Strathcona Farmers Market', 'edmontonalberta@gmail.com', 'Canada', 'Active', 5.00, 'CAD'),
  ('C000121', 'Stephanie Mills', 'berthmills@yahoo.com', NULL, 'Potential', 5.00, 'CAD'),
  ('C000005', 'Erased 9016734457', NULL, 'Canada', 'Inactive', 5.00, 'CAD');
*/
