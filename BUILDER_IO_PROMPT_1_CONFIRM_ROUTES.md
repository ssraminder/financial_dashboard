# Builder.io Prompt 1: Confirm Routes Before Implementation

## Purpose
Before implementing the multi-file upload feature, we need to confirm the exact route paths in the application so navigation links work correctly.

## Task
Please check `client/App.tsx` or the router configuration and provide the exact route paths for:

1. **View Statements page** - Where users view imported statements and transactions
2. **Review Queue page** - Where users review transactions flagged for HITL

## Expected Format
Please respond with:
```
1. View Statements route: [exact path, e.g., /statements]
2. Review Queue route: [exact path, e.g., /review-queue]
```

## Why This Matters
The new multi-file Upload page will navigate to these routes after successful import:

- **[View] button per statement** → Navigate to View Statements route + query params (`?account=...&statement=...`)
- **[Go to Review Queue] button** → Navigate to Review Queue route (only if HITL items exist)

We need exact paths to ensure the navigation works correctly.

## What We'll Do With This Information
Once you confirm the routes, we'll:
1. Update the multi-file upload implementation with correct navigation links
2. Verify ViewStatements can accept and handle query parameters
3. Ensure proper routing between Upload → Statements → Review Queue

---

**Please provide the route confirmation before we proceed with the full implementation.**
