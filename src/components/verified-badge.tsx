import { CheckCircle2 } from "lucide-react";

export function VerifiedBadge({
  email,
  verified,
}: {
  email: string | null;
  verified: number;
}) {
  if (email === null) return null;

  if (verified === 1) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
        <CheckCircle2 className="w-2.5 h-2.5" />
        Verified
      </span>
    );
  }

  return (
    <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">
      Unverified
    </span>
  );
}
