# 🔴 DATABASE SETUP REQUIRED

## Current Error

```
Error fetching dashboard stats: column categories_1.type does not exist
```

---

## What This Means

Your Supabase database is **not set up** with the required tables for the Cethos Financial Dashboard. You need to run the database migrations to create the necessary tables.

---

## 🚀 Quick Fix (5 minutes)

### Step 1: Open Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your project: **llxlkawdmuwsothxaada**
3. Click **"SQL Editor"** in the left sidebar

### Step 2: Run Main Schema Migration

1. Click **"New Query"**
2. Open the file `supabase-schema.sql` in this project
3. **Copy the entire contents** of that file
4. **Paste** into the Supabase SQL Editor
5. Click **"Run"** (or press `Ctrl+Enter` / `Cmd+Enter`)

**Expected Result:** `Success. No rows returned`

### Step 3: Verify Tables Were Created

Run this verification query in the SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**You should see these tables:**

- ✅ `bank_accounts`
- ✅ `categories`
- ✅ `companies`
- ✅ `transactions`
- ✅ `user_profiles`

---

## Additional Migrations (If You've Been Using These Features)

### For Accounts Page

If you're using the **Accounts** page (bank accounts, credit cards):

1. Run `supabase-accounts-schema.sql` to create:
   - `account_types` table
   - `institutions` table
   - `bank_accounts_view` view

2. Run `supabase-migration-add-bank-fields.sql` to add:
   - `bank_name` column
   - `currency` column

3. Run `supabase-fix-bank-accounts-rls.sql` to fix RLS policies

### For Clients Page

If you're using the **Clients** page:

1. Run `supabase-clients-schema.sql` to create:
   - `clients` table with all fields
   - RLS policies

---

## 📋 Complete Migration Checklist

Run these migrations **in order**:

### Core System (Required)

- [ ] `supabase-schema.sql` - **Core tables** (companies, categories, transactions, bank_accounts, user_profiles)

### Accounts Feature

- [ ] `supabase-accounts-schema.sql` - Account types and institutions
- [ ] `supabase-migration-add-bank-fields.sql` - Additional bank account fields
- [ ] `supabase-fix-bank-accounts-rls.sql` - RLS policy fixes

### Clients Feature

- [ ] `supabase-clients-schema.sql` - Client management

---

## 🔍 How to Run a Migration

For **each** SQL file above:

1. Open Supabase Dashboard → SQL Editor
2. Click **"New Query"**
3. Open the SQL file from your project
4. Copy **all contents**
5. Paste into SQL Editor
6. Click **"Run"**
7. Verify you see: `Success. No rows returned` (or row count for INSERT statements)

---

## ⚠️ Common Issues

### "relation does not exist"

**Cause:** Table hasn't been created yet

**Fix:** Run the corresponding migration file

---

### "column does not exist"

**Cause:** Table exists but is missing columns

**Fix:** Run the migration file that adds those columns (e.g., `supabase-migration-add-bank-fields.sql`)

---

### "duplicate key value violates unique constraint"

**Cause:** You're running a migration that has already been run (trying to insert duplicate data)

**Fix:** This is usually safe to ignore if you see it for sample data. The tables are already set up.

---

### RLS Policy Errors

**Cause:** Row Level Security policies are blocking access

**Fix:** Run `supabase-fix-bank-accounts-rls.sql` to create permissive policies

---

## 🎯 After Running Migrations

### 1. Refresh Your App

Press `Ctrl+Shift+R` (or `Cmd+Shift+R` on Mac) to clear cache and reload.

### 2. Check the Dashboard

Navigate to `/dashboard` - you should see:

- Revenue: $0.00
- Expenses: $0.00
- Net Income: $0.00
- Pending Reviews: 0

**No errors in the console!**

### 3. Optional: Add Sample Data

If you want to test with sample data, you can use the sample data provided in `supabase-schema.sql` (companies and categories are already inserted).

For transactions, you can use `sample-transactions.sql` or upload your own data via the Upload page.

---

## 📚 Database Schema Overview

### Core Tables

**`companies`**

- Stores company/business entities
- Used to categorize transactions by company

**`categories`**

- Income and expense categories
- Has a `type` column ('income' or 'expense') ← **This is what's missing!**

**`bank_accounts`**

- Bank accounts and credit cards
- Links to companies

**`transactions`**

- Financial transactions
- Links to categories, companies, and bank accounts
- Has `needs_review` flag for HITL workflow

**`user_profiles`**

- User information and roles
- Auto-created when users sign up
- Roles: 'owner' or 'accountant'

### Extended Tables (Optional Features)

**`account_types`** - For Accounts page
**`institutions`** - For Accounts page
**`clients`** - For Clients page

---

## 🆘 Still Having Issues?

1. **Check browser console** for detailed error messages
2. **Check Supabase logs**: Dashboard → Logs → Postgres Logs
3. **Verify authentication**: Make sure you're logged in
4. **Check RLS policies**: Ensure your user has proper access

---

## 📝 Summary

The error `column categories_1.type does not exist` means:

1. The `categories` table doesn't exist **OR**
2. The `categories` table exists but doesn't have a `type` column

**Solution:** Run `supabase-schema.sql` in your Supabase SQL Editor

**Time Required:** ~5 minutes

**After this, your dashboard will work perfectly! 🎉**

---

## Quick Links

- [Supabase Dashboard](https://supabase.com/dashboard)
- [SQL Editor Direct Link](https://supabase.com/dashboard/project/llxlkawdmuwsothxaada/sql)

---

**Need Help?** Open the browser console (`F12`) and share the error messages - they'll guide you to which specific migration you need to run.
