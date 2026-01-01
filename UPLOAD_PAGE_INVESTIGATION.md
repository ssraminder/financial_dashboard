# Upload Page Investigation Results

## 1. File Structure

### Primary Component
- **Path**: `client/pages/Upload.tsx`
- **Size**: ~1,800+ lines
- **Type**: Standalone page component (no child components)

### Child Components
- **None** - All functionality is contained within Upload.tsx
- Uses shared UI components from `@/components/ui/`:
  - Card, CardHeader, CardTitle, CardContent
  - Button
  - Select, SelectContent, SelectItem, SelectTrigger, SelectValue
  - Alert, AlertDescription
  - Custom StatusStep component (defined inline in file)
  - Custom StatCard component (defined inline in file)

### Imported Utilities & Hooks
- `useAuth()` from `@/hooks/useAuth` - authentication
- `useNavigate()` from `react-router-dom` - navigation
- `supabase` from `@/lib/supabase` - database client
- Icon library: `lucide-react` (20+ icons used)

### Shared Styling
- Tailwind CSS (inline classes only)
- No separate CSS files
- Uses component library from `shadcn/ui`

---

## 2. State Variables

| Variable | Type | Purpose |
|----------|------|---------|
| `bankAccounts` | `BankAccount[]` | List of bank accounts for selection |
| `selectedFile` | `File \| null` | Currently selected PDF file |
| `selectedBankAccountId` | `string` | Selected bank account UUID |
| `loading` | `boolean` | Master loading flag for upload/process |
| `loadingAccounts` | `boolean` | Bank accounts fetch loading state |
| `dragActive` | `boolean` | Drag and drop zone active state |
| `error` | `string \| null` | General error messages |
| `result` | `ParseStatementResult \| null` | Final API response with summary |
| `balanceError` | `Record<string, unknown> \| null` | Balance mismatch error details |
| `uploadStage` | `"idle" \| "uploading" \| "processing" \| "complete" \| "error"` | Progress stage tracker |
| `statusMessage` | `string` | Current status message for UI |
| `statusDetail` | `string` | Detailed status info |
| `editableTransactions` | `Array<{...}>` | Suspect transactions for balance correction |
| `isRevalidating` | `boolean` | Resubmission with corrections in progress |
| `parsedData` | `Record<string, unknown> \| null` | Full API response (kept for review screen) |
| `allTransactions` | `Array<{...}>` | All transactions from parsed statement |
| `isReviewing` | `boolean` | Review screen active state |
| `isSaving` | `boolean` | Save confirmation in progress |
| `editingIndex` | `number \| null` | Currently edited transaction index |
| `editAmount` | `string` | Temporary amount being edited |

**Total State Variables**: 19 pieces of state

---

## 3. Current Data Flow

### Step-by-Step Process

1. **Page Load**
   - Fetch bank accounts from Supabase (`bank_accounts` table)
   - Display dropdown selector

2. **File Selection**
   - User drags PDF or clicks to browse
   - Validate file type (PDF only)
   - Validate file size (max 10MB)
   - Store in `selectedFile` state

3. **Account Selection**
   - User selects bank account from dropdown
   - Store UUID in `selectedBankAccountId`

4. **Upload & Parse**
   - User clicks "Process Statement"
   - Create FormData with file + bank_account_id
   - POST to `parse-statement` Edge Function
   - Set `uploadStage` → "uploading" → "processing"

5. **API Processing**
   - Edge Function parses PDF
   - Extracts transactions and account info
   - Validates opening + credits - debits = closing
   - Returns `ParseStatementResult`

6. **Branch: Balance Mismatch**
   - If `error === "BALANCE_MISMATCH"`
   - Show error UI with suspect transactions
   - User can toggle transaction type or edit amounts
   - Create corrections array
   - POST to `parse-statement` again with corrections

7. **Branch: Success with Review**
   - If `action === "review"` (default for bank accounts)
   - Store response in `parsedData`
   - Set `isReviewing = true`
   - Show transaction review table
   - User can edit amounts (double-click) or toggle type (click button)

8. **Confirm & Save**
   - User clicks "Confirm & Save"
   - Create new FormData with:
     - `action: "save"`
     - `transactions` (JSON array)
     - `account_info`
     - `file_name`
     - `bank_account_id`
   - POST to `parse-statement` with save action
   - Set `uploadStage` → "complete"

9. **Success Display**
   - Show summary stats (transaction count, credits, debits)
   - Display account info and period
   - Offer navigation options:
     - "View Transactions" → `/transactions`
     - "Review Items" → `/review-queue` (if HITL items exist)
     - "Upload Another" → Reset form

10. **Reset**
    - Clear all state
    - Return to upload form

---

## 4. API Integration

### Endpoint Details

**URL**: `https://llxlkawdmuwsothxaada.supabase.co/functions/v1/parse-statement`

**Method**: POST

**Protocol**: FormData (multipart/form-data)

### Request Payloads

#### Request 1: Initial Parse
```javascript
const formData = new FormData();
formData.append("file", selectedFile);                    // File object
formData.append("bank_account_id", selectedBankAccountId); // UUID string
```

#### Request 2: Resubmit with Corrections
```javascript
const formData = new FormData();
formData.append("file", selectedFile);
formData.append("bank_account_id", selectedBankAccountId);
formData.append("corrections", JSON.stringify([
  {
    description: string,
    date: string,
    amount: number,
    corrected_type: "credit" | "debit"
  }
]));
```

#### Request 3: Save Transactions
```javascript
const formData = new FormData();
formData.append("bank_account_id", selectedBankAccountId);
formData.append("action", "save");
formData.append("transactions", JSON.stringify([
  {
    date: string,
    posting_date?: string,
    description: string,
    amount: number,
    type: "credit" | "debit",
    category_code?: string,
    payee_name?: string,
    has_gst?: boolean,
    gst_amount?: number,
    needs_review?: boolean,
    review_reason?: string,
    was_edited: boolean
  }
]));
formData.append("account_info", JSON.stringify({...}));
formData.append("file_name", selectedFile.name);
```

### Response Format

```typescript
interface ParseStatementResult {
  success: boolean;
  action?: "review" | "save";
  status?: "balanced" | "unbalanced" | "no_balance_check";
  status_message?: string;
  transactions?: Array<{
    date: string;
    posting_date?: string;
    description: string;
    amount: number;
    type: "credit" | "debit";
    category_code?: string;
    payee_name?: string;
    has_gst?: boolean;
    gst_amount?: number;
    needs_review?: boolean;
    review_reason?: string;
    running_balance?: number;
    is_credit_card?: boolean;
    is_suspect?: boolean;
  }>;
  account_info?: {
    account_holder: string;
    account_number: string;
    statement_period: string;
    opening_balance: number;
    closing_balance: number;
    currency: string;
  };
  summary?: {
    total_credits: number;
    total_debits: number;
    transaction_count: number;
    hitl_count: number;
    inserted_count: number;
  };
  bank_account?: {
    id: string;
    name: string;
    company: string;
  };
  error?: string;
}
```

### Three API Calls
1. **Parse**: Initial file upload and parse
2. **Revalidate**: With corrections for balance mismatch
3. **Save**: Persist transactions to database

---

## 5. Navigation & Routing

### Current Route
- **Upload Page URL**: `/upload` (inferred from file location)
- **Sidebar integration**: Yes (Sidebar component displayed)

### Post-Upload Navigation
- **Success Path 1**: `/transactions` (View all transactions)
- **Success Path 2**: `/review-queue` (If HITL items exist)
- **Reset Option**: Stay on `/upload` with cleared form

### Query Parameters
- **Current**: None
- **Potential Enhancement**: Could use `?account={id}` to pre-select account

---

## 6. Dependencies on Other Pages

### ViewStatements.tsx
- **Shared Interfaces**:
  ```typescript
  interface BankAccount {
    id: string;
    name: string;
    account_number?: string;
    company_id: string;
    bank_name: string;
    currency: string;
    is_active?: boolean;
  }
  
  interface Statement {
    id: string;
    bank_account_id: string;
    file_name: string;
    uploaded_at: string;
    statement_period: string;
    status: string;
  }
  
  interface Category {
    id: string;
    code: string;
    name: string;
  }
  
  interface Transaction {
    id: string;
    date: string;
    posting_date?: string;
    description: string;
    amount: number;
    type: "credit" | "debit";
    category_id: string | null;
    category?: Category;
    bank_account_id: string;
    has_gst?: boolean;
    gst_amount?: number;
  }
  ```
- **Shared Database Queries**: Uses same `bank_accounts` table
- **Expected Data Format**: ViewStatements expects transactions already in database (not from Upload)

### ReviewQueue.tsx (Review Queue page)
- **Expected Data**: Fetches directly from Supabase tables, not from Upload state
- **No direct dependency**: ReviewQueue loads its own data
- **Connection**: Upload navigates to ReviewQueue after successful import with HITL items
- **Expected Format**: Transactions with `needs_review: true`

### Transactions Page
- **Expected Data**: Transactions already persisted in database
- **No direct dependency**: Fetches fresh data from Supabase

---

## 7. Current Limitations

### Multi-File Handling
- **Current Status**: ❌ No multi-file support
- **Current Pattern**: 
  ```javascript
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  ```
- **Upload method**: Single file only via drag & drop or file input

### Batch Processing
- **Current Status**: ❌ No batch processing
- **Architecture**: Sequential: 1 file → parse → review → save
- **No queue**: Each upload requires manual confirmation

### Auto-Save
- **Current Status**: ❌ Manual review required
- **Required Review**: Even when balance is perfect, review screen shows
- **Action**: User must click "Confirm & Save"

### Error Handling per File
- **Current Status**: ❌ Fails on first error
- **Behavior**: 
  - Balance mismatch → stops, shows corrections UI
  - Parsing error → stops, shows error message
  - No continue-on-error for duplicates

### UI State Management
- **Reset Pattern**: Manual form reset required
- **No persistence**: No draft saving or recovery
- **State clearing**: All edits lost if user navigates away

### Comments and TODOs
- **None found** in current code
- **Debug logs**: Console.log statements present for transaction values

---

## 8. Styling

### Method
- **Primary**: Tailwind CSS (inline classes)
- **No CSS modules or external files**
- **Icons**: `lucide-react` (20+ icons throughout)

### Custom Components (Inline)

#### StatusStep Component
```typescript
interface StatusStepProps {
  step: number;
  label: string;
  status: "pending" | "active" | "complete" | "error";
  detail?: string;
  isRetry?: boolean;
}
```
- Shows progress with icons and spinner
- Color-coded by status (gray, blue, green, red)
- Used in processing status display

#### StatCard Component
```typescript
interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  highlight?: boolean;
  color?: "green" | "orange" | "blue" | "purple";
}
```
- Display stats with background color
- Icon on right side
- Optional highlight ring
- Used for summary display

### Animations & Transitions
- **Loading spinner**: `animate-spin` on Loader2 icon
- **Drag active**: Border color transition on drag zone
- **Button hover**: Scale, color changes
- **Smooth transitions**: Used on drag zone and editable fields

### Layout Patterns
- **Card-based**: Main sections in Card components
- **Grid layouts**: 2-3 column grids for stats
- **Responsive**: `grid-cols-2 md:grid-cols-3` patterns
- **Full height layout**: Flex with sidebar + main content

---

## Key Takeaways for Multi-File Implementation

### 1. State Structure
- Current: Single `selectedFile: File | null`
- Needed: `selectedFiles: File[]` + file queue management
- Needed: Per-file status tracking

### 2. API Contract
- Currently: 3 separate POST calls
- Multi-file: Would need to handle parallel or sequential calls
- Save payload: Already supports array of transactions

### 3. Component Architecture
- No child components means changes are isolated to this one file
- Large file (1,800+ lines) - consider extracting StatusStep and StatCard if expanding

### 4. Navigation Impact
- Current: Single result, single navigation
- Needed: Batch results, aggregate summary before navigation

### 5. UI/UX Considerations
- Current: Processing status shown during upload
- Needed: File queue display with per-file progress
- Current: Manual review required
- Impact: Could auto-save if review states allow

### 6. Error Handling
- Current: Fail-on-error model
- Needed: Continue-on-error with error collection
- Current: Show corrections dialog for balance issues
- Impact: Multiple balance errors from multiple files?

### 7. Database Integration
- Current: Single `bank_accounts` fetch on mount
- No impact expected for multi-file
- Statement table: May need to track multiple file imports in single session

---

## Data Type References

### BankAccount
```typescript
interface BankAccount {
  id: string;
  name: string;
  account_number?: string;
  company_id: string;
  bank_name: string;
  currency: string;
  is_active?: boolean;
}
```

### Transaction (from API response)
```typescript
{
  date: string;                    // YYYY-MM-DD
  posting_date?: string;
  description: string;             // Payee/description
  amount: number;                  // Positive decimal
  type: "credit" | "debit";
  category_code?: string;          // e.g., "office_expense"
  payee_name?: string;
  has_gst?: boolean;
  gst_amount?: number;
  needs_review?: boolean;
  review_reason?: string;
  running_balance?: number;        // Calculated from opening + transactions
  is_credit_card?: boolean;        // For no_balance_check accounts
  is_suspect?: boolean;            // Flagged by balance validation
}
```

---

**Report Date**: 2025-01-09  
**File Version**: Current (Upload.tsx ~1,800 lines)  
**Status**: Ready for multi-file implementation planning
