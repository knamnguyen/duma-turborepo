import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { slugify } from "@/lib/utils";

function cuid() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export const sessionRouter = router({
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        date: z.string().min(1),
        description: z.string().max(500),
        creatorDeviceId: z.string().min(1),
        creatorUserId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const slug = slugify(input.name);
      const id = cuid();
      const creatorUserId = input.creatorUserId || ctx.userId || null;

      if (!slug) {
        throw new Error("Session name must produce a valid URL slug");
      }

      // Check slug uniqueness against Session table
      const existing = await ctx.db
        .prepare('SELECT id FROM "Session" WHERE slug = ?')
        .bind(slug)
        .first();

      if (existing) {
        throw new Error("A session with this name already exists");
      }

      // Check slug conflicts with SlugRedirect table and delete stale entries
      const redirectConflict = await ctx.db
        .prepare('SELECT id FROM "SlugRedirect" WHERE "oldSlug" = ?')
        .bind(slug)
        .first();

      if (redirectConflict) {
        await ctx.db
          .prepare('DELETE FROM "SlugRedirect" WHERE "oldSlug" = ?')
          .bind(slug)
          .run();
      }

      await ctx.db
        .prepare(
          'INSERT INTO "Session" (id, name, slug, date, description, "creatorDeviceId", "creatorUserId", createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          id,
          input.name,
          slug,
          input.date,
          input.description,
          input.creatorDeviceId,
          creatorUserId,
          new Date().toISOString()
        )
        .run();

      return { id, name: input.name, slug, date: input.date, description: input.description };
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string().min(1),
        creatorDeviceId: z.string().optional(),
        creatorUserId: z.string().optional(),
        slug: z.string().max(100).optional(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        date: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch current session
      const session = await ctx.db
        .prepare('SELECT * FROM "Session" WHERE id = ?')
        .bind(input.id)
        .first<{
          id: string;
          name: string;
          slug: string;
          date: string;
          description: string;
          creatorDeviceId: string | null;
          creatorUserId: string | null;
          createdAt: string;
        }>();

      if (!session) {
        throw new Error("Session not found");
      }

      // Verify ownership via dual identity
      const userId = input.creatorUserId || ctx.userId || null;
      const isOwnerByUserId = userId && session.creatorUserId && session.creatorUserId === userId;
      const isOwnerByDeviceId = input.creatorDeviceId && session.creatorDeviceId && session.creatorDeviceId === input.creatorDeviceId;
      if (!isOwnerByUserId && !isOwnerByDeviceId) {
        throw new Error("Only the session creator can update this session");
      }

      // Build update fields
      const updates: string[] = [];
      const values: (string | null)[] = [];

      if (input.name !== undefined) {
        updates.push('"name" = ?');
        values.push(input.name);
      }

      if (input.description !== undefined) {
        updates.push('"description" = ?');
        values.push(input.description);
      }

      if (input.date !== undefined) {
        updates.push('"date" = ?');
        values.push(input.date);
      }

      // Handle slug change
      if (input.slug !== undefined) {
        const newSlug = slugify(input.slug);

        if (!newSlug) {
          throw new Error("Slug must contain at least one valid character");
        }

        // Skip if slug hasn't actually changed
        if (newSlug !== session.slug) {
          // Check uniqueness against Session table (exclude current session)
          const slugTaken = await ctx.db
            .prepare('SELECT id FROM "Session" WHERE slug = ? AND id != ?')
            .bind(newSlug, input.id)
            .first();

          if (slugTaken) {
            throw new Error("This slug is already taken by another session");
          }

          // Check uniqueness against SlugRedirect table
          const redirectTaken = await ctx.db
            .prepare('SELECT id FROM "SlugRedirect" WHERE "oldSlug" = ? AND "sessionId" != ?')
            .bind(newSlug, input.id)
            .first();

          if (redirectTaken) {
            throw new Error("This slug is reserved by a redirect from another session");
          }

          // Delete any self-referencing redirect that points back to this session
          // (e.g., if reverting to a previous slug)
          await ctx.db
            .prepare('DELETE FROM "SlugRedirect" WHERE "oldSlug" = ? AND "sessionId" = ?')
            .bind(newSlug, input.id)
            .run();

          // Insert old slug into SlugRedirect
          await ctx.db
            .prepare(
              'INSERT INTO "SlugRedirect" (id, "oldSlug", "sessionId", "createdAt") VALUES (?, ?, ?, ?)'
            )
            .bind(cuid(), session.slug, input.id, new Date().toISOString())
            .run();

          updates.push('"slug" = ?');
          values.push(newSlug);
        }
      }

      if (updates.length === 0) {
        return session;
      }

      values.push(input.id);

      await ctx.db
        .prepare(`UPDATE "Session" SET ${updates.join(", ")} WHERE id = ?`)
        .bind(...values)
        .run();

      // Return updated session
      const updated = await ctx.db
        .prepare('SELECT * FROM "Session" WHERE id = ?')
        .bind(input.id)
        .first<{
          id: string;
          name: string;
          slug: string;
          date: string;
          description: string;
          creatorDeviceId: string | null;
          creatorUserId: string | null;
          createdAt: string;
        }>();

      return updated;
    }),

  list: publicProcedure.query(async ({ ctx }) => {
    const sessions = await ctx.db
      .prepare(
        `SELECT s.*, (SELECT COUNT(*) FROM "Post" WHERE "sessionId" = s.id) as postCount
         FROM "Session" s ORDER BY s.createdAt DESC`
      )
      .all<{
        id: string;
        name: string;
        slug: string;
        date: string;
        description: string;
        createdAt: string;
        postCount: number;
      }>();

    return sessions.results.map((s) => ({
      ...s,
      _count: { posts: s.postCount },
    }));
  }),

  getBySlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db
        .prepare('SELECT * FROM "Session" WHERE slug = ?')
        .bind(input.slug)
        .first<{
          id: string;
          name: string;
          slug: string;
          date: string;
          description: string;
          creatorDeviceId: string | null;
          creatorUserId: string | null;
          createdAt: string;
        }>();

      if (!session) {
        throw new Error("Session not found");
      }

      return session;
    }),

  resolveSlug: publicProcedure
    .input(z.object({ slug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // Check Session table first
      const session = await ctx.db
        .prepare('SELECT slug FROM "Session" WHERE slug = ?')
        .bind(input.slug)
        .first<{ slug: string }>();

      if (session) {
        return { slug: session.slug, redirect: false } as const;
      }

      // Check SlugRedirect table
      const redirect = await ctx.db
        .prepare('SELECT "sessionId" FROM "SlugRedirect" WHERE "oldSlug" = ?')
        .bind(input.slug)
        .first<{ sessionId: string }>();

      if (redirect) {
        // Look up the session's current slug
        const targetSession = await ctx.db
          .prepare('SELECT slug FROM "Session" WHERE id = ?')
          .bind(redirect.sessionId)
          .first<{ slug: string }>();

        if (targetSession) {
          return { slug: targetSession.slug, redirect: true } as const;
        }
      }

      throw new Error("Session not found");
    }),
});
