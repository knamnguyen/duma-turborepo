"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Pin,
  Bookmark,
  Pencil,
  Trash2,
  Send,
  User,
  Link as LinkIcon,
} from "lucide-react";
import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { VerifiedBadge } from "@/components/verified-badge";
import { EmailVerifyPrompt } from "@/components/email-verify-prompt";
import { FieldRenderer } from "@/components/field-renderers";
import { mapLegacyToFieldResponses, type FormField } from "@/lib/form-schema";
import { timeAgo } from "@/lib/utils";
import type { useTRPC } from "@/trpc/client";

type PostData = {
  id: string;
  authorName: string;
  authorAvatar: string;
  content: string;
  imageUrls: string[];
  productLink: string | null;
  contactInfo: string | null;
  demoIntention: string | null;
  email: string | null;
  deviceId: string;
  userId: string | null;
  verified: number;
  createdAt: string;
  fieldResponses: string | null;
  _count: { comments: number };
};

function AvatarImg({ src, className }: { src: string; className?: string }) {
  if (!src) {
    return (
      <div
        className={`bg-white/10 flex items-center justify-center ${className}`}
      >
        <User className="w-1/2 h-1/2 text-white/40" />
      </div>
    );
  }
  return <img src={src} alt="" className={`object-cover ${className}`} />;
}

function simpleHash(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

const gradientPalette = [
  ["#a855f7", "#ec4899", "#f97316"],
  ["#06b6d4", "#8b5cf6", "#ec4899"],
  ["#f59e0b", "#ef4444", "#ec4899"],
  ["#10b981", "#06b6d4", "#3b82f6"],
  ["#8b5cf6", "#3b82f6", "#06b6d4"],
  ["#f43f5e", "#f97316", "#fbbf24"],
  ["#14b8a6", "#a855f7", "#f43f5e"],
  ["#6366f1", "#ec4899", "#f59e0b"],
];

function hashToAngle(id: string) {
  return simpleHash(id) % 360;
}

function hashToColor(id: string, index: number) {
  const palette =
    gradientPalette[simpleHash(id + index) % gradientPalette.length];
  return palette[index % palette.length];
}

/** Get field responses from post, falling back to legacy columns */
function getFieldResponses(post: PostData) {
  if (post.fieldResponses) {
    try {
      const parsed = JSON.parse(post.fieldResponses) as Record<string, string>;
      if (Object.keys(parsed).length > 0) return parsed;
    } catch {
      // Fall through to legacy mapping
    }
  }
  return mapLegacyToFieldResponses(post);
}

/* ─── Post Actions ─── */
function PostActions({
  isPinned,
  isSaved,
  isOwn,
  onPin,
  onSave,
  onEdit,
  onDelete,
}: {
  isPinned: boolean;
  isSaved: boolean;
  isOwn?: boolean;
  onPin: () => void;
  onSave: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="flex md:flex-row flex-col items-center gap-0.5">
      <button
        onClick={onPin}
        className={`p-1.5 rounded-lg transition-colors ${
          isPinned
            ? "text-purple-400"
            : "text-white/30 hover:text-white/60"
        }`}
        title={isPinned ? "Unpin" : "Pin to top"}
      >
        <Pin className="w-5 h-5" strokeWidth={2.5} />
      </button>
      <button
        onClick={onSave}
        className={`p-1.5 rounded-lg transition-colors ${
          isSaved
            ? "text-yellow-400"
            : "text-white/30 hover:text-white/60"
        }`}
        title={isSaved ? "Unsave" : "Save"}
      >
        <Bookmark
          className={`w-5 h-5 ${isSaved ? "fill-yellow-400" : ""}`}
          strokeWidth={2.5}
        />
      </button>
      {isOwn && onEdit && (
        <button
          onClick={onEdit}
          className="text-white/30 hover:text-white/60 transition-colors p-1.5"
          title="Edit"
        >
          <Pencil className="w-5 h-5" strokeWidth={2.5} />
        </button>
      )}
      {isOwn && onDelete && (
        <button
          onClick={onDelete}
          className="text-white/30 hover:text-red-400 transition-colors p-1.5"
          title="Delete"
        >
          <Trash2 className="w-5 h-5" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

/* ─── Dynamic Meta (renders non-builtin fields as pills/links/text) ─── */
function DynamicMeta({
  responses,
  formSchema,
}: {
  responses: Record<string, string>;
  formSchema: FormField[];
}) {
  // Show non-builtin, non-bio fields as meta
  const metaFields = formSchema.filter(
    (f) =>
      !f.builtin &&
      f.id !== "bio" &&
      f.type !== "photo" &&
      responses[f.id]
  );

  if (metaFields.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {metaFields.map((field) => (
        <FieldRenderer
          key={field.id}
          type={field.type}
          value={responses[field.id] || ""}
        />
      ))}
    </div>
  );
}

/* ─── Full Post Card ─── */
export function FullPostCard({
  post,
  formSchema,
  isOwn,
  hasPosted,
  isSignedIn,
  device,
  expanded,
  commentText,
  isPinned,
  isSaved,
  onPin,
  onSave,
  onToggleComments,
  onCommentTextChange,
  onCommentSubmit,
  onEdit,
  onDelete,
  onImageClick,
  isSubmittingComment,
  trpc,
  sessionSlug,
}: {
  post: PostData;
  formSchema: FormField[];
  isOwn: boolean;
  hasPosted: boolean;
  isSignedIn: boolean;
  device: { deviceId: string; name: string; avatarUrl: string };
  expanded: boolean;
  commentText: string;
  isPinned: boolean;
  isSaved: boolean;
  onPin: () => void;
  onSave: () => void;
  onToggleComments: () => void;
  onCommentTextChange: (text: string) => void;
  onCommentSubmit: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onImageClick: (url: string) => void;
  isSubmittingComment: boolean;
  trpc: ReturnType<typeof useTRPC>;
  sessionSlug: string;
}) {
  const commentsQuery = useQuery(
    trpc.comment.listByPost.queryOptions(
      { postId: post.id },
      { enabled: expanded }
    )
  );

  const responses = getFieldResponses(post);
  const bio = responses.bio || post.content;

  return (
    <div
      className={`border-b border-white/5 pb-5 animate-fade-in relative ${
        isPinned ? "border-l-2 border-l-purple-500/40 pl-3" : ""
      }`}
    >
      {/* Top right actions */}
      <div className="absolute top-0 right-0">
        <PostActions
          isPinned={isPinned}
          isSaved={isSaved}
          isOwn={isOwn}
          onPin={onPin}
          onSave={onSave}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>

      {isPinned && (
        <span className="text-[10px] text-purple-400/60 mb-2 block">
          Pinned
        </span>
      )}

      {/* Mobile layout */}
      <div className="md:hidden">
        <div className="flex gap-3 items-center pr-24">
          <div
            className="rounded-full p-[3px] w-[80px] h-[80px] shrink-0"
            style={{
              background: `linear-gradient(${hashToAngle(post.id)}deg, ${hashToColor(post.id, 0)}, ${hashToColor(post.id, 1)}, ${hashToColor(post.id, 2)})`,
            }}
          >
            <AvatarImg
              src={post.authorAvatar}
              className="w-full h-full rounded-full border-2 border-[#0a0a0a]"
            />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-base">
                {post.authorName}
              </span>
              <VerifiedBadge email={post.email} verified={post.verified} />
            </div>
            <DynamicMeta responses={responses} formSchema={formSchema} />
          </div>
        </div>
        {bio && (
          <p className="text-[15px] text-white/90 whitespace-pre-wrap mt-3">
            {bio}
          </p>
        )}
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex gap-4">
        <div className="w-1/3 shrink-0 flex flex-col items-center text-center">
          <div
            className="rounded-full p-[3px] w-[152px] h-[152px]"
            style={{
              background: `linear-gradient(${hashToAngle(post.id)}deg, ${hashToColor(post.id, 0)}, ${hashToColor(post.id, 1)}, ${hashToColor(post.id, 2)})`,
            }}
          >
            <AvatarImg
              src={post.authorAvatar}
              className="w-full h-full rounded-full border-2 border-[#0a0a0a]"
            />
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="font-semibold text-base">
              {post.authorName}
            </span>
            <VerifiedBadge email={post.email} verified={post.verified} />
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col pr-20 space-y-2">
          <DynamicMeta responses={responses} formSchema={formSchema} />
          {bio && (
            <p className="text-[15px] text-white/90 whitespace-pre-wrap flex-1">
              {bio}
            </p>
          )}
        </div>
      </div>

      {/* Scrollable images */}
      {post.imageUrls.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <div
            className="flex gap-2 pb-1"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {post.imageUrls.map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="h-48 rounded-xl object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                style={{ scrollSnapAlign: "start" }}
                onClick={() => onImageClick(url)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Email verify prompt */}
      <EmailVerifyPrompt
        postId={post.id}
        verified={post.verified}
        isOwn={isOwn}
        isSignedIn={isSignedIn}
      />

      {/* Comment toggle */}
      <button
        onClick={onToggleComments}
        className="mt-3 flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        {post._count.comments > 0
          ? `${post._count.comments} comment${post._count.comments > 1 ? "s" : ""}`
          : "Reply"}
        {expanded ? (
          <ChevronUp className="w-3 h-3" />
        ) : (
          <ChevronDown className="w-3 h-3" />
        )}
      </button>

      {/* Inline comments */}
      {expanded && (
        <PostComments
          postId={post.id}
          commentsQuery={commentsQuery}
          isSignedIn={isSignedIn}
          device={device}
          commentText={commentText}
          onCommentTextChange={onCommentTextChange}
          onCommentSubmit={onCommentSubmit}
          isSubmittingComment={isSubmittingComment}
          sessionSlug={sessionSlug}
        />
      )}
    </div>
  );
}

/* ─── Compact Post Card ─── */
export function CompactPostCard({
  post,
  formSchema,
  isOwn,
  isPinned,
  isSaved,
  isSignedIn,
  onPin,
  onSave,
  onImageClick,
  onEdit,
  onDelete,
}: {
  post: PostData;
  formSchema: FormField[];
  isOwn: boolean;
  isPinned: boolean;
  isSaved: boolean;
  isSignedIn: boolean;
  onPin: () => void;
  onSave: () => void;
  onImageClick: (url: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const responses = getFieldResponses(post);
  const bio = responses.bio || post.content;

  return (
    <div
      className={`flex gap-3 items-start py-3 border-b border-white/5 animate-fade-in ${
        isPinned ? "border-l-2 border-l-purple-500/40 pl-2" : ""
      }`}
    >
      {/* Small avatar */}
      <div
        className="rounded-full p-[2px] w-[44px] h-[44px] shrink-0"
        style={{
          background: `linear-gradient(${hashToAngle(post.id)}deg, ${hashToColor(post.id, 0)}, ${hashToColor(post.id, 1)}, ${hashToColor(post.id, 2)})`,
        }}
      >
        <AvatarImg
          src={post.authorAvatar}
          className="w-full h-full rounded-full border-[1.5px] border-[#0a0a0a]"
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{post.authorName}</span>
          <VerifiedBadge email={post.email} verified={post.verified} />
          <DynamicMeta responses={responses} formSchema={formSchema} />
        </div>
        {bio && (
          <p className="text-sm text-white/70 mt-1 line-clamp-2">{bio}</p>
        )}

        {/* Tiny image thumbnails */}
        {post.imageUrls.length > 0 && (
          <div className="flex gap-1.5 mt-2">
            {post.imageUrls.slice(0, 4).map((url, i) => (
              <img
                key={i}
                src={url}
                alt=""
                className="w-12 h-12 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => onImageClick(url)}
              />
            ))}
            {post.imageUrls.length > 4 && (
              <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center text-[11px] text-white/40">
                +{post.imageUrls.length - 4}
              </div>
            )}
          </div>
        )}

        {/* Comment count */}
        {post._count.comments > 0 && (
          <span className="text-[11px] text-white/25 mt-1 inline-flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            {post._count.comments}
          </span>
        )}

        <EmailVerifyPrompt
          postId={post.id}
          verified={post.verified}
          isOwn={isOwn}
          isSignedIn={isSignedIn}
        />
      </div>

      {/* Actions */}
      <div className="shrink-0">
        <PostActions
          isPinned={isPinned}
          isSaved={isSaved}
          isOwn={isOwn}
          onPin={onPin}
          onSave={onSave}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

/* ─── Post Comments (extracted for reuse) ─── */
function PostComments({
  postId,
  commentsQuery,
  isSignedIn,
  device,
  commentText,
  onCommentTextChange,
  onCommentSubmit,
  isSubmittingComment,
  sessionSlug,
}: {
  postId: string;
  commentsQuery: { data?: Array<{ id: string; authorAvatar: string; authorName: string; createdAt: string; content: string }>; isLoading: boolean };
  isSignedIn: boolean;
  device: { deviceId: string; name: string; avatarUrl: string };
  commentText: string;
  onCommentTextChange: (text: string) => void;
  onCommentSubmit: () => void;
  isSubmittingComment: boolean;
  sessionSlug: string;
}) {
  return (
    <div className="mt-3 pl-4 border-l border-white/5 space-y-3 animate-fade-in">
      {commentsQuery.data?.map((comment) => (
        <div key={comment.id} className="flex gap-2.5">
          <AvatarImg
            src={comment.authorAvatar}
            className="w-7 h-7 rounded-full shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium">{comment.authorName}</span>
              <span className="text-[11px] text-white/25">
                {timeAgo(comment.createdAt)}
              </span>
            </div>
            <p className="text-sm text-white/70 mt-0.5">{comment.content}</p>
          </div>
        </div>
      ))}
      {commentsQuery.isLoading && (
        <div className="text-xs text-white/30 py-2">Loading comments...</div>
      )}
      {isSignedIn ? (
        <div className="flex gap-2.5 pt-1">
          <AvatarImg
            src={device.avatarUrl}
            className="w-7 h-7 rounded-full shrink-0"
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onCommentSubmit();
            }}
            className="flex-1 flex gap-2"
          >
            <Input
              placeholder="Reply..."
              value={commentText}
              onChange={(e) => onCommentTextChange(e.target.value)}
              maxLength={300}
              className="text-base h-9"
            />
            <Button
              type="submit"
              size="icon"
              className="h-9 w-9 shrink-0"
              disabled={isSubmittingComment || !commentText.trim()}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      ) : (
        <SignInButton mode="modal" forceRedirectUrl={`/${sessionSlug}`}>
          <button className="text-xs text-purple-400 hover:text-purple-300 pt-1 transition-colors">
            Sign in to comment
          </button>
        </SignInButton>
      )}
    </div>
  );
}
