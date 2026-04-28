"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Camera,
  ImageIcon,
  Send,
  MessageCircle,
  ArrowLeft,
  X,
  User,
  Pencil,
  Link as LinkIcon,
  Check,
  ChevronDown,
  ChevronUp,
  Pin,
  Bookmark,
  Layers,
  List,
  Trash2,
  Mail,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { timeAgo } from "@/lib/utils";
import { getDeviceIdentity, updateDeviceIdentity } from "@/lib/device";
import { toast } from "sonner";
import {
  getPinnedPosts,
  togglePinPost,
  getSavedPosts,
  toggleSavePost,
} from "@/lib/post-preferences";
import { VerifiedBadge } from "@/components/verified-badge";
import { useAutoLink } from "@/lib/use-auto-link";
import { AutoLinkConfirmModal } from "@/components/auto-link-confirm-modal";
import { EmailMismatchModal } from "@/components/email-mismatch-modal";

function AvatarImg({ src, className }: { src: string; className?: string }) {
  if (!src) {
    return (
      <div className={`bg-white/10 flex items-center justify-center ${className}`}>
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
  const palette = gradientPalette[simpleHash(id + index) % gradientPalette.length];
  return palette[index % palette.length];
}

type DemoChoice = "yes" | "no" | "later" | "";

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
  _count: { comments: number };
};

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
  const [step, setStep] = useState(0);
  const [nameInput, setNameInput] = useState("");
  const [selfieDataUrl, setSelfieDataUrl] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [productLink, setProductLink] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [introContent, setIntroContent] = useState("");
  const [introImages, setIntroImages] = useState<string[]>([]);
  const [demoIntention, setDemoIntention] = useState<DemoChoice>("");
  const [uploading, setUploading] = useState(false);
  const [retaking, setRetaking] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState("");
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimEmailInput, setClaimEmailInput] = useState("");
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState("");

  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});

  // Tabs, view mode, pin/save
  const [activeTab, setActiveTab] = useState<"all" | "saved">("all");
  const [viewMode, setViewMode] = useState<"full" | "compact">("full");
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Lightbox
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Auto-link anonymous posts on sign-in
  const autoLink = useAutoLink();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const identity = getDeviceIdentity();
    setDevice(identity);
    setNameInput(identity.name);
    setPinnedIds(getPinnedPosts());
    setSavedIds(getSavedPosts());
  }, []);

  // Redirect if visiting an old slug
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
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );
  const updateSessionMutation = useMutation(
    trpc.session.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        setEditingSlug(false);
        toast.success("Slug updated!");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  useEffect(() => {
    if (sessionQuery.data && device.deviceId && myPostQuery.data === null && !myPostQuery.isLoading) {
      openOnboarding();
    }
  }, [sessionQuery.data, device.deviceId, myPostQuery.data, myPostQuery.isLoading]);

  useEffect(() => {
    if (showOnboarding && step === 0 && !selfieDataUrl && (!device.avatarUrl || retaking)) startCamera();
    return () => { if (!showOnboarding) stopCamera(); };
  }, [showOnboarding, step, retaking]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 400, height: 400 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch (err) { console.error("Camera access denied:", err); }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  };

  const takeSelfie = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.save(); ctx.translate(256, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, (video.videoWidth - size) / 2, (video.videoHeight - size) / 2, size, size, 0, 0, 256, 256);
    ctx.restore();
    setSelfieDataUrl(canvas.toDataURL("image/jpeg", 0.8));
    setRetaking(false);
    stopCamera();
  };

  const retakeSelfie = () => { setSelfieDataUrl(""); setRetaking(true); };

  const handleImageUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(files).forEach((f) => formData.append("files", f));
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = (await res.json()) as { urls?: string[] };
      if (data.urls) setIntroImages((prev) => [...prev, ...data.urls!]);
    } catch (err) { console.error("Upload failed:", err); }
    finally { setUploading(false); }
  }, [introImages.length]);

  const openOnboarding = (editPost?: typeof myPostQuery.data) => {
    if (editPost) {
      setEditingPostId(editPost.id); setNameInput(editPost.authorName); setSelfieDataUrl("");
      setProductLink(editPost.productLink || ""); setContactInfo(editPost.contactInfo || "");
      setIntroContent(editPost.content); setIntroImages(editPost.imageUrls);
      setDemoIntention((editPost.demoIntention || "") as DemoChoice); setEmailInput(""); setStep(1);
    } else {
      setEditingPostId(null);
      setNameInput(user?.fullName || device.name);
      setSelfieDataUrl("");
      setProductLink(""); setContactInfo(""); setIntroContent(""); setIntroImages([]);
      setDemoIntention("");
      setEmailInput(user?.primaryEmailAddress?.emailAddress || "");
      setStep(0);
    }
    setShowOnboarding(true);
  };

  const closeOnboarding = () => { setShowOnboarding(false); stopCamera(); setEditingPostId(null); setStep(0); setRetaking(false); };

  const uploadSelfie = async () => {
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

  const handleSubmit = async () => {
    let avatarUrl = device.avatarUrl;
    if (selfieDataUrl) avatarUrl = (await uploadSelfie()) || avatarUrl;
    const updated = updateDeviceIdentity({ name: nameInput.trim(), avatarUrl });
    setDevice(updated);
    const payload = {
      authorName: nameInput.trim(), authorAvatar: avatarUrl, content: introContent,
      imageUrls: introImages, productLink, contactInfo,
      demoIntention: demoIntention as "yes" | "no" | "later",
    };
    if (editingPostId) {
      updatePostMutation.mutate({ id: editingPostId, deviceId: device.deviceId, userId: user?.id, ...payload });
    } else {
      createPostMutation.mutate({ sessionId: sessionQuery.data!.id, deviceId: device.deviceId, userId: user?.id, email: emailInput.trim().toLowerCase(), ...payload });
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

  const currentAvatarPreview = retaking ? "" : (selfieDataUrl || device.avatarUrl);
  const isSubmitting = createPostMutation.isPending || updatePostMutation.isPending;

  // Sort posts: pinned first
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
  const totalSteps = 5;

  const validateStep = (s: number): string | null => {
    switch (s) {
      case 0: {
        if (!selfieDataUrl && !device.avatarUrl) return "Please take a selfie first!";
        if (!nameInput.trim()) return "Please enter your name";
        return null;
      }
      case 1: {
        if (!productLink.trim()) return "Please add your product or project link";
        if (!contactInfo.trim()) return "Please add your contact info";
        return null;
      }
      case 2: return !introContent.trim() ? "Please write a brief intro" : null;
      case 3: {
        if (introImages.length === 0) return "Please upload at least one photo";
        if (!demoIntention) return "Please select whether you plan to demo";
        return null;
      }
      case 4: {
        if (editingPostId) return null;
        const email = emailInput.trim();
        if (!email) return "Please enter your email address";
        if (!email.includes("@") || !email.includes(".")) return "Please enter a valid email address";
        return null;
      }
      default: return null;
    }
  };

  return (
    <div className="min-h-screen pb-20">
      <canvas ref={canvasRef} className="hidden" />

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

      {/* Onboarding Dialog */}
      <Dialog open={showOnboarding} onOpenChange={(open) => { if (!open) closeOnboarding(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPostId ? "Edit your post" : "Join the session"}</DialogTitle>
            <DialogDescription>Step {step + 1} of {totalSteps}</DialogDescription>
          </DialogHeader>

          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-purple-500" : "bg-white/10"}`} />
            ))}
          </div>

          {step === 0 && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex flex-col items-center gap-3">
                <div className="relative w-36 h-36 rounded-full overflow-hidden bg-black border-2 border-white/10">
                  {!currentAvatarPreview && <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />}
                  {currentAvatarPreview && <img src={currentAvatarPreview} alt="Your selfie" className="w-full h-full object-cover" />}
                  {!currentAvatarPreview && !cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/5"><Camera className="w-8 h-8 text-white/30" /></div>
                  )}
                </div>
                {!currentAvatarPreview && cameraReady && (
                  <Button onClick={takeSelfie} size="sm" className="gap-2"><Camera className="w-4 h-4" />Take Selfie</Button>
                )}
                {currentAvatarPreview && (
                  <button onClick={retakeSelfie} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">Retake photo</button>
                )}
                <p className="text-xs text-white/40 text-center max-w-[280px]">Take a selfie so others can recognize you (required)</p>
              </div>
              <div className="space-y-2">
                <Label>Your Name</Label>
                <Input placeholder="Enter your name" value={nameInput} onChange={(e) => setNameInput(e.target.value)} autoFocus />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="space-y-2">
                <Label>What is a product/project link you want people to know about?</Label>
                <Input placeholder="https://your-project.com" value={productLink} onChange={(e) => setProductLink(e.target.value)} autoFocus />
              </div>
              <div className="space-y-2">
                <Label>What is your contact? <span className="text-white/40 font-normal">(LinkedIn / WhatsApp / Telegram / Facebook / Zalo)</span></Label>
                <Input placeholder="e.g. linkedin.com/in/yourname or @telegram_handle" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} />
                <p className="text-xs text-white/30">Please specify which platform</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <Label>Please briefly intro yourself and what you are working on today</Label>
                <Textarea placeholder="Hi! I'm working on..." value={introContent} onChange={(e) => setIntroContent(e.target.value)} maxLength={1000} className="min-h-[140px]" autoFocus />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <Label>Upload random photos at the session or projects you are working on <span className="text-white/40 font-normal">(modifiable later)</span></Label>
                {introImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-4">
                    {introImages.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={url} alt="" className="w-20 h-20 object-cover rounded-lg" />
                        <button type="button" onClick={() => setIntroImages((prev) => prev.filter((_, j) => j !== i))}
                          className="absolute -top-1 -right-1 bg-red-500 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-4">
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageUpload(e.target.files)} />
                  <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    <ImageIcon className="w-4 h-4" />{introImages.length > 0 ? `Add more (${introImages.length})` : "Choose photos"}
                  </Button>
                  {uploading && <span className="text-xs text-white/40">Uploading...</span>}
                </div>
              </div>
              <div>
                <Label>We highly encourage everyone to showcase at the end. You can show us anything (marketing, finance, code, etc) as long as it is tech related! Do you plan to demo?</Label>
                <div className="flex gap-2 mt-4">
                  {([{ value: "yes" as const, label: "Yes" }, { value: "no" as const, label: "No" }, { value: "later" as const, label: "Decide later" }]).map((opt) => (
                    <button key={opt.value} onClick={() => setDemoIntention(opt.value)}
                      className={`flex-1 py-2.5 px-3 rounded-xl text-sm font-medium transition-all border ${demoIntention === opt.value ? "border-purple-500 bg-purple-500/20 text-purple-300" : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"}`}>
                      {demoIntention === opt.value && <Check className="w-3 h-3 inline mr-1" />}{opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4 animate-fade-in">
              <div className="space-y-2">
                <Label>Your email address</Label>
                <p className="text-xs text-white/40">Used to claim your profile if you switch devices. Not shown publicly.</p>
                {editingPostId ? (
                  <p className="text-sm text-white/60">{(myPostQuery.data as PostData | null)?.email ?? "No email set"}</p>
                ) : (
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="text-base"
                    autoFocus
                  />
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            {step > 0 && <Button variant="secondary" onClick={() => setStep(step - 1)} className="flex-1">Back</Button>}
            {step < totalSteps - 1 ? (
              <Button onClick={() => { const err = validateStep(step); if (err) { toast.error(err); return; } setStep(step + 1); }} className="flex-1">Next</Button>
            ) : (
              <Button onClick={() => { const err = validateStep(step); if (err) { toast.error(err); return; } handleSubmit(); }} className="flex-1" disabled={isSubmitting}>
                <Send className="w-4 h-4" />{isSubmitting ? "Submitting..." : editingPostId ? "Save Changes" : "Submit"}
              </Button>
            )}
          </div>
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
                        updateSessionMutation.mutate({
                          id: session.id,
                          creatorDeviceId: device.deviceId || undefined,
                          creatorUserId: user?.id,
                          slug: slugInput,
                        });
                      }
                      if (e.key === "Escape") setEditingSlug(false);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 shrink-0"
                    disabled={updateSessionMutation.isPending}
                    onClick={() => {
                      updateSessionMutation.mutate({
                        id: session.id,
                        creatorDeviceId: device.deviceId,
                        slug: slugInput,
                      });
                    }}
                  >
                    <Check className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 shrink-0"
                    onClick={() => setEditingSlug(false)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-1 mt-2 max-w-[200px]">
                  <p className="text-[10px] text-white/30 text-center break-all select-all">{sessionUrl.replace(/^https?:\/\//, "")}</p>
                  {((session.creatorDeviceId && session.creatorDeviceId === device.deviceId) || (session.creatorUserId && user?.id && session.creatorUserId === user.id)) && (
                    <button
                      onClick={() => { setSlugInput(session.slug); setEditingSlug(true); }}
                      className="shrink-0 text-white/20 hover:text-white/60 transition-colors"
                    >
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

      {/* Posts Feed */}
      <div className="max-w-2xl mx-auto px-6 py-6">
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
              return viewMode === "compact" ? (
                <CompactPostCard
                  key={post.id}
                  post={post}
                  isOwn={isOwn}
                  isPinned={pinnedIds.has(post.id)}
                  isSaved={savedIds.has(post.id)}
                  onPin={() => handlePin(post.id)}
                  onSave={() => handleSave(post.id)}
                  onImageClick={setLightboxUrl}
                  onEdit={() => openOnboarding({ ...post, productLink: post.productLink || "", contactInfo: post.contactInfo || "", demoIntention: post.demoIntention || "" })}
                  onDelete={() => handleDelete(post.id)}
                />
              ) : (
                <FullPostCard
                  key={post.id}
                  post={post}
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
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom nav bar — liquid glass style */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3">
        {/* Tab switcher */}
        <div className="flex rounded-2xl border border-white/10 backdrop-blur-2xl bg-white/5 shadow-2xl shadow-black/40 overflow-hidden">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all ${
              activeTab === "all" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            <Layers className="w-5 h-5" strokeWidth={2.5} />
            All
          </button>
          <button
            onClick={() => setActiveTab("saved")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold transition-all ${
              activeTab === "saved" ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
            }`}
          >
            <Bookmark className="w-5 h-5" strokeWidth={2.5} />
            Saved
            {savedIds.size > 0 && <span className="text-[10px] font-bold bg-purple-500/30 text-purple-300 px-1.5 rounded-full">{savedIds.size}</span>}
          </button>
        </div>

        {/* View toggle */}
        <button
          onClick={() => setViewMode(viewMode === "full" ? "compact" : "full")}
          className="flex items-center gap-1.5 rounded-full border border-white/10 backdrop-blur-2xl bg-white/5 shadow-2xl shadow-black/40 px-4 py-3 text-xs font-bold text-white/50 hover:text-white/80 transition-all"
        >
          {viewMode === "full" ? <List className="w-5 h-5" strokeWidth={2.5} /> : <Layers className="w-5 h-5" strokeWidth={2.5} />}
          {viewMode === "full" ? "Compact" : "Full"}
        </button>
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

function isUrl(str: string) {
  return /^https?:\/\//i.test(str) || /^[a-z0-9-]+\.[a-z]{2,}/i.test(str) || str.includes("linkedin.com") || str.includes("t.me/") || str.includes("wa.me/");
}

function toHref(str: string) {
  return str.startsWith("http") ? str : `https://${str}`;
}

function Linkify({ text, className }: { text: string; className?: string }) {
  if (isUrl(text.trim())) {
    return (
      <a href={toHref(text.trim())} target="_blank" rel="noopener noreferrer"
        className={`hover:underline ${className || ""}`}>
        {text.replace(/^https?:\/\//, "")}
      </a>
    );
  }
  return <span className={className}>{text}</span>;
}

/* ─── Meta row (shared between mobile/desktop in full card) ─── */
function PostMeta({ post }: { post: PostData }) {
  return (
    <>
      {(post.demoIntention === "yes" || post.demoIntention === "later" || post.productLink) && (
        <div className="flex items-center gap-2 flex-wrap">
          {post.demoIntention === "yes" && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">Will demo</span>
          )}
          {post.demoIntention === "later" && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">Maybe demo</span>
          )}
          {post.productLink && (
            <a href={post.productLink.startsWith("http") ? post.productLink : `https://${post.productLink}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 truncate">
              <LinkIcon className="w-3 h-3 shrink-0" />
              <span className="truncate">{post.productLink.replace(/^https?:\/\//, "")}</span>
            </a>
          )}
        </div>
      )}
      {post.contactInfo && <p className="text-xs text-white/40 truncate"><Linkify text={post.contactInfo} className="text-purple-400/70 hover:text-purple-300" /></p>}
    </>
  );
}

/* ─── Action buttons (pin, save) ─── */
function PostActions({ isPinned, isSaved, isOwn, onPin, onSave, onEdit, onDelete }: {
  isPinned: boolean; isSaved: boolean; isOwn?: boolean; onPin: () => void; onSave: () => void; onEdit?: () => void; onDelete?: () => void;
}) {
  return (
    <div className="flex md:flex-row flex-col items-center gap-0.5">
      <button onClick={onPin} className={`p-1.5 rounded-lg transition-colors ${isPinned ? "text-purple-400" : "text-white/30 hover:text-white/60"}`} title={isPinned ? "Unpin" : "Pin to top"}>
        <Pin className="w-5 h-5" strokeWidth={2.5} />
      </button>
      <button onClick={onSave} className={`p-1.5 rounded-lg transition-colors ${isSaved ? "text-yellow-400" : "text-white/30 hover:text-white/60"}`} title={isSaved ? "Unsave" : "Save"}>
        <Bookmark className={`w-5 h-5 ${isSaved ? "fill-yellow-400" : ""}`} strokeWidth={2.5} />
      </button>
      {isOwn && onEdit && (
        <button onClick={onEdit} className="text-white/30 hover:text-white/60 transition-colors p-1.5" title="Edit">
          <Pencil className="w-5 h-5" strokeWidth={2.5} />
        </button>
      )}
      {isOwn && onDelete && (
        <button onClick={onDelete} className="text-white/30 hover:text-red-400 transition-colors p-1.5" title="Delete">
          <Trash2 className="w-5 h-5" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

/* ─── Full post card ─── */
function FullPostCard({
  post, isOwn, hasPosted, isSignedIn, device, expanded, commentText, isPinned, isSaved,
  onPin, onSave, onToggleComments, onCommentTextChange, onCommentSubmit, onEdit, onDelete, onImageClick, isSubmittingComment, trpc,
}: {
  post: PostData; isOwn: boolean; hasPosted: boolean; isSignedIn: boolean;
  device: { deviceId: string; name: string; avatarUrl: string };
  expanded: boolean; commentText: string; isPinned: boolean; isSaved: boolean;
  onPin: () => void; onSave: () => void;
  onToggleComments: () => void; onCommentTextChange: (text: string) => void;
  onCommentSubmit: () => void; onEdit: () => void; onDelete: () => void; onImageClick: (url: string) => void;
  isSubmittingComment: boolean; trpc: ReturnType<typeof useTRPC>;
}) {
  const commentsQuery = useQuery(
    trpc.comment.listByPost.queryOptions({ postId: post.id }, { enabled: expanded })
  );

  return (
    <div className={`border-b border-white/5 pb-5 animate-fade-in relative ${isPinned ? "border-l-2 border-l-purple-500/40 pl-3" : ""}`}>
      {/* Top right actions */}
      <div className="absolute top-0 right-0">
        <PostActions isPinned={isPinned} isSaved={isSaved} isOwn={isOwn} onPin={onPin} onSave={onSave} onEdit={onEdit} onDelete={onDelete} />
      </div>

      {isPinned && <span className="text-[10px] text-purple-400/60 mb-2 block">📌 Pinned</span>}

      {/* Mobile layout */}
      <div className="md:hidden">
        <div className="flex gap-3 items-center pr-24">
          <div className="rounded-full p-[3px] w-[80px] h-[80px] shrink-0"
            style={{ background: `linear-gradient(${hashToAngle(post.id)}deg, ${hashToColor(post.id, 0)}, ${hashToColor(post.id, 1)}, ${hashToColor(post.id, 2)})` }}>
            <AvatarImg src={post.authorAvatar} className="w-full h-full rounded-full border-2 border-[#0a0a0a]" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-base">{post.authorName}</span>
              <VerifiedBadge email={post.email} verified={post.verified} />
            </div>
            <PostMeta post={post} />
          </div>
        </div>
        <p className="text-[15px] text-white/90 whitespace-pre-wrap mt-3">{post.content}</p>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex gap-4">
        <div className="w-1/3 shrink-0 flex flex-col items-center text-center">
          <div className="rounded-full p-[3px] w-[152px] h-[152px]"
            style={{ background: `linear-gradient(${hashToAngle(post.id)}deg, ${hashToColor(post.id, 0)}, ${hashToColor(post.id, 1)}, ${hashToColor(post.id, 2)})` }}>
            <AvatarImg src={post.authorAvatar} className="w-full h-full rounded-full border-2 border-[#0a0a0a]" />
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="font-semibold text-base">{post.authorName}</span>
            <VerifiedBadge email={post.email} verified={post.verified} />
          </div>
        </div>
        <div className="flex-1 min-w-0 flex flex-col pr-20 space-y-2">
          <PostMeta post={post} />
          <p className="text-[15px] text-white/90 whitespace-pre-wrap flex-1">{post.content}</p>
        </div>
      </div>

      {/* Scrollable images */}
      {post.imageUrls.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <div className="flex gap-2 pb-1" style={{ scrollSnapType: "x mandatory" }}>
            {post.imageUrls.map((url, i) => (
              <img key={i} src={url} alt="" className="h-48 rounded-xl object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                style={{ scrollSnapAlign: "start" }} onClick={() => onImageClick(url)} />
            ))}
          </div>
        </div>
      )}

      {/* Comment toggle */}
      <button onClick={onToggleComments} className="mt-3 flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors">
        <MessageCircle className="w-4 h-4" />
        {post._count.comments > 0 ? `${post._count.comments} comment${post._count.comments > 1 ? "s" : ""}` : "Reply"}
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {/* Inline comments */}
      {expanded && (
        <div className="mt-3 pl-4 border-l border-white/5 space-y-3 animate-fade-in">
          {commentsQuery.data?.map((comment) => (
            <div key={comment.id} className="flex gap-2.5">
              <AvatarImg src={comment.authorAvatar} className="w-7 h-7 rounded-full shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium">{comment.authorName}</span>
                  <span className="text-[11px] text-white/25">{timeAgo(comment.createdAt)}</span>
                </div>
                <p className="text-sm text-white/70 mt-0.5">{comment.content}</p>
              </div>
            </div>
          ))}
          {commentsQuery.isLoading && <div className="text-xs text-white/30 py-2">Loading comments...</div>}
          {isSignedIn ? (
            <div className="flex gap-2.5 pt-1">
              <AvatarImg src={device.avatarUrl} className="w-7 h-7 rounded-full shrink-0" />
              <form onSubmit={(e) => { e.preventDefault(); onCommentSubmit(); }} className="flex-1 flex gap-2">
                <Input placeholder="Reply..." value={commentText} onChange={(e) => onCommentTextChange(e.target.value)} maxLength={300} className="text-base h-9" />
                <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={isSubmittingComment || !commentText.trim()}>
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </form>
            </div>
          ) : (
            <SignInButton mode="modal" forceRedirectUrl={`/${sessionSlug}`}>
              <button className="text-xs text-purple-400 hover:text-purple-300 pt-1 transition-colors">Sign in to comment</button>
            </SignInButton>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Compact post card ─── */
function CompactPostCard({
  post, isOwn, isPinned, isSaved, onPin, onSave, onImageClick, onEdit, onDelete,
}: {
  post: PostData; isOwn: boolean; isPinned: boolean; isSaved: boolean;
  onPin: () => void; onSave: () => void; onImageClick: (url: string) => void; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <div className={`flex gap-3 items-start py-3 border-b border-white/5 animate-fade-in ${isPinned ? "border-l-2 border-l-purple-500/40 pl-2" : ""}`}>
      {/* Small avatar */}
      <div className="rounded-full p-[2px] w-[44px] h-[44px] shrink-0"
        style={{ background: `linear-gradient(${hashToAngle(post.id)}deg, ${hashToColor(post.id, 0)}, ${hashToColor(post.id, 1)}, ${hashToColor(post.id, 2)})` }}>
        <AvatarImg src={post.authorAvatar} className="w-full h-full rounded-full border-[1.5px] border-[#0a0a0a]" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm">{post.authorName}</span>
          <VerifiedBadge email={post.email} verified={post.verified} />
          {post.demoIntention === "yes" && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">Demo</span>
          )}
          {post.demoIntention === "later" && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">Maybe</span>
          )}
          {post.productLink && (
            <a href={post.productLink.startsWith("http") ? post.productLink : `https://${post.productLink}`}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-0.5 text-[11px] text-purple-400 hover:text-purple-300 truncate max-w-[120px]">
              <LinkIcon className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{post.productLink.replace(/^https?:\/\//, "")}</span>
            </a>
          )}
        </div>
        {post.contactInfo && <p className="text-[11px] text-white/30 truncate"><Linkify text={post.contactInfo} className="text-purple-400/60 hover:text-purple-300" /></p>}
        <p className="text-sm text-white/70 mt-1 line-clamp-2">{post.content}</p>

        {/* Tiny image thumbnails */}
        {post.imageUrls.length > 0 && (
          <div className="flex gap-1.5 mt-2">
            {post.imageUrls.slice(0, 4).map((url, i) => (
              <img key={i} src={url} alt="" className="w-12 h-12 rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => onImageClick(url)} />
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
            <MessageCircle className="w-3 h-3" />{post._count.comments}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="shrink-0">
        <PostActions isPinned={isPinned} isSaved={isSaved} isOwn={isOwn} onPin={onPin} onSave={onSave} onEdit={onEdit} onDelete={onDelete} />
      </div>
    </div>
  );
}
