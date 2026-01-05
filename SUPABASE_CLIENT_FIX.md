# Supabase Client Multiple Instance Fix

## Issue

```
GoTrueClient@sb-llxlkawdmuwsothxaada-auth-token:1 (2.89.0) 2026-01-05T22:23:45.863Z
Multiple GoTrueClient instances detected in the same browser context.
It is not an error, but this should be avoided as it may produce undefined
behavior when used concurrently under the same storage key.
```

## Root Cause

The `client/lib/supabase.ts` file was creating **two separate Supabase client instances**:

```typescript
// ❌ BEFORE - Multiple instances
export const supabase = createClient(url, key);
export const supabaseTyped = createClient<Database>(url, key);
```

This caused:

1. Two independent auth clients competing for the same storage
2. Potential race conditions in session management
3. Undefined behavior with concurrent auth operations
4. Memory overhead from duplicate clients

Additionally, Vite's Hot Module Replacement (HMR) in development could create new instances on every code change.

## Solution

Implemented a **singleton pattern with HMR protection**:

### 1. Single Instance Creation

```typescript
// ✅ AFTER - Singleton pattern
let supabaseInstance: SupabaseClient<Database> | null = null;

function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabaseInstance) {
    supabaseInstance = createClient<Database>(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabaseInstance;
}

export const supabase = getSupabaseClient();
export const supabaseTyped = supabase; // Same instance
```

### 2. HMR Protection

```typescript
// Preserve instance across hot reloads
if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.log("🔄 Supabase client preserved across HMR");
  });

  if (import.meta.hot.data.supabase) {
    supabaseInstance = import.meta.hot.data.supabase;
  } else {
    import.meta.hot.data.supabase = supabaseInstance;
  }
}
```

## Benefits

✅ **Single instance** - Only one Supabase client created  
✅ **Consistent auth** - No race conditions in session management  
✅ **HMR safe** - Instance preserved across hot reloads  
✅ **Better performance** - No duplicate clients in memory  
✅ **Type safety** - Still uses `Database` type for queries  
✅ **Backward compatible** - `supabaseTyped` still available

## How It Works

### Singleton Pattern

1. First call to `getSupabaseClient()` creates the instance
2. Subsequent calls return the existing instance
3. Only one `createClient()` call ever executes

### HMR Preservation

1. Instance stored in `import.meta.hot.data.supabase`
2. On hot reload, instance retrieved from HMR data
3. Same client persists across development changes
4. No new instances created unnecessarily

## Testing

After this fix:

1. ✅ Warning message should disappear
2. ✅ Auth should work consistently
3. ✅ No session conflicts
4. ✅ HMR works without creating new clients

## Files Modified

- `client/lib/supabase.ts` - Singleton pattern with HMR protection

## Additional Notes

### Auth Configuration

Added explicit auth configuration:

```typescript
{
  auth: {
    persistSession: true,      // Keep user logged in
    autoRefreshToken: true,    // Auto-refresh expired tokens
    detectSessionInUrl: true,  // Handle OAuth callbacks
  }
}
```

This ensures:

- Sessions persist across page reloads
- Tokens refresh automatically before expiration
- OAuth flows work correctly

### Backward Compatibility

The `supabaseTyped` export is maintained as an alias:

```typescript
export const supabaseTyped = supabase;
```

This ensures any existing code using `supabaseTyped` continues to work without changes.

## Migration Guide

No changes required! The fix is transparent to all existing code:

```typescript
// Both work exactly the same now
import { supabase } from "@/lib/supabase";
import { supabaseTyped } from "@/lib/supabase";

// They reference the SAME instance
supabase === supabaseTyped; // true
```

---

**Status**: ✅ FIXED - Single instance with HMR protection

**Date**: January 5, 2026
