import { z } from "zod";
import { router, publicProcedure } from "../trpc";

function cuid() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

interface MediaRow {
  id: string;
  sessionId: string;
  postId: string | null;
  userId: string | null;
  deviceId: string | null;
  url: string;
  type: string;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
}

interface MediaWithAuthor extends MediaRow {
  authorName: string | null;
  authorAvatar: string | null;
}

const mediaFileInput = z.object({
  url: z.string(),
  type: z.enum(["image", "video"]),
  mimeType: z.string().default(""),
  fileName: z.string().default(""),
  sizeBytes: z.number().default(0),
});

export const mediaRouter = router({
  upload: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        postId: z.string().optional(),
        deviceId: z.string().optional(),
        files: z.array(mediaFileInput).min(1).max(20),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.userId || null;
      const ids: string[] = [];

      for (const file of input.files) {
        const id = cuid();
        await ctx.db
          .prepare(
            'INSERT INTO "Media" (id, "sessionId", "postId", "userId", "deviceId", url, type, "mimeType", "fileName", "sizeBytes", "createdAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
          )
          .bind(
            id,
            input.sessionId,
            input.postId || null,
            userId,
            input.deviceId || null,
            file.url,
            file.type,
            file.mimeType,
            file.fileName,
            file.sizeBytes,
            new Date().toISOString()
          )
          .run();
        ids.push(id);
      }

      return { ids } as const;
    }),

  listBySession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .prepare(
          `SELECT m.*, p."authorName", p."authorAvatar"
           FROM "Media" m
           LEFT JOIN "Post" p ON m."postId" = p.id
           WHERE m."sessionId" = ?
           ORDER BY m."createdAt" DESC`
        )
        .bind(input.sessionId)
        .all<MediaWithAuthor>();

      return rows.results.map((row) => ({
        id: row.id,
        sessionId: row.sessionId,
        postId: row.postId,
        userId: row.userId,
        deviceId: row.deviceId,
        url: row.url,
        type: row.type as "image" | "video",
        mimeType: row.mimeType,
        fileName: row.fileName,
        sizeBytes: row.sizeBytes,
        createdAt: row.createdAt,
        authorName: row.authorName || "Anonymous",
        authorAvatar: row.authorAvatar || "",
      }));
    }),

  delete: publicProcedure
    .input(
      z.object({
        id: z.string(),
        deviceId: z.string().optional(),
        userId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = input.userId || ctx.userId || null;

      const existing = await ctx.db
        .prepare(
          'SELECT id FROM "Media" WHERE id = ? AND ("userId" = ? OR "deviceId" = ?)'
        )
        .bind(input.id, userId, input.deviceId || "")
        .first();

      if (!existing) {
        throw new Error("Media not found or not yours");
      }

      await ctx.db
        .prepare('DELETE FROM "Media" WHERE id = ?')
        .bind(input.id)
        .run();

      return { ok: true } as const;
    }),
});
