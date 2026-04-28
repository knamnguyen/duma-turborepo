# all-context.md

## 1. Project Overview

**session.buildstuffs.com** is an interactive event session platform where organizers create sessions and attendees share posts with selfies, project links, contact info, and demo intentions. It is a real-time, social-feed-style app designed for in-person events (hackathons, meetups, offsites).

- **Domain**: `session.buildstuffs.com`
- **Cloudflare Worker name**: `session-buildstuffs`
- **Repository**: Single Next.js app

---

## 2. Technology Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.2.4 | App Router framework |
| React | 19.2.4 | UI library |
| TypeScript | ^5 | Language |
| tRPC | ^11.16.0 | Type-safe API layer |
| TanStack React Query | ^5.100.1 | Server state management |
| Clerk | ^7.2.7 (`@clerk/nextjs`) | Authentication (Google + email) |
| Prisma Client | ^7.8.0 | Generated types only (raw D1 SQL at runtime) |
| @prisma/adapter-d1 | ^7.8.0 | D1 adapter (Prisma generate only, not runtime) |
| Tailwind CSS | ^4 | Styling (v4 with `@theme inline` syntax) |
| shadcn/ui (Radix) | Various | UI primitives (Dialog, Label, ScrollArea, Slot) |
| Zod | ^3.25.76 | Input validation |
| nanoid | ^5.1.9 | Device ID generation |
| qrcode.react | ^4.2.0 | QR code rendering for session sharing |
| sonner | ^2.0.7 | Toast notifications |
| lucide-react | ^1.9.0 | Icons |
| OpenNext for Cloudflare | ^1.19.4 | Cloudflare Pages deployment adapter |
| Wrangler | ^4.84.1 | Cloudflare CLI |
| better-sqlite3 | ^12.9.0 | Local development D1 emulation |

---

## 3. Architecture

### Runtime Model

- **Production**: Next.js compiled via `opennextjs-cloudflare` → deployed as a Cloudflare Worker
- **Database**: Cloudflare D1 (SQLite) accessed via raw SQL through D1 binding (NOT Prisma ORM at runtime)
- **Storage**: Cloudflare R2 bucket (`session-images`) for image uploads
- **Auth**: Clerk middleware on all routes; userId extracted in tRPC context
- **Local Dev**: `better-sqlite3` wrapper that emulates the D1 API (`src/lib/local-db.ts`)

### Request Flow

```
Browser → Clerk Middleware → Next.js App Router
  ├── Pages (RSC/Client) → tRPC React Query hooks
  └── API Routes
       ├── /api/trpc/[trpc] → tRPC fetchRequestHandler → D1
       ├── /api/upload (POST) → R2 put (prod) or base64 data URL (dev)
       └── /api/upload/[id] (GET) → R2 get → stream image
```

### Key Architectural Decisions

1. **Raw D1 SQL instead of Prisma ORM**: Prisma WASM does not work on Cloudflare Workers. Prisma is used only for schema definition and client type generation. All runtime queries use `ctx.db.prepare(sql).bind(...).run/first/all()`.
2. **Dual Identity System**: Posts/sessions track ownership via both `deviceId` (localStorage nanoid) AND `userId` (Clerk). Ownership checks use OR logic: `userId = ? OR deviceId = ?`.
3. **No protected procedures**: All tRPC procedures use `publicProcedure`. Auth is contextual — `ctx.userId` is available when signed in but not required.

---

## 4. Directory Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout: ClerkProvider + TRPCReactProvider + Toaster
│   ├── page.tsx                # Home page: session list + create dialog
│   ├── globals.css             # Tailwind v4 config + glass/masonry utilities
│   ├── [sessionSlug]/
│   │   └── page.tsx            # Session detail page (~900 lines, main feature page)
│   └── api/
│       ├── trpc/[trpc]/route.ts  # tRPC HTTP handler
│       └── upload/
│           ├── route.ts          # POST: upload images to R2
│           └── [id]/route.ts     # GET: serve images from R2
├── server/
│   ├── trpc.ts                 # tRPC init, context creation (db + userId)
│   └── routers/
│       ├── _app.ts             # Root router (session + post + comment)
│       ├── session.ts          # Session CRUD + slug resolution
│       ├── post.ts             # Post CRUD + auto-link + claim profile
│       └── comment.ts          # Comment create + list
├── trpc/
│   └── client.tsx              # tRPC React client + QueryClientProvider
├── lib/
│   ├── db.ts                   # D1 query helpers (getDb, queryAll, queryFirst, execute)
│   ├── local-db.ts             # better-sqlite3 D1 emulation for local dev
│   ├── device.ts               # localStorage device identity (deviceId + name + avatar)
│   ├── post-preferences.ts     # localStorage pin/save post preferences
│   ├── clerk-helpers.ts        # Server-side Clerk user email lookup
│   ├── use-auto-link.ts        # Client hook: auto-link posts on sign-in
│   └── utils.ts                # cn(), slugify(), timeAgo()
├── components/
│   ├── ui/                     # shadcn/ui primitives (button, dialog, input, label, textarea)
│   ├── verified-badge.tsx      # Verified/Unverified badge component
│   ├── auto-link-confirm-modal.tsx  # Cross-device post linking confirmation
│   └── email-mismatch-modal.tsx     # Email mismatch resolution dialog
├── middleware.ts               # Clerk middleware (all routes)
└── env.d.ts                    # CloudflareEnv type declarations
```

### Non-src Files

| File | Purpose |
|---|---|
| `wrangler.jsonc` | Cloudflare Worker config (D1 binding, R2 binding, route) |
| `open-next.config.ts` | OpenNext Cloudflare adapter config |
| `prisma/schema.prisma` | **STALE** — missing columns added via migration.sql |
| `prisma/migration.sql` | **SOURCE OF TRUTH** for database schema |
| `prisma.config.ts` | Local Prisma dev config (file:./dev.db) |
| `local.db` | Local SQLite database file (gitignored) |

---

## 5. Database Schema

**Source of truth**: `prisma/migration.sql`

> **Note**: `prisma/schema.prisma` is STALE. It is missing: `productLink`, `contactInfo`, `demoIntention`, `email`, `userId`, `verified` on Post; `creatorDeviceId`, `creatorUserId` on Session; `userId` on Comment; and the entire `SlugRedirect` table.

### Tables

#### Session

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | cuid-like random ID |
| name | TEXT NOT NULL | Display name |
| slug | TEXT NOT NULL UNIQUE | URL slug (auto-generated from name) |
| date | TEXT NOT NULL | Event date string |
| description | TEXT NOT NULL | Session description |
| creatorDeviceId | TEXT | Device that created the session |
| creatorUserId | TEXT | Clerk userId that created the session |
| createdAt | DATETIME | Default CURRENT_TIMESTAMP |

#### Post

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | cuid-like random ID |
| sessionId | TEXT NOT NULL FK→Session | Cascade delete |
| authorName | TEXT NOT NULL | Display name |
| authorAvatar | TEXT NOT NULL | Avatar URL (DiceBear) |
| content | TEXT NOT NULL | Post body text |
| imageUrls | TEXT NOT NULL DEFAULT '[]' | JSON array of image URLs |
| deviceId | TEXT NOT NULL | Device ownership |
| productLink | TEXT DEFAULT '' | Product/project link |
| contactInfo | TEXT DEFAULT '' | Contact info |
| demoIntention | TEXT DEFAULT '' | "yes" / "no" / "later" |
| email | TEXT | User email (unique per session) |
| userId | TEXT | Clerk userId (set on sign-in or auto-link) |
| verified | INTEGER NOT NULL DEFAULT 0 | 1 if Clerk email matches post email |
| createdAt | DATETIME | Default CURRENT_TIMESTAMP |

**Indexes**: `sessionId`, `deviceId`, UNIQUE(`sessionId`, `email`)

#### Comment

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | cuid-like random ID |
| postId | TEXT NOT NULL FK→Post | Cascade delete |
| authorName | TEXT NOT NULL | |
| authorAvatar | TEXT NOT NULL | |
| content | TEXT NOT NULL | |
| deviceId | TEXT NOT NULL | |
| userId | TEXT | Clerk userId |
| createdAt | DATETIME | |

**Index**: `postId`

#### SlugRedirect

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| oldSlug | TEXT NOT NULL UNIQUE | Previous slug value |
| sessionId | TEXT NOT NULL | Points to session's current ID |
| createdAt | DATETIME | |

#### Image (legacy)

| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | |
| data | TEXT NOT NULL | Base64 data (legacy, R2 used now) |
| contentType | TEXT NOT NULL | |
| createdAt | DATETIME | |

---

## 6. API Surface

### tRPC Routers (`/api/trpc`)

All procedures are `publicProcedure` (no auth guard). Context provides `{ db: D1Database, userId: string | null }`.

#### session router

| Procedure | Type | Input | Description |
|---|---|---|---|
| `session.create` | mutation | `{ name, date, description, creatorDeviceId, creatorUserId? }` | Create session with auto-generated slug |
| `session.update` | mutation | `{ id, creatorDeviceId?, creatorUserId?, slug?, name?, description?, date? }` | Update session (dual-identity ownership check) |
| `session.list` | query | — | List all sessions with post counts, ordered by createdAt DESC |
| `session.getBySlug` | query | `{ slug }` | Get session by slug |
| `session.resolveSlug` | query | `{ slug }` | Resolve slug: returns `{ slug, redirect: false }` or `{ slug, redirect: true }` for old slugs |

#### post router

| Procedure | Type | Input | Description |
|---|---|---|---|
| `post.create` | mutation | `{ sessionId, authorName, authorAvatar, content, imageUrls, deviceId, userId?, productLink, contactInfo, demoIntention, email }` | Create post; auto-verifies if Clerk email matches |
| `post.update` | mutation | `{ id, deviceId?, userId?, authorName?, content?, imageUrls?, productLink?, contactInfo?, demoIntention? }` | Update own post (dual-identity check) |
| `post.delete` | mutation | `{ id, deviceId?, userId? }` | Delete own post + its comments |
| `post.listBySession` | query | `{ sessionId }` | List posts with comment counts |
| `post.getMyPost` | query | `{ sessionId, deviceId?, userId? }` | Get current user's post in session |
| `post.hasPostedInSession` | query | `{ sessionId, deviceId?, userId? }` | Check if user has posted |
| `post.claimProfile` | mutation | `{ sessionId, email, newDeviceId, userId? }` | Transfer post ownership by email |
| `post.autoLink` | mutation | `{ deviceId }` | On sign-in: auto-link same-device posts, surface cross-device candidates and mismatches |
| `post.confirmLink` | mutation | `{ postIds, deviceId }` | Confirm linking cross-device posts |
| `post.handleMismatch` | mutation | `{ postId, action: "link"/"delete"/"leave", deviceId }` | Handle email mismatch posts |

#### comment router

| Procedure | Type | Input | Description |
|---|---|---|---|
| `comment.create` | mutation | `{ postId, authorName, authorAvatar, content, deviceId?, userId? }` | Create comment |
| `comment.listByPost` | query | `{ postId }` | List comments by post, ordered ASC |

### REST API Routes

| Route | Method | Description |
|---|---|---|
| `/api/upload` | POST | Upload images (FormData with `files`). Returns `{ urls: string[] }`. Dev: base64 data URLs. Prod: R2 storage. |
| `/api/upload/[id]` | GET | Serve image from R2. 1-year cache header. |

---

## 7. Key Patterns & Conventions

### Dual Identity (deviceId + userId)

Every ownership check uses OR logic:
```sql
WHERE (userId = ? OR deviceId = ?)
```
- Anonymous users identified by `deviceId` (nanoid stored in localStorage)
- Signed-in users additionally have `userId` (Clerk)
- Posts created before sign-in can be claimed/linked after sign-in

### Auto-Link Flow (on sign-in)

1. `useAutoLink` hook fires `post.autoLink` mutation when user signs in
2. Server finds unclaimed posts matching Clerk email:
   - **Same device + matching email**: Auto-linked silently (userId + verified set)
   - **Different device + matching email**: Surface as candidates in `AutoLinkConfirmModal`
   - **Same device + different email**: Surface in `EmailMismatchModal` (link/delete/leave)

### Result Pattern

Server-side helpers return `{ ok: true, ... } as const | { ok: false, error: string } as const` (see `clerk-helpers.ts`). tRPC procedures throw errors directly.

### Slug Resolution

1. Client navigates to `/{sessionSlug}`
2. `session.resolveSlug` checks `Session` table first, then `SlugRedirect` table
3. If found in redirect table, returns `{ slug: currentSlug, redirect: true }`
4. Client-side redirect to the new slug URL via `router.replace`
5. On slug update, old slug is stored in `SlugRedirect` table

### Verified Badges

- When a post is created by a signed-in user whose Clerk primary email matches the post's email field, `verified = 1`
- `VerifiedBadge` component renders green "Verified" or gray "Unverified" badge
- Auto-link also sets `verified = 1` when linking

### ID Generation

Uses a custom `cuid()` function: `Math.random().toString(36).substring(2) + Date.now().toString(36)`. Used for all entity IDs.

### Client State

- **Device identity**: `localStorage` key `session-app-device` → `{ deviceId, name, avatarUrl }`
- **Post preferences**: `localStorage` keys `buildstuffs:pinned` and `buildstuffs:saved` → Set of post IDs
- **TanStack Query**: 30s stale time, no refetch on window focus

---

## 8. Environment & Deployment

### Cloudflare Configuration (`wrangler.jsonc`)

| Binding | Type | Name/ID |
|---|---|---|
| `DB` | D1 Database | `session-db` |
| `R2` | R2 Bucket | `session-images` |
| `ASSETS` | Assets | `.open-next/assets` |

**Route**: `session.buildstuffs.com/*` on zone `buildstuffs.com`
**Compatibility**: `2025-04-01`, `nodejs_compat_v2`

### Build & Deploy

```bash
pnpm build          # Next.js build
pnpm build:cf       # OpenNext Cloudflare build
pnpm deploy         # build:cf + wrangler deploy
pnpm db:push        # Push migration.sql to remote D1
```

### Local Development

- `pnpm dev` → Next.js dev server
- D1 emulated via `better-sqlite3` at `./local.db`
- Images stored as base64 data URLs (no R2 locally)
- `trpc.ts` switches between local and Cloudflare DB based on `NODE_ENV`

---

## 9. Import Aliases

| Alias | Path |
|---|---|
| `@/*` | `./src/*` |

Configured in `tsconfig.json` with `"paths": { "@/*": ["./src/*"] }`.

---

## 10. Current State

### What's Implemented

- Full session CRUD with slug-based routing and slug redirect system
- Post creation with selfie, bio, product link, contact info, demo intention, email
- Image upload to R2 (production) with local base64 fallback
- Comment system on posts
- Clerk authentication with Google sign-in
- Dual identity system (deviceId + userId)
- Auto-link flow for post ownership transfer on sign-in
- Verified/Unverified badges on posts
- Post claim by email
- Session editing by owner (name, description, date, slug)
- Post editing/deletion by owner
- Pin/save post preferences (client-side only)
- QR code sharing for sessions
- Dark theme with glassmorphism design
- Masonry layout for post grid
- Responsive design (mobile-first)

### Plans Status

| Plan | Status |
|---|---|
| `session-enhancements_PLAN_25-04-26.md` | Phases 1-3 implemented, Phase 4 (deploy) unverified |
| `platform-evolution_PLAN_26-04-26.md` | Phase 1 ~90% done (missing UserProfile table, email verify prompt); Phases 2-3 not started |
| `rfc003-verified-badges_PLAN_27-04-26.md` | All 14 items implemented |

### What's NOT Implemented (from Platform Evolution plan)

- **UserProfile table** — cache Clerk user data locally
- **Email verify prompt** — prompt unverified users to verify via Clerk
- **Phase 2**: Luma-style form builder (custom fields per session), Notion-style card display
- **Phase 3**: Media gallery tab, video uploads, YouTube playlist embedding

### Known Architecture Notes

- `prisma/schema.prisma` is stale and does not reflect the actual database schema
- The `[sessionSlug]/page.tsx` file is ~900 lines (could benefit from splitting)
- The `Image` table in migration.sql is a legacy artifact (R2 is used now)
- No test files exist in the repository
- No CI/CD pipeline configuration
- Nothing has been committed yet (all work is uncommitted on top of initial Next.js commit)
