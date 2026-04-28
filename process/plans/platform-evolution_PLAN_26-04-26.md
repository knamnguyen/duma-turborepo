# Platform Evolution: Auth, Form Builder & Media Gallery

**Date**: April 26, 2026
**Complexity**: COMPLEX (Multi-phase)
**Status**: ⏳ PLANNED

## Overview

Evolve session.buildstuffs.com from a device-based event posting app into a platform with proper authentication (Clerk + Google), flexible form fields per session (Luma-style), Notion-style card display, and a media gallery with video/photo uploads and YouTube playlist embedding. Three independently shippable phases.

---

## Quick Links

- [Context and Goals](#1-context-and-goals)
- [Phase Completion Rules](#2-phase-completion-rules)
- [Execution Brief](#3-execution-brief)
- [Phased Execution Workflow](#4-phased-execution-workflow)
- [Non-Goals and Constraints](#5-non-goals-and-constraints)
- [Architecture Decisions](#6-architecture-decisions)
- [Database Schema](#7-database-schema)
- [API Surface](#8-api-surface)
- [Phased Delivery Plan](#9-phased-delivery-plan)
- [RFCs](#10-rfcs)
- [Rules](#11-rules)
- [Verification](#12-verification)

---

## Status Strip

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Clerk Auth + Verified/Unverified Badges | ⏳ PLANNED |
| Phase 2 | Luma-style Form Builder + Notion-style Cards | ⏳ PLANNED |
| Phase 3 | Media Gallery (Video/Photo + YouTube Embed) | ⏳ PLANNED |

---

## 1. Context and Goals

### Current State
- Device-based identity (nanoid in localStorage)
- Email collected but unverified — anyone can type any email to claim profiles
- Hardcoded post fields (name, selfie, bio, project link, contact, demo intention)
- Only photo uploads (selfie), no video support
- Single tab view showing all posts

### Target State
- Clerk-based auth with Google sign-in + email verification
- Verified/Unverified badges on posts (social proof incentive)
- Session creators define custom form fields per session
- Posts displayed as Notion-style cards with dynamic field rendering
- Media gallery tab with extra uploads and YouTube playlist embedding

### Success Metrics
- Auth adds < 5 seconds to posting flow (Google one-tap)
- Existing posts/sessions continue to work (backward compatibility)
- Session creators can configure fields in < 1 minute
- Media gallery loads performantly with 50+ items

---

## 2. Phase Completion Rules

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

## 3. Execution Brief

### Phase Group 1: Auth Foundation (RFC-001 through RFC-003)

**What happens**: Install Clerk, wrap app in ClerkProvider, add sign-in UI, migrate identity from deviceId to Clerk userId, add verified/unverified badges.

**Integration points**:
- ClerkProvider wraps root layout
- tRPC context receives Clerk auth state
- Posts link to Clerk userId (with deviceId fallback for legacy)
- Session creator ownership migrates from creatorDeviceId to Clerk userId

**Test**:
1. Visit session page without signing in — can browse all posts/comments
2. Click "Join Session" — prompted to sign in with Google
3. Sign in — onboarding flow starts (selfie, bio, links)
4. Post created with "Unverified" badge
5. Verify email via Clerk — badge changes to "Verified"
6. Open in different browser — sign in with same Google — see same profile
7. Legacy posts (deviceId-based) still display correctly

**Verify**:
- `SELECT userId, email, verified FROM "Post" WHERE ...` shows Clerk userId
- `SELECT creatorUserId FROM "Session" WHERE ...` shows Clerk userId
- Legacy posts with deviceId still render

**Done when**: User confirms sign-in flow, badge display, cross-device identity, and legacy compatibility all work.

### Phase Group 2: Form Builder + Cards (RFC-004 through RFC-006)

**What happens**: Add JSON form schema to Session, build Luma-style field editor for creators, render dynamic onboarding from schema, display posts as Notion-style cards with typed field rendering.

**Integration points**:
- Session.formSchema (JSON) defines the form
- Post.fieldResponses (JSON) stores answers
- Onboarding flow reads schema to render fields dynamically
- Card display reads fieldResponses to render typed fields

**Test**:
1. Create new session — see form builder with built-in fields (Name, Email, Selfie)
2. Toggle optional fields on/off (Mobile, Project Link, etc.)
3. Add custom question with type selection
4. Join session — onboarding shows configured fields only
5. Submit post — card displays fields with proper rendering (links clickable, tags as pills)
6. Edit existing session — form schema preserved

**Verify**:
- `SELECT formSchema FROM "Session" WHERE ...` shows JSON schema
- `SELECT fieldResponses FROM "Post" WHERE ...` shows JSON responses
- Legacy posts (hardcoded fields) render correctly with fallback

**Done when**: User creates a session with custom fields, submits a post, and sees properly rendered card.

### Phase Group 3: Media Gallery (RFC-007 through RFC-009)

**What happens**: Support multi-file uploads (photos + videos) per post, add a Media Gallery tab to session page, support YouTube playlist embedding.

**Integration points**:
- Post creation accepts multiple media files
- New Media table tracks uploads with post attribution
- Gallery tab aggregates all media across posts
- YouTube playlist URL parsed and videos embedded

**Test**:
1. Create post with multiple photos and a video
2. Switch to Media Gallery tab — see all media in grid
3. Upload extra photos from gallery (attributed to your post)
4. Paste YouTube playlist URL — all videos appear embedded
5. Media plays inline, photos open in lightbox

**Verify**:
- R2 contains uploaded media files
- `SELECT * FROM "Media" WHERE postId = ?` shows attributed files
- YouTube playlist parsing returns correct video IDs

**Done when**: User uploads mixed media, sees gallery tab, and YouTube videos embed correctly.

### Expected Outcome
- Users sign in with Google (one tap), get verified badge
- Session creators configure fields per event type
- Posts render as rich cards with dynamic fields
- Media gallery provides photo/video sharing + YouTube embedding
- All existing data preserved and functional

---

## 4. Phased Execution Workflow

**IMPORTANT**: This plan uses a phase-by-phase execution model with built-in verification gates.

For each RFC/Phase, follow this workflow:

- **Step 1: Pre-Phase Research** - Read existing code patterns, analyze Clerk SDK for Cloudflare Workers, identify blockers. **CRITICAL: Present findings and STOP. Wait for user approval before proceeding to Step 2.**
- **Step 2: Detailed Planning** - Create detailed implementation steps, specify exact files, define success criteria, get user approval
- **Step 3: Implementation** - Execute approved plan exactly as specified
- **Step 4: Testing & Verification** - Execute test scenarios, verify in database, document results
- **Step 5: User Confirmation** - Present structured summary:

```
**What's Functional Now**: What user can do/see after this stage
**What Was Tested**: Verification performed (DB queries, API calls, build checks)
**What You Can Test**: Specific manual steps user can take to verify
**Ready For**: Next stage
```

**CRITICAL: Do NOT proceed to next phase until current phase is VERIFIED**

### Example Phase Execution (Phase 1, RFC-001: Clerk Setup)

```
Step 1: Research
- Read Clerk docs for Next.js 16 + Cloudflare Workers compatibility
- Check @clerk/nextjs package for App Router support
- Analyze current layout.tsx and middleware patterns
- Identify: Does Clerk work on Cloudflare Workers edge runtime?

>>> PAUSE — Present findings to user <<<
>>> "Clerk SDK is compatible with edge runtime via @clerk/nextjs.
>>>  However, we need @clerk/backend for server-side verification
>>>  in tRPC context. Here's the approach..." <<<
>>> Wait for user approval <<<

Step 2: Plan
- Install @clerk/nextjs
- Wrap layout.tsx with ClerkProvider
- Add middleware.ts for auth
- Create sign-in/sign-up pages
- Update tRPC context to extract Clerk userId

Step 3: Implement (only after approval)
- Execute plan exactly

Step 4: Test
- Build succeeds
- Sign-in flow works
- tRPC context has userId
- Unauthenticated users can still browse

Step 5: User Confirmation
- User tests sign-in on local dev
```

---

## 5. Non-Goals and Constraints

### Non-Goals
- Full user profile management system (just name/avatar/email from Clerk)
- Drag-and-drop form builder (Luma-style toggle/add is sufficient)
- Video transcoding or streaming (direct R2 upload + HTML5 video)
- Real-time collaborative editing
- Payment/subscription system
- Native mobile app

### Constraints
- Must run on Cloudflare Workers (edge runtime)
- Clerk must work with Cloudflare Workers — verify compatibility in research phase
- D1 SQLite database — no PostgreSQL features
- R2 for file storage — 100MB max object size (sufficient for photos/short videos)
- Backward compatibility: existing posts/sessions must not break

---

## 6. Architecture Decisions

### AD-1: Clerk for Authentication
**Decision**: Use Clerk with Google OAuth as primary sign-in method.
**Rationale**: One-tap Google sign-in is lowest friction. Clerk handles email verification, session management, user profiles out of the box. Free tier (10K MAU) is more than sufficient.
**Implications**: Add `@clerk/nextjs` dependency. ClerkProvider in layout. Middleware for auth routing.

### AD-2: Dual Identity System (Migration Period)
**Decision**: Support both deviceId (legacy) and Clerk userId simultaneously.
**Rationale**: Existing posts use deviceId. Can't break existing data. Gradual migration as users sign in.
**Implications**: Post table gets optional `userId` column. Ownership checks: `userId` first, fall back to `deviceId`. Once all active users migrated, deviceId can be deprecated.

### AD-3: JSON Schema for Form Fields
**Decision**: Store form configuration as JSON in Session.formSchema column.
**Rationale**: SQLite doesn't support dynamic columns. JSON schema is flexible, easy to version, and matches the Luma approach. No schema migrations needed per-field-type.
**Implications**: formSchema column (TEXT/JSON) on Session. fieldResponses column (TEXT/JSON) on Post. Client-side form renderer reads schema.

### AD-4: Media Table for Gallery
**Decision**: Separate Media table (not embedded in Post.imageUrls).
**Rationale**: Gallery needs to query all media across posts. Extra uploads can be added post-creation. Need metadata (type, size, attribution). Current imageUrls stays for backward compat.
**Implications**: New Media table with postId FK. R2 keys stored in Media.url. Gallery queries aggregate across session.

### AD-5: YouTube Playlist via oEmbed/API
**Decision**: Parse YouTube playlist URL client-side, embed individual videos via iframe.
**Rationale**: No backend needed for embedding. YouTube's embed URL format is stable. No API key required for public playlists.
**Implications**: Client-side playlist URL parser. Store playlist URL in Session table. Render embedded iframes in gallery tab.

---

## 7. Database Schema

### New Tables

```sql
-- User profile (synced from Clerk, cached locally for fast queries)
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,        -- Clerk userId
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT DEFAULT '',
    "verified" INTEGER NOT NULL DEFAULT 0, -- 0 = unverified, 1 = verified
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "UserProfile_email_key" ON "UserProfile"("email");

-- Media items (photos/videos attached to posts or session gallery)
CREATE TABLE "Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "postId" TEXT,                          -- NULL if uploaded directly to gallery
    "userId" TEXT,                          -- Clerk userId of uploader
    "url" TEXT NOT NULL,                    -- R2 key or external URL
    "type" TEXT NOT NULL DEFAULT 'image',   -- 'image' | 'video' | 'youtube'
    "mimeType" TEXT DEFAULT '',
    "fileName" TEXT DEFAULT '',
    "sizeBytes" INTEGER DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Media_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE,
    CONSTRAINT "Media_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL
);
CREATE INDEX "Media_sessionId_idx" ON "Media"("sessionId");
CREATE INDEX "Media_postId_idx" ON "Media"("postId");
```

### Altered Tables

```sql
-- Session: add formSchema, creatorUserId, youtubePlaylistUrl
ALTER TABLE "Session" ADD COLUMN "formSchema" TEXT DEFAULT '[]';
ALTER TABLE "Session" ADD COLUMN "creatorUserId" TEXT;
ALTER TABLE "Session" ADD COLUMN "youtubePlaylistUrl" TEXT;

-- Post: add userId, fieldResponses, verified
ALTER TABLE "Post" ADD COLUMN "userId" TEXT;
ALTER TABLE "Post" ADD COLUMN "fieldResponses" TEXT DEFAULT '{}';
ALTER TABLE "Post" ADD COLUMN "verified" INTEGER NOT NULL DEFAULT 0;
```

### Form Schema Format (Session.formSchema)

```json
[
  {
    "id": "name",
    "type": "text",
    "label": "Name",
    "required": true,
    "builtin": true
  },
  {
    "id": "email",
    "type": "email",
    "label": "Email",
    "required": true,
    "builtin": true
  },
  {
    "id": "selfie",
    "type": "photo",
    "label": "Selfie",
    "required": true,
    "builtin": true
  },
  {
    "id": "projectLink",
    "type": "url",
    "label": "Project Link",
    "required": false,
    "builtin": false
  },
  {
    "id": "custom_1",
    "type": "textarea",
    "label": "What are you building?",
    "required": true,
    "builtin": false
  },
  {
    "id": "custom_2",
    "type": "select",
    "label": "Will you demo?",
    "required": false,
    "builtin": false,
    "options": ["Yes", "No", "Maybe"]
  }
]
```

Field types: `text`, `textarea`, `url`, `email`, `phone`, `select`, `photo`

---

## 8. API Surface

### New tRPC Procedures

**Auth-related:**
- `user.syncProfile` (mutation) — Sync Clerk user data to UserProfile table on sign-in
- `user.getProfile` (query) — Get cached user profile by userId

**Form Builder:**
- `session.updateFormSchema` (mutation) — Creator updates form schema for session
- `session.getFormSchema` (query) — Get form schema for session (used by onboarding)

**Media Gallery:**
- `media.upload` (mutation) — Upload media file to R2, create Media record
- `media.listBySession` (query) — List all media for gallery tab
- `media.delete` (mutation) — Delete own media
- `session.updatePlaylistUrl` (mutation) — Set YouTube playlist URL

### Modified tRPC Procedures

- `post.create` — Accept `userId` (from Clerk), `fieldResponses` (JSON), `verified` flag
- `post.listBySession` — Include `verified` flag and `fieldResponses` in response
- `session.create` — Accept `creatorUserId`, `formSchema`
- `session.update` — Accept `creatorUserId` alongside `creatorDeviceId` for ownership

---

## 9. Phased Delivery Plan

### Phase 1: Clerk Auth + Verified Badges ⏳ PLANNED

**Overview**: Add Clerk authentication, Google sign-in, email verification, verified/unverified badges. Maintain backward compatibility with deviceId.

**Implementation Summary**:
1. Install and configure Clerk
2. Add ClerkProvider to layout, middleware for auth routing
3. Create sign-in trigger (modal, not separate page)
4. Update tRPC context with Clerk auth
5. Add userId column to Post, creatorUserId to Session
6. Implement dual-identity ownership checks
7. Add verified/unverified badge UI
8. Migrate session creator ownership to Clerk userId

**Files/Modules**:
- `package.json` — add `@clerk/nextjs`
- `src/app/layout.tsx` — wrap with ClerkProvider
- `src/middleware.ts` — new file, Clerk auth middleware
- `src/server/trpc.ts` — add Clerk auth to context
- `src/server/routers/post.ts` — dual identity support
- `src/server/routers/session.ts` — creatorUserId support
- `src/server/routers/user.ts` — new router for profile sync
- `src/app/[sessionSlug]/page.tsx` — sign-in UI, badges
- `src/app/page.tsx` — creator identity via Clerk
- `src/lib/device.ts` — keep for fallback
- `prisma/migration.sql` — new columns
- `wrangler.jsonc` — Clerk env vars as secrets

**Test Procedure**:
1. Open session page without auth — browse posts freely
2. Click "Join Session" — Google sign-in modal appears
3. Sign in — onboarding starts with pre-filled name/avatar from Google
4. Submit post — appears with "Unverified" badge
5. Verify email in Clerk — refresh — badge shows "Verified"
6. Sign in on different device — same profile, same posts
7. View legacy posts — display correctly without badges

**Verification Queries**:
```sql
SELECT id, userId, deviceId, verified FROM "Post" WHERE sessionId = ?;
SELECT id, creatorUserId, creatorDeviceId FROM "Session" WHERE id = ?;
SELECT * FROM "UserProfile" WHERE id = ?;
```

**Done Criteria**: User signs in with Google, posts with badge, verifies email, sees verified badge, legacy posts work.

---

### Phase 2: Form Builder + Notion Cards ⏳ PLANNED

**Overview**: Session creators define custom fields. Posts store responses as JSON. Cards render fields dynamically.

**Implementation Summary**:
1. Add formSchema column to Session
2. Build form field editor UI (Luma-style)
3. Render dynamic onboarding from schema
4. Store responses in Post.fieldResponses
5. Build Notion-style card renderer for typed fields
6. Backward compat: legacy posts render with hardcoded field mapping

**Files/Modules**:
- `src/components/form-builder.tsx` — new, Luma-style field editor
- `src/components/dynamic-form.tsx` — new, renders form from schema
- `src/components/post-card.tsx` — new, Notion-style card renderer
- `src/components/field-renderers.tsx` — new, per-type field display (url, text, select, etc.)
- `src/server/routers/session.ts` — formSchema CRUD
- `src/server/routers/post.ts` — fieldResponses handling
- `src/app/[sessionSlug]/page.tsx` — integrate dynamic form + cards
- `src/app/page.tsx` — form builder in session creation dialog
- `prisma/migration.sql` — formSchema, fieldResponses columns

**Test Procedure**:
1. Create session — form builder shows built-in fields + "Add Question"
2. Toggle "Mobile" on, add custom text question
3. Join session — onboarding shows Name, Email, Selfie, Mobile, custom question
4. Submit — card shows all fields with proper rendering
5. URL fields are clickable, select fields show as pills
6. Legacy posts display with field mapping from old columns

**Verification Queries**:
```sql
SELECT formSchema FROM "Session" WHERE id = ?;
SELECT fieldResponses FROM "Post" WHERE sessionId = ?;
```

**Done Criteria**: Creator builds custom form, user fills it, card renders all fields correctly, legacy posts unbroken.

---

### Phase 3: Media Gallery ⏳ PLANNED

**Overview**: Multi-file uploads, Media Gallery tab, YouTube playlist embedding.

**Implementation Summary**:
1. Create Media table in D1
2. Build multi-file upload (photos + videos) in post creation
3. Add Media Gallery tab to session page
4. Build extra upload UI (attributed to post)
5. YouTube playlist URL input + video embedding
6. Lightbox for photos, inline player for videos

**Files/Modules**:
- `src/components/media-gallery.tsx` — new, gallery grid with tabs
- `src/components/media-upload.tsx` — new, multi-file upload component
- `src/components/youtube-embed.tsx` — new, playlist parser + embed
- `src/components/lightbox.tsx` — new, photo viewer
- `src/server/routers/media.ts` — new router
- `src/app/api/upload/route.ts` — extend for video uploads
- `src/app/[sessionSlug]/page.tsx` — gallery tab integration
- `prisma/migration.sql` — Media table

**Test Procedure**:
1. Create post with 3 photos and 1 video
2. Post card shows media thumbnails
3. Switch to Media Gallery tab — all session media in grid
4. Upload extra photo from gallery — attributed to your post
5. Paste YouTube playlist URL — videos appear embedded
6. Click photo — lightbox opens. Click video — plays inline.

**Verification Queries**:
```sql
SELECT * FROM "Media" WHERE sessionId = ? ORDER BY createdAt DESC;
SELECT COUNT(*) FROM "Media" WHERE postId = ? AND type = 'video';
SELECT youtubePlaylistUrl FROM "Session" WHERE id = ?;
```

**Done Criteria**: Multi-media uploads work, gallery tab shows all media, YouTube playlist embeds correctly.

---

## 10. RFCs

### RFC-001: Clerk SDK Integration ⏳ PLANNED
**Dependencies**: None
**Summary**: Install Clerk, configure ClerkProvider, add middleware, set up sign-in modal.

**Stage 0: Pre-Phase Research**
- Verify Clerk compatibility with Next.js 16 + Cloudflare Workers
- Check if `@clerk/nextjs` works on edge runtime
- Identify required Clerk env vars for Cloudflare deployment
- Review Clerk docs for sign-in modal (not redirect) approach

**Stage 1: Package Installation**
- Install `@clerk/nextjs`
- Add Clerk env vars to `.env` and Cloudflare secrets
- Verify build still succeeds

**Stage 2: ClerkProvider + Middleware**
- Wrap `layout.tsx` with `<ClerkProvider>`
- Create `middleware.ts` with public routes config (all routes public, auth optional)
- Configure sign-in/sign-up redirect URLs

**Stage 3: Sign-In UI**
- Add sign-in trigger button to session page header
- Use Clerk's `<SignInButton>` with modal mode
- Show user avatar + name when signed in (Clerk's `<UserButton>`)
- Update "Join Session" to prompt sign-in if not authed

**Acceptance Criteria**:
- [ ] ClerkProvider wraps app without errors
- [ ] Middleware allows all routes (viewing is public)
- [ ] Google sign-in modal works
- [ ] Signed-in state persists across page loads
- [ ] Build + deploy to Cloudflare succeeds

**Implementation Checklist**:
```
- [ ] Install @clerk/nextjs
- [ ] Add ClerkProvider to src/app/layout.tsx
- [ ] Create src/middleware.ts with public route config
- [ ] Add SignInButton + UserButton to session page
- [ ] Gate "Join Session" behind auth check
- [ ] Test build locally
- [ ] Deploy to Cloudflare, set Clerk secrets
- [ ] Verify sign-in works on production
```

---

### RFC-002: Dual Identity + tRPC Auth Context ⏳ PLANNED
**Dependencies**: RFC-001
**Summary**: Add Clerk userId to tRPC context, create UserProfile table, implement dual identity (userId + deviceId fallback).

**Stage 1: tRPC Context Update**
- Extract Clerk auth from request in tRPC context creator
- Pass `userId` (nullable) to all procedures
- Create UserProfile sync procedure

**Stage 2: Database Migration**
- Add `userId` column to Post
- Add `creatorUserId` column to Session
- Create UserProfile table
- Run migration on local + production D1

**Stage 3: Dual Identity Ownership**
- Post ownership: check userId first, fall back to deviceId
- Session creator: check creatorUserId first, fall back to creatorDeviceId
- On sign-in: if user has deviceId-based posts, link them to userId

**Stage 4: Profile Sync**
- On first sign-in: create UserProfile from Clerk data (name, email, avatar)
- On subsequent sign-ins: update UserProfile if Clerk data changed
- Link existing deviceId posts to userId via email match

**Acceptance Criteria**:
- [ ] tRPC context includes userId when signed in, null when not
- [ ] New posts created with userId when authed
- [ ] Legacy posts (deviceId only) still editable by device owner
- [ ] Profile sync creates/updates UserProfile on sign-in
- [ ] Email-matched legacy posts linked to Clerk userId

**Implementation Checklist**:
```
- [ ] Update src/server/trpc.ts to extract Clerk auth
- [ ] Create src/server/routers/user.ts with syncProfile procedure
- [ ] Add userId column to Post table (migration.sql)
- [ ] Add creatorUserId column to Session table (migration.sql)
- [ ] Create UserProfile table (migration.sql)
- [ ] Update post.create to store userId when authed
- [ ] Update post ownership checks for dual identity
- [ ] Update session creator checks for dual identity
- [ ] Add post-linking logic (match deviceId posts to userId via email)
- [ ] Run migration on local D1
- [ ] Test: sign in, create post, verify userId in DB
- [ ] Test: legacy post still editable without auth
```

---

### RFC-003: Verified/Unverified Badges ⏳ PLANNED
**Dependencies**: RFC-002
**Summary**: Add verified flag to posts, display badges, update on email verification.

**Stage 1: Badge Logic**
- Add `verified` column to Post (default 0)
- Set verified=1 when user's Clerk email is verified
- Check Clerk `emailAddresses[0].verification.status` on profile sync

**Stage 2: Badge UI**
- Green "Verified" badge with checkmark on verified posts
- Gray "Unverified" on unverified posts
- No badge on legacy posts (pre-auth era)
- Subtle, non-intrusive — small badge near author name

**Stage 3: Verification Flow**
- Unverified user sees "Verify your email" prompt on their post
- Link to Clerk email verification flow
- On return: profile sync updates verified status
- Badge updates on next page load

**Acceptance Criteria**:
- [ ] New posts show Unverified badge by default
- [ ] After email verification, badge shows Verified
- [ ] Legacy posts show no badge (backward compat)
- [ ] Badge is visually clear but not distracting

**Implementation Checklist**:
```
- [ ] Add verified column to Post (migration.sql)
- [ ] Update post.create to set verified based on Clerk email status
- [ ] Update user.syncProfile to check email verification
- [ ] Add badge component to post card UI
- [ ] Add "Verify email" prompt for unverified users
- [ ] Test: new post shows Unverified
- [ ] Test: verify email in Clerk, refresh, shows Verified
- [ ] Test: legacy post shows no badge
```

---

### RFC-004: Session Form Schema ⏳ PLANNED
**Dependencies**: RFC-002
**Summary**: Add formSchema column to Session, build creator-facing field editor.

**Stage 1: Schema Storage**
- Add `formSchema` TEXT column to Session (default: built-in fields JSON)
- Define schema format: array of field objects with id, type, label, required, builtin, options
- Add Zod validation for schema structure

**Stage 2: Form Builder UI**
- Luma-style editor in session creation dialog
- Built-in fields section: Name (always on), Email (always on), Selfie (always on)
- Optional predefined fields: Mobile, Project Link, Contact Info, Demo Intention (toggle on/off)
- Custom Questions section: "Add Question" button
- Per-question: label input, type dropdown (text/textarea/url/select), required toggle, delete button
- For select type: options list with add/remove

**Stage 3: Schema CRUD**
- `session.updateFormSchema` mutation — creator can update fields after creation
- Validation: must always include Name, Email, Selfie (builtin fields can't be removed)
- Schema versioning not needed — new posts use current schema, existing posts keep their fieldResponses

**Acceptance Criteria**:
- [ ] Session creation dialog shows form builder
- [ ] Built-in fields visible and non-removable
- [ ] Optional fields toggle on/off
- [ ] Custom questions added with type selection
- [ ] Schema saved to DB on session create/update
- [ ] Default schema for sessions without custom fields

**Implementation Checklist**:
```
- [ ] Add formSchema column to Session (migration.sql)
- [ ] Create default form schema constant
- [ ] Build src/components/form-builder.tsx
- [ ] Add form builder to session creation dialog (src/app/page.tsx)
- [ ] Add session.updateFormSchema tRPC procedure
- [ ] Add session.getFormSchema tRPC procedure
- [ ] Test: create session with custom fields
- [ ] Test: verify formSchema in DB
- [ ] Test: update form schema after creation
```

---

### RFC-005: Dynamic Onboarding Form ⏳ PLANNED
**Dependencies**: RFC-004
**Summary**: Replace hardcoded onboarding steps with dynamic form rendered from session's formSchema.

**Stage 1: Dynamic Form Renderer**
- Read session's formSchema
- Render each field based on type: text input, textarea, URL input, email input, phone input, select dropdown, photo capture
- Built-in fields (Name, Email, Selfie) use existing UI components
- Validation based on required flag and field type

**Stage 2: Response Storage**
- Post.fieldResponses stores JSON: `{ "fieldId": "value", ... }`
- Built-in fields also stored in fieldResponses (plus legacy columns for backward compat)
- On submit: validate all required fields filled, types correct

**Stage 3: Edit Mode**
- Editing a post pre-fills form from fieldResponses
- Schema changes after post creation: show current fields, ignore removed fields
- New fields added after post creation: show as empty in edit

**Stage 4: Backward Compatibility**
- Legacy posts: map old columns (authorName, content, productLink, etc.) to fieldResponses on read
- No data migration — mapping done at query time

**Acceptance Criteria**:
- [ ] Onboarding renders fields from formSchema
- [ ] All field types render and validate correctly
- [ ] Responses saved as JSON in Post.fieldResponses
- [ ] Edit mode pre-fills from existing responses
- [ ] Legacy posts editable with old field mapping

**Implementation Checklist**:
```
- [ ] Add fieldResponses column to Post (migration.sql)
- [ ] Create src/components/dynamic-form.tsx
- [ ] Create field type renderers (text, textarea, url, select, photo)
- [ ] Replace hardcoded onboarding with dynamic form
- [ ] Update post.create to accept fieldResponses
- [ ] Update post.update to handle fieldResponses
- [ ] Add legacy field mapping in post.listBySession
- [ ] Test: join session with custom fields, submit
- [ ] Test: edit post with dynamic fields
- [ ] Test: legacy post still renders correctly
```

---

### RFC-006: Notion-Style Card Display ⏳ PLANNED
**Dependencies**: RFC-005
**Summary**: Replace current post layout with Notion-style cards that render dynamic fields.

**Stage 1: Card Component**
- New PostCard component that reads fieldResponses
- Per-field rendering: text as text, URLs as clickable links, select as colored pills, email with mailto, phone with tel
- Selfie/avatar as card header
- Author name prominent, other fields in structured layout

**Stage 2: Card Layout**
- Desktop: 2-column card grid
- Mobile: single column stack
- Cards expand/collapse for long content
- Maintain existing pin/save/edit/delete actions

**Stage 3: Field-Specific Renderers**
- `text` — plain text
- `textarea` — multi-line with read-more
- `url` — clickable link with domain preview
- `email` — clickable mailto link
- `phone` — clickable tel link
- `select` — colored pill/badge
- `photo` — thumbnail with lightbox

**Acceptance Criteria**:
- [ ] Posts display as cards with structured fields
- [ ] Each field type renders appropriately
- [ ] Cards responsive on mobile/desktop
- [ ] Pin/save/edit/delete still work
- [ ] Legacy posts render with mapped fields

**Implementation Checklist**:
```
- [ ] Create src/components/post-card.tsx
- [ ] Create src/components/field-renderers.tsx
- [ ] Replace post rendering in session page with PostCard
- [ ] Add expand/collapse for long content
- [ ] Integrate pin/save/edit/delete actions
- [ ] Test: card renders all field types correctly
- [ ] Test: legacy post renders as card with mapped fields
- [ ] Test: mobile responsive layout
```

---

### RFC-007: Multi-File Upload ⏳ PLANNED
**Dependencies**: RFC-002
**Summary**: Support uploading multiple photos and videos per post.

**Stage 1: Media Table**
- Create Media table in D1
- Fields: id, sessionId, postId, userId, url, type, mimeType, fileName, sizeBytes, createdAt

**Stage 2: Upload Endpoint Extension**
- Extend `/api/upload` to accept video files
- Validate file types (image/*, video/mp4, video/quicktime, video/webm)
- Size limits: 10MB per image, 50MB per video
- Return Media record ID + R2 URL

**Stage 3: Multi-File UI**
- Replace single selfie capture with multi-file picker
- Support camera capture + file picker
- Show upload progress per file
- Thumbnails preview before submit
- Remove individual files before submit

**Acceptance Criteria**:
- [ ] Can upload multiple photos per post
- [ ] Can upload videos (mp4, mov, webm)
- [ ] Upload progress shown
- [ ] Files stored in R2 with Media records in D1
- [ ] Size validation enforced

**Implementation Checklist**:
```
- [ ] Create Media table (migration.sql)
- [ ] Extend /api/upload for video support
- [ ] Create src/components/media-upload.tsx
- [ ] Create media tRPC router (src/server/routers/media.ts)
- [ ] Update post creation to use multi-file upload
- [ ] Add upload progress indicator
- [ ] Test: upload 3 photos + 1 video
- [ ] Test: verify in R2 and D1
- [ ] Test: file size rejection works
```

---

### RFC-008: Media Gallery Tab ⏳ PLANNED
**Dependencies**: RFC-007
**Summary**: Add gallery tab to session page showing all media across posts.

**Stage 1: Tab Navigation**
- Add [Posts] [Gallery] tabs to session page
- Default to Posts tab
- Tab state in URL query param or local state

**Stage 2: Gallery Grid**
- Masonry/grid layout for mixed media
- Photos: thumbnail with lightbox on click
- Videos: thumbnail with play overlay, inline player on click
- Attribution: small avatar + name overlay on each media item

**Stage 3: Extra Upload**
- "Add Photos" button in gallery tab
- Upload attributed to user's post in this session
- If no post: prompt to join session first

**Acceptance Criteria**:
- [ ] Gallery tab shows all session media
- [ ] Photos open in lightbox
- [ ] Videos play inline
- [ ] Media attributed to uploader
- [ ] Extra uploads work and attribute correctly

**Implementation Checklist**:
```
- [ ] Create src/components/media-gallery.tsx
- [ ] Create src/components/lightbox.tsx
- [ ] Add tab navigation to session page
- [ ] Add media.listBySession tRPC procedure
- [ ] Add "Add Photos" upload button in gallery
- [ ] Wire up attribution to post
- [ ] Test: gallery shows all media
- [ ] Test: lightbox and video player work
- [ ] Test: extra upload attributed correctly
```

---

### RFC-009: YouTube Playlist Embedding ⏳ PLANNED
**Dependencies**: RFC-008
**Summary**: Session creator can paste YouTube playlist URL, videos display in gallery.

**Stage 1: Playlist URL Input**
- Add `youtubePlaylistUrl` column to Session
- Input field in session settings (creator only)
- Validate YouTube playlist URL format

**Stage 2: Playlist Parser**
- Parse playlist URL to extract playlist ID
- Use YouTube oEmbed or IFrame API to get video list
- Client-side parsing — no API key needed for public playlists
- Fallback: manual video URL entry if playlist parsing fails

**Stage 3: Video Embedding**
- Display YouTube videos in gallery grid alongside uploaded media
- Responsive iframe embeds
- Lazy load for performance
- Visual distinction between uploaded media and YouTube videos

**Acceptance Criteria**:
- [ ] Creator can paste YouTube playlist URL
- [ ] Videos from playlist appear in gallery
- [ ] Videos play inline via YouTube embed
- [ ] Gallery mixes uploaded media + YouTube videos
- [ ] Invalid URLs handled gracefully

**Implementation Checklist**:
```
- [ ] Add youtubePlaylistUrl column to Session (migration.sql)
- [ ] Add session.updatePlaylistUrl tRPC procedure
- [ ] Create src/components/youtube-embed.tsx
- [ ] Add playlist URL input to session settings
- [ ] Parse playlist URL and extract video IDs
- [ ] Render YouTube embeds in gallery grid
- [ ] Test: paste playlist URL, videos appear
- [ ] Test: invalid URL shows error
- [ ] Test: gallery mixes uploaded + YouTube media
```

---

## 11. Rules

### Tech Stack
- Next.js 16 (App Router) on Cloudflare Workers
- Clerk for auth (`@clerk/nextjs`)
- tRPC v11 for API
- Cloudflare D1 (SQLite) — raw SQL via `.prepare().bind()`
- Cloudflare R2 for media storage
- Tailwind CSS v4 + shadcn/ui
- Zod for validation

### Code Standards
- kebab-case file names
- Files under 200 lines — split large components
- No explicit return types — let TypeScript infer
- Result pattern for utility functions (`{ ok: true, data } | { ok: false, error }`)
- `as const` on return objects
- Try/catch with error objects (not throws) in utils
- Conventional commits

### Architecture Patterns
- JSON columns for flexible/dynamic data (formSchema, fieldResponses)
- Dual identity during migration (userId + deviceId)
- Public by default, auth required for mutations
- Component composition over large monolithic files

---

## 12. Verification

### Gap Analysis
- **Clerk + Cloudflare Workers**: Must verify edge runtime compatibility in RFC-001 research phase. If incompatible, fallback to server-side auth check.
- **Video upload size**: R2 supports up to 5GB per object, but Cloudflare Workers have 100MB request size limit. For large videos, may need direct-to-R2 upload (presigned URLs). Address in RFC-007.
- **YouTube playlist parsing**: Public playlists may require YouTube Data API for reliable video listing. Free quota is 10K requests/day. Evaluate in RFC-009 research.
- **Legacy data migration**: No data migration needed — dual identity + field mapping handles backward compat at runtime.

### Quality Assessment
- **Completeness**: 9/10 — All requested features covered
- **Feasibility**: 8/10 — Clerk + Cloudflare Workers needs validation
- **Backward Compat**: 9/10 — Dual identity + field mapping preserves all existing data
- **Complexity Management**: 8/10 — Three independent phases, each shippable

---

## Future Work
- Magic link auth (alternative to Google for users without Google)
- AI content moderation for uploaded media
- Live slideshow mode for venue screens
- Physical QR code templates (Canva integration)
- Event analytics dashboard
- Multi-org support for event companies
- Face recognition photo finder (like Waldo)

---

## Cursor + RIPER-5 Guidance

- **Cursor Plan mode**: Import implementation checklists from each RFC. Execute by phase.
- **RIPER-5**: RESEARCH each RFC first (code patterns, API docs). PLAN detailed steps. Wait for approval. EXECUTE exactly as planned.
- **CRITICAL**: After each RFC, run verification checklist. Do NOT proceed until VERIFIED.
- Reattach this plan file to future sessions for context.

**Each phase requires verification before proceeding to the next.**
