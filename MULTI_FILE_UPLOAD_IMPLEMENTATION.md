# Multi-File Upload Implementation Prompt

## Executive Summary

**Scope**: Full replacement of `client/pages/Upload.tsx`

**Confidence Level**: HIGH - Investigation confirmed:

- ✅ No shared child components to break
- ✅ Same API endpoint (`parse-statement`)
- ✅ Same FormData structure
- ✅ ReviewQueue independent of Upload state
- ✅ Navigation paths confirmed

**Timeline Estimate**: 2-4 hours (full file replacement)

---

## Current → New Comparison

| Aspect           | Current                         | New                                  |
| ---------------- | ------------------------------- | ------------------------------------ |
| File selection   | Single PDF                      | Multiple PDF/CSV                     |
| File input       | `accept=".pdf"`                 | `accept=".pdf,.csv" multiple`        |
| Processing       | Parse → Review → Confirm → Save | Parse → Auto-Save (sequential)       |
| Review step      | Required UI table               | Removed (use ViewStatements instead) |
| Error handling   | Stops on first error            | Continue, show summary               |
| State complexity | 19 variables (large)            | ~6-8 variables (simplified)          |
| Expected outcome | Single result                   | Batch results with per-file status   |

---

## New State Structure

### Remove These Variables

Delete the following 8 state variables (they're no longer needed):

- `selectedFile: File | null`
- `isReviewing: boolean`
- `allTransactions: Array<...>`
- `editableTransactions: Array<...>`
- `editingIndex: number | null`
- `editAmount: string`
- `balanceError: Record<string, unknown> | null`
- `parsedData: Record<string, unknown> | null`

### Add These Variables

```typescript
interface QueuedFile {
  id: string; // UUID for tracking
  file: File; // Actual File object
  name: string; // File name (e.g., "RBC_Nov_2025.pdf")
  size: number; // File size in bytes
  type: "pdf" | "csv"; // File type detected from extension
  status: "queued" | "parsing" | "saving" | "success" | "error";
  result?: {
    // Set when status = "success"
    statement_import_id: string; // ID from API response
    period: string; // e.g., "Nov 3 - Dec 1, 2025"
    transaction_count: number; // How many transactions parsed
    kb_matches: number; // KB auto-categorized count
    hitl_count: number; // HITL (needs review) count
  };
  error?: {
    // Set when status = "error"
    code: string; // e.g., "DUPLICATE_STATEMENT"
    message: string; // User-facing message
  };
}

// New state variables
const [files, setFiles] = useState<QueuedFile[]>([]);
const [phase, setPhase] = useState<"select" | "processing" | "complete">(
  "select",
);
const [currentIndex, setCurrentIndex] = useState(0);

// Keep these from current implementation
const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>("");
const [loadingAccounts, setLoadingAccounts] = useState(true);
const [error, setError] = useState<string | null>(null);
```

---

## UI Phases

### Phase 1: Select Files

**Shown when**: `phase === "select"`

**Layout**:

```
┌─────────────────────────────────────────────────────┐
│  Upload Bank Statements                              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Bank Account * [Dropdown - required]                │
│  (Must be selected before upload)                    │
│                                                      │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐    │
│  │  📄 Drag & drop PDF or CSV files here       │    │
│  │     or click to browse (select multiple)   │    │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘    │
│                                                      │
│  Queued Files (3)                    [Clear All]     │
│  ┌─────────────────────────────────────────────┐    │
│  │ 📄 RBC_Nov_2025.pdf    1.2 MB   ⏳ Queued ✕ │    │
│  │ 📄 RBC_Oct_2025.pdf    0.9 MB   ⏳ Queued ✕ │    │
│  │ 📄 RBC_Sep_2025.csv    0.1 MB   ⏳ Queued ✕ │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  [Upload 3 Files] (disabled if files.length === 0)  │
└─────────────────────────────────────────────────────┘
```

**Components**:

1. Bank account dropdown (required)
2. Drag & drop zone (multiple file acceptance)
3. File queue list (with remove button per file)
4. "Clear All" button
5. "Upload X Files" button

**Behavior**:

- File input accepts `.pdf` and `.csv` files
- Multiple selection allowed
- Validate each file on add
- Show error toast for invalid files
- Display file name, size, and status

### Phase 2: Processing (Sequential)

**Shown when**: `phase === "processing"`

**Layout**:

```
┌─────────────────────────────────────────────────────┐
│  Processing Statements (2/3)                         │
│  Please don't close this page while processing...    │
├─────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────┐    │
│  │ ✅ RBC_Nov_2025.pdf                          │    │
│  │    Nov 3 - Dec 1, 2025 • 55 txns • 7 KB ...  │    │
│  ├─────────────────────────────────────────────┤    │
│  │ 🔄 RBC_Oct_2025.pdf       [Parsing...]       │    │
│  │    (spinner animation)                        │    │
│  ├─────────────────────────────────────────────┤    │
│  │ ⏳ RBC_Sep_2025.csv       Queued             │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  Progress: 2 of 3 files complete                     │
└─────────────────────────────────────────────────────┘
```

**Components**:

1. File list with status indicators
   - ✅ Complete (green checkmark)
   - 🔄 Processing (spinner)
   - ⏳ Queued (hourglass)
   - ❌ Error (red X)
2. Per-file details (period, txn count, KB matches, HITL count)
3. Progress counter (X of Y files)
4. Warning message (don't close page)

**Behavior**:

- Process files sequentially (one at a time)
- Update status as each file progresses
- Show current index: `(currentIndex + 1)/${files.length}`
- Update results when parse succeeds
- Update error when parse fails (but continue to next)
- No page navigation during processing

### Phase 3: Complete

**Shown when**: `phase === "complete"`

**Layout**:

```
┌─────────────────────────────────────────────────────┐
│  ✅ Upload Complete                                  │
├─────────────────────────────────────────────────────┤
│  ┌──────────┬──────────┬──────────┬──────────┐     │
│  │ ✅ 2     │ ❌ 1     │ 📊 127   │ ⚠️ 24    │     │
│  │Succeeded │ Failed   │ Txns     │ Review   │     │
│  └──────────┴──────────┴──────────┴──────────┘     │
│                                                      │
│  Results:                                            │
│  ┌─────────────────────────────────────────────┐    │
│  │ ✅ RBC_Nov_2025.pdf                   [View] │    │
│  │    Nov 3 - Dec 1, 2025 • 55 transactions     │    │
│  ├─────────────────────────────────────────────┤    │
│  │ ❌ RBC_Oct_2025.pdf                          │    │
│  │    ⚠️ Duplicate: Already imported Dec 15     │    │
│  ├─────────────────────────────────────────────┤    │
│  │ ✅ RBC_Sep_2025.csv                   [View] │    │
│  │    Sep 2 - Oct 1, 2025 • 72 transactions     │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  [Upload More] [Go to Review Queue] (conditional)   │
└─────────────────────────────────────────────────────┘
```

**Components**:

1. Summary stats grid (4 cards: succeeded, failed, total txns, total HITL)
2. Results list per file:
   - Success: file name, period, transaction count, [View] button
   - Error: file name, error message with icon
3. Action buttons:
   - "Upload More" (always shown)
   - "Go to Review Queue" (only if any file has hitl_count > 0)

**Behavior**:

- Show summary stats (count of succeeded, failed, totals)
- Per-file detail cards with status icon
- Success files show: period + txn count + [View] link
- Error files show: error code/message + icon
- [View] navigates to statement detail page
- [Go to Review Queue] shown if any HITL items

---

## Processing Logic (Core Algorithm)

```typescript
const processFiles = async () => {
  setPhase("processing");

  for (let i = 0; i < files.length; i++) {
    setCurrentIndex(i);
    const file = files[i];

    // Step 1: Update to "parsing" status
    updateFileStatus(file.id, "parsing");

    try {
      // Step 1a: Parse the file
      const parseFormData = new FormData();
      parseFormData.append("file", file.file);
      parseFormData.append("bank_account_id", selectedBankAccountId);
      parseFormData.append("action", "parse");

      const parseResponse = await fetch(
        "https://llxlkawdmuwsothxaada.supabase.co/functions/v1/parse-statement",
        {
          method: "POST",
          body: parseFormData,
        },
      );

      const parseResult = await parseResponse.json();

      // Check for parse errors (stop this file, continue to next)
      if (!parseResult.success) {
        updateFileStatus(file.id, "error", {
          code: parseResult.error || "PARSE_ERROR",
          message: getErrorMessage(parseResult.error),
        });
        continue; // Move to next file
      }

      // Step 1b: Auto-save transactions
      updateFileStatus(file.id, "saving");

      const saveFormData = new FormData();
      saveFormData.append("action", "save");
      saveFormData.append("bank_account_id", selectedBankAccountId);
      saveFormData.append(
        "transactions",
        JSON.stringify(parseResult.transactions || []),
      );
      saveFormData.append(
        "account_info",
        JSON.stringify(parseResult.account_info || {}),
      );
      saveFormData.append("file_name", file.name);

      const saveResponse = await fetch(
        "https://llxlkawdmuwsothxaada.supabase.co/functions/v1/parse-statement",
        {
          method: "POST",
          body: saveFormData,
        },
      );

      const saveResult = await saveResponse.json();

      // Check for save errors
      if (!saveResult.success && !saveResult.inserted_count) {
        updateFileStatus(file.id, "error", {
          code: saveResult.error || "SAVE_ERROR",
          message: getErrorMessage(saveResult.error),
        });
        continue;
      }

      // Success: Update status with results
      updateFileStatus(file.id, "success", null, {
        statement_import_id: saveResult.statement_import_id || generateId(),
        period: parseResult.account_info?.statement_period || "Unknown",
        transaction_count:
          saveResult.inserted_count || parseResult.transactions?.length || 0,
        kb_matches:
          parseResult.summary?.transaction_count ||
          0 - (parseResult.summary?.hitl_count || 0),
        hitl_count: parseResult.summary?.hitl_count || 0,
      });
    } catch (err) {
      // Network or unexpected error
      updateFileStatus(file.id, "error", {
        code: "ERROR",
        message: err instanceof Error ? err.message : "Connection error",
      });
      // Continue with next file
    }
  }

  // All files processed
  setPhase("complete");
};
```

### Helper Function: updateFileStatus

```typescript
const updateFileStatus = (
  fileId: string,
  status: QueuedFile["status"],
  error?: QueuedFile["error"] | null,
  result?: QueuedFile["result"],
) => {
  setFiles((prev) =>
    prev.map((f) =>
      f.id === fileId ? { ...f, status, error: error || undefined, result } : f,
    ),
  );
};
```

### Helper Function: getErrorMessage

```typescript
const getErrorMessage = (code: string): string => {
  const messages: Record<string, string> = {
    DUPLICATE_STATEMENT: "Already imported - appears to be a duplicate",
    ACCOUNT_MISMATCH: "Account number doesn't match the selected account",
    PARSE_ERROR: "Failed to parse the statement",
    SAVE_ERROR: "Failed to save transactions",
    ERROR: "An error occurred while processing",
  };
  return messages[code] || code;
};
```

---

## File Validation

```typescript
const addFiles = (newFiles: FileList) => {
  Array.from(newFiles).forEach((file) => {
    // Step 1: Check file extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "csv"].includes(ext || "")) {
      showErrorToast("Invalid file type. Please upload PDF or CSV files.");
      return;
    }

    // Step 2: Check file size (max 10MB)
    const maxSizeBytes = 10 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      showErrorToast(`File too large: ${file.name}. Maximum 10MB.`);
      return;
    }

    // Step 3: Check for duplicates in current queue
    if (files.some((f) => f.name === file.name && f.size === file.size)) {
      showErrorToast(`File already in queue: ${file.name}`);
      return;
    }

    // Step 4: Add to queue
    const newFile: QueuedFile = {
      id: `file_${Date.now()}_${Math.random()}`, // Simple unique ID
      file,
      name: file.name,
      size: file.size,
      type: ext as "pdf" | "csv",
      status: "queued",
    };

    setFiles((prev) => [...prev, newFile]);
  });
};
```

---

## Navigation

### Success Navigation Options

After upload completes (`phase === "complete"`), provide:

1. **[View] button per successful file**
   - Target: `/statements?account=${selectedBankAccountId}&statement=${result.statement_import_id}`
   - Only show if file status is "success"
   - Show as link in the result card
   - **Note**: ViewStatements.tsx will need query param support (add in post-implementation)

2. **[Go to Review Queue] button**
   - Target: `/review-queue` (correct route from App.tsx)
   - Only show if ANY file has `hitl_count > 0`
   - Show as secondary button below results

3. **[Upload More] button**
   - Action: Call `handleResetForm()`
   - Reset phase to "select"
   - Clear files array
   - Keep selected bank account
   - Always shown

### Reset Function

```typescript
const handleResetForm = () => {
  setFiles([]);
  setPhase("select");
  setCurrentIndex(0);
  setError(null);
  // Keep selectedBankAccountId (user might upload to same account)
};
```

---

## Error Messages (UX Copy)

| Error Code            | User Message                                                                                            | Severity |
| --------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| `DUPLICATE_STATEMENT` | "Already imported. This statement was imported on [DATE]"                                               | warning  |
| `ACCOUNT_MISMATCH`    | "Account mismatch. The statement is for account \*\*\*\*[LAST4], but you selected a different account." | error    |
| `PARSE_ERROR`         | "Failed to parse this statement. Please check the file format."                                         | error    |
| `SAVE_ERROR`          | "Failed to save transactions. Please try again."                                                        | error    |
| Network error         | "Connection error. Please check your internet and try again."                                           | error    |
| Invalid file type     | "Invalid file type. Please upload PDF or CSV files."                                                    | error    |
| File too large        | "File too large. Maximum 10MB allowed."                                                                 | error    |
| Duplicate in queue    | "File already in queue: {filename}"                                                                     | warning  |

---

## What to Remove

Completely delete these UI sections from current Upload.tsx:

1. **Transaction review table**
   - The entire `Review Transactions` card with grid layout
   - Opening/closing balance rows
   - Transaction rows with edit functionality
   - Status step display for balance checking

2. **Balance correction UI**
   - The `Are you sure you want to...` correction dialog
   - Editable transaction list for fixing balance mismatches
   - Amount/type toggle buttons
   - "Resubmit with Corrections" flow

3. **Confirm & Save buttons**
   - Remove from the review screen (entire screen gone)
   - No more manual confirmation step

4. **Custom inline components**
   - Delete `StatusStep` component
   - Delete `StatCard` component
   - (Or refactor for reuse in new UI)

5. **Form validation for balance**
   - Remove `isBalanced` checks
   - Remove `calculateNewBalance()` function
   - Remove `balanceError` related logic

---

## What to Keep

These elements are still needed:

1. **Bank account dropdown**
   - Same `BankAccount[]` structure
   - Same fetch logic
   - Same selection behavior

2. **Drag & drop zone**
   - Enhance to accept multiple files
   - Keep drag styling
   - Add file list below zone

3. **Tailwind CSS styling**
   - Same approach (inline classes)
   - Same color scheme
   - Same responsive patterns

4. **Edge Function endpoint**
   - Same URL: `parse-statement`
   - Same FormData structure
   - Same response schema

5. **Icons from lucide-react**
   - Use for file types (📄)
   - Use for status (✅ 🔄 ⏳ ❌)
   - Keep all existing icon imports

6. **Sidebar integration**
   - Keep `<Sidebar />` component
   - Same layout structure

---

## Implementation Checklist

After implementation, verify all items:

### File Selection & Queue

- [ ] Can select multiple PDF files at once
- [ ] Can select multiple CSV files at once
- [ ] Can mix PDF and CSV files in same upload
- [ ] File queue displays with name, size, type
- [ ] Can remove individual files from queue (✕ button)
- [ ] Can clear all files ("Clear All" button)
- [ ] Invalid files show error toast
- [ ] Duplicate files in queue show error toast
- [ ] Files too large show error toast

### Processing Flow

- [ ] "Upload X Files" button disabled if no files selected
- [ ] "Upload X Files" button shows correct count
- [ ] Processing phase shows progress (X/Y complete)
- [ ] Files process sequentially (not in parallel)
- [ ] Current file shows parsing status with spinner
- [ ] Completed files show success checkmark
- [ ] Queued files show hourglass icon
- [ ] Processing continues after duplicate error
- [ ] Processing continues after account mismatch error
- [ ] Processing continues after parse error
- [ ] Processing continues after save error

### Results Display

- [ ] Summary stats show correct counts
  - [ ] Succeeded count accurate
  - [ ] Failed count accurate
  - [ ] Total transactions sum is correct
  - [ ] Total HITL count is correct
- [ ] Success files show period (e.g., "Nov 3 - Dec 1, 2025")
- [ ] Success files show transaction count
- [ ] Failed files show error message (not just error code)
- [ ] [View] button only shows for success files
- [ ] [View] button links to correct statement detail page
- [ ] [Go to Review Queue] only shows if hitl_count > 0 for any file
- [ ] [Upload More] button always shown
- [ ] [Upload More] resets form properly

### Edge Cases

- [ ] Empty file selection (button disabled)
- [ ] Single file upload still works
- [ ] All files fail (show all errors, no success card)
- [ ] Mixed success/failure (show both in results)
- [ ] Network error during processing (graceful error)
- [ ] Very large statement (>1000 txns) parses correctly
- [ ] CSV file parsing works same as PDF
- [ ] Bank account dropdown still required for upload

### Navigation & Routing

- [ ] Correct URL structure for view links: `/statements?account=...&statement=...`
- [ ] Review Queue link correct: `/review-queue` (verified in App.tsx)
- [ ] [View] button navigates to statements with params
- [ ] [Go to Review Queue] button navigates to `/review-queue`
- [ ] No navigation during processing phase
- [ ] Back button disabled during processing
- [ ] Unload warning if try to close during processing

### UI/UX

- [ ] Mobile responsive (stack files on small screens)
- [ ] Animations smooth (no jank during processing)
- [ ] Spinner visible during file processing
- [ ] Status updates happen in real-time
- [ ] Warning message shown during processing
- [ ] Success screen accessible immediately after completion
- [ ] Error messages user-friendly (not technical codes)
- [ ] File sizes displayed in human-readable format (MB, KB)

### Code Quality

- [ ] No TypeScript errors
- [ ] No console errors/warnings
- [ ] No unused imports
- [ ] Proper error handling with try-catch
- [ ] Consistent code style with rest of project
- [ ] Comments on complex logic
- [ ] Helper functions extracted (not inline)

---

## Dependencies & Imports

### Keep These Imports

```typescript
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Sidebar } from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Loader2,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Package,
  Circle,
  XCircle,
} from "lucide-react";
```

### Remove These (if present)

```typescript
// Delete these if they were imported:
// RefreshCw, CreditCard, TrendingUp, ArrowRight (no longer used)
```

---

## Testing Data

### Test Scenario 1: Single File Success

- Upload 1 PDF
- Expected: Shows success with txn count
- Nav: [View] and [Upload More] buttons shown

### Test Scenario 2: Three Files (2 Success, 1 Duplicate)

- Upload 3 files
- First 2 process successfully
- Third fails with DUPLICATE_STATEMENT
- Expected: Shows 2 success + 1 failure in results
- Stats: 2 succeeded, 1 failed, both txn counts shown

### Test Scenario 3: CSV File

- Upload CSV file (mixed with PDF)
- Expected: Parses correctly
- File icon shows CSV indicator
- Results display same as PDF

### Test Scenario 4: All Failures

- Upload file that's already imported
- Expected: Shows error message
- No success cards
- [Upload More] still available

---

## Performance Considerations

1. **Sequential Processing**: Files processed one-by-one (not parallel)
   - Prevents overwhelming the API
   - Easier error tracking per file
   - Better UX (clear which file is processing)

2. **State Updates**: Each file status update triggers re-render
   - Use useCallback for helpers
   - Consider useReducer if state management gets complex

3. **File Size**: Max 10MB per file (validated client-side)
   - Prevents timeout on large uploads
   - Keep this same as current implementation

4. **API Calls**: 2 calls per file (parse + save)
   - 3 files = 6 total API calls
   - Estimated 30-60 seconds for typical batch

---

## Success Criteria

This implementation is successful when:

1. ✅ User can select multiple files in one action
2. ✅ Files process sequentially with visible progress
3. ✅ Errors don't stop processing (continue to next file)
4. ✅ Results clearly show success/failure with details
5. ✅ Navigation options work correctly
6. ✅ All tests in checklist pass
7. ✅ No TypeScript errors
8. ✅ Mobile responsive
9. ✅ Same API endpoint used (no changes needed to backend)
10. ✅ ReviewQueue data still accessible after upload

---

## Notes for Implementation

### Why Sequential Processing?

- Easier error handling (know exactly which file failed)
- Better UX feedback
- Prevents API rate limiting
- Simpler state management

### Why Auto-Save Instead of Review?

- Investigation found ReviewQueue is independent
- Users can review in ViewStatements after import
- Faster workflow (no manual confirmation)
- Still shows HITL items in Review Queue for items needing attention

### Why Remove Balance Correction UI?

- Most bank statements balance correctly
- Edge case (balance mismatch) moved to admin correction in future
- Simplifies implementation scope
- Reduces complexity significantly

### Future Enhancements

- Batch retry for failed files
- Pause/resume processing
- Automatic re-import of failed files
- Schedule recurring imports
- Custom field mapping for CSV files

---

**Ready for Implementation!**

This specification provides all details needed. The investigation confirmed the approach is sound and safe. No breaking changes to other pages or shared components expected.

Contact me with questions during implementation.
