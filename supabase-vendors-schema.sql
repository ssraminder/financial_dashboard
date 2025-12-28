-- ============================================================================
-- VENDORS TABLE SCHEMA (SHARED BUSINESS DATABASE)
-- ============================================================================
-- This migration creates the vendors table for managing vendor/contractor data
-- Compatible with XTRF CSV imports and manual entry
-- This is a SHARED database - all authenticated users can access all vendors
-- 
-- Run this in your Supabase SQL Editor

-- Drop existing table if you need to reset (CAUTION: removes all data)
-- DROP TABLE IF EXISTS vendors CASCADE;

-- Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- XTRF Integration
  legal_name TEXT UNIQUE NOT NULL,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  
  -- Basic Information
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  is_active BOOLEAN DEFAULT true,
  country TEXT,
  city TEXT,
  
  -- Contact Information
  email TEXT,
  email_3 TEXT, -- Additional email from XTRF
  phone TEXT,
  phone_2 TEXT,
  phone_3 TEXT,
  
  -- XTRF Specific Fields
  overall_evaluation DECIMAL(3, 2), -- Rating (0.00 to 5.00)
  availability TEXT,
  language_combinations TEXT, -- Stored as text from XTRF
  
  -- Financial Settings
  gst_registered BOOLEAN DEFAULT false,
  gst_rate DECIMAL(5, 2) DEFAULT 5.00,
  gst_number TEXT,
  category TEXT DEFAULT 'Contractor' CHECK (category IN ('Contractor', 'Agency', 'Freelancer', 'Employee')),
  payment_terms TEXT DEFAULT 'Net 30',
  preferred_currency TEXT DEFAULT 'CAD',
  
  -- Vendor Management
  is_preferred BOOLEAN DEFAULT false,
  
  -- Notes
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vendors_legal_name ON vendors(legal_name);
CREATE INDEX IF NOT EXISTS idx_vendors_status ON vendors(status);
CREATE INDEX IF NOT EXISTS idx_vendors_country ON vendors(country);
CREATE INDEX IF NOT EXISTS idx_vendors_email ON vendors(email);
CREATE INDEX IF NOT EXISTS idx_vendors_is_preferred ON vendors(is_preferred);
CREATE INDEX IF NOT EXISTS idx_vendors_overall_evaluation ON vendors(overall_evaluation);

-- Enable Row Level Security
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Shared Business Database
-- All authenticated users can view all vendors
CREATE POLICY "Authenticated users can view all vendors"
  ON vendors
  FOR SELECT
  TO authenticated
  USING (true);

-- All authenticated users can insert vendors
CREATE POLICY "Authenticated users can insert vendors"
  ON vendors
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- All authenticated users can update vendors
CREATE POLICY "Authenticated users can update all vendors"
  ON vendors
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- All authenticated users can delete vendors
CREATE POLICY "Authenticated users can delete vendors"
  ON vendors
  FOR DELETE
  TO authenticated
  USING (true);

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_vendors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_vendors_timestamp
  BEFORE UPDATE ON vendors
  FOR EACH ROW
  EXECUTE FUNCTION update_vendors_updated_at();

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================
-- Run this to verify the table was created successfully:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'vendors';

-- ============================================================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================================================
-- Uncomment to insert sample vendors:
/*
INSERT INTO vendors (legal_name, status, country, city, email, overall_evaluation, gst_registered, gst_rate)
VALUES 
  ('Abdessamad Binaoui', 'Active', 'Morocco', 'AIN TAOUJDATE', 'neues-leben@live.de', NULL, false, 5.00),
  ('Abdi Hurre', 'Active', 'Canada', 'Toronto', 'ahurre@hotmail.com', NULL, false, 5.00),
  ('Abhash Pathak', 'Active', 'India', 'New Delhi', 'abhashpathak@gmail.com', 5.00, false, 5.00),
  ('Abhinav Dang', 'Active', 'India', 'Mumbai', 'abhinavdang@gmail.com', 4.70, false, 5.00),
  ('Chirag Dhiman', 'Active', 'Canada', 'Vancouver', 'chirag@example.com', 5.00, true, 5.00);
*/
