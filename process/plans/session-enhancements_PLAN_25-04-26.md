# Session Enhancements PLAN

- **Date**: 25-04-26
- **Complexity**: SIMPLE (one-session)
- **Status**: ⏳ PLANNED → Ready for EXECUTE
- **Validated**: 3 parallel agents audited plan against codebase — gaps addressed
- **Test Coverage**: 66 test scenarios (20 email, 21 slugs, 13 regression, 12 edge cases)

## Overview

Three related enhancements to the session platform:

1. **Email-based profile claiming** — Users set an email during onboarding (new step 4, 0-indexed). Same device works as before. Different device can "claim" their profile by entering matching email, which transfers ownership.
2. **Custom session slugs** — Allow editing session URL slugs (creator only). Old slugs redirect via a `SlugRedirect` table so existing QR codes and bookmarks keep working.
3. **Clickable contact links** — Already done (UI fixes applied). Contact info that looks like a URL becomes a clickable link. QR code link display shows full path without `https://` and without truncation.

## Quick Links

- [Phase Completion Rules](#phase-completion-rules)
- [Execution Brief](#execution-brief)
- [Phase 1: DB Migration](#phase-1-database-migration)
- [Phase 2: Email Profile Claiming](#phase-2-email-based-profile-claiming)
- [Phase 3: Custom Session Slugs](#phase-3-custom-session-slugs)
- [Phase 4: Deploy & Verify](#phase-4-deploy--verify)
- [Validation Findings](#validation-findings)

## Goals and Success Metrics

| Goal | Metric |
|------|--------|
| Users can reclaim profile on new device | Enter email → deviceId updated → can edit/comment |
| Session creators can customize URLs | Slug editable by creator, old QR codes redirect |
| Contact info is actionable | URLs in contact field are clickable links |
| Zero data loss | Existing posts, sessions, comments unaffected |

## Phase Completion Rules

A phase is NOT complete until:

1. **Integration Test** - Works with other system pieces
2. **Manual Test** - User can perform the action
3. **Data Verification** - Database/state changes confirmed
4. **Error Handling** - Failure cases handled gracefully
5. **User Confirmation** - User says "it works"

Status meanings:
- ⏳ PLANNED - Not started
- 🔨 CODE DONE - Written but not E2E tested
- 🧪 TESTING - Currently being tested
- ✅ VERIFIED - Tested AND confirmed working
- 🚧 BLOCKED - Has issues

After each phase, document:
- [ ] What was tested manually
- [ ] Data verified in DB (show query + result)
- [ ] Errors encountered and fixed
- [ ] User confirmation received

---

## Validation Findings

Three parallel agents audited the plan against the codebase. Key gaps identified and resolved:

### Critical (addressed in updated plan)

| # | Gap | Resolution |
|---|-----|------------|
| 1 | `getBySlug` return type change breaks 6+ call sites | Use separate `resolveSlug` procedure; `getBySlug` stays unchanged |
| 2 | No session ownership — anyone can edit slugs | Add `creatorDeviceId` to Session table; check in update mutation |
| 3 | No DB unique index for `(sessionId, email)` | Add composite unique index to prevent race conditions |
| 4 | `PostRow` + `PostData` types missing email | Added to implementation checklist |
| 5 | Slug recycling conflict (redirect clashes with new session) | Check + delete stale SlugRedirect on session create |
| 6 | `slugify` edge cases (empty, no length limit) | Add guards: min 1 char, max 100, strip leading/trailing hyphens |
| 7 | Email editability unspecified | Email is **immutable** after creation; show read-only in edit mode |
| 8 | Claimer already has a post in session | Block claim with error toast |
| 9 | Step numbering: plan said "step 5" but steps are 0-indexed | Corrected: new email step is index 4, `totalSteps = 5` |
| 10 | local-db.ts: ALTER TABLE fails silently on re-run | Acceptable — caught by existing error suppression in `initTables()` |
| 11 | INSERT in `create` mutation has explicit column list | Must add `email` column + placeholder to INSERT SQL |
| 12 | Old device after claim auto-opens onboarding | Expected behavior — old device can create a new post |

### Architecture Decision: Slug Redirect

**Chosen: Separate `resolveSlug` procedure** (not modifying `getBySlug`)

1. Frontend calls `resolveSlug(slug)` → returns `{ slug: "current-slug", redirect: boolean }`
2. If redirect, `router.replace(/current-slug)` before rendering
3. `getBySlug` return type stays unchanged — zero existing code breakage

---

## Execution Brief

### Phase 1: Database Migration ⏳
**What happens**: Add `email` column to Post table. Add `creatorDeviceId` column to Session table. Add `SlugRedirect` table. Add composite unique index `(sessionId, email)`. Run migration on local DB.

**Test**: Query `PRAGMA table_info("Post")` and `PRAGMA table_info("Session")` to confirm new columns. Query `sqlite_master` for `SlugRedirect` table.

**Verify**: Local DB has new schema. All existing queries still work.

**Done when**: Schema verified and dev server starts without errors.

### Phase 2: Email-Based Profile Claiming ⏳
**What happens**: Add step index 4 to onboarding (email input, required, unique per session). Update `PostRow` and `PostData` types. Add `post.claimProfile` tRPC mutation. Add "Claim my profile" UI on session page for devices without a post. Email is immutable — shown read-only during edit.

**Test**:
1. Create a post with email in onboarding step 4 (5th step)
2. Open session in incognito browser
3. Click "Claim my profile" → enter email → post ownership transfers
4. Verify original device can no longer edit that post (auto-opens onboarding)
5. Verify new device can edit/comment
6. Verify claiming device that already has a post gets blocked
7. Verify duplicate email in same session is rejected

**Verify**: `SELECT deviceId, email FROM "Post" WHERE id = ?` shows updated deviceId after claim.

**Done when**: Full claim flow works across two browsers.

### Phase 3: Custom Session Slugs ⏳
**What happens**: Backfill `creatorDeviceId` on Session create. Add `session.update` mutation (creator only). Add `resolveSlug` procedure (checks SlugRedirect). Harden `slugify` with guards. On slug change, insert old slug into `SlugRedirect`. Frontend uses `resolveSlug` for redirect, then `getBySlug` as before. Add inline slug edit UI in session header (visible to creator only).

**Test**:
1. Create session — verify `creatorDeviceId` is set
2. Edit session slug from "sample-session" to "my-session" (as creator)
3. Try editing from different device — should be blocked
4. Visit `/sample-session` → should redirect to `/my-session`
5. QR code on `/my-session` shows updated URL
6. Change slug again → both old slugs redirect
7. Test edge cases: empty slug, special chars, very long slug

**Verify**: `SELECT * FROM "SlugRedirect"` shows old slug entries. `SELECT slug, creatorDeviceId FROM "Session"` shows new slug and creator.

**Done when**: Old URLs redirect, new QR code correct, only creator can edit.

### Phase 4: Deploy & Verify ⏳
**What happens**: Run production D1 migration (3 ALTER TABLEs + 1 CREATE TABLE + indexes). Deploy to Cloudflare. Test all features on production.

**Test**: Full E2E on `session.buildstuffs.com`.

**Done when**: User confirms all features work on production.

**Expected Outcome**:
- Posts have `email` field (hidden from public display, immutable)
- Users can claim their profile on any device via email
- Session slugs are editable by creator with backward-compatible redirects
- Contact info with URLs is clickable
- QR code link shows full path without truncation
- All existing data and functionality preserved

---

## Scope

### In Scope
- Email field on Post (new step 4, required for new posts, immutable)
- Claim profile mutation + UI
- `creatorDeviceId` on Session for ownership
- Custom slug editing + SlugRedirect table
- Session update mutation (creator only)
- `resolveSlug` procedure for redirect handling
- Hardened `slugify` function
- Clickable contact links (already done)
- QR code link display fix (already done)

### Out of Scope
- Email verification/confirmation (just stored as-is)
- Admin dashboard for session management
- Bulk session operations
- Email notifications
- Password/auth system beyond email matching
- Prisma schema sync (pre-existing issue, not blocking)

## Assumptions and Constraints

1. Email is used as a simple identifier, not for authentication or sending emails
2. Email uniqueness is per-session (same email can exist in different sessions), enforced by DB unique index
3. Email is immutable after post creation — cannot be changed during edit
4. Claiming transfers deviceId — the old device loses edit access and can create a new post
5. SlugRedirect entries are permanent — old slugs always redirect
6. Production D1 migration must be additive (ALTER TABLE ADD COLUMN) — no destructive changes
7. Existing posts without email are grandfathered — they can't be claimed but still work
8. Session slug editing is restricted to the session creator (matched by `creatorDeviceId`)
9. Existing sessions have no `creatorDeviceId` — slug editing is unavailable for them unless manually set

## Functional Requirements

### Email Profile Claiming
- F1: New step (index 4) in onboarding asks for email (required for new posts)
- F2: Email must be valid format (`x@y.z`) — validated by `z.string().email()`
- F3: Email must be unique within the session — enforced by `UNIQUE(sessionId, email)` index
- F4: Same device never needs email to edit/comment
- F5: Different device sees "Claim my profile" button on session page (only if device has no post)
- F6: Claiming requires entering email matching a post in this session
- F7: On successful claim, post's `deviceId` updates to new device
- F8: New device gets full edit/comment access after claiming
- F9: Old device loses edit access, auto-opens onboarding (can create new post)
- F10: Existing posts without email field continue to work normally
- F11: Email is immutable — shown read-only during post editing
- F12: If claiming device already has a post in the session, claim is blocked with error

### Custom Session Slugs
- F13: Session creator (matched by `creatorDeviceId`) can edit slug via UI
- F14: Non-creators cannot see or use slug edit UI
- F15: New slug is auto-slugified (lowercase, hyphens, 1-100 chars, no leading/trailing hyphens)
- F16: New slug must be unique (not taken by another session or existing redirect)
- F17: Old slug stored in `SlugRedirect` → points to session ID
- F18: Visiting old slug URL redirects (client-side via `resolveSlug`) to new slug
- F19: Multiple renames supported (each old slug redirects)
- F20: QR code updates to show new slug immediately
- F21: Creating a new session checks SlugRedirect for conflicts; deletes stale redirects if slug is being claimed

## Non-Functional Requirements

- N1: Migration must not drop data — ALTER TABLE ADD COLUMN only
- N2: Claim operation must be atomic (no partial state)
- N3: Slug redirect lookup adds minimal latency (indexed by `oldSlug`)
- N4: Email uniqueness enforced at DB level (composite unique index)

## Acceptance Criteria

1. [ ] New post creation requires email in step 4 (0-indexed)
2. [ ] Email validated for format and uniqueness in session
3. [ ] "Claim my profile" visible on different device, hidden on same device or device with existing post
4. [ ] Entering correct email transfers post ownership to new device
5. [ ] Entering wrong email shows error toast
6. [ ] Claiming device with existing post gets blocked
7. [ ] Email shown read-only during post editing
8. [ ] Session slug editable from session header (creator only)
9. [ ] Non-creator cannot see slug edit UI
10. [ ] Old slug URLs redirect to new slug via `resolveSlug`
11. [ ] QR code reflects current slug
12. [ ] Existing posts without email still function
13. [ ] Existing sessions without `creatorDeviceId` still function (slug edit unavailable)
14. [ ] Production deployment succeeds with D1 migration

---

## Implementation Checklist

### Phase 1: Database Migration
- [ ] 1.1 Add to `prisma/migration.sql`:
  - `ALTER TABLE "Post" ADD COLUMN "email" TEXT;`
  - `ALTER TABLE "Session" ADD COLUMN "creatorDeviceId" TEXT;`
  - `CREATE TABLE IF NOT EXISTS "SlugRedirect" (id TEXT PK, oldSlug TEXT NOT NULL, sessionId TEXT NOT NULL, createdAt DATETIME DEFAULT CURRENT_TIMESTAMP);`
  - `CREATE UNIQUE INDEX IF NOT EXISTS "SlugRedirect_oldSlug_key" ON "SlugRedirect"("oldSlug");`
  - `CREATE UNIQUE INDEX IF NOT EXISTS "Post_sessionId_email_key" ON "Post"("sessionId", "email");`
- [ ] 1.2 Run migration on local DB: `sqlite3 local.db` with the ALTER/CREATE statements
- [ ] 1.3 Verify: `PRAGMA table_info("Post")` shows email; `PRAGMA table_info("Session")` shows creatorDeviceId
- [ ] 1.4 Start dev server — confirm no errors

### Phase 2: Email Profile Claiming — Backend
- [ ] 2.1 Update `PostRow` interface in `post.ts`: add `email: string | null`
- [ ] 2.2 Update `postInput` schema: add `email: z.string().trim().toLowerCase().email().max(254)`
- [ ] 2.3 Update `create` mutation INSERT: add `email` column + placeholder + `input.email` to bind
- [ ] 2.4 Add email uniqueness check in `create`: wrap INSERT in try/catch, detect UNIQUE constraint violation on `(sessionId, email)`, return friendly error "This email is already used in this session"
- [ ] 2.5 Add `claimProfile` mutation: takes `{ sessionId, email, newDeviceId }` → normalize email with `.trim().toLowerCase()` → finds post by sessionId+email → checks claimer doesn't already have a post → updates `deviceId`
- [ ] 2.6 Update `update` mutation: do NOT allow email changes (omit from updatable fields)

### Phase 2: Email Profile Claiming — Frontend
- [ ] 2.7 Update `PostData` type in `page.tsx`: add `email: string | null`
- [ ] 2.8 Add `emailInput` state, update `totalSteps` from 4 to 5
- [ ] 2.9 Add step index 4 UI: email input field (required)
- [ ] 2.10 Add `validateStep` case 4: email format check
- [ ] 2.11 Pass `email` to create mutation payload in `handleSubmit`
- [ ] 2.12 In edit mode (`openOnboarding` with editPost): skip to step 1 (same as now), show email as read-only text in step 4
- [ ] 2.13 Add "Claim my profile" button below session header (shown when device hasn't posted AND posts exist)
- [ ] 2.14 Create claim modal: email input → calls `post.claimProfile` → on success, toast + invalidate queries
- [ ] 2.15 Test: create post, claim in incognito, verify ownership transfer

### Phase 3: Custom Session Slugs — Backend
- [ ] 3.1 Update `session.create` mutation: accept + store `creatorDeviceId` from input; also check SlugRedirect for conflicts and delete stale entries
- [ ] 3.2 Add `session.update` mutation: accepts `{ id, creatorDeviceId, slug?, name?, description?, date? }`; verify `creatorDeviceId` matches stored value
- [ ] 3.3 On slug change in update: slugify + validate (1-100 chars, not empty, no leading/trailing hyphens); skip if new slug === current slug (no-op); check uniqueness against Session + SlugRedirect; INSERT old slug into SlugRedirect
- [ ] 3.4 Harden `slugify` in `src/lib/utils.ts`: strip leading/trailing hyphens, clamp to 100 chars, return null/throw if empty after processing
- [ ] 3.5 Add `resolveSlug` procedure in `session.ts`: takes `{ slug }` → checks Session first, then SlugRedirect → returns `{ slug: string, redirect: boolean }`
- [ ] 3.6 Test: update slug via tRPC, verify SlugRedirect entry, verify resolveSlug returns redirect

### Phase 3: Custom Session Slugs — Frontend
- [ ] 3.7 Update home page `src/app/page.tsx`: pass `creatorDeviceId` (from localStorage device identity) when creating sessions
- [ ] 3.8 Add `resolveSlug` query in `page.tsx` — runs before `getBySlug`; if redirect, `router.replace()` to new slug
- [ ] 3.9 Add inline slug edit UI in session header: pencil icon → input → save button (visible only to creator, matched by `session.creatorDeviceId === device.deviceId`)
- [ ] 3.10 Call `session.update` on save, invalidate queries, show toast
- [ ] 3.11 Test: edit slug, visit old URL, confirm redirect + QR update

### Phase 4: Deploy & Verify
- [ ] 4.1 Run D1 migration on production:
  ```
  wrangler d1 execute session-db --remote --command "ALTER TABLE \"Post\" ADD COLUMN \"email\" TEXT;"
  wrangler d1 execute session-db --remote --command "ALTER TABLE \"Session\" ADD COLUMN \"creatorDeviceId\" TEXT;"
  wrangler d1 execute session-db --remote --command "CREATE TABLE IF NOT EXISTS \"SlugRedirect\" (\"id\" TEXT NOT NULL PRIMARY KEY, \"oldSlug\" TEXT NOT NULL, \"sessionId\" TEXT NOT NULL, \"createdAt\" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP);"
  wrangler d1 execute session-db --remote --command "CREATE UNIQUE INDEX IF NOT EXISTS \"SlugRedirect_oldSlug_key\" ON \"SlugRedirect\"(\"oldSlug\");"
  wrangler d1 execute session-db --remote --command "CREATE UNIQUE INDEX IF NOT EXISTS \"Post_sessionId_email_key\" ON \"Post\"(\"sessionId\", \"email\");"
  ```
- [ ] 4.2 Deploy: `pnpm run deploy`
- [ ] 4.3 Test email claiming on production
- [ ] 4.4 Test slug editing on production (set creatorDeviceId on existing session first)
- [ ] 4.5 User confirms all features work

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| D1 migration fails | Blocks deploy | Use additive ALTER TABLE only, test locally first |
| Existing posts have no email | Can't be claimed | Graceful: old posts work normally, just can't be claimed |
| Existing sessions have no creatorDeviceId | Can't edit slug | Manual SQL to set it, or accept limitation for old sessions |
| Slug conflicts with redirect table | Confusing redirects | Check both Session and SlugRedirect tables; delete stale redirects on new session create |
| User forgets email | Can't claim on new device | Email is visible (read-only) in edit mode for reference |
| Claiming when already posted | Data conflict | Block claim with error toast |

## Integration Notes

### Files Modified
- `prisma/migration.sql` — new columns + new table + indexes
- `src/lib/utils.ts` — hardened `slugify` function
- `src/server/routers/post.ts` — email field, `PostRow` type, `claimProfile` mutation, uniqueness check
- `src/server/routers/session.ts` — `creatorDeviceId`, `update` mutation, `resolveSlug` procedure, slug conflict check
- `src/app/[sessionSlug]/page.tsx` — step 4 (email), `PostData` type, claim UI, slug edit UI, `resolveSlug` redirect handling

### Data Model Changes
```sql
-- Post table additions
ALTER TABLE "Post" ADD COLUMN "email" TEXT;
CREATE UNIQUE INDEX "Post_sessionId_email_key" ON "Post"("sessionId", "email");

-- Session table addition
ALTER TABLE "Session" ADD COLUMN "creatorDeviceId" TEXT;

-- New table
CREATE TABLE IF NOT EXISTS "SlugRedirect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "oldSlug" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "SlugRedirect_oldSlug_key" ON "SlugRedirect"("oldSlug");
```

### Environment
- Local: `local.db` (SQLite via better-sqlite3)
- Production: Cloudflare D1 `session-db`
- Both need same migration applied

## Cursor + RIPER-5 Guidance

- **Cursor Plan mode**: Import the Implementation Checklist steps directly. Execute phase by phase.
- **RIPER-5**: Research + validation complete. Plan is this document. Request EXECUTE to begin implementation.
- **After each phase**: STOP and verify before proceeding to the next phase.
- If scope changes during implementation, pause and update this plan first.
