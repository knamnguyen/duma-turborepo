"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/heic",
  "video/mp4", "video/quicktime", "video/webm",
];

type PendingFile = {
  id: string;
  file: File;
  previewUrl: string;
  type: "image" | "video";
};

type UploadedFile = {
  url: string;
  type: "image" | "video";
  mimeType: string;
  fileName: string;
  sizeBytes: number;
};

export function MediaUpload({
  onUploaded,
  disabled,
}: {
  sessionId?: string;
  postId?: string;
  deviceId?: string;
  onUploaded: (files: UploadedFile[]) => void;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;

    const newPending: PendingFile[] = [];
    for (const file of Array.from(fileList)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`Unsupported file type: ${file.type}`);
        continue;
      }
      const isVideo = file.type.startsWith("video/");
      const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      if (file.size > maxSize) {
        const limitMB = maxSize / (1024 * 1024);
        toast.error(`"${file.name}" exceeds ${limitMB}MB limit`);
        continue;
      }
      newPending.push({
        id: Math.random().toString(36).substring(2),
        file,
        previewUrl: URL.createObjectURL(file),
        type: isVideo ? "video" : "image",
      });
    }
    setPending((prev) => [...prev, ...newPending]);
  };

  const removeFile = (id: string) => {
    setPending((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleUpload = async () => {
    if (pending.length === 0) return;
    setUploading(true);

    try {
      const formData = new FormData();
      for (const p of pending) {
        formData.append("files", p.file);
      }

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = (await res.json()) as {
        urls?: string[];
        files?: UploadedFile[];
        error?: string;
      };

      if (!res.ok || data.error) {
        toast.error(data.error || "Upload failed");
        setUploading(false);
        return;
      }

      // Use files array if available, otherwise build from urls
      const uploaded: UploadedFile[] = data.files || (data.urls || []).map((url, i) => ({
        url,
        type: pending[i].type,
        mimeType: pending[i].file.type,
        fileName: pending[i].file.name,
        sizeBytes: pending[i].file.size,
      }));

      // Cleanup preview URLs
      for (const p of pending) {
        URL.revokeObjectURL(p.previewUrl);
      }
      setPending([]);
      onUploaded(uploaded);
      toast.success(`${uploaded.length} file${uploaded.length > 1 ? "s" : ""} uploaded`);
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* File picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(",")}
        multiple
        className="hidden"
        onChange={(e) => addFiles(e.target.files)}
      />

      <div className="flex gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="w-4 h-4" />
          Add Photos/Videos
        </Button>
      </div>

      {/* Previews */}
      {pending.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {pending.map((p) => (
            <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden bg-white/5">
              {p.type === "video" ? (
                <video
                  src={p.previewUrl}
                  className="w-full h-full object-cover"
                  muted
                />
              ) : (
                <img
                  src={p.previewUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              )}
              <button
                type="button"
                className="absolute top-1 right-1 bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => removeFile(p.id)}
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
              {p.type === "video" && (
                <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1.5 py-0.5 text-[10px] text-white/80">
                  Video
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {pending.length > 0 && (
        <Button
          type="button"
          size="sm"
          disabled={uploading}
          onClick={handleUpload}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Uploading...
            </>
          ) : (
            `Upload ${pending.length} file${pending.length > 1 ? "s" : ""}`
          )}
        </Button>
      )}
    </div>
  );
}
