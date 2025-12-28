# Accounts Page - Setup Guide

## ✅ What's Been Implemented

The comprehensive Accounts page has been fully implemented with all requested features:

### 1. **Database Schema** (`supabase-accounts-schema.sql`)

- `account_types` table with 7 account types (Chequing, Savings, Credit Card, Cash Card, Payment Processor, Forex, Line of Credit)
- `institutions` table with 21 pre-populated financial institutions
- Enhanced `bank_accounts` table with new columns:
  - `account_type` - Type of account
  - `is_personal` - Flag for personal cards used for business
  - `last4_physical` - Last 4 digits of physical card/account (optional with N/A)
  - `last4_wallet` - Last 4 digits of digital wallet (optional with N/A)
  - `notes` - Additional account notes
- `bank_accounts_view` - Database view for accounts with type display names

### 2. **Accounts Page** (`client/pages/Accounts.tsx`)

- Full CRUD operations (Create, Read, Update, Delete)
- Account grouping by type:
  - Business: Bank Accounts, Credit Cards, Payment Processors & Forex
  - Personal: Cards used for business expenses
- Add Account modal with conditional fields
- Edit Account modal
- Delete confirmation modal
- Empty states for no accounts and no personal cards
- Success/error toast notifications

### 3. **Features Implemented**

#### Add/Edit Account Modal

- Ownership selection (Business/Personal)
- Account type dropdown (filtered by institution support)
- Institution dropdown (filtered by account type)
- Account name input
- Currency selector (CAD, USD, Multi)
- **Last 4 digits with N/A checkboxes** (payment processors/forex don't need them)
- Digital wallet option (for credit/cash cards)
- Company selection (required for business accounts)
- Notes textarea
- Full form validation

#### Account Card Display

- Icon based on account type (Building2, CreditCard, Wallet, Globe)
- Color-coded type badges:
  - Blue: Chequing
  - Green: Savings
  - Purple: Credit Card
  - Orange: Cash Card
  - Indigo: Payment Processor
  - Teal: Forex
  - Red: Line of Credit
- Last 4 digits display
- Currency badge
- Apple Wallet info (if different from physical)
- Edit, Deactivate, Delete actions

#### Empty States

- No accounts: Full-page empty state with call-to-action
- No personal cards: Informative card with benefits explanation

### 4. **Navigation**

- Added "Accounts" to sidebar (between Upload and Settings)
- Route: `/accounts`
- Icon: Building2 (Lucide React)

### 5. **TypeScript Types**

Updated `client/types/database.ts` with:

- Enhanced `bank_accounts` type
- `account_types` table type
- `institutions` table type

---

## 🚀 Setup Instructions

### Step 1: Apply Database Migration

Run the SQL migration in your Supabase SQL Editor:

```bash
# Copy the contents of supabase-accounts-schema.sql
# Paste into Supabase Dashboard → SQL Editor → New Query
# Run the query
```

This will:

- Create `account_types` and `institutions` tables
- Add new columns to `bank_accounts`
- Insert 7 account types
- Insert 21 financial institutions
- Create the `bank_accounts_view`
- Set up RLS policies

### Step 2: Update Existing Bank Accounts (if any)

If you already have bank accounts in your database, update them with the new fields:

```sql
-- Example: Update existing RBC CAD account
UPDATE bank_accounts
SET
  account_type = 'chequing',
  is_personal = false,
  last4_physical = '6245'
WHERE name = 'RBC CAD';
```

### Step 3: Navigate to Accounts Page

The page is now accessible at:

- **URL**: `http://localhost:5173/accounts`
- **Sidebar**: Click "Accounts" in the navigation

---

## 📝 Usage Guide

### Adding a Business Bank Account

1. Click "+ Add Account"
2. Select "Business Account"
3. Choose account type (e.g., "Chequing")
4. Select institution (e.g., "RBC - Royal Bank")
5. Enter account name (e.g., "RBC Business Chequing")
6. Select currency (e.g., "CAD")
7. Enter last 4 digits OR check "N/A" (for processors/forex)
8. Select company
9. (Optional) Add notes
10. Click "Add Account"

### Adding a Personal Credit Card

1. Click "+ Add Account"
2. Select "Personal Card (for business expenses only)"
3. Choose "Credit Card"
4. Select institution (e.g., "Visa")
5. Enter card name (e.g., "Personal Visa")
6. Select currency
7. Enter last 4 digits
8. (Optional) Enter Apple Wallet last 4 OR check "Same as physical"
9. Click "Add Account"

### Adding Payment Processor (PayPal, Stripe)

1. Click "+ Add Account"
2. Select "Business Account"
3. Choose "Payment Processor"
4. Select institution (e.g., "PayPal")
5. Enter name (e.g., "PayPal Business")
6. Select currency (often "Multi")
7. **Check "N/A" for Last 4 digits** (processors don't have card numbers)
8. Select company
9. Click "Add Account"

---

## 🎨 Design Features

### Grouping Logic

Accounts are automatically grouped into sections:

**Business Accounts:**

- Bank Accounts (Chequing, Savings)
- Credit Cards
- Payment Processors & Forex (PayPal, Stripe, Wise, Airwallex)
- Other (Line of Credit, etc.)

**Personal Cards:**

- Credit/Cash cards used for business expenses
- Shows Apple Wallet info if different from physical

### Conditional Fields

- **Wallet field**: Only shown for Credit Card and Cash Card
- **Company field**: Only shown for Business Accounts (hidden for Personal)
- **Institution dropdown**: Filtered based on selected account type
- **N/A checkboxes**: Allow skipping last 4 digits for processors/forex

### Badge Colors

Each account type has a distinct color for easy visual identification:

- 🔵 Blue: Chequing
- 🟢 Green: Savings
- 🟣 Purple: Credit Card
- 🟠 Orange: Cash Card
- 🟦 Indigo: Payment Processor
- 🩵 Teal: Forex
- 🔴 Red: Line of Credit

---

## 🔧 Available Institutions

The system comes pre-loaded with 21 institutions:

**Canadian Banks:**

- RBC, TD, Scotiabank, BMO, CIBC, National Bank, Desjardins, Tangerine, Simplii, EQ Bank

**Credit Cards:**

- American Express, Visa, Mastercard

**Payment Processors:**

- PayPal, Stripe, Square

**Forex/Multi-currency:**

- Wise (TransferWise), Airwallex, Revolut

**Cash Cards:**

- Koho, STACK

To add more institutions, insert into the `institutions` table via Supabase Dashboard.

---

## 📊 Database Views

The `bank_accounts_view` provides enhanced data:

```sql
SELECT * FROM bank_accounts_view;
```

Returns:

- All account fields
- `account_type_display` - Human-readable type name
- `account_type_color` - Badge color
- `company_name` - Company name (from join)

Use this view for displaying accounts with enriched data.

---

## ✅ Key Features Summary

| Feature                | Status      |
| ---------------------- | ----------- |
| Add Account Modal      | ✅ Complete |
| Edit Account Modal     | ✅ Complete |
| Delete Confirmation    | ✅ Complete |
| Account Grouping       | ✅ Complete |
| Type Badges            | ✅ Complete |
| Last 4 with N/A Option | ✅ Complete |
| Wallet Support         | ✅ Complete |
| Company Association    | ✅ Complete |
| Empty States           | ✅ Complete |
| Success/Error Toasts   | ✅ Complete |
| Sidebar Navigation     | ✅ Complete |
| Responsive Design      | ✅ Complete |

---

## 🔐 Security

- All tables have Row Level Security (RLS) enabled
- Authenticated users can view all accounts
- Modification requires proper authentication
- Delete actions require confirmation

---

## 🎯 Next Steps

1. **Apply the migration** to your Supabase database
2. **Test the page** by adding different account types
3. **Customize institutions** if you need additional banks/processors
4. **Link to Upload page** - The Upload page can now use the enhanced bank accounts data

---

## 💡 Tips

- Use "N/A" for last 4 digits on payment processors (PayPal, Stripe) and forex accounts (Wise, Airwallex)
- Personal cards are flagged separately and shown in their own section
- Apple Wallet info only appears if it differs from the physical card
- All forms have full validation with helpful error messages
- Accounts can be deactivated (soft delete) or permanently deleted

---

## 🐛 Troubleshooting

**Issue: "No institutions found for this account type"**

- Make sure you've run the migration to populate the `institutions` table
- Check that the institution supports the selected account type

**Issue: "Required for business accounts" error on Company field**

- Company is mandatory for all business accounts
- Make sure you've selected a company from the dropdown
- Personal cards don't need a company

**Issue: "Must be exactly 4 digits" error**

- Last 4 fields only accept 4 numeric digits
- Use the "N/A" checkbox if the account doesn't have a card/account number

---

Enjoy your new comprehensive Accounts management page! 🎉
