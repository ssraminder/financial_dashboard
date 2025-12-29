# HITL Review Queue - Deployment Checklist

## Pre-Deployment (Do This First)

### 1. Database Migration

- [ ] Ensure you have backup of production database
- [ ] Review `supabase-migration-add-ai-fields.sql`
- [ ] Apply migration to Supabase:

  ```bash
  # Option A: Using Supabase Dashboard
  # - Go to SQL Editor
  # - Copy content of supabase-migration-add-ai-fields.sql
  # - Execute the SQL

  # Option B: Using Supabase CLI
  supabase db push
  ```

### 2. Verify Prerequisites

- [ ] Vendors table exists and is properly set up
  - Check: `SELECT COUNT(*) FROM vendors;`
  - Should have at least some active vendors
- [ ] Categories table has contractor-related categories
  - Expected: "Contractor", "Professional Fees", "Consulting", etc.
- [ ] Bank accounts are set up
  - Check: `SELECT COUNT(*) FROM bank_accounts;`

### 3. Test Data

- [ ] Create test transactions with `needs_review = true`
  - Include example contractor payments
  - Include example regular expense payments
- [ ] Populate some vendors in the vendors table
  - At least 3-5 sample vendors for testing

## Deployment Steps

### Step 1: Code Deployment

- [ ] Code changes are in place (ReviewQueue.tsx, types/index.ts)
- [ ] Build successfully: `npm run build` or `pnpm build`
- [ ] No TypeScript errors
- [ ] All imports resolve correctly

### Step 2: Database Setup

- [ ] Migration applied successfully
- [ ] Verify new columns exist:

  ```sql
  -- Check transactions table columns
  SELECT column_name FROM information_schema.columns
  WHERE table_name='transactions'
  AND column_name IN ('vendor_id', 'ai_reasoning', 'status');

  -- Check transaction_patterns table exists
  SELECT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_name='transaction_patterns'
  );
  ```

### Step 3: Verification

- [ ] Navigate to /review-queue in UI
- [ ] Page loads without errors
- [ ] First transaction displays correctly
- [ ] AI suggestion section appears (if ai_reasoning populated)
- [ ] Category dropdown populated
- [ ] Vendor selection appears for contractor categories

## Testing Workflow

### Basic Flow Test

1. [ ] Open /review-queue
2. [ ] Verify transaction card displays:
   - Date, description, amount ✓
   - AI suggestion section (if available) ✓
   - Confidence badge ✓
   - Category dropdown ✓
3. [ ] Test category selection:
   - Select any category
   - Verify form updates
4. [ ] Test contractor flow:
   - Select contractor-type category
   - Verify vendor selection appears
5. [ ] Test vendor selection:
   - [ ] Regular Vendor option
     - Click it
     - Verify dropdown appears
     - Search for vendor
     - Select a vendor
   - [ ] One-Time Payment option
     - Click it
     - Verify vendor dropdown disappears
   - [ ] New Vendor option
     - Click it
     - Enter vendor name
     - Select contractor type
     - Toggle offshore checkbox
     - Verify country selector works
6. [ ] Test notes:
   - Add text to "Your Notes"
   - Change category
   - Verify "Why different?" appears
   - Add text to "Why different?"
7. [ ] Test save:
   - Click "Approve & Save"
   - Verify success toast
   - Verify transaction removed
   - Verify next transaction loads

### Edge Cases

- [ ] Skip button works (moves to next without saving)
- [ ] Works with no transactions pending
- [ ] Works with one transaction
- [ ] Works with many transactions
- [ ] Vendor creation succeeds
- [ ] Vendor appears in dropdown after creation
- [ ] Database transaction_patterns entry created

## Post-Deployment Validation

### Check Database

```sql
-- Verify saved transaction
SELECT id, category_id, vendor_id, status, human_notes, ai_reasoning
FROM transactions
WHERE needs_review = false
LIMIT 5;

-- Verify pattern saved
SELECT payee_pattern, category_id, vendor_id, reasoning, confidence_score
FROM transaction_patterns
LIMIT 5;

-- Check for errors
SELECT COUNT(*) FROM transactions WHERE status = 'pending';
SELECT COUNT(*) FROM transactions WHERE status = 'categorized';
```

### Check UI

- [ ] No console errors
- [ ] All buttons functional
- [ ] Form validation works
- [ ] Error toasts display correctly
- [ ] Success toasts display correctly
- [ ] Progress bar updates

## Rollback Plan (If Needed)

### Quick Rollback

1. Revert the ReviewQueue.tsx and types/index.ts to previous versions
2. Refresh the page
3. Users will see the table-based view again

### Database Rollback

If migration causes issues:

```sql
-- Drop new table
DROP TABLE IF EXISTS transaction_patterns;

-- Remove new columns
ALTER TABLE transactions
DROP COLUMN IF EXISTS payee_normalized,
DROP COLUMN IF EXISTS vendor_id,
DROP COLUMN IF EXISTS status,
DROP COLUMN IF EXISTS ai_reasoning,
DROP COLUMN IF EXISTS ai_confidence_score,
DROP COLUMN IF EXISTS human_notes,
DROP COLUMN IF EXISTS human_decision_reason;
```

## Performance Monitoring

After deployment, monitor:

- [ ] Page load time (should be <2s)
- [ ] Category/vendor dropdown responsiveness
- [ ] Form save time (should be <1s)
- [ ] No N+1 queries in browser dev tools

### Check Logs

- [ ] No 404 errors
- [ ] No 500 server errors
- [ ] No auth/permission errors
- [ ] No database constraint violations

## Known Issues & Workarounds

### If vendor dropdown is empty:

- Check that vendors table has active vendors: `WHERE is_active = true`
- Add test vendors if needed

### If categories don't appear:

- Verify categories exist in database
- Ensure they are ordered by name (migration includes ORDER BY)

### If transactions won't save:

- Check vendor_id is nullable (migration includes this)
- Verify category_id matches existing category
- Check auth user is logged in

## Success Criteria

✅ All of the following should be true:

- [ ] Page loads without errors
- [ ] Can navigate through transactions
- [ ] Can select categories
- [ ] Can select vendors (regular/one-time/new)
- [ ] Can create new vendors
- [ ] Can add notes
- [ ] Transactions save successfully
- [ ] Transaction patterns table records created
- [ ] Next transaction loads automatically
- [ ] No console errors
- [ ] All buttons functional
- [ ] Forms validate correctly

## Support/Troubleshooting

If you encounter issues:

1. Check browser console (F12) for errors
2. Check Supabase logs for database errors
3. Verify all prerequisites are met
4. Review the HITL_REVIEW_UPDATE.md guide
5. Check that migration was applied successfully
6. Verify test data exists in database

## Rollout Strategy (For Production)

### Option A: Immediate Deployment

- Deploy to all users immediately
- Monitor for issues
- Be ready to rollback

### Option B: Phased Rollout

- Deploy to internal team first
- Test for 1-2 days
- Deploy to power users
- Deploy to all users
- Monitor and support as needed

### Option C: Feature Flag

- Deploy code but disable with feature flag
- Enable for subset of users
- Monitor performance and feedback
- Gradually enable for all users

## Post-Deployment Support

- [ ] Monitor user feedback
- [ ] Track error reports
- [ ] Monitor database performance
- [ ] Track transaction processing time
- [ ] Gather user suggestions for improvements
- [ ] Plan Phase 2 enhancements:
  - Payee normalization
  - Bulk operations
  - Pattern-based auto-categorization
  - Advanced filtering
  - Export capabilities
