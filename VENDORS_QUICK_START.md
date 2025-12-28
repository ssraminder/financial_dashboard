# Vendors Page - Quick Start Guide

## ✅ Implementation Complete!

The Vendors page is fully implemented and ready to use.

---

## 🚀 Get Started in 3 Steps

### Step 1: Run Database Migration (5 minutes)

1. Open [Supabase SQL Editor](https://supabase.com/dashboard/project/llxlkawdmuwsothxaada/sql)
2. Click **"New Query"**
3. Open `supabase-vendors-schema.sql` from your project
4. Copy **all contents** and paste into SQL Editor
5. Click **"Run"**
6. You should see: `Success. No rows returned`

---

### Step 2: Navigate to Vendors Page

1. Open your Cethos Financial Dashboard
2. Click **"Vendors"** in the sidebar (Package icon 📦)
3. You'll see the empty state with Import/Add options

---

### Step 3: Import or Add Vendors

**Option A: Import from XTRF**

1. Click **"Import CSV"**
2. Upload your XTRF vendor export file
3. Select import options
4. Click **"Import Vendors"**
5. Watch progress and review summary

**Option B: Add Manually**

1. Click **"+ Add Vendor"**
2. Fill in Legal Name (required)
3. Add contact and financial details
4. Click **"Add Vendor"**

---

## 📋 What You Get

### Features

- ✅ CSV import from XTRF (semicolon-delimited format)
- ✅ Search vendors by name, email, or city
- ✅ Filter by Status and Country
- ✅ View ratings from XTRF (⭐)
- ✅ Track GST registration (✓/✗)
- ✅ Mark preferred vendors (🏅)
- ✅ Edit vendor details and financial settings
- ✅ Pagination (20 vendors per page)
- ✅ Delete with confirmation

### Vendor Data Fields

- **Basic:** Legal Name, Status, Country, City
- **Contact:** Email (+ Email 2), Phone (+ Phone 2, 3)
- **XTRF:** Overall Evaluation, Language Pairs, Availability
- **Financial:** GST (registered, rate, number), Category, Payment Terms, Currency
- **Management:** Preferred status, Notes

---

## 🎯 Common Tasks

### Import 700+ Vendors from XTRF

```
1. Export vendors from XTRF as CSV
2. Click "Import CSV" in Cethos
3. Upload file
4. Check "Update existing" and "Add new"
5. Click "Import Vendors"
6. Wait for batch processing (shows progress)
7. Review summary (added/updated/errors)
```

### Find Canadian GST-Registered Vendors

```
1. Status filter: All Statuses
2. Country filter: Canada
3. Look for ✓ icon in GST column
4. Shows rate (e.g., ✓ 5%)
```

### Mark Your Top Vendors as Preferred

```
1. Find vendor in list
2. Click ⋮ (actions menu)
3. Select "Mark as Preferred"
4. Award badge (🏅) appears next to name
```

### Update Vendor Financial Settings

```
1. Click on vendor row (or Edit from ⋮ menu)
2. Scroll to "Financial Settings"
3. Check "GST Registered" if applicable
4. Enter GST Number
5. Select Category (Contractor/Agency/Freelancer/Employee)
6. Set Payment Terms (Net 30, etc.)
7. Choose Preferred Currency
8. Click "Save Changes"
```

---

## 📊 CSV Import Format

**XTRF Vendor Export (semicolon-delimited):**

```csv
Legal Name;Status;Overall Evaluation;Availability;Language Combinations;Address > Country;Address > City;Address > E-mail Address;Address > E-mail Address 3;Address > Phone;Address > Phone 2;Address > Phone 3
Vendor Name;Active;5.00;Available;EN » FR, FR » EN;Canada;Toronto;email@example.com;;;+1234567890;;
```

**Key Points:**

- **Delimiter:** Semicolon (`;`)
- **Match Field:** Legal Name (must be unique)
- **Rating:** Decimal (0.00-5.00) or dash (`-`)
- **Language Pairs:** Stored as text from XTRF

---

## 🔍 Search & Filter Tips

### Search

- Type partial name: "Abh" finds "Abhash Pathak"
- Search by email: "gmail" finds all Gmail addresses
- Search by city: "Delhi" finds vendors in New Delhi

### Filters

- **Status:** Active vs Inactive vendors
- **Country:** Dynamically populated from your data
- **Combined:** Status=Active + Country=India shows active Indian vendors

### Reset

- Search: Clear text box
- Status: Select "All Statuses"
- Country: Select "All Countries"

---

## ⚠️ Important Notes

### Unique Legal Names

- Each vendor must have a unique Legal Name
- CSV import will UPDATE existing vendors with same name
- Choose descriptive, unique names

### GST Settings

- GST Rate disabled unless "GST Registered" is checked
- GST Number optional but recommended for records
- Canadian vendors typically 5% GST

### Preferred Vendors

- Use to identify go-to contractors
- Shows award badge (🏅) in vendor list
- Can filter/sort by preferred status in future

### Sync Tracking

- `last_synced_at` tracks XTRF imports
- Displayed in edit modal
- Shows in summary bar if any vendors synced

---

## 📁 Files Reference

| File                          | What It Does                      |
| ----------------------------- | --------------------------------- |
| `supabase-vendors-schema.sql` | Creates database table (run once) |
| `client/pages/Vendors.tsx`    | Main Vendors page UI              |
| `VENDORS_SETUP_GUIDE.md`      | Detailed setup and feature guide  |
| `VENDORS_FEATURE_SUMMARY.md`  | Technical implementation details  |
| `VENDORS_QUICK_START.md`      | This quick start guide            |

---

## ✅ Verification

**After migration, verify setup:**

```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) as vendor_count FROM vendors;

SELECT country, COUNT(*) as count
FROM vendors
WHERE country IS NOT NULL
GROUP BY country
ORDER BY count DESC;
```

**Expected:**

- First query shows total vendor count
- Second query shows vendors by country

---

## 🆘 Troubleshooting

### "Failed to fetch"

→ Run `supabase-vendors-schema.sql` migration

### CSV import fails

→ Check file is semicolon-delimited XTRF export
→ Ensure "Legal Name" column exists

### No vendors showing

→ Check Status and Country filters
→ Try searching with empty filters

### Can't edit vendor

→ Click on row OR use ⋮ menu > Edit
→ Check browser console for errors

---

## 🎉 You're Ready!

**The Vendors page is fully functional with:**

- ✅ Complete database schema
- ✅ Full CRUD operations
- ✅ XTRF CSV import
- ✅ Advanced filtering
- ✅ Professional UI
- ✅ Comprehensive documentation

**Start managing your vendors now!**

Navigate to: **`/vendors`** in your Cethos Financial Dashboard.

---

For more details, see:

- `VENDORS_SETUP_GUIDE.md` - Comprehensive setup guide
- `VENDORS_FEATURE_SUMMARY.md` - Technical documentation
