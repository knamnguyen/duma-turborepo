"use client";

import { use, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  X,
  Pencil,
  Check,
  Layers,
  List,
  Trash2,
  Mail,
  Send,
  Bookmark,
  User,
  ImageIcon,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getDeviceIdentity, updateDeviceIdentity } from "@/lib/device";
import { toast } from "sonner";
import {
  getPinnedPosts,
  togglePinPost,
  getSavedPosts,
  toggleSavePost,
} from "@/lib/post-preferences";
import { useAutoLink } from "@/lib/use-auto-link";
import { AutoLinkConfirmModal } from "@/components/auto-link-confirm-modal";
import { EmailMismatchModal } from "@/components/email-mismatch-modal";
import { DynamicForm } from "@/components/dynamic-form";
import { FullPostCard, CompactPostCard } from "@/components/post-card";
import { MediaGallery } from "@/components/media-gallery";
import { DEFAULT_FORM_SCHEMA, mapLegacyToFieldResponses } from "@/lib/form-schema";

export default function SessionPage({
  params,
}: {
  params: Promise<{ sessionSlug: string }>;
}) {
  const { sessionSlug } = use(params);
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { isSignedIn, user } = useUser();

  const resolveSlugQuery = useQuery(
    trpc.session.resolveSlug.queryOptions({ slug: sessionSlug })
  );

  const [device, setDevice] = useState({ deviceId: "", name: "", avatarUrl: "" });
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimEmailInput, setClaimEmailInput] = useState("");
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState("");

  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});

  const [activeTab, setActiveTab] = useState<"all" | "saved" | "gallery">("all");
  const [viewMode, setViewMode] = useState<"full" | "compact">("full");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [editingPlaylistUrl, setEditingPlaylistUrl] = useState(false);
  const [playlistUrlInput, setPlaylistUrlInput] = useState("");

  // Pre-fill values for editing
  const [editInitialValues, setEditInitialValues] = useState<Record<string, string> | undefined>(undefined);

  const autoLink = useAutoLink();

  useEffect(() => {
    const identity = getDeviceIdentity();
    setDevice(identity);
    setPinnedIds(getPinnedPosts());
    setSavedIds(getSavedPosts());
  }, []);

  useEffect(() => {
    if (resolveSlugQuery.data?.redirect === true) {
      router.replace("/" + resolveSlugQuery.data.slug);
    }
  }, [resolveSlugQuery.data, router]);

  const sessionQuery = useQuery(
    trpc.session.getBySlug.queryOptions({ slug: sessionSlug })
  );
  const postsQuery = useQuery(
    trpc.post.listBySession.queryOptions(
      { sessionId: sessionQuery.data?.id ?? "" },
      { enabled: !!sessionQuery.data?.id }
    )
  );
  const myPostQuery = useQuery(
    trpc.post.getMyPost.queryOptions(
      { sessionId: sessionQuery.data?.id ?? "", deviceId: device.deviceId || undefined, userId: user?.id },
      { enabled: !!sessionQuery.data?.id && (!!device.deviceId || !!user?.id) }
    )
  );
  const hasPostedQuery = useQuery(
    trpc.post.hasPostedInSession.queryOptions(
      { sessionId: sessionQuery.data?.id ?? "", deviceId: device.deviceId || undefined, userId: user?.id },
      { enabled: !!sessionQuery.data?.id && (!!device.deviceId || !!user?.id) }
    )
  );

  const createPostMutation = useMutation(
    trpc.post.create.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries(); closeOnboarding(); },
    })
  );
  const updatePostMutation = useMutation(
    trpc.post.update.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries(); closeOnboarding(); },
    })
  );
  const deletePostMutation = useMutation(
    trpc.post.delete.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries(); toast.success("Post deleted"); },
    })
  );
  const createCommentMutation = useMutation(
    trpc.comment.create.mutationOptions({
      onSuccess: () => { queryClient.invalidateQueries(); },
    })
  );
  const claimProfileMutation = useMutation(
    trpc.post.claimProfile.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        setShowClaimModal(false);
        setClaimEmailInput("");
        toast.success("Profile claimed!");
      },
      onError: (err) => { toast.error(err.message); },
    })
  );
  const syncProfileMutation = useMutation(
    trpc.user.syncProfile.mutationOptions()
  );
  const syncedRef = useRef(false);

  useEffect(() => {
    if (isSignedIn && !syncedRef.current) {
      syncedRef.current = true;
      syncProfileMutation.mutate();
    }
  }, [isSignedIn]);

  const updateSessionMutation = useMutation(
    trpc.session.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        setEditingSlug(false);
        toast.success("Slug updated!");
      },
      onError: (err) => { toast.error(err.message); },
    })
  );

  useEffect(() => {
    if (sessionQuery.data && device.deviceId && myPostQuery.data === null && !myPostQuery.isLoading) {
      openOnboarding();
    }
  }, [sessionQuery.data, device.deviceId, myPostQuery.data, myPostQuery.isLoading]);

  const formSchema = sessionQuery.data?.formSchema || DEFAULT_FORM_SCHEMA;

  const openOnboarding = (editPost?: typeof myPostQuery.data) => {
    if (editPost) {
      setEditingPostId(editPost.id);
      // Build initial values from fieldResponses or legacy columns
      let initial: Record<string, string> = {};
      if (editPost.fieldResponses) {
        try {
          initial = JSON.parse(editPost.fieldResponses) as Record<string, string>;
        } catch {
          initial = mapLegacyToFieldResponses(editPost);
        }
      }
      if (Object.keys(initial).length === 0) {
        initial = mapLegacyToFieldResponses(editPost);
      }
      // Always ensure name is set
      if (!initial.name) initial.name = editPost.authorName;
      if (!initial.email && editPost.email) initial.email = editPost.email;
      setEditInitialValues(initial);
    } else {
      setEditingPostId(null);
      setEditInitialValues({
        name: user?.fullName || device.name || "",
        email: user?.primaryEmailAddress?.emailAddress || "",
      });
    }
    setShowOnboarding(true);
  };

  const closeOnboarding = () => {
    setShowOnboarding(false);
    setEditingPostId(null);
    setEditInitialValues(undefined);
  };

  const uploadSelfie = async (selfieDataUrl: string) => {
    if (!selfieDataUrl) return device.avatarUrl;
    try {
      const blob = await (await fetch(selfieDataUrl)).blob();
      const formData = new FormData();
      formData.append("files", new File([blob], "selfie.jpg", { type: "image/jpeg" }));
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = (await res.json()) as { urls?: string[] };
      return data.urls?.[0] || selfieDataUrl;
    } catch { return selfieDataUrl; }
  };

  const handleDynamicFormSubmit = async (responses: Record<string, string>, selfieDataUrl: string) => {
    let avatarUrl = device.avatarUrl;
    if (selfieDataUrl) avatarUrl = (await uploadSelfie(selfieDataUrl)) || avatarUrl;

    const authorName = responses.name || device.name || "Anonymous";
    const updated = updateDeviceIdentity({ name: authorName, avatarUrl });
    setDevice(updated);

    // Extract legacy fields for backward compat
    const content = responses.bio || "";
    const productLink = responses.projectLink || "";
    const contactInfo = responses.contactInfo || "";
    const demoValue = responses.demoIntention || "";
    const demoMap: Record<string, "yes" | "no" | "later" | ""> = {
      "Yes": "yes",
      "No": "no",
      "Maybe later": "later",
      "yes": "yes",
      "no": "no",
      "later": "later",
    };
    const demoIntention = demoMap[demoValue] || "";

    const fieldResponses = JSON.stringify(responses);

    if (editingPostId) {
      updatePostMutation.mutate({
        id: editingPostId,
        deviceId: device.deviceId,
        userId: user?.id,
        authorName,
        authorAvatar: avatarUrl,
        content,
        productLink,
        contactInfo,
        demoIntention,
        fieldResponses,
      });
    } else {
      createPostMutation.mutate({
        sessionId: sessionQuery.data!.id,
        deviceId: device.deviceId,
        userId: user?.id,
        email: (responses.email || "").trim().toLowerCase(),
        authorName,
        authorAvatar: avatarUrl,
        content,
        imageUrls: [],
        productLink,
        contactInfo,
        demoIntention,
        fieldResponses,
      });
    }
  };

  const toggleComments = (postId: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(postId)) next.delete(postId); else next.add(postId);
      return next;
    });
  };

  const handleCommentSubmit = (postId: string) => {
    const text = commentTexts[postId]?.trim();
    if (!text) return;
    createCommentMutation.mutate(
      { postId, authorName: device.name, authorAvatar: device.avatarUrl, content: text, deviceId: device.deviceId, userId: user?.id },
      { onSuccess: () => { setCommentTexts((prev) => ({ ...prev, [postId]: "" })); } }
    );
  };

  const handlePin = (postId: string) => { setPinnedIds(togglePinPost(postId)); };
  const handleSave = (postId: string) => { setSavedIds(toggleSavePost(postId)); };
  const handleDelete = (postId: string) => { setConfirmDeleteId(postId); };
  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    deletePostMutation.mutate({ id: confirmDeleteId, deviceId: device.deviceId, userId: user?.id });
    setConfirmDeleteId(null);
  };

  const isSubmitting = createPostMutation.isPending || updatePostMutation.isPending;

  const sortedPosts = postsQuery.data
    ? [...postsQuery.data].sort((a, b) => {
        const ap = pinnedIds.has(a.id) ? 1 : 0;
        const bp = pinnedIds.has(b.id) ? 1 : 0;
        return bp - ap;
      })
    : [];

  const displayPosts = activeTab === "saved"
    ? sortedPosts.filter((p) => savedIds.has(p.id))
    : sortedPosts;

  if (sessionQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-2xl p-8 animate-pulse w-80 h-40" />
      </div>
    );
  }

  if (sessionQuery.error || !sessionQuery.data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white/80">Session not found</h2>
          <Link href="/" className="mt-4 text-purple-400 hover:text-purple-300 inline-block">Back to home</Link>
        </div>
      </div>
    );
  }

  const session = sessionQuery.data;
  const sessionUrl = `https://session.buildstuffs.com/${session.slug}`;
  const isSessionCreator = (!!session.creatorDeviceId && session.creatorDeviceId === device.deviceId) || (!!session.creatorUserId && user?.id && session.creatorUserId === user.id);

  return (
    <div className="min-h-screen pb-20">
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxUrl(null)}
        >
          <button className="absolute top-4 right-4 text-white/60 hover:text-white" onClick={() => setLightboxUrl(null)}>
            <X className="w-8 h-8" />
          </button>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fade-in" onClick={() => setConfirmDeleteId(null)}>
          <div className="glass rounded-2xl p-6 max-w-sm w-full space-y-4 text-center" onClick={(e) => e.stopPropagation()}>
            <Trash2 className="w-10 h-10 text-red-400 mx-auto" strokeWidth={2} />
            <h3 className="text-lg font-semibold">Delete post?</h3>
            <p className="text-sm text-white/50">This cannot be undone. Your post and all its comments will be permanently deleted.</p>
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
              <Button className="flex-1 bg-red-500 hover:bg-red-600 text-white" onClick={confirmDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      {/* Claim profile modal */}
      {showClaimModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowClaimModal(false)}>
          <div className="glass rounded-2xl p-6 max-w-sm w-full space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <Mail className="w-10 h-10 text-purple-400 mx-auto" strokeWidth={2} />
              <h3 className="text-lg font-semibold mt-2">Claim your profile</h3>
              <p className="text-sm text-white/50 mt-1">Enter the email you used when creating your post to transfer it to this device.</p>
            </div>
            <Input
              type="email"
              placeholder="your@email.com"
              value={claimEmailInput}
              onChange={(e) => setClaimEmailInput(e.target.value)}
              className="text-base"
              autoFocus
            />
            <div className="flex gap-3">
              <Button variant="secondary" className="flex-1" onClick={() => { setShowClaimModal(false); setClaimEmailInput(""); }}>Cancel</Button>
              <Button
                className="flex-1"
                disabled={claimProfileMutation.isPending || !claimEmailInput.trim()}
                onClick={() => {
                  claimProfileMutation.mutate({
                    sessionId: sessionQuery.data!.id,
                    email: claimEmailInput.trim().toLowerCase(),
                    newDeviceId: device.deviceId,
                    userId: user?.id,
                  });
                }}
              >
                {claimProfileMutation.isPending ? "Claiming..." : "Claim"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding Dialog — Dynamic Form */}
      <Dialog open={showOnboarding} onOpenChange={(open) => { if (!open) closeOnboarding(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPostId ? "Edit your post" : "Join the session"}</DialogTitle>
            <DialogDescription>Fill in the fields below to {editingPostId ? "update" : "create"} your post.</DialogDescription>
          </DialogHeader>

          <DynamicForm
            schema={formSchema}
            initialValues={editInitialValues}
            isEditing={!!editingPostId}
            isSubmitting={isSubmitting}
            onSubmit={handleDynamicFormSubmit}
          />

          {(createPostMutation.error || updatePostMutation.error) && (
            <p className="text-red-400 text-sm">{createPostMutation.error?.message || updatePostMutation.error?.message}</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Header */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-transparent to-pink-900/20" />
        <div className="relative max-w-2xl mx-auto px-6 pt-8 pb-8">
          <div className="flex items-center justify-between mb-6">
            <Link href="/" className="inline-flex items-center gap-1 text-sm text-white/40 hover:text-white/70 transition-colors">
              <ArrowLeft className="w-4 h-4" /> All sessions
            </Link>
            <div>
              {isSignedIn ? (
                <UserButton />
              ) : (
                <SignInButton mode="modal" forceRedirectUrl={`/${sessionSlug}`}>
                  <Button variant="secondary" size="sm" className="text-xs">
                    <User className="w-3 h-3" /> Sign in
                  </Button>
                </SignInButton>
              )}
            </div>
          </div>
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start">
            <div className="shrink-0 glass rounded-2xl p-4">
              <QRCodeSVG value={sessionUrl} size={160} bgColor="transparent" fgColor="white" level="M" />
              {editingSlug ? (
                <div className="mt-2 flex items-center gap-1 max-w-[200px]">
                  <Input
                    value={slugInput}
                    onChange={(e) => setSlugInput(e.target.value)}
                    className="text-base h-7 text-xs px-2"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        updateSessionMutation.mutate({ id: session.id, creatorDeviceId: device.deviceId || undefined, creatorUserId: user?.id, slug: slugInput });
                      }
                      if (e.key === "Escape") setEditingSlug(false);
                    }}
                  />
                  <Button
                    size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0"
                    disabled={updateSessionMutation.isPending}
                    onClick={() => updateSessionMutation.mutate({ id: session.id, creatorDeviceId: device.deviceId, slug: slugInput })}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => setEditingSlug(false)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1 mt-2 max-w-[200px]">
                  <p className="text-[10px] text-white/30 text-center break-all select-all">{sessionUrl.replace(/^https?:\/\//, "")}</p>
                  {((session.creatorDeviceId && session.creatorDeviceId === device.deviceId) || (session.creatorUserId && user?.id && session.creatorUserId === user.id)) && (
                    <button onClick={() => { setSlugInput(session.slug); setEditingSlug(true); }} className="shrink-0 text-white/20 hover:text-white/60 transition-colors">
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 text-center md:text-left">
              <h1 className="text-2xl md:text-3xl font-bold">{session.name}</h1>
              <p className="mt-2 text-white/50 whitespace-pre-wrap text-sm">{session.description}</p>
              <p className="mt-2 text-xs text-white/30">{session.date}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {myPostQuery.data ? (
                  <Button variant="secondary" size="sm" onClick={() => openOnboarding(myPostQuery.data)}>
                    <Pencil className="w-4 h-4" />Edit My Post
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => openOnboarding()}><Send className="w-4 h-4" />Join Session</Button>
                )}
                {!myPostQuery.data && !myPostQuery.isLoading && postsQuery.data && postsQuery.data.length > 0 && (
                  <Button variant="secondary" size="sm" onClick={() => setShowClaimModal(true)} className="text-white/60">
                    <Mail className="w-4 h-4" />Claim my profile
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-2xl mx-auto px-6 py-6">
        {activeTab === "gallery" ? (
          <>
            {/* YouTube playlist URL editor (session creator only) */}
            {isSessionCreator && (
              <div className="mb-4">
                {editingPlaylistUrl ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={playlistUrlInput}
                      onChange={(e) => setPlaylistUrlInput(e.target.value)}
                      placeholder="YouTube playlist URL..."
                      className="text-base flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          updateSessionMutation.mutate({
                            id: session.id,
                            creatorDeviceId: device.deviceId || undefined,
                            creatorUserId: user?.id,
                            youtubePlaylistUrl: playlistUrlInput,
                          });
                          setEditingPlaylistUrl(false);
                        }
                        if (e.key === "Escape") setEditingPlaylistUrl(false);
                      }}
                    />
                    <Button
                      size="sm"
                      disabled={updateSessionMutation.isPending}
                      onClick={() => {
                        updateSessionMutation.mutate({
                          id: session.id,
                          creatorDeviceId: device.deviceId || undefined,
                          creatorUserId: user?.id,
                          youtubePlaylistUrl: playlistUrlInput,
                        });
                        setEditingPlaylistUrl(false);
                      }}
                    >
                      <Check className="w-3 h-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingPlaylistUrl(false)}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setPlaylistUrlInput(session.youtubePlaylistUrl || "");
                      setEditingPlaylistUrl(true);
                    }}
                    className="text-xs text-white/30 hover:text-white/60 transition-colors"
                  >
                    {session.youtubePlaylistUrl ? "Edit YouTube playlist" : "+ Add YouTube playlist URL"}
                  </button>
                )}
              </div>
            )}
            <MediaGallery
              sessionId={session.id}
              hasPosted={!!hasPostedQuery.data?.hasPosted}
              postId={myPostQuery.data?.id}
              deviceId={device.deviceId}
              youtubePlaylistUrl={session.youtubePlaylistUrl}
            />
          </>
        ) : (
          <>
            {postsQuery.isLoading && (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => <div key={i} className="glass rounded-2xl p-4 h-48 animate-pulse" />)}
              </div>
            )}

            {displayPosts.length === 0 && !postsQuery.isLoading && (
              <div className="text-center py-20 text-white/30">
                <p className="text-lg">{activeTab === "saved" ? "No saved posts yet" : "No posts yet. Be the first to join!"}</p>
              </div>
            )}

            {displayPosts.length > 0 && (
              <div className="space-y-4">
                {displayPosts.map((post) => {
                  const isOwn = (!!user?.id && post.userId === user.id) || (!!device.deviceId && post.deviceId === device.deviceId);
                  const postWithField = { ...post, fieldResponses: post.fieldResponses || null };
                  return viewMode === "compact" ? (
                    <CompactPostCard
                      key={post.id}
                      post={postWithField}
                      formSchema={formSchema}
                      isOwn={isOwn}
                      isPinned={pinnedIds.has(post.id)}
                      isSaved={savedIds.has(post.id)}
                      isSignedIn={!!isSignedIn}
                      onPin={() => handlePin(post.id)}
                      onSave={() => handleSave(post.id)}
                      onImageClick={setLightboxUrl}
                      onEdit={() => openOnboarding({ ...post, productLink: post.productLink || "", contactInfo: post.contactInfo || "", demoIntention: post.demoIntention || "" })}
                      onDelete={() => handleDelete(post.id)}
                    />
                  ) : (
                    <FullPostCard
                      key={post.id}
                      post={postWithField}
                      formSchema={formSchema}
                      isOwn={isOwn}
                      hasPosted={!!hasPostedQuery.data?.hasPosted}
                      isSignedIn={!!isSignedIn}
                      device={device}
                      expanded={expandedComments.has(post.id)}
                      commentText={commentTexts[post.id] || ""}
                      isPinned={pinnedIds.has(post.id)}
                      isSaved={savedIds.has(post.id)}
                      onPin={() => handlePin(post.id)}
                      onSave={() => handleSave(post.id)}
                      onToggleComments={() => toggleComments(post.id)}
                      onCommentTextChange={(text) => setCommentTexts((prev) => ({ ...prev, [post.id]: text }))}
                      onCommentSubmit={() => handleCommentSubmit(post.id)}
                      onEdit={() => openOnboarding({ ...post, productLink: post.productLink || "", contactInfo: post.contactInfo || "", demoIntention: post.demoIntention || "" })}
                      onDelete={() => handleDelete(post.id)}
                      onImageClick={setLightboxUrl}
                      isSubmittingComment={createCommentMutation.isPending}
                      trpc={trpc}
                      sessionSlug={sessionSlug}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom nav bar */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3">
        <div className="flex rounded-2xl border border-white/10 backdrop-blur-2xl bg-white/5 shadow-2xl shadow-black/40 overflow-hidden">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all ${
              activeTab === "all" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            <Layers className="w-5 h-5" strokeWidth={2.5} />
            Posts
          </button>
          <button
            onClick={() => setActiveTab("gallery")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all ${
              activeTab === "gallery" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            <ImageIcon className="w-5 h-5" strokeWidth={2.5} />
            Gallery
          </button>
          <button
            onClick={() => setActiveTab("saved")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-bold transition-all ${
              activeTab === "saved" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            <Bookmark className="w-5 h-5" strokeWidth={2.5} />
            Saved
            {savedIds.size > 0 && <span className="text-[10px] font-bold bg-purple-500/30 text-purple-300 px-1.5 rounded-full">{savedIds.size}</span>}
          </button>
        </div>

        {activeTab !== "gallery" && (
          <button
            onClick={() => setViewMode(viewMode === "full" ? "compact" : "full")}
            className="flex items-center gap-1.5 rounded-full border border-white/10 backdrop-blur-2xl bg-white/5 shadow-2xl shadow-black/40 px-4 py-3 text-xs font-bold text-white/50 hover:text-white/80 transition-all"
          >
            {viewMode === "full" ? <List className="w-5 h-5" strokeWidth={2.5} /> : <Layers className="w-5 h-5" strokeWidth={2.5} />}
            {viewMode === "full" ? "Compact" : "Full"}
          </button>
        )}
      </div>

      {/* Auto-link modals */}
      <AutoLinkConfirmModal
        open={autoLink.showConfirmModal}
        onOpenChange={autoLink.setShowConfirmModal}
        candidates={autoLink.candidates}
        onConfirm={autoLink.confirmLink}
        onReject={() => autoLink.setShowConfirmModal(false)}
        isPending={autoLink.isConfirming}
      />
      <EmailMismatchModal
        open={autoLink.showMismatchModal}
        onOpenChange={autoLink.setShowMismatchModal}
        posts={autoLink.mismatched}
        onAction={autoLink.handleMismatch}
        isPending={autoLink.isMismatchPending}
      />
    </div>
  );
}
