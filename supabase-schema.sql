-- Cethos Financial Dashboard - Supabase Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank Accounts table
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  bank_name TEXT,
  currency TEXT DEFAULT 'CAD',
  is_active BOOLEAN DEFAULT TRUE,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
  needs_review BOOLEAN DEFAULT TRUE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'accountant' CHECK (role IN ('owner', 'accountant')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_needs_review ON transactions(needs_review);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_company ON transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON bank_accounts(company_id);

-- Enable Row Level Security (RLS)
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view their own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- RLS Policies for companies (all authenticated users can read)
CREATE POLICY "Authenticated users can view companies"
  ON companies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage companies"
  ON companies FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'owner'
    )
  );

-- RLS Policies for bank_accounts (all authenticated users can read)
CREATE POLICY "Authenticated users can view bank accounts"
  ON bank_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage bank accounts"
  ON bank_accounts FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'owner'
    )
  );

-- RLS Policies for categories (all authenticated users can read)
CREATE POLICY "Authenticated users can view categories"
  ON categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage categories"
  ON categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'owner'
    )
  );

-- RLS Policies for transactions (all authenticated users can read)
CREATE POLICY "Authenticated users can view transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Owners can manage transactions"
  ON transactions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'owner'
    )
  );

CREATE POLICY "Accountants can update transaction reviews"
  ON transactions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
    )
  );

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'accountant')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert sample data (optional)

-- Sample Companies
INSERT INTO companies (name) VALUES
  ('Cethos Translation Services'),
  ('Acme Corporation'),
  ('Global Solutions Inc.')
ON CONFLICT DO NOTHING;

-- Sample Categories
INSERT INTO categories (name, type) VALUES
  ('Translation Services', 'income'),
  ('Consulting Fees', 'income'),
  ('Office Rent', 'expense'),
  ('Software Subscriptions', 'expense'),
  ('Marketing', 'expense'),
  ('Salaries', 'expense'),
  ('Office Supplies', 'expense')
ON CONFLICT DO NOTHING;

-- Note: To create your first user:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add user" and create a user with email/password
-- 3. The trigger will automatically create a user_profile
-- 4. Optionally, update the role to 'owner' in the user_profiles table
