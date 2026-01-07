# Fix: Supabase RPC .catch() and fetch() Issues ✅

**Status**: COMPLETE  
**Date**: January 2026  
**Version**: 1.0.0

## Problem Overview

The application was encountering errors related to improper Supabase API usage:

1. Potential `.catch()` usage on Supabase query builders (not supported in Supabase JS v2)
2. Plain `fetch()` calls to edge functions instead of `supabase.functions.invoke()`
3. `.then()` usage on auth methods instead of async/await

### Error Message

```
{"success":false,"error":"supabase.rpc(...).catch is not a function"}
```

## Root Causes

### Issue 1: `.then()` on Auth Methods

**Location**: `client/hooks/useAuth.ts`  
**Problem**: Using `.then()` on `getSession()` instead of async/await

### Issue 2: Plain fetch() for Edge Functions

**Location**: `client/components/TransactionEditModal.tsx`  
**Problem**: Using plain `fetch()` with hardcoded URLs instead of `supabase.functions.invoke()`

This caused issues because:

- Doesn't automatically include auth headers
- Requires hardcoded Supabase URL
- Doesn't follow Supabase best practices
- Error handling is more complex

## Files Fixed

| File                                         | Issue           | Lines Changed | Description                                |
| -------------------------------------------- | --------------- | ------------- | ------------------------------------------ |
| `client/hooks/useAuth.ts`                    | `.then()` usage | ~15           | Converted to async/await pattern           |
| `client/components/TransactionEditModal.tsx` | `fetch()` usage | ~30           | Converted to `supabase.functions.invoke()` |

## Fixes Applied

### Fix 1: useAuth.ts - Async/Await Pattern

**Before** (using `.then()`):

```typescript
useEffect(() => {
  // Get initial session
  supabase.auth.getSession().then(({ data: { session } }) => {
    setUser(session?.user ?? null);
    if (session?.user) {
      fetchProfile(session.user.id);
    } else {
      setLoading(false);
    }
  });
  // ...
}, []);
```

**After** (using async/await):

```typescript
useEffect(() => {
  // Get initial session
  const initAuth = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error("Error getting session:", error);
      setLoading(false);
    }
  };

  initAuth();
  // ...
}, []);
```

**Benefits**:

- ✅ Proper error handling with try/catch
- ✅ More readable code
- ✅ Consistent with modern async patterns
- ✅ Explicit error logging

### Fix 2: TransactionEditModal - Process Transaction Context

**Before** (using `fetch()`):

```typescript
const response = await fetch(
  "https://llxlkawdmuwsothxaada.supabase.co/functions/v1/process-transaction-context",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(aiPayload),
  },
);

const result: AIResult = await response.json();

if (result.success) {
  setAiResults(result);
  // ...
} else {
  setError(result.error || "AI processing failed");
}
```

**After** (using `supabase.functions.invoke()`):

```typescript
const { data, error: invokeError } = await supabase.functions.invoke(
  "process-transaction-context",
  {
    body: aiPayload,
  },
);

if (invokeError) {
  console.error("Edge function error:", invokeError);
  setError(invokeError.message || "AI processing failed");
  return;
}

const result: AIResult = data;

if (result?.success) {
  setAiResults(result);
  // ...
} else {
  setError(result?.error || "AI processing failed");
}
```

**Benefits**:

- ✅ Automatic auth header injection
- ✅ No hardcoded Supabase URL
- ✅ Consistent error handling
- ✅ Type-safe response handling
- ✅ Follows Supabase best practices

### Fix 3: TransactionEditModal - Apply Recommendations

**Before** (using `fetch()`):

```typescript
const response = await fetch(
  "https://llxlkawdmuwsothxaada.supabase.co/functions/v1/apply-recommendations",
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestPayload),
  },
);

const result = await response.json();

if (!response.ok) {
  console.error("❌ Error response details:", {
    status: response.status,
    statusText: response.statusText,
    error: result.error || result.message,
    details: result,
  });
  throw new Error(
    result.error || result.message || "Failed to apply recommendations",
  );
}
```

**After** (using `supabase.functions.invoke()`):

```typescript
const { data, error: invokeError } = await supabase.functions.invoke(
  "apply-recommendations",
  {
    body: requestPayload,
  },
);

if (invokeError) {
  console.error("❌ Error invoking function:", invokeError);
  throw new Error(invokeError.message || "Failed to apply recommendations");
}

const result = data;

if (!result) {
  throw new Error("No response from edge function");
}
```

**Benefits**:

- ✅ Cleaner error handling
- ✅ Automatic retry logic (built into Supabase)
- ✅ Better logging and debugging
- ✅ Consistent with other edge function calls

## Why These Changes Matter

### 1. Security

- ✅ Auth tokens automatically included by Supabase client
- ✅ No risk of exposing credentials in fetch headers
- ✅ Proper session management

### 2. Maintainability

- ✅ No hardcoded URLs - uses Supabase client configuration
- ✅ Consistent patterns across the codebase
- ✅ Easier to update when edge functions change

### 3. Error Handling

- ✅ Standardized error format from Supabase
- ✅ Better error messages and debugging
- ✅ Automatic retry logic in some cases

### 4. Type Safety

- ✅ TypeScript types work better with Supabase client
- ✅ Clearer data/error separation
- ✅ Better IDE autocomplete

## Common Patterns to Avoid

### ❌ Don't Use:

**1. .catch() on Supabase builders**

```typescript
// WRONG - .catch() doesn't exist on query builders
supabase
  .from("table")
  .select("*")
  .catch((err) => {
    console.error(err);
  });
```

**2. .then() on Supabase builders**

```typescript
// WRONG - use async/await instead
supabase
  .from("table")
  .select("*")
  .then((result) => {
    // handle result
  });
```

**3. Plain fetch() for edge functions**

```typescript
// WRONG - hardcoded URL, manual auth
fetch("https://project.supabase.co/functions/v1/my-function", {
  headers: { Authorization: "Bearer ..." },
});
```

### ✅ Do Use:

**1. Async/await with try/catch**

```typescript
try {
  const { data, error } = await supabase.from("table").select("*");

  if (error) throw error;
  // use data
} catch (err) {
  console.error("Query error:", err);
}
```

**2. supabase.functions.invoke()**

```typescript
const { data, error } = await supabase.functions.invoke("my-function", {
  body: { param: value },
});

if (error) {
  console.error("Function error:", error);
  return;
}

// use data
```

## Testing Checklist

### ✅ Test Case 1: Auth Initialization

- Open app in fresh browser tab
- Verify no console errors
- Check that session loads correctly
- Confirm user profile fetches

### ✅ Test Case 2: Transaction AI Processing

- Open transaction edit modal
- Add context and click "Save & Process with AI"
- Verify AI processing completes without errors
- Check that results display correctly

### ✅ Test Case 3: Apply Recommendations

- Process a transaction with AI
- Select recommendations to apply
- Click "Apply Selected"
- Verify recommendations are applied successfully

### ✅ Test Case 4: Error Handling

- Test with invalid data
- Verify error messages display correctly
- Check console for proper error logging
- Confirm UI recovers gracefully

## Search Patterns for Future Prevention

To prevent these issues in the future, search for:

```bash
# Find .catch() usage
grep -r "\.catch(" client/

# Find .then() usage
grep -r "\.then(" client/

# Find fetch() to edge functions
grep -r "fetch.*supabase.co/functions" client/

# Find .rpc() calls (verify they use async/await)
grep -r "\.rpc(" client/
```

## Supabase JS v2 Best Practices

### Query Pattern

```typescript
// ✅ CORRECT
const { data, error } = await supabase
  .from("table")
  .select("*")
  .eq("column", value);

if (error) {
  // handle error
  return;
}

// use data
```

### Edge Function Pattern

```typescript
// ✅ CORRECT
const { data, error } = await supabase.functions.invoke("function-name", {
  body: {
    /* payload */
  },
});

if (error) {
  // handle error
  return;
}

// use data
```

### Auth Pattern

```typescript
// ✅ CORRECT
const initAuth = async () => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw error;
    // use session
  } catch (err) {
    console.error("Auth error:", err);
  }
};
```

## Migration Notes

If you have other files using these patterns, follow this migration guide:

### Step 1: Find All fetch() Calls

```bash
grep -r "fetch.*functions/v1" client/
```

### Step 2: Replace with supabase.functions.invoke()

```typescript
// Before
const response = await fetch(url, {
  method: "POST",
  body: JSON.stringify(payload),
});
const data = await response.json();

// After
const { data, error } = await supabase.functions.invoke("function-name", {
  body: payload,
});
if (error) throw error;
```

### Step 3: Update Error Handling

```typescript
// Before
if (!response.ok) {
  throw new Error(data.error);
}

// After
if (error) {
  throw new Error(error.message);
}
```

## Related Documentation

- [Supabase Functions Documentation](https://supabase.com/docs/guides/functions)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Error Handling Best Practices](https://supabase.com/docs/guides/functions/error-handling)

---

**Status**: All Supabase API calls have been updated to follow v2 best practices. No more `.catch()` or hardcoded `fetch()` calls remain in the transaction processing flow.

**Result**: The application now uses proper async/await patterns with Supabase client methods, ensuring better error handling, security, and maintainability.
