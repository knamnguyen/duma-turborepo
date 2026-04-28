"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { Play, User } from "lucide-react";
import { Lightbox } from "@/components/lightbox";
import { MediaUpload } from "@/components/media-upload";
import { YoutubePlaylistEmbed } from "@/components/youtube-embed";

type MediaItem = {
  id: string;
  url: string;
  type: "image" | "video";
  authorName: string;
  authorAvatar: string;
  postId: string | null;
};

function AvatarSmall({ src }: { src: string }) {
  if (!src) {
    return (
      <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center shrink-0">
        <User className="w-3 h-3 text-white/40" />
      </div>
    );
  }
  return <img src={src} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />;
}

export function MediaGallery({
  sessionId,
  hasPosted,
  postId,
  deviceId,
  youtubePlaylistUrl,
}: {
  sessionId: string;
  hasPosted: boolean;
  postId?: string;
  deviceId?: string;
  youtubePlaylistUrl?: string | null;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const mediaQuery = useQuery(
    trpc.media.listBySession.queryOptions(
      { sessionId },
      { enabled: !!sessionId }
    )
  );

  const uploadMutation = useMutation(
    trpc.media.upload.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
      },
    })
  );

  const media: MediaItem[] = (mediaQuery.data || []).map((m) => ({
    id: m.id,
    url: m.url,
    type: m.type,
    authorName: m.authorName,
    authorAvatar: m.authorAvatar,
    postId: m.postId,
  }));

  const lightboxItems = media.map((m) => ({ url: m.url, type: m.type }));

  const handleUploaded = (files: { url: string; type: "image" | "video"; mimeType: string; fileName: string; sizeBytes: number }[]) => {
    uploadMutation.mutate({
      sessionId,
      postId,
      deviceId,
      files: files.map((f) => ({
        url: f.url,
        type: f.type,
        mimeType: f.mimeType,
        fileName: f.fileName,
        sizeBytes: f.sizeBytes,
      })),
    });
  };

  return (
    <div className="space-y-6">
      {/* Upload area (only for users with a post) */}
      {hasPosted && (
        <MediaUpload
          sessionId={sessionId}
          postId={postId}
          deviceId={deviceId}
          onUploaded={handleUploaded}
        />
      )}

      {/* YouTube playlist */}
      {youtubePlaylistUrl && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-white/50">Event Videos</h3>
          <YoutubePlaylistEmbed url={youtubePlaylistUrl} />
        </div>
      )}

      {/* Gallery grid */}
      {mediaQuery.isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      )}

      {media.length === 0 && !mediaQuery.isLoading && (
        <div className="text-center py-12 text-white/30">
          <p>No photos or videos yet.</p>
          {hasPosted && <p className="text-sm mt-1">Be the first to share!</p>}
        </div>
      )}

      {media.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {media.map((item, index) => (
            <button
              key={item.id}
              className="group relative aspect-square rounded-xl overflow-hidden bg-white/5 cursor-pointer"
              onClick={() => setLightboxIndex(index)}
            >
              {item.type === "video" ? (
                <>
                  <video
                    src={item.url}
                    className="w-full h-full object-cover"
                    muted
                    preload="metadata"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="bg-black/60 rounded-full p-2 group-hover:bg-black/80 transition-colors">
                      <Play className="w-6 h-6 text-white fill-white" />
                    </div>
                  </div>
                </>
              ) : (
                <img
                  src={item.url}
                  alt=""
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
              )}
              {/* Attribution */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6">
                <div className="flex items-center gap-1.5">
                  <AvatarSmall src={item.authorAvatar} />
                  <span className="text-[11px] text-white/80 truncate">{item.authorName}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          items={lightboxItems}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
