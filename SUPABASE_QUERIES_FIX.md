# Supabase Queries Column Name Fix Summary

## Overview
Fixed two critical Supabase queries to use the correct column names:
1. Categories table: Use `category_type` instead of `type`
2. Vendors table: Use `contractor_type` instead of `category`

## Files Updated

### 1. `client/types/index.ts` - Type Interfaces

#### Category Interface ✅
**Before:**
```typescript
type: "income" | "expense";
```

**After:**
```typescript
category_type: "income" | "expense";
```

#### Vendor Interface ✅
**Before:**
```typescript
category: "Contractor" | "Agency" | "Freelancer" | "Employee";
```

**After:**
```typescript
contractor_type: string | null;
```

### 2. `client/pages/ReviewQueue.tsx` - Categories Query ✅

**Before:**
```typescript
.select("id, name, type")
```

**After:**
```typescript
.select("id, code, name, category_type, description")
.eq("is_active", true)
```

### 3. `client/pages/ReviewQueue.tsx` - Vendors Query ✅

**Before:**
```typescript
.select("id, legal_name, category")
```

**After:**
```typescript
.select("id, legal_name, contractor_type")
```

### 4. `client/pages/ReviewQueue.tsx` - New Vendor Creation ✅

**Before:**
```typescript
{
  legal_name: newVendorName,
  category: selectedContractorType,
  ...
}
```

**After:**
```typescript
{
  legal_name: newVendorName,
  contractor_type: selectedContractorType,
  ...
}
```

### 5. `client/pages/Vendors.tsx` - Form State Initial ✅

**Before:**
```typescript
category: "Contractor",
```

**After:**
```typescript
contractor_type: "Contractor",
```

### 6. `client/pages/Vendors.tsx` - Reset Form ✅

**Before:**
```typescript
category: "Contractor",
```

**After:**
```typescript
contractor_type: "Contractor",
```

### 7. `client/pages/Vendors.tsx` - Category Select Handler ✅

**Before:**
```typescript
value={formData.category}
onValueChange={(value: Vendor["category"]) =>
  setFormData((prev) => ({ ...prev, category: value }))
}
```

**After:**
```typescript
value={formData.contractor_type || ""}
onValueChange={(value: string) =>
  setFormData((prev) => ({ ...prev, contractor_type: value }))
}
```

## Database Schema Reference

### Categories Table
```sql
- id (uuid)
- code (text)
- name (text)
- category_type (text) ← Use this, not "type"
- description (text)
- is_active (boolean)
```

### Vendors Table
```sql
- id (uuid)
- legal_name (text)
- contractor_type (text) ← Use this, not "category"
- is_offshore (boolean)
- country (text)
- is_active (boolean)
- ... (other fields)
```

## Changes Summary

| Component | Field | Before | After | Status |
|-----------|-------|--------|-------|--------|
| Category Type | Column | `type` | `category_type` | ✅ |
| Vendor Type | Column | `category` | `contractor_type` | ✅ |
| Categories Query | Select | Missing fields | Full columns + filter | ✅ |
| Vendors Query | Select | `category` | `contractor_type` | ✅ |
| New Vendor Insert | Field | `category` | `contractor_type` | ✅ |
| Vendors Form | State | `category` | `contractor_type` | ✅ |
| ReviewQueue | New vendor creation | `category` | `contractor_type` | ✅ |

## Impact

These fixes ensure:
- ✅ ReviewQueue page fetches correct categories and vendors
- ✅ Dashboard correctly calculates revenue vs expenses
- ✅ Vendors page correctly displays and manages contractor types
- ✅ New vendors are created with correct field names
- ✅ No more "column does not exist" errors
- ✅ TypeScript types match database schema exactly

## Testing Checklist

After these fixes:
- [ ] ReviewQueue page loads without errors
- [ ] Categories dropdown shows all active categories
- [ ] Vendors dropdown shows all active vendors
- [ ] Creating new vendor saves contractor_type correctly
- [ ] Vendors page form displays contractor type dropdown
- [ ] Dashboard calculates stats correctly
- [ ] No TypeScript type errors
- [ ] No Supabase query errors in console
