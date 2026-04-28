function cuid() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getR2(): R2Bucket {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getCloudflareContext } = require("@opennextjs/cloudflare");
  const { env } = getCloudflareContext();
  return env.R2 as R2Bucket;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return Response.json({ error: "No files provided" }, { status: 400 });
    }

    // Dev mode: store as data URLs (no R2 locally)
    if (process.env.NODE_ENV === "development") {
      const urls: string[] = [];
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        urls.push(`data:${file.type || "image/jpeg"};base64,${base64}`);
      }
      return Response.json({ urls });
    }

    const r2 = getR2();
    const urls: string[] = [];

    for (const file of files) {
      const id = cuid();
      const key = `images/${id}`;
      const buffer = await file.arrayBuffer();

      await r2.put(key, buffer, {
        httpMetadata: { contentType: file.type || "image/jpeg" },
      });

      urls.push(`/api/upload/${id}`);
    }

    return Response.json({ urls });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
