# Builder.io Prompt 2: Update ViewStatements.tsx for Query Parameters

## Purpose
After implementing the multi-file upload feature, the Upload page will navigate directly to specific statements using URL query parameters. ViewStatements.tsx needs to read these parameters and auto-select the appropriate account and statement.

## Current Behavior
- User manually selects bank account from dropdown
- User manually selects statement from dropdown  
- No URL query parameter support

## Required Changes

### 1. Update Imports
Add `useSearchParams` from react-router-dom (line 2, after useNavigate):

```typescript
import { useNavigate, useSearchParams } from "react-router-dom";
```

### 2. Read Query Parameters
Add this code after the useNavigate hook is initialized (around line 107):

```typescript
const [searchParams] = useSearchParams();
const accountParam = searchParams.get('account');
const statementParam = searchParams.get('statement');
```

### 3. Auto-Select Account from URL
Add this useEffect after the `fetchBankAccounts` function is called (around line 180):

```typescript
// Auto-select bank account from URL query parameter if provided
useEffect(() => {
  if (accountParam && bankAccounts.length > 0) {
    // Verify account exists in the fetched list
    const accountExists = bankAccounts.some(a => a.id === accountParam);
    if (accountExists) {
      setSelectedBankAccountId(accountParam);
    }
  }
}, [accountParam, bankAccounts]);
```

### 4. Auto-Select Statement from URL
Add this useEffect after statements are fetched (around line 200):

```typescript
// Auto-select statement from URL query parameter if provided
useEffect(() => {
  if (statementParam && statements.length > 0) {
    // Verify statement exists in the fetched list
    const statementExists = statements.some(s => s.id === statementParam);
    if (statementExists) {
      setSelectedStatementId(statementParam);
    }
  }
}, [statementParam, statements]);
```

## Expected URL Format
After multi-file upload completes, the [View] button will generate URLs like:

```
/statements?account=5ba080c9-5593-4c86-b22d-95713d30579f&statement=abc123-def456
```

Where:
- `account` = Bank account UUID (required for auto-selection)
- `statement` = Statement import ID (optional, requires account to work)

## Testing Checklist

Please verify all of these scenarios after implementation:

- [ ] Navigate to `/statements` - works as before (no auto-selection)
- [ ] Navigate to `/statements?account=VALID_UUID` - auto-selects that account
- [ ] Navigate to `/statements?account=INVALID_UUID` - no error, no selection
- [ ] Navigate to `/statements?account=VALID&statement=VALID` - auto-selects both
- [ ] Navigate to `/statements?statement=VALID` (no account param) - no selection occurs (account is required first)
- [ ] After auto-selection, user can manually change dropdown - still works normally
- [ ] URL params only trigger initial selection, don't override user's manual selection after page loads
- [ ] No console errors when accessing with invalid IDs
- [ ] No console errors when accessing with missing params

## Implementation Notes

1. **Safe Defaults**: If the account or statement IDs don't exist, the code silently does nothing. No errors are shown.

2. **Dependency Order**: The statement auto-selection only works if an account is selected first. This is intentional - users need to select an account before a statement makes sense.

3. **URL Format**: The Upload feature will generate these URLs automatically. ViewStatements just needs to read and respect them.

4. **No Override After Load**: Once the page has loaded and the user interacts with the dropdowns, the URL params are ignored. This prevents constant re-selection as the user makes changes.

5. **Empty States**: Handle gracefully when:
   - Params provided but IDs don't exist (no selection, no error)
   - Only statement param (ignore it, need account first)
   - Empty bankAccounts or statements arrays (wait for data to load)

## Files Modified
- **Only `client/pages/ViewStatements.tsx`** - No other files need changes for this feature

## Success Criteria
- ✅ URL params read correctly without errors
- ✅ Valid accounts auto-selected from URL
- ✅ Valid statements auto-selected from URL
- ✅ Invalid IDs handled gracefully (no errors)
- ✅ Manual dropdown selection works normally
- ✅ All test scenarios pass

## Related Feature
This enhancement works in conjunction with the multi-file upload feature (MULTI_FILE_UPLOAD_IMPLEMENTATION.md) which will:
- Generate these URLs automatically in the [View] button
- Navigate users to specific statements after upload completes
- Ensure they land on the correct account/statement pair

---

**This is a secondary task** that enhances the user experience after multi-file upload is complete. It's not blocking the upload implementation, but recommended for a complete workflow.
