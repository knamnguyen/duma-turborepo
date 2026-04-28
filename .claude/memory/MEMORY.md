# Project Memory

## Agent Container Architecture

Per-account Docker containers with persistent volumes for browser automation.

- Each container runs: OpenClaw agent, CloakBrowser (anti-detect Chromium), MITM proxy, Hono file server, noVNC, supervisord
- CloakBrowser server at `packages/openclaw-cloakbrowser/server.js` — Express REST API managing browser sessions
- Container source at `apps/flowser-container/`
- Dockerfile must be built from repo root (COPY paths reference both `apps/` and `packages/`)
- OpenClaw npm package: `openclaw@2026.3.8`
- CloakBrowser npm package: `cloakbrowser`

## Key Conventions

- API dev server: `localhost:8000`
- Docker path: `/Applications/Docker.app/Contents/Resources/bin/docker`
- tRPC pattern: `useTRPC()` → `useQuery(trpc.X.queryOptions(...))` / `useMutation(trpc.X.mutationOptions(...))`
- Instance ID from URL params in Next.js App Router pages
- Flowser webapp at `apps/flowser/`
- tRPC router at `packages/api/src/router/`
- DB schema at `packages/db/schema.sql` (SQLite/libSQL via Drizzle)

## Flowser Webapp Structure

- Next.js App Router with instance-scoped layout at `apps/flowser/src/app/dashboard/instances/[instanceId]/`
- Tabs: overview, chat, browser, files, agents, secrets, settings
- Components organized by domain: `components/chat/`, `components/files/`, `components/browser/`, `components/agents/`
- SessionSidebar for chat history management
- FileBrowser with tree view for container file system

## Standalone Migration

This repo (flowser-turborepo) was migrated from engagekit-turborepo to be a standalone product.
Migration plan: `process/plans/flowser-standalone-migration_PLAN_22-03-26.md`

## currentDate

Today's date is 2026-03-22.
