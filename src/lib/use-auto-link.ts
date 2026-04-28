"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { getDeviceIdentity } from "@/lib/device";
import { toast } from "sonner";

interface Candidate {
  id: string;
  sessionId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

interface MismatchPost {
  id: string;
  email: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export function useAutoLink() {
  const { isSignedIn } = useUser();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const hasRun = useRef(false);
  const prevSignedIn = useRef<boolean | undefined>(undefined);

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [mismatched, setMismatched] = useState<MismatchPost[]>([]);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showMismatchModal, setShowMismatchModal] = useState(false);

  const autoLinkMutation = useMutation(
    trpc.post.autoLink.mutationOptions({
      onSuccess: (data) => {
        if (data.autoLinked.length > 0) {
          toast.success(
            `Linked ${data.autoLinked.length} post${data.autoLinked.length > 1 ? "s" : ""} to your account`
          );
          queryClient.invalidateQueries();
        }
        if (data.candidates.length > 0) {
          setCandidates([...data.candidates]);
          setShowConfirmModal(true);
        }
        if (data.mismatched.length > 0) {
          setMismatched([...data.mismatched]);
          setShowMismatchModal(true);
        }
      },
    })
  );

  const confirmLinkMutation = useMutation(
    trpc.post.confirmLink.mutationOptions({
      onSuccess: () => {
        setCandidates([]);
        setShowConfirmModal(false);
        toast.success("Posts linked to your account");
        queryClient.invalidateQueries();
      },
    })
  );

  const handleMismatchMutation = useMutation(
    trpc.post.handleMismatch.mutationOptions({
      onSuccess: (_, variables) => {
        setMismatched((prev) => prev.filter((p) => p.id !== variables.postId));
        if (variables.action === "link") {
          toast.success("Post linked to your account");
        } else if (variables.action === "delete") {
          toast.success("Post deleted");
        }
        queryClient.invalidateQueries();
      },
    })
  );

  useEffect(() => {
    if (
      isSignedIn &&
      prevSignedIn.current !== true &&
      !hasRun.current
    ) {
      hasRun.current = true;
      const { deviceId } = getDeviceIdentity();
      if (deviceId) {
        autoLinkMutation.mutate({ deviceId });
      }
    }
    prevSignedIn.current = isSignedIn;
  }, [isSignedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmLink = useCallback(
    (postIds: string[]) => {
      const { deviceId } = getDeviceIdentity();
      confirmLinkMutation.mutate({ postIds, deviceId });
    },
    [confirmLinkMutation]
  );

  const handleMismatch = useCallback(
    (postId: string, action: "link" | "delete" | "leave") => {
      const { deviceId } = getDeviceIdentity();
      handleMismatchMutation.mutate({ postId, action, deviceId });
      if (action === "leave") {
        setMismatched((prev) => prev.filter((p) => p.id !== postId));
      }
    },
    [handleMismatchMutation]
  );

  // Close mismatch modal when all posts handled
  useEffect(() => {
    if (mismatched.length === 0 && showMismatchModal) {
      setShowMismatchModal(false);
    }
  }, [mismatched.length, showMismatchModal]);

  return {
    candidates,
    mismatched,
    showConfirmModal,
    showMismatchModal,
    setShowConfirmModal,
    setShowMismatchModal,
    confirmLink,
    handleMismatch,
    isAutoLinking: autoLinkMutation.isPending,
    isConfirming: confirmLinkMutation.isPending,
    isMismatchPending: handleMismatchMutation.isPending,
  };
}
