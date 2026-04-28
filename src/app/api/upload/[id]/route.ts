function getR2(): R2Bucket {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getCloudflareContext } = require("@opennextjs/cloudflare");
  const { env } = getCloudflareContext();
  return env.R2 as R2Bucket;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const r2 = getR2();

    // Try images first, then videos
    let object = await r2.get(`images/${id}`);
    if (!object) {
      object = await r2.get(`videos/${id}`);
    }

    if (!object) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
