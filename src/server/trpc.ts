import { initTRPC } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";

function getDb(): D1Database {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLocalD1 } = require("@/lib/local-db");
    return getLocalD1();
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getCloudflareContext } = require("@opennextjs/cloudflare");
  const { env } = getCloudflareContext();
  return env.DB as D1Database;
}

export async function createTRPCContext() {
  const { userId } = await auth();
  return { db: getDb(), userId: userId as string | null };
}

const t = initTRPC.context<typeof createTRPCContext>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
