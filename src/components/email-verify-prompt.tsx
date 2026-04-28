"use client";

import { useState, useEffect } from "react";
import { useClerk } from "@clerk/nextjs";
import { X, ShieldCheck } from "lucide-react";

const DISMISS_KEY = "email-verify-prompt-dismissed";

export function EmailVerifyPrompt({
  postId,
  verified,
  isOwn,
  isSignedIn,
}: {
  postId: string;
  verified: number;
  isOwn: boolean;
  isSignedIn: boolean;
}) {
  const clerk = useClerk();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(DISMISS_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        setDismissed(parsed.includes(postId));
      } catch {
        setDismissed(false);
      }
    } else {
      setDismissed(false);
    }
  }, [postId]);

  if (!isOwn || !isSignedIn || verified === 1 || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      const stored = localStorage.getItem(DISMISS_KEY);
      const ids: string[] = stored ? JSON.parse(stored) : [];
      if (!ids.includes(postId)) ids.push(postId);
      localStorage.setItem(DISMISS_KEY, JSON.stringify(ids));
    } catch {
      localStorage.setItem(DISMISS_KEY, JSON.stringify([postId]));
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
      <ShieldCheck className="w-4 h-4 shrink-0" />
      <span className="flex-1">
        Verify your email to get a verified badge.{" "}
        <button
          onClick={() => clerk.openUserProfile()}
          className="underline hover:text-amber-200 transition-colors"
        >
          Open account settings
        </button>
      </span>
      <button
        onClick={handleDismiss}
        className="shrink-0 text-amber-400/60 hover:text-amber-300 transition-colors"
        title="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
