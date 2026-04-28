"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/utils";

interface Candidate {
  id: string;
  sessionId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export function AutoLinkConfirmModal({
  open,
  onOpenChange,
  candidates,
  onConfirm,
  onReject,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidates: Candidate[];
  onConfirm: (postIds: string[]) => void;
  onReject: () => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>We found posts with your email</DialogTitle>
          <DialogDescription>
            These posts were created with your email on a different device.
            Would you like to link them to your account?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-60 overflow-y-auto">
          {candidates.map((post) => (
            <div
              key={post.id}
              className="rounded-lg border border-white/10 bg-white/5 p-3"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-medium">{post.authorName}</span>
                <span className="text-[11px] text-white/25">
                  {timeAgo(post.createdAt)}
                </span>
              </div>
              <p className="text-sm text-white/60 mt-1 line-clamp-2">
                {post.content}
              </p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button
            variant="ghost"
            onClick={onReject}
            disabled={isPending}
          >
            Skip
          </Button>
          <Button
            onClick={() => onConfirm(candidates.map((c) => c.id))}
            disabled={isPending}
          >
            {isPending ? "Linking..." : "Link All"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
