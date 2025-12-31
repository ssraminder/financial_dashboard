# Knowledge Base Table Names and Function Calls Audit

## Summary

The KB Admin interface has **inconsistent table naming** and **two Edge Function calls still using the deprecated fetch method**.

---

## 1. Table Names Used in Code

### ✅ CORRECT Tables

| Table Name             | Purpose         | Files Used                                                               | Status     |
| ---------------------- | --------------- | ------------------------------------------------------------------------ | ---------- |
| `knowledgebase_payees` | Main KB entries | KBAdmin.tsx, KBEntryEditor.tsx, KBPendingQueue.tsx, kb-pending-review.ts | ✅ CORRECT |

### ❌ INCORRECT Tables (Discrepancy with Expected)

| Current Name        | Expected Name | Purpose                  | Files Used                                            | Issue                      |
| ------------------- | ------------- | ------------------------ | ----------------------------------------------------- | -------------------------- |
| `kb_pending_queue`  | `kb_pending`  | Pending approvals queue  | KBAdmin.tsx, KBPendingQueue.tsx, kb-pending-review.ts | ❌ Different from expected |
| `kb_change_history` | `kb_history`  | Change history/audit log | kb-pending-review.ts, KBEntryEditor/History.tsx       | ❌ Different from expected |

---

## 2. Edge Function Calls

### ✅ Using Correct Method (supabase.functions.invoke)

| Function          | File                                    | Method                        | Status     |
| ----------------- | --------------------------------------- | ----------------------------- | ---------- |
| `kb-ai-interpret` | client/pages/KBAdmin.tsx (Line 131-138) | `supabase.functions.invoke()` | ✅ CORRECT |
| `kb-entry-manage` | client/pages/KBAdmin.tsx (Line 167-178) | `supabase.functions.invoke()` | ✅ CORRECT |

### ❌ Still Using OLD Fetch Method

| Function                      | File                                           | Method                       | Status       | Issue |
| ----------------------------- | ---------------------------------------------- | ---------------------------- | ------------ | ----- |
| `kb-pending-review` (Approve) | client/pages/KBPendingQueue.tsx (Line 99-115)  | `fetch()` with wrong headers | ❌ NEEDS FIX |
| `kb-pending-review` (Reject)  | client/pages/KBPendingQueue.tsx (Line 131-158) | `fetch()` with wrong headers | ❌ NEEDS FIX |

---

## 3. Detailed List of All Table Queries in KBAdmin.tsx

### Query 1: Fetch KB Entries (Line 71-101)

```javascript
let query = supabase
  .from("knowledgebase_payees") // ✅ CORRECT
  .select("*, category:categories(id, code, name, category_type)", {
    count: "exact",
  })
  .order("usage_count", { ascending: false });

// Filters applied:
// - ilike("payee_pattern", `%${filters.search}%`)
// - eq("category_id", filters.category_id)
// - eq("payee_type", filters.payee_type)
// - eq("source", filters.source)
// - eq("is_active", filters.is_active)

// Pagination:
// - range(offset, offset + filters.pageSize - 1)
```

### Query 2: Fetch Pending Count (Line 111-114)

```javascript
const { count: pending } = await supabase
  .from("kb_pending_queue") // ❌ EXPECTED: kb_pending
  .select("id", { count: "exact" })
  .eq("status", "pending");
```

### Query 3: Deactivate/Activate Entry (Line 218-220)

```javascript
const { error } = await supabase
  .from("knowledgebase_payees") // ✅ CORRECT
  .update({ is_active: !entry.is_active })
  .eq("id", entry.id);
```

---

## 4. All Table Queries in KBPendingQueue.tsx

### Query 1: Fetch Pending Items (Line 71-81)

```javascript
let query = supabase
  .from("kb_pending_queue") // ❌ EXPECTED: kb_pending
  .select("*")
  .order("created_at", { ascending: false });

// Filter by status
query = query.eq("status", activeTab);
```

### Query 2: Expire Old Items (Line 187-192)

```javascript
const { error: updateError } = await supabase
  .from("kb_pending_queue") // ❌ EXPECTED: kb_pending
  .update({ status: "expired" })
  .eq("status", "pending")
  .lt("created_at", thirtyDaysAgo.toISOString());
```

### Edge Function Calls (STILL USING FETCH) - Lines 99-115, 131-158

#### Approve Call (Line 99-115)

```javascript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kb-pending-review`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${user?.id}`, // ❌ WRONG
    },
    body: JSON.stringify({
      action: "approve",
      id: item.id,
      user_email: user?.email,
    }),
  },
);
```

#### Reject Call (Line 131-158)

```javascript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kb-pending-review`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${user?.id}`, // ❌ WRONG
    },
    body: JSON.stringify({
      action: "reject",
      id: selectedItemForReject.id,
      user_email: user?.email,
      quick_reasons: quickReasons,
      rejection_reason: customReason,
    }),
  },
);
```

---

## 5. All Table Queries in KBEntryEditor.tsx

### Query 1: Insert KB Entry (Line 147-150)

```javascript
const { error: insertError } = await supabase
  .from("knowledgebase_payees") // ✅ CORRECT
  .insert([payload]);
```

### Query 2: Update KB Entry (Line 153-156)

```javascript
const { error: updateError } = await supabase
  .from("knowledgebase_payees") // ✅ CORRECT
  .update(payload)
  .eq("id", entry.id);
```

---

## 6. All Table Queries in kb-pending-review.ts (Netlify Function)

### Query 1: Fetch Pending Item (Line 86-89)

```javascript
const { data: pendingItem, error: fetchError } = await supabase
  .from("kb_pending_queue") // ❌ EXPECTED: kb_pending
  .select("*")
  .eq("id", body.id)
  .single();
```

### Query 2: Check Existing Entry (Line 147-150)

```javascript
const { data: existingEntry } = await supabase
  .from("knowledgebase_payees") // ✅ CORRECT
  .select("id")
  .eq("payee_pattern", entryData.payee_pattern)
  .maybeSingle();
```

### Query 3: Update Existing Entry (Line 155-158)

```javascript
const { error: updateError } = await supabase
  .from("knowledgebase_payees") // ✅ CORRECT
  .update(entryData)
  .eq("id", existingEntry.id);
```

### Query 4: Insert New Entry (Line 168-172)

```javascript
const { data: newEntry, error: insertError } = await supabase
  .from("knowledgebase_payees") // ✅ CORRECT
  .insert([entryData])
  .select("id")
  .single();
```

### Query 5: Record Change History (Line 183-189)

```javascript
await supabase.from("kb_change_history").insert({
  // ❌ EXPECTED: kb_history
  entry_id: result.entry_id || existingEntry?.id,
  action: "create",
  changed_fields: entryData,
  changed_by: body.user_email,
  changed_at: new Date().toISOString(),
});
```

### Query 6: Mark as Approved (Line 192-197)

```javascript
const { error: approveError } = await supabase
  .from("kb_pending_queue") // ❌ EXPECTED: kb_pending
  .update({
    status: "approved",
    reviewed_by: body.user_email,
    reviewed_at: new Date().toISOString(),
  })
  .eq("id", body.id);
```

### Query 7: Mark as Rejected (Line 212-219)

```javascript
const { error: rejectError } = await supabase
  .from("kb_pending_queue") // ❌ EXPECTED: kb_pending
  .update({
    status: "rejected",
    rejection_reason: reasons,
    reviewed_by: body.user_email,
    reviewed_at: new Date().toISOString(),
  })
  .eq("id", body.id);
```

---

## 7. All Table Queries in KBEntryEditor/History.tsx

### Query: Fetch Change History (Line 37-42)

```javascript
const { data, error: fetchError } = await supabase
  .from("kb_change_history") // ❌ EXPECTED: kb_history
  .select("*")
  .eq("entry_id", entry.id)
  .order("changed_at", { ascending: false });
```

---

## Summary of Issues

### Table Name Discrepancies

| Current             | Expected     | Occurrences   | Impact                               |
| ------------------- | ------------ | ------------- | ------------------------------------ |
| `kb_pending_queue`  | `kb_pending` | 8 occurrences | ❌ HIGH - Multiple files affected    |
| `kb_change_history` | `kb_history` | 2 occurrences | ⚠️ MEDIUM - History feature affected |

### Edge Function Method Issues

| Function            | Current Method               | Expected Method               | Files Affected     | Impact                              |
| ------------------- | ---------------------------- | ----------------------------- | ------------------ | ----------------------------------- |
| `kb-pending-review` | `fetch()` with wrong headers | `supabase.functions.invoke()` | KBPendingQueue.tsx | ❌ HIGH - Will get 401 Unauthorized |

---

## Recommendations

1. **If table names are correct in your Supabase:**
   - Update all code references to use correct table names
   - This includes: KBAdmin.tsx, KBPendingQueue.tsx, KBEntryEditor.tsx, kb-pending-review.ts, History.tsx

2. **If table names in code are correct:**
   - Update your Supabase database to match current naming convention
   - Document the naming standard going forward

3. **Fix KBPendingQueue.tsx:**
   - Replace both fetch calls with `supabase.functions.invoke()`
   - Remove manual header construction
   - This will fix the 401 Unauthorized errors

4. **Update kb-pending-review.ts (if server-side):**
   - If this is a Netlify function, update table references if needed
   - If this is a Supabase Edge Function, update table references
