"use client";

import { useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

type MediaItem = {
  url: string;
  type: "image" | "video";
};

export function Lightbox({
  items,
  currentIndex,
  onClose,
  onNavigate,
}: {
  items: MediaItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const current = items[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight" && hasNext) onNavigate(currentIndex + 1);
    },
    [onClose, onNavigate, currentIndex, hasPrev, hasNext]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  if (!current) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 z-10 text-white/60 hover:text-white p-2 transition-colors"
        onClick={onClose}
      >
        <X className="w-7 h-7" />
      </button>

      {/* Counter */}
      {items.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/50 text-sm">
          {currentIndex + 1} / {items.length}
        </div>
      )}

      {/* Previous button */}
      {hasPrev && (
        <button
          className="absolute left-2 md:left-4 z-10 text-white/40 hover:text-white p-2 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex - 1);
          }}
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}

      {/* Media content */}
      <div
        className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {current.type === "video" ? (
          <video
            src={current.url}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] rounded-lg"
          />
        ) : (
          <img
            src={current.url}
            alt=""
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
          />
        )}
      </div>

      {/* Next button */}
      {hasNext && (
        <button
          className="absolute right-2 md:right-4 z-10 text-white/40 hover:text-white p-2 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex + 1);
          }}
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}
    </div>
  );
}
