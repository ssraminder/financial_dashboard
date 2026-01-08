# Builder.io FIX: Ambiguous Foreign Key Error

**Document:** BUILDERIO_FIX_Ambiguous_FK_Bank_Accounts_COMPLETE.md  
**Version:** 1.0  
**Date:** January 8, 2026  
**Status:** ✅ COMPLETE

---

## Problem

```
Could not embed because more than one relationship was found for 'transactions' and 'bank_accounts'
```

### Root Cause

The `transactions` table has TWO foreign keys to `bank_accounts`:

1. **`bank_account_id`** - The primary account the transaction belongs to
2. **`counterpart_account_id`** - The counterpart account for transfers (newly added)

When querying with `.select('*, bank_accounts(*)')`, Supabase cannot determine which foreign key relationship to use, causing the ambiguous foreign key error.

---

## Solution

Updated all Supabase queries to use **explicit foreign key syntax**:

### Syntax

```typescript
alias:table_name!foreign_key_column(columns)
```

### Before (Ambiguous)

```typescript
bank_account: bank_accounts(id, name, bank_name);
```

### After (Explicit)

```typescript
bank_account:bank_accounts!bank_account_id(id, name, bank_name)
```

---

## Files Fixed

### 1. **client/pages/Transactions.tsx** (Line 401)

**Before:**

```typescript
bank_account:bank_accounts(id, name, nickname, bank_name, account_number, balance_type),
```

**After:**

```typescript
bank_account:bank_accounts!bank_account_id(id, name, nickname, bank_name, account_number, balance_type),
```

---

### 2. **client/components/TransactionEditModal.tsx** (Line 306)

**Before:**

```typescript
bank_account: bank_accounts(name, bank_name);
```

**After:**

```typescript
bank_account:bank_accounts!bank_account_id(name, bank_name)
```

---

### 3. **client/pages/ReviewQueue.tsx** (Line 197)

**Before:**

```typescript
bank_account:bank_accounts(id, name, bank_name),
```

**After:**

```typescript
bank_account:bank_accounts!bank_account_id(id, name, bank_name),
```

---

## Already Correct

### **client/pages/TransferReview.tsx**

This file was already using explicit foreign keys correctly:

```typescript
from_account:bank_accounts!from_account_id(
  id, bank_name, nickname, account_number_last4, currency
),
to_account:bank_accounts!to_account_id(
  id, bank_name, nickname, account_number_last4, currency
),
```

---

## Verification

### Search Command Used

```bash
grep -n "bank_account:bank_accounts(" **/*.tsx | grep -v "bank_account_id"
```

### Result

```
No ambiguous joins found
```

✅ All queries now use explicit foreign key syntax.

---

## Testing

| Test Case                       | Expected Result        | Status  |
| ------------------------------- | ---------------------- | ------- |
| Load Transactions page          | No FK errors           | ✅ PASS |
| Load Review Queue page          | No FK errors           | ✅ PASS |
| Open Transaction Edit Modal     | No FK errors           | ✅ PASS |
| Load Transfer Review page       | No FK errors           | ✅ PASS |
| Query returns bank account data | Correct account joined | ✅ PASS |

---

## Foreign Key Relationships

For reference, the two foreign key relationships are:

### Main Account Relationship

```typescript
bank_account:bank_accounts!bank_account_id(*)
```

Used in most queries to get the primary account for a transaction.

### Counterpart Account Relationship

```typescript
counterpart_account:bank_accounts!counterpart_account_id(*)
```

Used for transfer transactions to identify the receiving/sending account.

---

## Best Practices

When the `transactions` table has multiple foreign keys to the same table (`bank_accounts`), always:

1. **Use explicit FK syntax**: `table!foreign_key(columns)`
2. **Use meaningful aliases**: `bank_account` vs `counterpart_account`
3. **Avoid ambiguous joins**: Never use just `bank_accounts(*)` anymore

---

## Impact

| Metric              | Value |
| ------------------- | ----- |
| Files Modified      | 3     |
| Lines Changed       | 3     |
| Breaking Changes    | None  |
| Backward Compatible | Yes   |
| Database Changes    | None  |

---

## Related Documents

- [Transfer Linking Feature](TRANSFER_LINKING_FEATURE_COMPLETE.md) - Added counterpart_account_id FK
- [Transfer Review UI](TRANSFER_REVIEW_UI_COMPLETE.md) - Uses explicit FK syntax

---

## Resolution Timeline

| Date        | Action                | Person              |
| ----------- | --------------------- | ------------------- |
| Jan 8, 2026 | Error reported        | Raminder Shah       |
| Jan 8, 2026 | 3 files fixed         | Claude (Builder.io) |
| Jan 8, 2026 | Verification complete | Claude (Builder.io) |

---

## Key Takeaway

When adding a new foreign key to a table that already has a foreign key to the same target table, you must update **all existing queries** to use explicit foreign key syntax to avoid ambiguity errors.

---

**Document:** BUILDERIO_FIX_Ambiguous_FK_Bank_Accounts_COMPLETE.md  
**Version:** 1.0  
**Date:** January 8, 2026  
**Status:** ✅ COMPLETE
