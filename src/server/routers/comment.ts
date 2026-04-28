import { z } from "zod";
import { router, publicProcedure } from "../trpc";

function cuid() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

interface CommentRow {
  id: string;
  postId: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  deviceId: string;
  userId: string | null;
  createdAt: string;
}

export const commentRouter = router({
  create: publicProcedure
    .input(
      z.object({
        postId: z.string(),
        authorName: z.string().min(1).max(50),
        authorAvatar: z.string(),
        content: z.string().min(1).max(300),
        deviceId: z.string().optional().default(""),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = cuid();
      const userId = input.userId || ctx.userId || null;
      await ctx.db
        .prepare(
          'INSERT INTO "Comment" (id, postId, authorName, authorAvatar, content, deviceId, userId, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        )
        .bind(
          id,
          input.postId,
          input.authorName,
          input.authorAvatar,
          input.content,
          input.deviceId,
          userId,
          new Date().toISOString()
        )
        .run();

      return { id };
    }),

  listByPost: publicProcedure
    .input(z.object({ postId: z.string() }))
    .query(async ({ ctx, input }) => {
      const comments = await ctx.db
        .prepare('SELECT * FROM "Comment" WHERE postId = ? ORDER BY createdAt ASC')
        .bind(input.postId)
        .all<CommentRow>();

      return comments.results;
    }),
});
