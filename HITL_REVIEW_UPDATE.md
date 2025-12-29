# HITL Review Queue Update

## Overview

The HITL (Human-in-the-Loop) Review Queue has been completely redesigned to display AI suggestions and allow for intelligent vendor/client selection during transaction categorization.

## What's New

### 1. AI Suggestion Display

Each transaction now shows:

- **Confidence Badge**: Visual indicator of AI confidence level
  - 🟢 Green (85-100%) = High Confidence
  - 🟡 Yellow (70-84%) = Medium Confidence
  - 🔴 Red (0-69%) = Low Confidence
- **AI Reasoning**: Claude's explanation for the suggested category
- **Accept Suggestion Button**: Quick-fill button to use AI's category choice

### 2. Enhanced Decision Making

Users can now:

- View transaction details in a card-based layout
- See AI reasoning before making a decision
- Accept or override AI suggestions
- Add notes about the transaction
- Explain why they chose a different category

### 3. Vendor/Client Selection

For contractor or professional services payments:

#### Regular Vendor

- Select from existing active vendors in the database
- Search vendors by name
- Track for taxes and future reporting

#### One-Time Payment

- No vendor association
- For one-off payments that shouldn't be tracked

#### New Vendor

- Create vendor on-the-fly during transaction review
- Required fields:
  - Vendor name
  - Contractor type (Language Vendor, Legal, Accounting, etc.)
  - Offshore status (checkbox)
  - Country (defaults to Canada)
- Vendor is automatically added to the database

### 4. Knowledge Base Integration

All reviewed transactions are saved to the `transaction_patterns` table:

- Pattern matching on normalized payee names
- Category associations with confidence scores
- Vendor relationships
- User reasoning and notes
- Future AI improvements from user feedback

## Database Changes

### New Columns on Transactions Table

```sql
- payee_normalized TEXT          -- Normalized payee for pattern matching
- vendor_id UUID               -- Reference to vendors table
- status TEXT                  -- pending, categorized, or approved
- ai_reasoning TEXT            -- Claude's explanation
- ai_confidence_score INT      -- 0-100 confidence level
- human_notes TEXT             -- User's notes about the transaction
- human_decision_reason TEXT   -- Why user chose differently from AI
```

### New Table: transaction_patterns

Knowledge base for ML improvements:

```sql
CREATE TABLE transaction_patterns (
  id UUID PRIMARY KEY,
  payee_pattern TEXT NOT NULL,
  category_id UUID NOT NULL,
  vendor_id UUID,
  contractor_type TEXT,
  reasoning TEXT,
  notes TEXT,
  confidence_score INT (default 100),
  frequency INT (default 1),
  last_matched_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Usage Workflow

1. **View Transaction**: Card shows transaction details and AI suggestion
2. **Review AI Suggestion**: Read confidence level and reasoning
3. **Make Decision**:
   - Click "Accept Suggestion" to use AI's category, OR
   - Select a different category from dropdown
4. **Add Context**:
   - Add notes about the transaction (optional)
   - Explain why you chose differently (optional, if different from AI)
5. **Select Vendor** (if contractor payment):
   - Regular Vendor: Search and select from existing vendors
   - One-Time: Skip vendor tracking
   - New Vendor: Create vendor with details
6. **Save**: Click "Approve & Save" to:
   - Update transaction status
   - Create vendor if new
   - Save to transaction patterns (knowledge base)
   - Move to next transaction

## Contractor Types Available

When creating a new vendor during transaction review:

- Language Vendor
- Offshore Employee
- Legal
- Accounting
- Consulting
- IT/Development
- Design
- Trades
- Cleaning/Maintenance
- Virtual Assistant
- Other

## Setup Required

Before using the HITL Review Queue with AI suggestions:

1. **Run Migration**:

   ```bash
   # Apply the migration to your Supabase project
   supabase migration up supabase-migration-add-ai-fields.sql
   ```

2. **Verify Vendors Table**: Ensure vendors are properly set up
   - See VENDORS_SETUP_GUIDE.md for vendor table setup

3. **Verify Categories**: Categories must exist in database
   - Create contractor/professional services categories if not present

## Database Schema Relationship

```
transactions (main)
├── category_id → categories
├── vendor_id → vendors (NEW)
├── company_id → companies
├── bank_account_id → bank_accounts
└── reviewed_by → auth.users

transaction_patterns (NEW knowledge base)
├── category_id → categories
└── vendor_id → vendors
```

## Future Improvements

This structure enables:

- Pattern-based auto-categorization
- Vendor relationship tracking
- ML training on user corrections
- Payee normalization for better matching
- Confidence score improvements over time
- Team learning from collective decisions

## Notes

- The "Why different from AI?" field only appears when you select a category different from the AI suggestion
- Skip button allows moving to next transaction without categorizing current one
- All decisions are recorded for future AI model improvements
- Vendor creation is instant and doesn't require separate database access
