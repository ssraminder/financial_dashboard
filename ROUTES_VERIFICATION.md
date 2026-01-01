# Route Verification & Navigation Fixes

## Actual Routes in App.tsx

Based on inspection of `client/App.tsx`, the actual routes are:

| Feature              | Current Spec Route                      | ✅ Actual Route |
| -------------------- | --------------------------------------- | --------------- |
| View Statements Page | `/statements?account=...&statement=...` | `/statements`   |
| Review Queue Page    | `/review`                               | `/review-queue` |

## Corrected Navigation Links for Upload.tsx

### For [View] Button (Success Results)

**Updated Navigation:**

```typescript
// Instead of: /statements?account=...&statement=...
// Use: /statements

// Simple navigation (no params needed)
onClick={() => navigate("/statements")}

// Note: Will need to update ViewStatements.tsx to support
// query parameters for direct statement filtering
```

### For [Go to Review Queue] Button

**Updated Navigation:**

```typescript
// Instead of: /review
// Use: /review-queue
onClick={() => navigate("/review-queue")}
```

---

## Post-Implementation: Update ViewStatements.tsx

After multi-file upload is implemented, add query parameter support to `client/pages/ViewStatements.tsx`:

### Changes Needed

**1. Add useLocation import (line 2)**

```typescript
import { useNavigate, useLocation } from "react-router-dom";
```

**2. Read query params in component (after line 107)**

```typescript
const location = useLocation();

// Parse query parameters
const searchParams = new URLSearchParams(location.search);
const accountParam = searchParams.get("account");
const statementParam = searchParams.get("statement");
```

**3. Auto-select bank account if provided (add useEffect after fetchBankAccounts)**

```typescript
// Auto-select bank account from query param if provided
useEffect(() => {
  if (accountParam && bankAccounts.length > 0) {
    // Check if account exists in fetched bank accounts
    const account = bankAccounts.find((a) => a.id === accountParam);
    if (account) {
      setSelectedBankAccountId(accountParam);
    }
  }
}, [accountParam, bankAccounts]);
```

**4. Auto-select statement if provided (add useEffect after fetchStatements)**

```typescript
// Auto-select statement from query param if provided
useEffect(() => {
  if (statementParam && selectedBankAccountId && statements.length > 0) {
    // Check if statement exists for selected account
    const statement = statements.find((s) => s.id === statementParam);
    if (statement) {
      setSelectedStatementId(statementParam);
      // Optionally fetch transactions for this statement
      // Call fetchTransactions(statementParam);
    }
  }
}, [statementParam, selectedBankAccountId, statements]);
```

---

## Navigation Implementation in Upload.tsx

Update the [View] button to use correct route with query parameters:

```typescript
// In Phase 3 (Complete) results section
{file.status === "success" && file.result && (
  <Button
    onClick={() => navigate(
      `/statements?account=${selectedBankAccountId}&statement=${file.result?.statement_import_id}`
    )}
    variant="outline"
    size="sm"
  >
    View
  </Button>
)}
```

And [Go to Review Queue] button:

```typescript
// Only show if any file has HITL items
{files.some(f => (f.result?.hitl_count ?? 0) > 0) && (
  <Button
    onClick={() => navigate("/review-queue")}
    variant="secondary"
    size="lg"
    className="flex-1"
  >
    Go to Review Queue
  </Button>
)}
```

---

## Summary of Changes

### Upload.tsx (Multi-File Implementation)

- ✅ Route to `/statements?account=${id}&statement=${id}` for [View]
- ✅ Route to `/review-queue` for [Review Queue]

### ViewStatements.tsx (Post-Implementation Enhancement)

- ⭕ Add `useLocation` import
- ⭕ Read `account` and `statement` query parameters
- ⭕ Auto-select bank account if `account` param provided
- ⭕ Auto-select statement if `statement` param provided
- ⭕ Trigger transaction fetch when auto-selected

---

## Files Affected

| File                              | Change                        | Priority     |
| --------------------------------- | ----------------------------- | ------------ |
| `client/pages/Upload.tsx`         | Replace entirely (multi-file) | 🔴 Primary   |
| `client/pages/ViewStatements.tsx` | Add query param support       | 🟡 Secondary |
| `client/App.tsx`                  | No changes needed             | ✅ Verified  |

---

## Testing Verification

After implementation, test:

1. ✅ Upload a file successfully
2. ✅ Click [View] button in results
3. ✅ Verify navigates to `/statements?account=...&statement=...`
4. ✅ Verify ViewStatements loads and auto-selects correct account
5. ✅ Verify correct statement is highlighted/selected
6. ✅ Verify transactions for that statement are shown

7. ✅ Upload file with HITL items
8. ✅ Click [Go to Review Queue]
9. ✅ Verify navigates to `/review-queue`
10. ✅ Verify HITL items are visible in ReviewQueue

---

## Ready to Send to Builder.io

✅ **MULTI_FILE_UPLOAD_IMPLEMENTATION.md** - Updated with correct routes:

- Line showing [View] navigation: `/statements?account=...&statement=...`
- Line showing [Review Queue] navigation: `/review-queue`

✅ **This document** - Provides post-implementation enhancement plan for ViewStatements.tsx

---

**Verification Status**: READY FOR IMPLEMENTATION
