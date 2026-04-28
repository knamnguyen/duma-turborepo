import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getClerkUserEmail } from "@/lib/clerk-helpers";

function cuid() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

interface PostRow {
  id: string;
  sessionId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  imageUrls: string;
  deviceId: string;
  productLink: string;
  contactInfo: string;
  demoIntention: string;
  email: string | null;
  userId: string | null;
  verified: number;
  fieldResponses: string | null;
  createdAt: string;
  commentCount: number;
}

const postInput = z.object({
  sessionId: z.string(),
  authorName: z.string().min(1).max(50),
  authorAvatar: z.string(),
  content: z.string().max(1000).default(""),
  imageUrls: z.array(z.string()).default([]),
  deviceId: z.string().optional().default(""),
  userId: z.string().optional(),
  productLink: z.string().default(""),
  contactInfo: z.string().default(""),
  demoIntention: z.enum(["yes", "no", "later", ""]).default(""),
  email: z.string().email().max(254).transform((v) => v.trim().toLowerCase()),
  fieldResponses: z.string().default("{}"),
});

export const postRouter = router({
  create: publicProcedure.input(postInput).mutation(async ({ ctx, input }) => {
    const id = cuid();
    const userId = input.userId || ctx.userId || null;

    let verified = 0;
    if (userId) {
      const clerkInfo = await getClerkUserEmail(userId);
      if (clerkInfo.ok && clerkInfo.verified && clerkInfo.email === input.email) {
        verified = 1;
      }
    }

    try {
      await ctx.db
        .prepare(
          'INSERT INTO "Post" (id, sessionId, authorName, authorAvatar, content, imageUrls, deviceId, productLink, contactInfo, demoIntention, email, userId, verified, "fieldResponses", createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          id,
          input.sessionId,
          input.authorName,
          input.authorAvatar,
          input.content,
          JSON.stringify(input.imageUrls),
          input.deviceId,
          input.productLink,
          input.contactInfo,
          input.demoIntention,
          input.email,
          userId,
          verified,
          input.fieldResponses,
          new Date().toISOString()
        )
        .run();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("UNIQUE") && message.includes("email")) {
        throw new Error("This email is already used in this session");
      }
      throw err;
    }

    return { id };
  }),

  claimProfile: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        email: z.string().email().max(254).transform((v) => v.trim().toLowerCase()),
        newDeviceId: z.string(),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = input.userId || ctx.userId || null;

      // If signed in, verify Clerk email matches the claim email
      if (userId) {
        const clerkInfo = await getClerkUserEmail(userId);
        if (clerkInfo.ok && clerkInfo.email !== input.email) {
          throw new Error("You can only claim posts matching your verified email");
        }
      }

      // Check if claimer already has a post in this session
      const existingPost = await ctx.db
        .prepare('SELECT id FROM "Post" WHERE sessionId = ? AND (deviceId = ? OR userId = ?) LIMIT 1')
        .bind(input.sessionId, input.newDeviceId, userId)
        .first();

      if (existingPost) {
        throw new Error("You already have a post in this session");
      }

      // Find post by sessionId + email — check if it exists at all first
      const anyPost = await ctx.db
        .prepare('SELECT id, deviceId, userId FROM "Post" WHERE sessionId = ? AND LOWER(email) = ? LIMIT 1')
        .bind(input.sessionId, input.email)
        .first<{ id: string; deviceId: string; userId: string | null }>();

      if (!anyPost) {
        throw new Error("No post found with this email in this session");
      }

      if (anyPost.userId) {
        throw new Error("This post is already linked to an account");
      }

      // Transfer ownership — update both deviceId and userId
      await ctx.db
        .prepare('UPDATE "Post" SET deviceId = ?, userId = ? WHERE id = ? AND userId IS NULL')
        .bind(input.newDeviceId, userId, anyPost.id)
        .run();

      return { id: anyPost.id };
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        deviceId: z.string().optional(),
        userId: z.string().optional(),
        authorName: z.string().min(1).max(50).optional(),
        authorAvatar: z.string().optional(),
        content: z.string().max(1000).optional(),
        imageUrls: z.array(z.string()).optional(),
        productLink: z.string().optional(),
        contactInfo: z.string().optional(),
        demoIntention: z.enum(["yes", "no", "later", ""]).optional(),
        fieldResponses: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = input.userId || ctx.userId || null;
      // Verify ownership via dual identity
      const existing = await ctx.db
        .prepare('SELECT id FROM "Post" WHERE id = ? AND (userId = ? OR deviceId = ?)')
        .bind(input.id, userId, input.deviceId || "")
        .first();

      if (!existing) {
        throw new Error("Post not found or not yours");
      }

      const sets: string[] = [];
      const values: unknown[] = [];

      if (input.authorName !== undefined) { sets.push('"authorName" = ?'); values.push(input.authorName); }
      if (input.authorAvatar !== undefined) { sets.push('"authorAvatar" = ?'); values.push(input.authorAvatar); }
      if (input.content !== undefined) { sets.push('"content" = ?'); values.push(input.content); }
      if (input.imageUrls !== undefined) { sets.push('"imageUrls" = ?'); values.push(JSON.stringify(input.imageUrls)); }
      if (input.productLink !== undefined) { sets.push('"productLink" = ?'); values.push(input.productLink); }
      if (input.contactInfo !== undefined) { sets.push('"contactInfo" = ?'); values.push(input.contactInfo); }
      if (input.demoIntention !== undefined) { sets.push('"demoIntention" = ?'); values.push(input.demoIntention); }
      if (input.fieldResponses !== undefined) { sets.push('"fieldResponses" = ?'); values.push(input.fieldResponses); }

      if (sets.length === 0) return { id: input.id };

      values.push(input.id);
      await ctx.db
        .prepare(`UPDATE "Post" SET ${sets.join(", ")} WHERE id = ?`)
        .bind(...values)
        .run();

      return { id: input.id };
    }),

  listBySession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const posts = await ctx.db
        .prepare(
          `SELECT p.*, (SELECT COUNT(*) FROM "Comment" WHERE "postId" = p.id) as commentCount
           FROM "Post" p WHERE p.sessionId = ? ORDER BY p.createdAt DESC`
        )
        .bind(input.sessionId)
        .all<PostRow>();

      return posts.results.map((post) => ({
        ...post,
        imageUrls: JSON.parse(post.imageUrls) as string[],
        fieldResponses: post.fieldResponses || "{}",
        _count: { comments: post.commentCount },
      }));
    }),

  getMyPost: publicProcedure
    .input(z.object({ sessionId: z.string(), deviceId: z.string().optional(), userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const userId = input.userId || ctx.userId || null;
      const post = await ctx.db
        .prepare('SELECT * FROM "Post" WHERE sessionId = ? AND (userId = ? OR deviceId = ?) LIMIT 1')
        .bind(input.sessionId, userId, input.deviceId || "")
        .first<PostRow>();

      if (!post) return null;

      return {
        ...post,
        imageUrls: JSON.parse(post.imageUrls) as string[],
        fieldResponses: post.fieldResponses || "{}",
      };
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string(), deviceId: z.string().optional(), userId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const userId = input.userId || ctx.userId || null;
      const existing = await ctx.db
        .prepare('SELECT id FROM "Post" WHERE id = ? AND (userId = ? OR deviceId = ?)')
        .bind(input.id, userId, input.deviceId || "")
        .first();

      if (!existing) {
        throw new Error("Post not found or not yours");
      }

      await ctx.db.prepare('DELETE FROM "Comment" WHERE "postId" = ?').bind(input.id).run();
      await ctx.db.prepare('DELETE FROM "Post" WHERE id = ?').bind(input.id).run();

      return { ok: true } as const;
    }),

  hasPostedInSession: publicProcedure
    .input(z.object({ sessionId: z.string(), deviceId: z.string().optional(), userId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const userId = input.userId || ctx.userId || null;
      const post = await ctx.db
        .prepare('SELECT id FROM "Post" WHERE sessionId = ? AND (userId = ? OR deviceId = ?) LIMIT 1')
        .bind(input.sessionId, userId, input.deviceId || "")
        .first();

      return { hasPosted: !!post };
    }),

  autoLink: publicProcedure
    .input(z.object({ deviceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        return { autoLinked: [], candidates: [], mismatched: [] } as const;
      }

      const clerkInfo = await getClerkUserEmail(ctx.userId);
      if (!clerkInfo.ok) {
        return { autoLinked: [], candidates: [], mismatched: [] } as const;
      }

      // Find posts with matching email that are unclaimed
      const emailMatches = await ctx.db
        .prepare(
          'SELECT id, deviceId, authorName, content, createdAt, sessionId FROM "Post" WHERE LOWER(email) = ? AND userId IS NULL'
        )
        .bind(clerkInfo.email)
        .all<{ id: string; deviceId: string; authorName: string; content: string; createdAt: string; sessionId: string }>();

      const sameDevice = emailMatches.results.filter((p) => p.deviceId === input.deviceId);
      const crossDevice = emailMatches.results.filter((p) => p.deviceId !== input.deviceId);

      // Auto-link same-device posts silently
      if (sameDevice.length > 0) {
        const placeholders = sameDevice.map(() => "?").join(",");
        await ctx.db
          .prepare(
            `UPDATE "Post" SET userId = ?, verified = 1 WHERE id IN (${placeholders}) AND userId IS NULL`
          )
          .bind(ctx.userId, ...sameDevice.map((p) => p.id))
          .run();
      }

      // Find same-device posts with different email (mismatch)
      const mismatchResults = await ctx.db
        .prepare(
          'SELECT id, email, authorName, content, createdAt FROM "Post" WHERE deviceId = ? AND userId IS NULL AND email IS NOT NULL AND LOWER(email) != ?'
        )
        .bind(input.deviceId, clerkInfo.email)
        .all<{ id: string; email: string; authorName: string; content: string; createdAt: string }>();

      return {
        autoLinked: sameDevice.map((p) => p.id),
        candidates: crossDevice.map((p) => ({
          id: p.id,
          sessionId: p.sessionId,
          authorName: p.authorName,
          content: p.content,
          createdAt: p.createdAt,
        })),
        mismatched: mismatchResults.results.map((p) => ({
          id: p.id,
          email: p.email,
          authorName: p.authorName,
          content: p.content,
          createdAt: p.createdAt,
        })),
      } as const;
    }),

  confirmLink: publicProcedure
    .input(z.object({ postIds: z.array(z.string()).min(1), deviceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new Error("Must be signed in");
      }

      const linked: string[] = [];
      for (const postId of input.postIds) {
        const result = await ctx.db
          .prepare('UPDATE "Post" SET userId = ?, verified = 1, deviceId = ? WHERE id = ? AND userId IS NULL')
          .bind(ctx.userId, input.deviceId, postId)
          .run();
        if (result.meta?.changes && result.meta.changes > 0) {
          linked.push(postId);
        }
      }

      return { linked } as const;
    }),

  handleMismatch: publicProcedure
    .input(z.object({
      postId: z.string(),
      action: z.enum(["link", "delete", "leave"]),
      deviceId: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ctx.userId) {
        throw new Error("Must be signed in");
      }

      if (input.action === "link") {
        await ctx.db
          .prepare('UPDATE "Post" SET userId = ?, verified = 1 WHERE id = ? AND userId IS NULL AND deviceId = ?')
          .bind(ctx.userId, input.postId, input.deviceId)
          .run();
      } else if (input.action === "delete") {
        // Verify ownership via deviceId before deleting
        const existing = await ctx.db
          .prepare('SELECT id FROM "Post" WHERE id = ? AND deviceId = ? AND userId IS NULL')
          .bind(input.postId, input.deviceId)
          .first();
        if (existing) {
          await ctx.db.prepare('DELETE FROM "Comment" WHERE "postId" = ?').bind(input.postId).run();
          await ctx.db.prepare('DELETE FROM "Post" WHERE id = ?').bind(input.postId).run();
        }
      }
      // "leave" is a no-op

      return { ok: true } as const;
    }),
});
