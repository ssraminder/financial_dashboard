# Categories Column Fix Summary

## Issue

The categories table has a column named `category_type`, but several queries were trying to fetch a column named `type`, which doesn't exist.

## Files Fixed

### 1. `client/types/index.ts` - Category Interface

**Before:**

```typescript
export interface Category {
  id: string;
  name: string;
  type: "income" | "expense";
  created_at: string;
  updated_at: string;
}
```

**After:**

```typescript
export interface Category {
  id: string;
  code: string;
  name: string;
  category_type: "income" | "expense"; // ← Changed from "type"
  tax_deductible_percent: number | null;
  quickbooks_account: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### 2. `client/pages/ReviewQueue.tsx` - Categories Fetch Query

**Before:**

```typescript
const { data: categoriesData, error: categoriesError } = await supabase
  .from("categories")
  .select("id, name, type")
  .order("name");
```

**After:**

```typescript
const { data: categoriesData, error: categoriesError } = await supabase
  .from("categories")
  .select("id, code, name, category_type, description")
  .eq("is_active", true)
  .order("name");
```

### 3. `client/pages/Dashboard.tsx` - Categories Reference (2 changes)

**Before (line 80):**

```typescript
.select("amount, category_id, needs_review, categories(type)");
```

**After:**

```typescript
.select("amount, category_id, needs_review, categories(category_type)");
```

**Before (line 110):**

```typescript
const categoryType = transaction.categories?.type;
```

**After:**

```typescript
const categoryType = transaction.categories?.category_type;
```

## Database Column Reference

The actual categories table columns are:

```sql
- id (uuid) - Primary key
- code (text) - Category code
- name (text) - Category name
- category_type (text) - Type: "income" or "expense"
- tax_deductible_percent (integer) - Tax deductible percentage
- quickbooks_account (text) - QB account reference
- description (text) - Category description
- is_active (boolean) - Is category active
- created_at (timestamp)
- updated_at (timestamp)
```

## What Changed

✅ Updated Category TypeScript interface to match database schema
✅ Fixed ReviewQueue categories fetch query
✅ Added `is_active` filter to ReviewQueue query
✅ Added all required fields to ReviewQueue query
✅ Fixed Dashboard query to use `category_type`
✅ Fixed Dashboard code to reference `category_type` instead of `type`

## Impact

These fixes ensure:

- ReviewQueue page correctly fetches only active categories
- Dashboard correctly calculates revenue vs expenses
- TypeScript types match the actual database schema
- No more "column does not exist" errors

## Testing

After these fixes:

1. ✅ ReviewQueue should load categories without errors
2. ✅ Dashboard should calculate stats correctly
3. ✅ No TypeScript errors related to Category type
4. ✅ Supabase queries should succeed
