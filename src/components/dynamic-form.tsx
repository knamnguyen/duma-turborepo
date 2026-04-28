"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Camera, ImageIcon, Send, X, Check } from "lucide-react";
import { toast } from "sonner";
import type { FormField } from "@/lib/form-schema";

export function DynamicForm({
  schema,
  initialValues,
  isEditing,
  isSubmitting,
  onSubmit,
  submitLabel,
}: {
  schema: FormField[];
  initialValues?: Record<string, string>;
  isEditing: boolean;
  isSubmitting: boolean;
  onSubmit: (responses: Record<string, string>, avatarDataUrl: string) => void;
  submitLabel?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(
    initialValues || {}
  );
  const [currentStep, setCurrentStep] = useState(0);
  const [selfieDataUrl, setSelfieDataUrl] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [retaking, setRetaking] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Group fields into steps: each step has 1-3 fields for manageable UX
  const steps = groupFieldsIntoSteps(schema);
  const totalSteps = steps.length;
  const currentFields = steps[currentStep] || [];

  const setValue = (fieldId: string, val: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
  };

  // Camera management for photo fields
  const hasPhotoField = currentFields.some((f) => f.type === "photo");

  useEffect(() => {
    if (hasPhotoField && !selfieDataUrl && !retaking) {
      const existingAvatar = values["selfie"] || initialValues?.["selfie"];
      if (!existingAvatar) {
        startCamera();
      }
    }
    return () => {
      if (!hasPhotoField) stopCamera();
    };
  }, [currentStep, hasPhotoField, retaking]);

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
    } catch (err) {
      console.error("Camera access denied:", err);
    }
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
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.save();
    ctx.translate(256, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(
      video,
      (video.videoWidth - size) / 2,
      (video.videoHeight - size) / 2,
      size,
      size,
      0,
      0,
      256,
      256
    );
    ctx.restore();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
    setSelfieDataUrl(dataUrl);
    setRetaking(false);
    stopCamera();
  };

  const retakeSelfie = () => {
    setSelfieDataUrl("");
    setRetaking(true);
    startCamera();
  };

  const currentAvatarPreview =
    retaking ? "" : selfieDataUrl || values["selfie"] || initialValues?.["selfie"] || "";

  const validateStep = () => {
    for (const field of currentFields) {
      if (!field.required) continue;
      if (field.type === "photo") {
        if (!selfieDataUrl && !values["selfie"] && !initialValues?.["selfie"]) {
          return `Please complete: ${field.label}`;
        }
        continue;
      }
      const val = values[field.id]?.trim();
      if (!val) return `Please complete: ${field.label}`;
      if (field.type === "email" && (!val.includes("@") || !val.includes("."))) {
        return "Please enter a valid email address";
      }
    }
    return null;
  };

  const handleNext = () => {
    const err = validateStep();
    if (err) {
      toast.error(err);
      return;
    }
    setCurrentStep((s) => s + 1);
  };

  const handleBack = () => {
    setCurrentStep((s) => s - 1);
  };

  const handleSubmitForm = () => {
    const err = validateStep();
    if (err) {
      toast.error(err);
      return;
    }
    onSubmit(values, selfieDataUrl);
  };

  return (
    <div>
      <canvas ref={canvasRef} className="hidden" />

      {/* Progress bar */}
      <div className="flex gap-1 mb-4">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= currentStep ? "bg-purple-500" : "bg-white/10"
            }`}
          />
        ))}
      </div>

      <p className="text-xs text-white/40 mb-4">
        Step {currentStep + 1} of {totalSteps}
      </p>

      {/* Fields for current step */}
      <div className="space-y-5 animate-fade-in">
        {currentFields.map((field) => (
          <DynamicFieldInput
            key={field.id}
            field={field}
            value={values[field.id] || ""}
            onChange={(val) => setValue(field.id, val)}
            // Photo-specific props
            videoRef={videoRef}
            cameraReady={cameraReady}
            currentAvatarPreview={
              field.type === "photo" ? currentAvatarPreview : ""
            }
            onTakeSelfie={takeSelfie}
            onRetakeSelfie={retakeSelfie}
            isEditing={isEditing}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-4">
        {currentStep > 0 && (
          <Button
            type="button"
            variant="secondary"
            onClick={handleBack}
            className="flex-1"
          >
            Back
          </Button>
        )}
        {currentStep < totalSteps - 1 ? (
          <Button type="button" onClick={handleNext} className="flex-1">
            Next
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleSubmitForm}
            className="flex-1"
            disabled={isSubmitting}
          >
            <Send className="w-4 h-4" />
            {isSubmitting
              ? "Submitting..."
              : submitLabel || (isEditing ? "Save Changes" : "Submit")}
          </Button>
        )}
      </div>
    </div>
  );
}

function DynamicFieldInput({
  field,
  value,
  onChange,
  videoRef,
  cameraReady,
  currentAvatarPreview,
  onTakeSelfie,
  onRetakeSelfie,
  isEditing,
}: {
  field: FormField;
  value: string;
  onChange: (val: string) => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cameraReady: boolean;
  currentAvatarPreview: string;
  onTakeSelfie: () => void;
  onRetakeSelfie: () => void;
  isEditing: boolean;
}) {
  switch (field.type) {
    case "photo":
      return (
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-36 h-36 rounded-full overflow-hidden bg-black border-2 border-white/10">
            {!currentAvatarPreview && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            )}
            {currentAvatarPreview && (
              <img
                src={currentAvatarPreview}
                alt="Your selfie"
                className="w-full h-full object-cover"
              />
            )}
            {!currentAvatarPreview && !cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/5">
                <Camera className="w-8 h-8 text-white/30" />
              </div>
            )}
          </div>
          {!currentAvatarPreview && cameraReady && (
            <Button onClick={onTakeSelfie} size="sm" className="gap-2">
              <Camera className="w-4 h-4" />
              Take Selfie
            </Button>
          )}
          {currentAvatarPreview && (
            <button
              type="button"
              onClick={onRetakeSelfie}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              Retake photo
            </button>
          )}
          <p className="text-xs text-white/40 text-center max-w-[280px]">
            {field.label}{" "}
            {field.required && "(required)"}
          </p>
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-2">
          <Label>
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </Label>
          <Textarea
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            maxLength={1000}
            className="min-h-[140px]"
          />
        </div>
      );

    case "select":
      return (
        <div className="space-y-2">
          <Label>
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </Label>
          <div className="flex gap-2 flex-wrap">
            {(field.options || []).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                className={`py-2.5 px-4 rounded-xl text-sm font-medium transition-all border ${
                  value === opt
                    ? "border-purple-500 bg-purple-500/20 text-purple-300"
                    : "border-white/10 bg-white/5 text-white/60 hover:border-white/20"
                }`}
              >
                {value === opt && <Check className="w-3 h-3 inline mr-1" />}
                {opt}
              </button>
            ))}
          </div>
        </div>
      );

    case "email":
      // In edit mode for email field, show as read-only
      if (isEditing && field.id === "email") {
        return (
          <div className="space-y-2">
            <Label>{field.label}</Label>
            <p className="text-sm text-white/60">{value || "No email set"}</p>
          </div>
        );
      }
      return (
        <div className="space-y-2">
          <Label>
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </Label>
          {field.id === "email" && (
            <p className="text-xs text-white/40">
              Used to claim your profile if you switch devices. Not shown
              publicly.
            </p>
          )}
          <Input
            type="email"
            placeholder="your@email.com"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="text-base"
          />
        </div>
      );

    case "url":
      return (
        <div className="space-y-2">
          <Label>
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </Label>
          <Input
            type="url"
            placeholder="https://..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case "phone":
      return (
        <div className="space-y-2">
          <Label>
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </Label>
          <Input
            type="tel"
            placeholder="+1 (555) 123-4567"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    default:
      return (
        <div className="space-y-2">
          <Label>
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </Label>
          <Input
            placeholder={`Enter ${field.label.toLowerCase()}...`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );
  }
}

/** Group fields into steps of 1-3 fields each for a multi-step form UX */
function groupFieldsIntoSteps(schema: FormField[]) {
  const steps: FormField[][] = [];

  // Photo + name always go together in step 0 if present
  const photoField = schema.find((f) => f.type === "photo");
  const nameField = schema.find((f) => f.id === "name");

  if (photoField && nameField) {
    steps.push([photoField, nameField]);
  } else if (photoField) {
    steps.push([photoField]);
  } else if (nameField) {
    steps.push([nameField]);
  }

  // Remaining fields, grouped by 2-3
  const remaining = schema.filter(
    (f) => f.id !== "selfie" && f.id !== "name" && f.type !== "photo"
  );

  let batch: FormField[] = [];
  for (const field of remaining) {
    batch.push(field);
    // Textarea and select get their own step for better UX
    if (field.type === "textarea" || field.type === "select" || batch.length >= 3) {
      steps.push(batch);
      batch = [];
    }
  }
  if (batch.length > 0) {
    steps.push(batch);
  }

  return steps;
}
