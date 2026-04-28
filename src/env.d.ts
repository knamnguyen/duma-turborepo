interface CloudflareEnv {
  DB: D1Database;
}

declare module "@opennextjs/cloudflare" {
  export function getCloudflareContext(): {
    env: CloudflareEnv;
    cf: unknown;
    ctx: ExecutionContext;
  };
}
