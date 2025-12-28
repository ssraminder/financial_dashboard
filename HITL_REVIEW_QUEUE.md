# HITL Review Queue - Feature Documentation

## Overview

The HITL (Human-In-The-Loop) Review Queue is a comprehensive transaction review interface that allows users to review, categorize, and approve financial transactions.

## Features Implemented

### 1. Transaction Fetching
- **Automatic Loading**: Fetches all transactions where `needs_review = true` from Supabase
- **Related Data**: Includes categories, companies, and bank account information
- **Real-time Updates**: Table updates immediately after approvals

### 2. Data Table Display
The table includes the following columns:

| Column | Description |
|--------|-------------|
| **Checkbox** | For bulk selection |
| **Date** | Transaction date (formatted as "MMM d, yyyy") |
| **Description** | Transaction description (truncated for long text) |
| **Amount** | Formatted as CAD currency (green for positive, red for negative) |
| **Category** | Dropdown to assign/change category |
| **Company** | Dropdown to assign/change company |
| **Bank Account** | Read-only display of the bank account |
| **Actions** | Approve button for individual transactions |

### 3. Dynamic Dropdowns

#### Category Dropdown
- Loads all categories from the `categories` table
- Shows "No Category" option for unassigned transactions
- Updates transaction immediately on selection
- Displays success toast notification

#### Company Dropdown
- Loads all companies from the `companies` table
- Includes companies like:
  - 12537494 Canada Inc.
  - Cethos Solutions Inc.
- Shows "No Company" option for unassigned transactions
- Updates transaction immediately on selection

### 4. Approval Actions

#### Individual Approve
- **Button**: "Approve" button in each row
- **Action**: Updates the transaction with:
  ```typescript
  {
    needs_review: false,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString()
  }
  ```
- **UI Feedback**:
  - Button shows loading spinner during approval
  - Row is removed from table after successful approval
  - Success toast notification displayed

#### Bulk Approve
- **Selection**: Checkboxes on each row + "Select All" checkbox in header
- **Badge**: Shows count of selected transactions
- **Button**: "Approve Selected" button appears when items are selected
- **Action**: Approves all selected transactions in a single database call
- **Performance**: Optimized with `.in()` query for multiple IDs

### 5. Advanced Filters

#### Date Range Picker
- **Date From**: Select start date for filtering
- **Date To**: Select end date for filtering
- **UI**: Beautiful calendar popover component
- **Format**: Displays as "PPP" format (e.g., "Dec 28, 2024")

#### Category Filter
- Dropdown showing all available categories
- "All Categories" option to clear filter
- Filters transactions by `category_id`

#### Bank Account Filter
- Dropdown showing all bank accounts
- "All Accounts" option to clear filter
- Filters transactions by `bank_account_id`

#### Filter Actions
- **Apply Filters**: Refetches data with applied filters
- **Clear Filters**: Resets all filters to default and refetches

### 6. Empty State
When no transactions need review:
- Icon: Clipboard icon displayed
- Heading: "No transactions pending review"
- Message: "All transactions have been reviewed and approved."

### 7. Loading States
- **Initial Load**: Full-page spinner while fetching data
- **Approving**: Individual button spinners during approval
- **Bulk Approve**: Disabled state with loading indicator

## Technical Implementation

### State Management
```typescript
- transactions: TransactionWithRelations[]
- categories: Category[]
- companies: Company[]
- bankAccounts: BankAccount[]
- dateFrom/dateTo: Date | undefined
- categoryFilter: string
- bankAccountFilter: string
- selectedIds: Set<string>
- approving: string[]
```

### Key Functions

#### `fetchData()`
Loads all required data: categories, companies, bank accounts, and transactions

#### `fetchTransactions()`
Fetches transactions with applied filters using Supabase query builder

#### `handleCategoryChange(transactionId, categoryId)`
Updates transaction category in database and local state

#### `handleCompanyChange(transactionId, companyId)`
Updates transaction company in database and local state

#### `handleApprove(transactionId)`
Approves a single transaction and removes it from the queue

#### `handleBulkApprove()`
Approves all selected transactions in batch

#### `toggleSelectAll()`
Selects/deselects all visible transactions

#### `applyFilters()`
Refetches transactions with current filter criteria

### Database Queries

#### Fetch Transactions
```typescript
supabase
  .from("transactions")
  .select(`
    *,
    categories(*),
    companies(*),
    bank_accounts(*)
  `)
  .eq("needs_review", true)
  .order("date", { ascending: false })
```

#### Update Category
```typescript
supabase
  .from("transactions")
  .update({ category_id: categoryId })
  .eq("id", transactionId)
```

#### Approve Transaction(s)
```typescript
supabase
  .from("transactions")
  .update({
    needs_review: false,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString()
  })
  .eq("id", transactionId) // or .in("id", ids) for bulk
```

## UI/UX Features

### Responsive Design
- Desktop: Full table with all columns visible
- Tablet/Mobile: Horizontal scroll for table
- Filters: Stack vertically on mobile

### Visual Feedback
- ✅ Success toasts for approvals and updates
- ❌ Error toasts for failed operations
- 🔄 Loading spinners during async operations
- 🎨 Color-coded amounts (green/red)
- 📊 Badge showing selected count

### Accessibility
- Keyboard navigation support
- ARIA labels on interactive elements
- Clear visual states for buttons
- Semantic HTML structure

## Usage Flow

1. **Login**: User authenticates via Supabase Auth
2. **Navigate**: Click "HITL Review Queue" in sidebar
3. **Review**: See all transactions needing review
4. **Filter** (Optional): Apply date range, category, or account filters
5. **Categorize**: Select appropriate category for each transaction
6. **Assign**: Select company for each transaction
7. **Approve**: 
   - Click "Approve" for individual transactions, or
   - Select multiple and click "Approve Selected"
8. **Complete**: Approved transactions are removed from queue

## Future Enhancements

Potential features to add:
- Export to CSV/Excel
- Bulk edit categories/companies
- Transaction comments/notes
- Approval history view
- Undo approval functionality
- Keyboard shortcuts for power users
- Transaction search/filtering by description
- Pagination for large datasets
- Sort by column headers
- Transaction details modal

## Dependencies

- React 18
- Supabase JS Client
- shadcn/ui components
- date-fns for date formatting
- Lucide React for icons
- React Router for navigation
