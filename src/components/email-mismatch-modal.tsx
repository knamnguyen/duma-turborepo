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

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const visible = local.slice(0, 2);
  return `${visible}***@${domain}`;
}

interface MismatchPost {
  id: string;
  email: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export function EmailMismatchModal({
  open,
  onOpenChange,
  posts,
  onAction,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  posts: MismatchPost[];
  onAction: (postId: string, action: "link" | "delete" | "leave") => void;
  isPending: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Post from this device with a different email</DialogTitle>
          <DialogDescription>
            We found a post on this device that was created with a different
            email than your signed-in account.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 max-h-72 overflow-y-auto">
          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-3"
            >
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">
                    {post.authorName}
                  </span>
                  <span className="text-[11px] text-white/25">
                    {timeAgo(post.createdAt)}
                  </span>
                </div>
                <p className="text-[11px] text-white/40 mt-0.5">
                  {maskEmail(post.email)}
                </p>
                <p className="text-sm text-white/60 mt-1 line-clamp-2">
                  {post.content}
                </p>
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  onClick={() => onAction(post.id, "link")}
                  disabled={isPending}
                >
                  Link to my account
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => onAction(post.id, "delete")}
                  disabled={isPending}
                >
                  Delete it
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onAction(post.id, "leave")}
                  disabled={isPending}
                >
                  Leave it
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
