# HITL Review Queue - Quick Start Reference

## TL;DR - What Was Done

✅ **Transaction Type Updated** - 7 new fields added for AI suggestions
✅ **ReviewQueue Component Rebuilt** - Complete card-based UI redesign
✅ **AI Suggestions** - Display with confidence badges and accept button
✅ **Vendor Selection** - Regular/One-time/New vendor options
✅ **Smart Forms** - Conditional fields based on category
✅ **Database Schema** - Migration adds AI fields and transaction_patterns table
✅ **Complete Documentation** - 5 detailed guides provided

## Files Changed

| File | Change | Lines |
|------|--------|-------|
| `client/types/index.ts` | Add 7 fields to Transaction | +7 |
| `client/pages/ReviewQueue.tsx` | Complete rewrite | 806 |
| `supabase-migration-add-ai-fields.sql` | NEW: DB schema | 47 |
| `HITL_REVIEW_UPDATE.md` | NEW: Feature guide | 176 |
| `HITL_REVIEW_IMPLEMENTATION.md` | NEW: Technical docs | 278 |
| `HITL_REVIEW_DEPLOYMENT.md` | NEW: Deploy guide | 258 |
| `HITL_REVIEW_VISUAL_GUIDE.md` | NEW: UI reference | 467 |
| `HITL_QUICK_START.md` | NEW: This file | - |

## Quick Setup (3 Steps)

### 1. Apply Database Migration
```sql
-- Copy content of supabase-migration-add-ai-fields.sql
-- Paste into Supabase SQL Editor
-- Execute

-- Or use CLI:
supabase db push
```

### 2. Deploy Code
```bash
# Code already in place:
# - client/types/index.ts (updated)
# - client/pages/ReviewQueue.tsx (replaced)

# Build and deploy
pnpm run build
# Deploy to your hosting
```

### 3. Test
```
Navigate to: http://localhost:8080/review-queue
(or your deployed URL)

Should see:
✓ Transaction card
✓ AI suggestion (if ai_reasoning present)
✓ Category dropdown
✓ Vendor selection (for contractor categories)
✓ Notes textarea
✓ Skip/Save buttons
```

## Feature Overview

### What Users See

```
1. Transaction Card
   ├─ Date, Description, Amount
   ├─ AI Suggestion (with confidence)
   └─ Accept Suggestion button

2. Decision Form
   ├─ Category dropdown (required)
   ├─ Vendor selection (if contractor)
   │  ├─ Option: Regular vendor (from database)
   │  ├─ Option: One-time payment (no tracking)
   │  └─ Option: New vendor (create on save)
   ├─ Notes textarea (optional)
   └─ "Why different?" textarea (if category differs from AI)

3. Action Buttons
   ├─ Skip → Move to next transaction
   └─ Approve & Save → Save and advance
```

### Accept Suggestion Button
- ✅ Auto-fills category with AI's suggestion
- ✅ Clears "why different?" field
- ✅ One-click workflow

### Vendor Selection Logic
- **Regular Vendor**: Pick from existing active vendors
- **One-Time Payment**: Skip vendor tracking
- **New Vendor**: Create inline (name + type + offshore + country)

### Form Validation
```
Required:
├─ Category (always)
├─ Vendor (if regular vendor selected)
└─ Name & Type (if new vendor selected)

Optional:
├─ Notes
└─ Why different?
```

## Database Changes

### New Transaction Fields
```typescript
payee_normalized?: string      // For pattern matching
vendor_id?: string             // Vendor reference
status?: 'pending'|'categorized'|'approved'
ai_reasoning?: string          // Claude's explanation
ai_confidence_score?: 0-100    // Confidence %
human_notes?: string           // User's notes
human_decision_reason?: string // Why user chose differently
```

### New Table: transaction_patterns
```sql
CREATE TABLE transaction_patterns (
  payee_pattern TEXT,
  category_id UUID,
  vendor_id UUID,
  contractor_type TEXT,
  reasoning TEXT,
  confidence_score INT (default 100),
  -- ... more fields
)
```

## Key Components

### ReviewQueue.tsx State
```typescript
// Current transaction
const [currentTransaction]

// Form fields
const [selectedCategoryId]
const [vendorType]               // "regular"|"one-time"|"new"
const [selectedVendorId]
const [newVendorName]
const [selectedContractorType]
const [isOffshore]
const [selectedCountry]
const [userNotes]
const [reasonForChange]
const [searchVendor]

// Data
const [categories]
const [vendors]
const [transactions]
```

### Core Functions
```typescript
// Fetch all required data
const fetchData = () => {
  // Load categories, vendors, bank accounts, transactions
}

// Save transaction with validation
const handleApprove = async () => {
  // 1. Validate form
  // 2. Create vendor (if new)
  // 3. Update transaction
  // 4. Save to patterns
  // 5. Load next
}

// Move to next without saving
const handleReject = () => {
  // Move to next transaction
}

// Show "why different?" only when needed
const isShowReasonField = 
  selectedCategoryId && 
  selectedCategoryId !== currentTransaction.category_id
```

## Styling Reference

```tailwind
// AI Suggestion Section
bg-blue-50 dark:bg-blue-950
border border-blue-200 dark:border-blue-800

// Vendor Section
bg-muted rounded-lg p-4

// Confidence Badges
- High: bg-green-100 text-green-800
- Medium: bg-yellow-100 text-yellow-800
- Low: bg-red-100 text-red-800

// Buttons
- Accept: bg-green-600 hover:bg-green-700
- Approve: bg-primary hover:bg-primary/90
- Skip: variant="outline"
```

## Common Tasks

### Adding Test Data
```sql
-- Add test vendors
INSERT INTO vendors (legal_name, category, status, is_active)
VALUES 
  ('Acme Translation', 'Language Vendor', 'Active', true),
  ('Big Blue Solutions', 'IT/Development', 'Active', true);

-- Add test transaction
INSERT INTO transactions 
  (date, description, amount, bank_account_id, needs_review,
   ai_reasoning, ai_confidence_score)
VALUES 
  (NOW(), 'Translation Service', 1250.00, 'account-id', true,
   'Payment to translation service based on vendor name', 92);
```

### Checking Saved Data
```sql
-- View reviewed transactions
SELECT id, category_id, vendor_id, status, human_notes
FROM transactions
WHERE needs_review = false;

-- View patterns
SELECT payee_pattern, category_id, vendor_id, confidence_score
FROM transaction_patterns
ORDER BY created_at DESC;
```

### Debugging
```typescript
// Check component state (in browser console)
localStorage.getItem('transaction_state')

// Check database (Supabase dashboard)
SELECT * FROM transactions WHERE id = 'transaction-id'
SELECT * FROM transaction_patterns LIMIT 10
```

## Troubleshooting

### Page Won't Load
```
❌ Check: User logged in
❌ Check: /review-queue route exists
❌ Check: ReviewQueue.tsx file saved
✓ Try: Clear browser cache and reload
```

### No Transactions Showing
```
❌ Check: needs_review = true in database
❌ Check: Query returns results
✓ Try: Add test data with needs_review = true
```

### Vendor Dropdown Empty
```
❌ Check: Vendors exist with is_active = true
❌ Check: Vendor table has data
✓ Try: Insert test vendors
```

### Form Won't Submit
```
❌ Check: All required fields filled
❌ Check: No console errors
✓ Try: Refresh page and retry
```

### AI Suggestion Not Showing
```
❌ Check: ai_reasoning field populated
❌ Check: Value is not null
✓ Try: Add sample ai_reasoning to transaction
```

## Performance Tips

- ✅ Vendors fetched once on mount
- ✅ Vendor search is client-side (no API calls)
- ✅ One transaction at a time
- ✅ Indexes added to frequently queried columns
- ✅ RLS policies optimized

## Security Checklist

- ✅ User authentication required
- ✅ User ID recorded in reviewed_by
- ✅ RLS policies on transaction_patterns
- ✅ No sensitive data in errors
- ✅ Input validation before save

## Testing Checklist

Basic Flow:
- [ ] Navigate to /review-queue
- [ ] See transaction card
- [ ] Read AI suggestion
- [ ] Select category
- [ ] Save transaction
- [ ] Next transaction loads

Vendor Selection:
- [ ] Regular vendor: search and select
- [ ] One-time: vendor section hidden
- [ ] New vendor: form appears and saves

Validation:
- [ ] Can't save without category
- [ ] Can't save with invalid vendor
- [ ] Error messages appear
- [ ] Form stays open on error

## Documentation Map

Start with these files in order:

1. **HITL_QUICK_START.md** ← You are here
   Quick overview and setup

2. **HITL_REVIEW_UPDATE.md**
   Feature guide and usage

3. **HITL_REVIEW_VISUAL_GUIDE.md**
   UI layouts and interactions

4. **HITL_REVIEW_IMPLEMENTATION.md**
   Technical implementation details

5. **HITL_REVIEW_DEPLOYMENT.md**
   Deployment and testing

6. **HITL_REVIEW_COMPLETE.md**
   Complete overview and architecture

## Need Help?

### Check Documentation
- UI questions → HITL_REVIEW_VISUAL_GUIDE.md
- How to use → HITL_REVIEW_UPDATE.md
- Implementation → HITL_REVIEW_IMPLEMENTATION.md
- Setup issues → HITL_REVIEW_DEPLOYMENT.md

### Check Database
```sql
-- Verify migration applied
\d transactions  -- See new columns
\d transaction_patterns  -- See new table

-- Check for errors
SELECT * FROM transaction_patterns LIMIT 1;
SELECT * FROM transactions WHERE ai_reasoning IS NOT NULL LIMIT 1;
```

### Check Code
- ReviewQueue.tsx (806 lines)
- client/types/index.ts (Transaction interface)
- Check browser console for errors

## Next Steps

1. Apply database migration
2. Deploy code
3. Add test data with ai_reasoning
4. Test workflow end-to-end
5. Monitor for issues
6. Gather user feedback
7. Plan enhancements

## Future Enhancements

- [ ] Payee normalization
- [ ] Pattern matching auto-categorization
- [ ] Bulk operations
- [ ] Undo functionality
- [ ] Analytics dashboard
- [ ] Team pattern sharing

---

**Ready to go!** Follow the 3-step setup above to get started.

Questions? See the full documentation files.
