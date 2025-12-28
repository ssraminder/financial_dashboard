# 🚨 URGENT: Database Tables Missing

## The Problem

The errors you're seeing mean the database tables haven't been created yet:

```
Error fetching account types: [object Object]
TypeError: Failed to fetch
```

These errors occur because:

- ✅ The `bank_accounts` table exists (from the original schema)
- ❌ The `account_types` table does NOT exist
- ❌ The `institutions` table does NOT exist
- ❌ The `companies` table MIGHT not exist

## ✅ Fixes Applied (Error Logging)

I've fixed the error logging so you'll now see helpful messages instead of `[object Object]`:

1. **Better error messages** - You'll see actual Supabase error details
2. **Helpful guidance** - The app will tell you to run migrations
3. **Fixed HMR warning** - No more createRoot warnings in development

## 🚀 SOLUTION: Run the Database Migration

You **MUST** run the SQL migration to create the missing tables.

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase Dashboard
2. Click **SQL Editor** in the left sidebar
3. Click **New Query**

### Step 2: Run the Accounts Schema Migration

Copy and paste the **entire contents** of `supabase-accounts-schema.sql` into the SQL editor and run it.

**Or copy this SQL directly:**

```sql
-- Account Types table
CREATE TABLE IF NOT EXISTS account_types (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
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
INSERT INTO account_types (code, name, sort_order) VALUES
  ('chequing', 'Chequing Account', 1),
  ('savings', 'Savings Account', 2),
  ('credit_card', 'Credit Card', 3),
  ('cash_card', 'Cash Card / Prepaid', 4),
  ('payment_processor', 'Payment Processor', 5),
  ('forex', 'Foreign Exchange / Multi-currency', 6),
  ('line_of_credit', 'Line of Credit', 7)
ON CONFLICT (code) DO NOTHING;

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
  at.name as account_type_display,
  c.name as company_name
FROM bank_accounts ba
LEFT JOIN account_types at ON ba.account_type = at.code
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

-- Update bank_accounts RLS policy
DROP POLICY IF EXISTS "Owners can manage bank accounts" ON bank_accounts;

CREATE POLICY "Authenticated users can manage bank accounts"
  ON bank_accounts FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE account_types IS 'Types of bank accounts and cards supported by the system';
COMMENT ON TABLE institutions IS 'Financial institutions (banks, payment processors, etc.)';
COMMENT ON COLUMN bank_accounts.account_type IS 'Type of account (references account_types.code)';
COMMENT ON COLUMN bank_accounts.is_personal IS 'True if personal card used for business expenses';
COMMENT ON COLUMN bank_accounts.last4_physical IS 'Last 4 digits of physical card/account number';
COMMENT ON COLUMN bank_accounts.last4_wallet IS 'Last 4 digits of digital wallet version (Apple/Google Pay)';
COMMENT ON COLUMN bank_accounts.notes IS 'Additional notes about the account';
```

### Step 3: Verify Tables Were Created

Run this query to check:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('account_types', 'institutions', 'bank_accounts');
```

You should see all three tables listed.

### Step 4: Verify Data Was Inserted

```sql
-- Check account types (should show 7 rows)
SELECT * FROM account_types ORDER BY sort_order;

-- Check institutions (should show 21 rows)
SELECT * FROM institutions ORDER BY sort_order;
```

### Step 5: Refresh Your Browser

After running the migration:

1. Refresh your browser (F5)
2. The errors should be gone
3. The Accounts page should load successfully

## 🎯 What You'll See After Fixing

### ✅ Before (Errors):

```
Error fetching account types: [object Object]
TypeError: Failed to fetch
```

### ✅ After (Success):

```
Account types fetched: [
  { code: 'chequing', name: 'Chequing Account', ... },
  { code: 'savings', name: 'Savings Account', ... },
  ...
]
```

The Accounts page will load with:

- Empty state message if no accounts exist
- "Add Account" button that opens a working modal
- All dropdowns populated with data

## 📋 Error Improvements Made

### 1. Better Error Logging (`client/pages/Accounts.tsx`)

**Before:**

```javascript
console.error("Error fetching account types:", typesRes.error);
// Output: Error fetching account types: [object Object]
```

**After:**

```javascript
console.error(
  "Error fetching account types:",
  typesRes.error.message || typesRes.error,
);
console.error("Full error:", JSON.stringify(typesRes.error, null, 2));
// Output: Error fetching account types: relation "public.account_types" does not exist
```

### 2. Helpful UI Message

The app now shows:

```
Database tables are missing. Please run the database migrations in Supabase.
See ACCOUNTS_PAGE_SETUP.md for instructions.
```

### 3. Fixed HMR Warning (`client/App.tsx`)

Used Vite's HMR API to prevent double root creation:

```typescript
if (import.meta.hot) {
  if (!import.meta.hot.data.root) {
    import.meta.hot.data.root = createRoot(rootElement);
  }
  root = import.meta.hot.data.root;
}
```

## 🔍 Troubleshooting

### Still seeing errors after running migration?

**Check 1: Verify tables exist**

```sql
\dt account_types
\dt institutions
```

**Check 2: Check for migration errors**
Look in the Supabase SQL Editor output for any red error messages.

**Check 3: Check RLS policies**

```sql
SELECT * FROM pg_policies WHERE tablename IN ('account_types', 'institutions');
```

You should see policies allowing authenticated users to SELECT.

**Check 4: Hard refresh browser**
Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac) to clear cache.

## 📝 Summary of Changes

| File                        | Change                        | Purpose                              |
| --------------------------- | ----------------------------- | ------------------------------------ |
| `client/pages/Accounts.tsx` | Improved error logging        | Show actual error messages           |
| `client/pages/Accounts.tsx` | Added missing table detection | Guide user to run migrations         |
| `client/hooks/useAuth.ts`   | Fixed profile error logging   | Show error message instead of object |
| `client/App.tsx`            | Fixed HMR handling            | Prevent createRoot warnings          |

## ✅ Next Steps

1. **Run the SQL migration** (see Step 2 above)
2. **Refresh your browser**
3. **Test the Accounts page** - it should load without errors
4. **Add your first account** - the form should work perfectly

Once the migration is complete, all features will work:

- ✅ Account type dropdown (7 options)
- ✅ Institution dropdown (21 institutions, filtered by type)
- ✅ Add/Edit/Delete accounts
- ✅ Grouping by business vs personal
- ✅ All form validation

---

**Need help?** Check `ACCOUNTS_PAGE_SETUP.md` for the full setup guide.
