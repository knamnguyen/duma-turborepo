import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getClerkUserInfo } from "@/lib/clerk-helpers";

interface UserProfileRow {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  verified: number;
  createdAt: string;
  updatedAt: string;
}

export const userRouter = router({
  syncProfile: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.userId) {
      throw new Error("Must be signed in");
    }

    const info = await getClerkUserInfo(ctx.userId);
    if (!info.ok) {
      throw new Error(info.error);
    }

    const now = new Date().toISOString();

    await ctx.db
      .prepare(
        `INSERT OR REPLACE INTO "UserProfile" (id, email, name, avatarUrl, verified, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, COALESCE((SELECT createdAt FROM "UserProfile" WHERE id = ?), ?), ?)`
      )
      .bind(
        ctx.userId,
        info.email,
        info.name,
        info.avatarUrl,
        info.verified ? 1 : 0,
        ctx.userId,
        now,
        now
      )
      .run();

    const profile = await ctx.db
      .prepare('SELECT * FROM "UserProfile" WHERE id = ?')
      .bind(ctx.userId)
      .first<UserProfileRow>();

    return profile;
  }),

  getProfile: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.db
        .prepare('SELECT * FROM "UserProfile" WHERE id = ?')
        .bind(input.userId)
        .first<UserProfileRow>();

      return profile ?? null;
    }),
});
