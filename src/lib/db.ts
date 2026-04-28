// Direct D1 query helpers (Prisma WASM doesn't work on Workers)

export function getDb() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getCloudflareContext } = require("@opennextjs/cloudflare");
  const { env } = getCloudflareContext();
  return env.DB as D1Database;
}

export async function queryAll<T>(db: D1Database, sql: string, ...params: unknown[]) {
  const stmt = db.prepare(sql).bind(...params);
  const result = await stmt.all<T>();
  return result.results;
}

export async function queryFirst<T>(db: D1Database, sql: string, ...params: unknown[]) {
  const stmt = db.prepare(sql).bind(...params);
  return stmt.first<T>();
}

export async function execute(db: D1Database, sql: string, ...params: unknown[]) {
  const stmt = db.prepare(sql).bind(...params);
  return stmt.run();
}
