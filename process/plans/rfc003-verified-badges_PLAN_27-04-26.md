# RFC-003: Verified/Unverified Badges + Auto-Link

**Date:** April 27, 2026
**Complexity:** SIMPLE (one-session)
**Status:** PLANNED
**Parent Plan:** `process/plans/platform-evolution_PLAN_26-04-26.md` (Phase 1, RFC-003)
**Edge Case Analysis:** `process/plans/reports/general-purpose-260427-0140-dual-identity-edge-cases.md`

---

## Overview

Add verified/unverified badges to posts, implement auto-link logic that connects anonymous posts to signed-in Clerk accounts, and harden the claim flow. This RFC builds on the existing Clerk auth (RFC-001) and dual identity system (RFC-002) that are already in the codebase.

## Goals

1. Show verified/unverified badges on posts based on Clerk email verification status
2. Auto-link anonymous posts to Clerk accounts on sign-in (same-device silent, cross-device with confirmation)
3. Handle email mismatch between anonymous post and signed-in user
4. Harden claim flow to prevent unauthorized takeover

## Scope

**In-Scope:**
- Badge UI component (verified/unverified/none for legacy)
- `post.create` verified flag based on Clerk email verification
- `post.autoLink` tRPC mutation
- Frontend sign-in detection + auto-link trigger
- Cross-device confirmation modal
- Email mismatch prompt (link/delete/leave)
- Claim flow hardening (`WHERE userId IS NULL`, email match for signed-in users)

**Out-of-Scope:**
- UserProfile table (deferred, not needed for badges)
- Email verification prompts/flows within the app (Clerk handles this)
- Admin moderation tools
- Verification revocation

---

## Execution Brief

**IMPORTANT:** This is a SIMPLE (one-session) plan. Implement all phases continuously without approval gates between them. The phases below are logical groupings, NOT stop points.

### Phase 1: Badge Component + Post Create Verified Logic
Update `post.create` to set `verified` based on Clerk email status. Create badge UI component. Add badges to all post rendering locations.

### Phase 2: Auto-Link tRPC Mutation
Create `post.autoLink` mutation that finds anonymous posts matching the signed-in user's email and links them.

### Phase 3: Frontend Auto-Link Trigger + Confirmation UI
Detect sign-in state change, call auto-link, show confirmation modal for cross-device posts and email mismatch prompt.

### Phase 4: Claim Flow Hardening
Add `WHERE userId IS NULL` guard, require email match for signed-in claimers.

### Post-Implementation Testing
1. Create post while signed in with verified email -- should show green verified badge
2. Create post anonymously -- should show gray unverified badge
3. View legacy post (no email) -- should show no badge
4. Sign in after anonymous post (same device, same email) -- post auto-links, badge changes to verified
5. Sign in on different device (same email) -- confirmation modal appears
6. Sign in with different email than anonymous post on same device -- mismatch prompt appears
7. Attempt to claim already-claimed post -- should fail

### Expected Outcome
- Posts display verified/unverified badges based on auth status
- Signing in silently links same-device posts
- Cross-device linking shows confirmation
- Email mismatches are handled gracefully
- Claim flow prevents unauthorized takeover

---

## Data Flow

### Badge Display Flow
```
Post.verified (DB) --> listBySession/getMyPost query --> PostData.verified (frontend)
  --> verified=1 + userId != null --> Green "Verified" badge
  --> verified=0 + email != null  --> Gray "Unverified" badge
  --> email == null               --> No badge (legacy)
```

### Auto-Link Flow (Sign-In)
```
User signs in (Clerk) --> useEffect detects isSignedIn change
  --> calls post.autoLink({ deviceId })
  --> Backend: get Clerk user email via clerkClient
  --> Find posts: LOWER(email) = LOWER(clerkEmail) AND userId IS NULL
  --> Same device (deviceId match): auto-link silently, set userId + verified=1
  --> Cross device (deviceId mismatch): return as candidates
  --> Frontend: if candidates exist, show confirmation modal
  --> User confirms --> calls post.confirmLink({ postIds })
  --> Invalidate queries --> badges update
```

### Email Mismatch Flow
```
User signs in --> autoLink finds post on same device but different email
  --> Return as mismatchPosts (separate from candidates)
  --> Frontend shows mismatch prompt per post:
    "Link to my account" --> set userId, keep original email, verified=1
    "Delete it" --> delete post
    "Leave it" --> no change
```

---

## Phase 1: Badge Component + Verified Logic on Create

### 1.1 Get Clerk email verification status in tRPC context

**File:** `src/server/trpc.ts`

**Current state:** Context has `{ db, userId }`. We need the Clerk user's primary email and verification status for `post.create` and `post.autoLink`.

**Change:** Add a helper function `getClerkUserEmail` that uses `clerkClient` to fetch the user's email info server-side. This will be called by procedures that need it (not in every request context).

**Implementation details:**
- Import `clerkClient` from `@clerk/nextjs/server`
- Create exported async function `getClerkUserEmail(userId: string)` in `src/lib/clerk-helpers.ts`
- Returns `{ ok: true, email: string, verified: boolean }` or `{ ok: false, error: string }`
- Reads `user.emailAddresses[0]` and checks `verification.status === "verified"`
- Case-insensitive email (lowercase)

**File to create:** `src/lib/clerk-helpers.ts`

### 1.2 Update post.create to set verified flag

**File:** `src/server/routers/post.ts`

**Current state:** Line 62 hardcodes `verified: 0`.

**Change:** When `ctx.userId` is set, call `getClerkUserEmail(ctx.userId)`. If the email is verified AND `LOWER(input.email) === LOWER(clerkEmail)`, set `verified = 1`. Otherwise `verified = 0`.

**Logic:**
```
if ctx.userId:
  clerkInfo = await getClerkUserEmail(ctx.userId)
  if clerkInfo.ok AND clerkInfo.verified AND LOWER(clerkInfo.email) === LOWER(input.email):
    verified = 1
  else:
    verified = 0
else:
  verified = 0
```

### 1.3 Create VerifiedBadge component

**File to create:** `src/components/verified-badge.tsx`

**Props:** `{ verified: number, email: string | null }`

**Rendering logic:**
- If `email === null` (legacy post, pre-auth): render nothing (return null)
- If `verified === 1`: render green badge -- small `CheckCircle2` icon (lucide) + "Verified" text, green color scheme (`text-green-400 bg-green-500/15 border-green-500/20`)
- If `verified === 0`: render gray badge -- "Unverified" text only, gray color scheme (`text-white/40 bg-white/5 border-white/10`)

**Styling:** `text-[9px] font-medium px-1.5 py-0.5 rounded-full border` (matches existing demo badge styling in the codebase)

### 1.4 Add badge to post rendering in session page

**File:** `src/app/[sessionSlug]/page.tsx`

**Locations to add badge (3 places):**

1. **Card view - Mobile layout** (around line 965): After `{post.authorName}`, add `<VerifiedBadge verified={post.verified} email={post.email} />`

2. **Card view - Desktop layout** (around line 979): After `{post.authorName}`, add same badge

3. **List view** (around line 1061): In the `flex items-center gap-2` div after `{post.authorName}`, add same badge (before the demo badges)

**Import:** Add `import { VerifiedBadge } from "@/components/verified-badge"` at top of file.

### Phase 1 Verification
- Create post while signed in with verified Google email (same email in form) -- verified=1 in DB, green badge
- Create post while signed in but with different email in form -- verified=0, gray badge
- Create post anonymously -- verified=0, gray badge
- View old post with email=NULL -- no badge
- DB check: `SELECT id, verified, email, userId FROM "Post" WHERE sessionId = ?`

---

## Phase 2: Auto-Link tRPC Mutation

### 2.1 Create post.autoLink mutation

**File:** `src/server/routers/post.ts`

**Input schema:**
```
z.object({
  deviceId: z.string(),
})
```
Note: `userId` comes from `ctx.userId` (required -- this is an authed-only operation).

**Logic:**
1. Guard: if `!ctx.userId`, throw error "Must be signed in"
2. Call `getClerkUserEmail(ctx.userId)` to get Clerk email
3. If not ok, return empty result
4. Query: `SELECT id, deviceId, email FROM "Post" WHERE LOWER(email) = ? AND userId IS NULL`
   - Bind: `LOWER(clerkEmail)`
5. Separate results into three categories:
   - `autoLinked`: posts where `deviceId === input.deviceId` (same device, same email) -- link silently
   - `candidates`: posts where `deviceId !== input.deviceId` (cross-device, same email) -- need confirmation
   - `mismatched`: (handled separately, see 2.2)
6. For `autoLinked` posts: batch UPDATE `SET userId = ?, verified = 1, deviceId = ? WHERE id IN (...)` with `ctx.userId` and `input.deviceId`
   - Also add `AND userId IS NULL` to WHERE to prevent race conditions
7. Return `{ autoLinked: string[], candidates: Array<{ id, sessionId, authorName, content, createdAt }> }`

### 2.2 Handle email mismatch (same device, different email)

**Additional query in post.autoLink:**
After the email-match query, also query for same-device posts with different email:
`SELECT id, email, authorName, content, createdAt FROM "Post" WHERE deviceId = ? AND userId IS NULL AND (email IS NOT NULL AND LOWER(email) != ?)`
- Bind: `input.deviceId`, `LOWER(clerkEmail)`

Add these to the return as `mismatched: Array<{ id, email, authorName, content, createdAt }>`.

### 2.3 Create post.confirmLink mutation

**File:** `src/server/routers/post.ts`

**Input schema:**
```
z.object({
  postIds: z.array(z.string()).min(1),
  deviceId: z.string(),
})
```

**Logic:**
1. Guard: if `!ctx.userId`, throw error
2. Get Clerk email via `getClerkUserEmail(ctx.userId)`
3. For each postId: `UPDATE "Post" SET userId = ?, verified = 1, deviceId = ? WHERE id = ? AND userId IS NULL`
   - The `userId IS NULL` guard prevents double-linking
4. Return `{ linked: string[] }` (IDs that were actually updated)

### 2.4 Create post.handleMismatch mutation

**File:** `src/server/routers/post.ts`

**Input schema:**
```
z.object({
  postId: z.string(),
  action: z.enum(["link", "delete", "leave"]),
  deviceId: z.string(),
})
```

**Logic:**
- `"link"`: `UPDATE "Post" SET userId = ?, verified = 1 WHERE id = ? AND userId IS NULL AND deviceId = ?`
  - Keep original email, set userId from ctx, set verified=1 (user's Google auth proves they own this device)
  - Require `deviceId` match since this is a same-device mismatch scenario
- `"delete"`: Verify ownership via deviceId, then delete post + its comments (same as existing delete logic)
- `"leave"`: No-op, return success

### Phase 2 Verification
- Call autoLink with matching email + same device -- posts should be updated in DB
- Call autoLink with matching email + different device -- posts returned as candidates
- Call autoLink when there's a same-device post with different email -- returned as mismatched
- Call confirmLink with candidate IDs -- posts should be updated
- Call handleMismatch with "link" -- post gets userId
- Call handleMismatch with "delete" -- post removed
- DB check after each: `SELECT id, userId, verified, email, deviceId FROM "Post" WHERE ...`

---

## Phase 3: Frontend Auto-Link Trigger + Confirmation UI

### 3.1 Create auto-link hook

**File to create:** `src/lib/use-auto-link.ts`

**Hook:** `useAutoLink(sessionSlug: string)`

**Logic:**
- Track previous `isSignedIn` state with useRef
- useEffect watches `isSignedIn` (from `useUser()`)
- When `isSignedIn` changes from `false/undefined` to `true`:
  1. Get deviceId from `getDeviceIdentity()`
  2. Call `post.autoLink.mutate({ deviceId })`
  3. On success:
     - If `autoLinked.length > 0`: show toast "Your posts have been linked to your account"
     - If `candidates.length > 0`: set state to show confirmation modal
     - If `mismatched.length > 0`: set state to show mismatch prompt
  4. Invalidate relevant queries (listBySession, getMyPost, hasPostedInSession)

**Returns:** `{ candidates, mismatched, showConfirmModal, showMismatchModal, setShowConfirmModal, setShowMismatchModal, confirmLink, handleMismatch }`

### 3.2 Create CrossDeviceConfirmModal component

**File to create:** `src/components/auto-link-confirm-modal.tsx`

**Props:**
```
{
  open: boolean
  onOpenChange: (open: boolean) => void
  candidates: Array<{ id, authorName, content, createdAt }>
  onConfirm: (postIds: string[]) => void
  onReject: () => void
  isPending: boolean
}
```

**UI:**
- Uses existing Dialog component
- Title: "We found posts with your email"
- Description: "These posts were created with your email on a different device. Would you like to link them to your account?"
- List of candidate posts with: authorName, content preview (truncated), createdAt (timeAgo)
- Buttons: "Link All" (primary), "Skip" (secondary/ghost)
- On "Link All": call `onConfirm` with all candidate IDs
- On "Skip": call `onReject`, close modal

### 3.3 Create EmailMismatchModal component

**File to create:** `src/components/email-mismatch-modal.tsx`

**Props:**
```
{
  open: boolean
  onOpenChange: (open: boolean) => void
  posts: Array<{ id, email, authorName, content, createdAt }>
  onAction: (postId: string, action: "link" | "delete" | "leave") => void
  isPending: boolean
}
```

**UI:**
- Uses existing Dialog component
- Title: "Post from this device with a different email"
- Shows each mismatched post with:
  - Post preview (authorName, email, content snippet)
  - Three action buttons per post:
    1. "Link to my account" (primary) -- explains: keeps original email, adds to your account
    2. "Delete it" (destructive/red)
    3. "Leave it" (ghost/secondary) -- explains: stays anonymous
- Process posts one at a time (or all at once if only one)

### 3.4 Integrate into session page

**File:** `src/app/[sessionSlug]/page.tsx`

**Changes:**
1. Import and call `useAutoLink` hook at the component top level (needs session ID or slug)
   - Actually, autoLink is not session-specific -- it links ALL posts across ALL sessions. But for this MVP, we can scope it to the current session by passing `sessionId` to the mutations. However, the user requirement says to find ALL posts with matching email, not just current session. Decision: keep it global (no sessionId filter) per the requirements.
   - Actually re-reading the requirements: the autoLink mutation finds posts globally (`WHERE LOWER(email) = ? AND userId IS NULL`), not per-session. The hook is called from the session page but operates globally. This is correct.

2. Add `useAutoLink()` call (no sessionSlug param needed since it's global)

3. Render `<CrossDeviceConfirmModal>` and `<EmailMismatchModal>` at the bottom of the component tree

4. After auto-link completes (any action), invalidate:
   - `trpc.post.listBySession` for current session
   - `trpc.post.getMyPost` for current session
   - `trpc.post.hasPostedInSession` for current session

### Phase 3 Verification
- Sign in for the first time with an email matching an anonymous post on same device -- toast appears, post updates to verified
- Sign in with an email matching anonymous posts on different devices -- confirmation modal appears
- Confirm linking -- posts update, modal closes
- Sign in on device with anonymous post using different email -- mismatch modal appears
- Choose "Link" -- post gets userId, verified
- Choose "Delete" -- post removed
- Choose "Leave" -- no change, modal closes

---

## Phase 4: Claim Flow Hardening

### 4.1 Add userId IS NULL guard to claimProfile

**File:** `src/server/routers/post.ts`

**Current claim query (line 101):**
```sql
SELECT id, deviceId FROM "Post" WHERE sessionId = ? AND LOWER(email) = ? LIMIT 1
```

**Change to:**
```sql
SELECT id, deviceId FROM "Post" WHERE sessionId = ? AND LOWER(email) = ? AND userId IS NULL LIMIT 1
```

This prevents claiming a post that's already linked to a Clerk account.

**Error message update:** If no post found after adding this guard, differentiate between "no post exists" and "post already claimed":
- First query without `userId IS NULL` to check if post exists
- If exists but has userId: throw "This post is already linked to an account"
- If doesn't exist: throw existing "No post found with this email in this session"

### 4.2 Require email match for signed-in claimers

**File:** `src/server/routers/post.ts`

**Current state:** `claimProfile` doesn't verify the claimer owns the email.

**Change:** When `ctx.userId` is set:
1. Get Clerk email via `getClerkUserEmail(ctx.userId)`
2. If Clerk email doesn't match `input.email` (case-insensitive), throw "You can only claim posts matching your verified email"

**When not signed in (anonymous claim):** Keep existing behavior -- email + deviceId transfer. This is the "claim my profile from this device" flow that works via knowing the email.

### Phase 4 Verification
- Try to claim a post that already has userId set -- should fail with "already linked to an account"
- Signed-in user tries to claim post with email matching their Clerk email -- should succeed
- Signed-in user tries to claim post with different email -- should fail with "can only claim posts matching your verified email"
- Anonymous claim (not signed in) with correct email -- should still work (deviceId transfer)

---

## Implementation Checklist

| # | Step | File(s) | Description |
|---|------|---------|-------------|
| 1 | Create clerk-helpers utility | `src/lib/clerk-helpers.ts` | `getClerkUserEmail(userId)` function using `clerkClient` |
| 2 | Update post.create verified logic | `src/server/routers/post.ts` | Check Clerk email verification, set verified=1 when appropriate |
| 3 | Create VerifiedBadge component | `src/components/verified-badge.tsx` | Green verified / gray unverified / nothing for legacy |
| 4 | Add badges to session page | `src/app/[sessionSlug]/page.tsx` | 3 locations: mobile card, desktop card, list view |
| 5 | Create post.autoLink mutation | `src/server/routers/post.ts` | Find + link same-device posts, return candidates + mismatched |
| 6 | Create post.confirmLink mutation | `src/server/routers/post.ts` | Confirm cross-device linking |
| 7 | Create post.handleMismatch mutation | `src/server/routers/post.ts` | Handle link/delete/leave for email mismatches |
| 8 | Create useAutoLink hook | `src/lib/use-auto-link.ts` | Detect sign-in, trigger autoLink, manage modal state |
| 9 | Create CrossDeviceConfirmModal | `src/components/auto-link-confirm-modal.tsx` | Confirmation UI for cross-device posts |
| 10 | Create EmailMismatchModal | `src/components/email-mismatch-modal.tsx` | Link/delete/leave UI for mismatched emails |
| 11 | Integrate auto-link into session page | `src/app/[sessionSlug]/page.tsx` | Hook + modals wired in |
| 12 | Harden claimProfile - userId IS NULL | `src/server/routers/post.ts` | Prevent overwriting existing claims |
| 13 | Harden claimProfile - email match | `src/server/routers/post.ts` | Signed-in users must match Clerk email |
| 14 | Manual testing pass | -- | Run through all test scenarios above |

---

## Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `src/lib/clerk-helpers.ts` | NEW | Clerk email/verification helper |
| `src/components/verified-badge.tsx` | NEW | Badge component |
| `src/components/auto-link-confirm-modal.tsx` | NEW | Cross-device confirmation modal |
| `src/components/email-mismatch-modal.tsx` | NEW | Email mismatch prompt modal |
| `src/lib/use-auto-link.ts` | NEW | Auto-link hook |
| `src/server/routers/post.ts` | MODIFY | post.create verified logic, autoLink/confirmLink/handleMismatch mutations, claimProfile hardening |
| `src/app/[sessionSlug]/page.tsx` | MODIFY | Badge display (3 locations), auto-link hook + modals integration |

**No database migration needed** -- `verified` and `userId` columns already exist in the schema.

---

## Risks and Mitigations

**Risk 1:** `clerkClient` may not work on Cloudflare Workers edge runtime.
- **Mitigation:** `clerkClient` from `@clerk/nextjs/server` should work since tRPC context already uses `auth()` from the same package. If it fails, fall back to passing email/verified status from the frontend (less secure but functional).

**Risk 2:** Auto-link cross-session could link posts the user didn't create (shared email scenario from edge case analysis 2.3).
- **Mitigation:** Same-device auto-link requires both email AND deviceId match (silent). Cross-device requires explicit user confirmation via modal. This two-tier approach handles the shared email risk.

**Risk 3:** Race condition in auto-link -- two tabs open, both trigger autoLink on sign-in.
- **Mitigation:** `AND userId IS NULL` in UPDATE WHERE clause makes the second write a no-op. Idempotent by design.

**Risk 4:** Session page file is already large (1000+ lines) and we're adding more.
- **Mitigation:** All new logic is in separate files (hook, components). Session page changes are minimal: 1 import, 1 hook call, 2 modal renders, 3 badge insertions.

---

## Acceptance Criteria

1. [ ] Signed-in user with verified email creates post -- green "Verified" badge appears
2. [ ] Anonymous user creates post -- gray "Unverified" badge appears
3. [ ] Legacy posts (email=NULL) show no badge
4. [ ] Sign in on same device with matching email -- posts auto-link silently, badge updates
5. [ ] Sign in on different device with matching email -- confirmation modal appears
6. [ ] Confirming cross-device link updates posts and badges
7. [ ] Sign in with different email than device's anonymous post -- mismatch prompt appears
8. [ ] Mismatch "Link" action sets userId and verified=1
9. [ ] Mismatch "Delete" action removes the post
10. [ ] Mismatch "Leave" action makes no changes
11. [ ] Cannot claim a post that already has userId (returns error)
12. [ ] Signed-in user cannot claim post with non-matching email
13. [ ] Anonymous claim still works (existing behavior preserved)
14. [ ] No TypeScript errors, build succeeds
