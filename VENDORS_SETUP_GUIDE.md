# Vendors Page Setup Guide

## Overview

The Vendors page allows you to manage your vendor and contractor database with features including:

- ✅ CSV import from XTRF exports
- ✅ Manual vendor creation and editing
- ✅ Search and filtering (by status and country)
- ✅ Pagination
- ✅ Rating display from XTRF evaluations
- ✅ GST registration tracking
- ✅ Preferred vendor management
- ✅ Financial settings (GST, currency, payment terms, category)

**Note:** This is a **shared business database**. All authenticated users can view and manage all vendors (not filtered by user).

---

## 🔴 REQUIRED: Run Database Migration

Before using the Vendors page, you **MUST** create the `vendors` table in Supabase.

### Steps:

1. **Open Supabase Dashboard**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Migration**
   - Open the file `supabase-vendors-schema.sql` in this project
   - Copy the **entire contents** of that file
   - Paste it into the Supabase SQL Editor
   - Click **"Run"** (or press `Ctrl+Enter`)

4. **Verify Success**
   - You should see: `Success. No rows returned`
   - Run this verification query:
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
   AND table_name = 'vendors';
   ```

   - You should see `vendors` in the results

---

## Features Guide

### 1. Viewing Vendors

- Navigate to **Vendors** in the sidebar
- Vendors are displayed in a table with:
  - Name (with preferred vendor badge if applicable)
  - Country
  - Email (truncated if long)
  - Rating (from XTRF evaluations)
  - GST status (✓ 5% or ✗)

### 2. Importing from XTRF

**Supported Format:**

- XTRF vendor export CSV files (semicolon-delimited)
- Expected columns: `Legal Name`, `Status`, `Overall Evaluation`, `Availability`, `Language Combinations`, `Country`, `City`, `E-mail Address`, etc.

**How to Import:**

1. Click **"Import CSV"** button
2. Drag & drop or browse for your XTRF CSV file
3. Choose import options:
   - ☑ **Update existing vendors** - Updates vendors that match by Legal Name
   - ☑ **Add new vendors** - Imports vendors not in your database
   - ☐ **Mark missing as inactive** - Sets vendors not in CSV as inactive
4. Click **"Import Vendors"**
5. Watch the progress indicator
6. Review the import summary

**CSV Format Example:**

```csv
Legal Name;Status;Overall Evaluation;Availability;Language Combinations;Address > Country;Address > City;Address > E-mail Address;...
Abdessamad Binaoui;Active;-;Available;FR » EN-US, EN-US » FR;Morocco;AIN TAOUJDATE;neues-leben@live.de;...
Abhash Pathak;Active;5.00;Available;EN » HI, HI » EN;India;New Delhi;abhashpathak@gmail.com;...
```

### 3. Manual Vendor Management

**Add New Vendor:**

1. Click **"+ Add Vendor"** button
2. Fill in required fields (Legal Name is mandatory)
3. Set contact information (email, phone)
4. Set location (country, city)
5. Configure financial settings:
   - GST Registered checkbox
   - GST Rate (default 5%)
   - GST Number
   - Category (Contractor, Agency, Freelancer, Employee)
   - Payment Terms
   - Preferred Currency
6. Mark as Preferred Vendor (optional)
7. Click **"Add Vendor"**

**Edit Existing Vendor:**

1. Click on any vendor row in the table
2. Or click the ⋮ menu and select **"Edit"**
3. Update any fields
4. Click **"Save Changes"**

**Delete Vendor:**

1. Click the ⋮ menu on a vendor row
2. Select **"Delete"**
3. Confirm the deletion

**Mark as Preferred:**

1. Click the ⋮ menu on a vendor row
2. Select **"Mark as Preferred"** or **"Remove Preferred"**
3. Preferred vendors display an award badge (🏅)

### 4. Search and Filters

**Search:**

- Type in the search box to filter by:
  - Legal name
  - Email address
  - City
- Search is debounced (waits 300ms after you stop typing)

**Status Filter:**

- Use the dropdown to filter by:
  - All Statuses
  - Active
  - Inactive

**Country Filter:**

- Use the dropdown to filter by:
  - All Countries
  - Specific country (dynamically populated from database)

### 5. Pagination

- Page size: 20 vendors per page
- Use **Previous** and **Next** buttons to navigate
- Current page and total pages shown in the center

---

## Database Schema

### Table: `vendors`

| Column                  | Type      | Description                                 |
| ----------------------- | --------- | ------------------------------------------- |
| `id`                    | UUID      | Primary key (auto-generated)                |
| `legal_name`            | TEXT      | Legal name (required, unique)               |
| `status`                | TEXT      | Active or Inactive                          |
| `is_active`             | BOOLEAN   | Active status flag                          |
| `country`               | TEXT      | Country                                     |
| `city`                  | TEXT      | City                                        |
| `email`                 | TEXT      | Primary email address                       |
| `email_3`               | TEXT      | Additional email (from XTRF)                |
| `phone`                 | TEXT      | Primary phone number                        |
| `phone_2`               | TEXT      | Additional phone                            |
| `phone_3`               | TEXT      | Additional phone                            |
| `overall_evaluation`    | DECIMAL   | Rating from XTRF (0.00 to 5.00)             |
| `availability`          | TEXT      | Availability status from XTRF               |
| `language_combinations` | TEXT      | Language pairs from XTRF                    |
| `gst_registered`        | BOOLEAN   | GST registration status                     |
| `gst_rate`              | DECIMAL   | GST percentage (default 5.00)               |
| `gst_number`            | TEXT      | GST registration number                     |
| `category`              | TEXT      | Contractor, Agency, Freelancer, or Employee |
| `payment_terms`         | TEXT      | Due on Receipt, Net 15, Net 30, Net 60      |
| `preferred_currency`    | TEXT      | CAD, USD, EUR, GBP                          |
| `is_preferred`          | BOOLEAN   | Preferred vendor flag                       |
| `notes`                 | TEXT      | Free-form notes                             |
| `last_synced_at`        | TIMESTAMP | Last XTRF sync timestamp                    |
| `created_at`            | TIMESTAMP | Record creation timestamp                   |
| `updated_at`            | TIMESTAMP | Last update timestamp (auto-updated)        |

---

## Row Level Security (RLS)

The `vendors` table has RLS enabled with policies that:

- ✅ Allow all authenticated users to view all vendors (shared business database)
- ✅ Allow all authenticated users to insert vendors
- ✅ Allow all authenticated users to update vendors
- ✅ Allow all authenticated users to delete vendors

**Note:** This is a shared database. All team members can access and manage all vendors.

---

## Troubleshooting

### "Failed to fetch" Error

**Cause:** The `vendors` table doesn't exist in your Supabase database.

**Fix:** Run the migration in `supabase-vendors-schema.sql` (see steps above).

---

### CSV Import Fails

**Common Issues:**

1. **Wrong CSV Format**
   - Ensure the CSV is from XTRF
   - Check that headers include: `Legal Name`, `Status`, etc.
   - File must be semicolon-delimited (`;`)
2. **Special Characters**
   - CSV should use semicolon (`;`) as delimiter
   - Ensure UTF-8 encoding

3. **Duplicate Legal Names**
   - Legal names must be unique
   - The upsert will update records with matching `legal_name`

---

### Empty Vendor List

**Possible Causes:**

1. **No vendors imported yet**
   - Import from XTRF or add manually
2. **Status or Country filter active**
   - Reset filters to "All Statuses" and "All Countries"

---

## Sample Data (Optional)

To test the feature, you can insert sample vendors by uncommenting the section at the bottom of `supabase-vendors-schema.sql`:

```sql
INSERT INTO vendors (legal_name, status, country, city, email, overall_evaluation, gst_registered, gst_rate)
VALUES
  ('Abdessamad Binaoui', 'Active', 'Morocco', 'AIN TAOUJDATE', 'neues-leben@live.de', NULL, false, 5.00),
  ('Abdi Hurre', 'Active', 'Canada', 'Toronto', 'ahurre@hotmail.com', NULL, false, 5.00),
  ('Abhash Pathak', 'Active', 'India', 'New Delhi', 'abhashpathak@gmail.com', 5.00, false, 5.00);
```

---

## Key Features Explained

### Rating Display

- **From XTRF:** Overall Evaluation field (0.00 to 5.00)
- **Display:** ⭐ 5.00 (star icon + number)
- **No Rating:** Shows "—" if null or dash in CSV

### GST Registration

- **Registered:** ✓ 5% (green checkmark + rate)
- **Not Registered:** ✗ (gray X icon)
- **GST Number:** Optional field for registration number
- **Rate:** Editable, defaults to 5%

### Preferred Vendor

- **Badge:** Award icon (🏅) next to name in table
- **Quick Toggle:** Use actions menu (⋮) to mark/unmark
- **Filter:** Can be used to show only preferred vendors

### Financial Categories

- **Contractor:** Independent contractor
- **Agency:** Translation agency or service provider
- **Freelancer:** Individual freelancer
- **Employee:** Internal employee/staff member

---

## Next Steps

After setting up the Vendors page:

1. ✅ Import your XTRF vendor database
2. ✅ Review and update vendor financial settings
3. ✅ Mark preferred vendors for easy identification
4. ✅ Set up GST registration for Canadian vendors
5. Consider:
   - Linking vendors to transactions
   - Generating vendor-specific reports
   - Setting up automated payment workflows

---

## File Summary

| File                            | Purpose                                  |
| ------------------------------- | ---------------------------------------- |
| `client/pages/Vendors.tsx`      | Main Vendors page component              |
| `client/types/index.ts`         | Vendor TypeScript interface              |
| `supabase-vendors-schema.sql`   | Database migration script                |
| `client/components/Sidebar.tsx` | Updated navigation (includes Vendors)    |
| `client/App.tsx`                | Updated router (includes /vendors route) |

---

## Support

If you encounter any issues:

1. Check the browser console for errors
2. Verify the database migration ran successfully
3. Ensure you're logged in with a valid user account
4. Check Supabase Dashboard > Database > Tables to confirm `vendors` table exists

---

**🎉 You're all set! Navigate to `/vendors` to start managing your vendor database.**
