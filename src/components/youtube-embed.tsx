"use client";

function extractPlaylistId(url: string) {
  try {
    const parsed = new URL(url);
    const listParam = parsed.searchParams.get("list");
    if (listParam) return listParam;
  } catch {
    // Not a valid URL
  }
  return null;
}

export function YoutubePlaylistEmbed({ url }: { url: string }) {
  const playlistId = extractPlaylistId(url);

  if (!playlistId) {
    return (
      <div className="glass rounded-xl p-4 text-center text-white/40 text-sm">
        Invalid YouTube playlist URL
      </div>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden border border-white/10">
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/videoseries?list=${playlistId}`}
          title="YouTube playlist"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      </div>
    </div>
  );
}
