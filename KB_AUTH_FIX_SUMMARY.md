# Knowledge Base Edge Function Authentication Fix

## Issue Summary

The `kb-ai-interpret` Edge Function was returning **401 Unauthorized** errors.

## Root Causes Found

### 1. **Incorrect Authorization Header**

- **Before**: `Authorization: Bearer ${user?.id}` (passing user ID instead of access token)
- **After**: Using `supabase.functions.invoke()` which automatically includes the user's session token

### 2. **Missing Supabase Anon Key**

- **Before**: No `apikey` header with the Supabase anon key
- **After**: `supabase.functions.invoke()` automatically includes the anon key

### 3. **Using Raw `fetch()` Instead of SDK Method**

- **Before**: Manual `fetch()` call with incorrect header construction
- **After**: Using `supabase.functions.invoke()` which handles all authentication automatically

## Changes Made

### File: `client/pages/KBAdmin.tsx`

#### 1. Fixed `handleInterpretNL` Function (Lines 124-150)

**Before:**

```javascript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kb-ai-interpret`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${user?.id}`,  // WRONG!
    },
    body: JSON.stringify({
      instruction: input,
      user_email: user?.email,
    }),
  },
);

if (!response.ok) {
  throw new Error(`AI interpretation failed: ${response.statusText}`);
}

const result: AIInterpretationResult = await response.json();
```

**After:**

```javascript
const { data, error } = await supabase.functions.invoke(
  "kb-ai-interpret",
  {
    body: {
      instruction: input,
      user_email: user?.email,
    },
  },
);

if (error) {
  throw error;
}

const result: AIInterpretationResult = data;
```

#### 2. Fixed `handleConfirmInterpret` Function (Lines 159-187)

**Before:**

```javascript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kb-entry-manage`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${user?.id}`, // WRONG!
    },
    body: JSON.stringify({
      action: interpretResult.action,
      user_email: user?.email,
      entry: interpretResult.proposed,
      ai_interpretation: interpretResult.ai_interpretation,
    }),
  },
);

if (!response.ok) {
  throw new Error(`Failed to save entry: ${response.statusText}`);
}
```

**After:**

```javascript
const { data, error } = await supabase.functions.invoke("kb-entry-manage", {
  body: {
    action: interpretResult.action,
    user_email: user?.email,
    entry: interpretResult.proposed,
    ai_interpretation: interpretResult.ai_interpretation,
  },
});

if (error) {
  throw error;
}
```

## Why These Changes Fix the Issue

### `supabase.functions.invoke()` Automatically Handles:

1. **Authentication**: Includes the user's session JWT token in the `Authorization` header
2. **API Key**: Includes the Supabase anon key in the `apikey` header
3. **Content-Type**: Automatically sets `Content-Type: application/json`
4. **CORS**: Properly configured for Supabase origins
5. **Error Handling**: Returns structured `{ data, error }` response

### Benefits of Using SDK Method Over Raw `fetch()`:

- ✅ Type-safe responses
- ✅ Automatic authentication
- ✅ Built-in error handling
- ✅ Consistent with Supabase best practices
- ✅ Works with user session automatically
- ✅ No need to manually manage headers

## Expected Result

After these changes:

- ✅ Natural language input will successfully call the AI interpretation function
- ✅ No more 401 Unauthorized errors
- ✅ Knowledge base entries can be created/updated via AI interpretation
- ✅ Proper authentication is enforced on the Edge Function side

## Edge Functions Status

**Note:** The Edge Functions (`kb-ai-interpret` and `kb-entry-manage`) are deployed in your Supabase project but not stored in this repository. If you haven't created them yet in Supabase, you'll need to:

1. Go to your Supabase project dashboard
2. Navigate to **Edge Functions**
3. Create `kb-ai-interpret` function
4. Create `kb-entry-manage` function

These functions should authenticate users via JWT and process the request body appropriately.

## Testing Steps

1. Navigate to the Knowledge Base Admin page (`/admin/knowledge-base`)
2. Enter a natural language instruction in the KB Natural Language Input
3. Click "Interpret with AI"
4. If successful, the AI interpretation result modal should appear
5. Review and confirm to create/update the KB entry

If you still see 401 errors:

- Verify that the Edge Functions exist in your Supabase project
- Check that RLS policies allow authenticated users to access the functions
- Review Supabase function logs for detailed error messages
