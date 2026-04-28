function cuid() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

function getR2(): R2Bucket {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getCloudflareContext } = require("@opennextjs/cloudflare");
  const { env } = getCloudflareContext();
  return env.R2 as R2Bucket;
}

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/heic"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const ALL_ALLOWED_TYPES = [...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES];

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

function getMediaType(mimeType: string) {
  if (ALLOWED_VIDEO_TYPES.includes(mimeType)) return "video" as const;
  return "image" as const;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (files.length === 0) {
      return Response.json({ error: "No files provided" }, { status: 400 });
    }

    // Validate files
    for (const file of files) {
      const mime = file.type || "image/jpeg";
      if (!ALL_ALLOWED_TYPES.includes(mime)) {
        return Response.json(
          { error: `Unsupported file type: ${mime}. Allowed: images and videos.` },
          { status: 400 }
        );
      }
      const maxSize = ALLOWED_VIDEO_TYPES.includes(mime) ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      if (file.size > maxSize) {
        const limitMB = maxSize / (1024 * 1024);
        return Response.json(
          { error: `File "${file.name}" exceeds ${limitMB}MB limit.` },
          { status: 400 }
        );
      }
    }

    // Dev mode: store as data URLs (no R2 locally)
    if (process.env.NODE_ENV === "development") {
      const results: { url: string; type: string; mimeType: string; fileName: string; sizeBytes: number }[] = [];
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        let binary = "";
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        const mime = file.type || "image/jpeg";
        results.push({
          url: `data:${mime};base64,${base64}`,
          type: getMediaType(mime),
          mimeType: mime,
          fileName: file.name,
          sizeBytes: file.size,
        });
      }
      return Response.json({ urls: results.map((r) => r.url), files: results });
    }

    const r2 = getR2();
    const results: { url: string; type: string; mimeType: string; fileName: string; sizeBytes: number }[] = [];

    for (const file of files) {
      const id = cuid();
      const mime = file.type || "image/jpeg";
      const prefix = ALLOWED_VIDEO_TYPES.includes(mime) ? "videos" : "images";
      const key = `${prefix}/${id}`;
      const buffer = await file.arrayBuffer();

      await r2.put(key, buffer, {
        httpMetadata: { contentType: mime },
      });

      results.push({
        url: `/api/upload/${id}`,
        type: getMediaType(mime),
        mimeType: mime,
        fileName: file.name,
        sizeBytes: file.size,
      });
    }

    return Response.json({ urls: results.map((r) => r.url), files: results });
  } catch (error) {
    console.error("Upload error:", error);
    return Response.json({ error: "Upload failed" }, { status: 500 });
  }
}
