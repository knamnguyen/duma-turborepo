import { Link as LinkIcon, Mail, Phone } from "lucide-react";
import type { FieldType } from "@/lib/form-schema";

function isUrl(str: string) {
  return /^https?:\/\//i.test(str) || /^[a-z0-9-]+\.[a-z]{2,}/i.test(str);
}

function toHref(str: string) {
  return str.startsWith("http") ? str : `https://${str}`;
}

export function TextFieldRenderer({ value }: { value: string }) {
  if (!value) return null;
  return <span className="text-sm text-white/80">{value}</span>;
}

export function TextareaFieldRenderer({ value }: { value: string }) {
  if (!value) return null;
  return <p className="text-sm text-white/80 whitespace-pre-wrap">{value}</p>;
}

export function UrlFieldRenderer({ value }: { value: string }) {
  if (!value) return null;
  const href = isUrl(value) ? toHref(value) : value;
  const display = value.replace(/^https?:\/\//, "");
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 truncate"
    >
      <LinkIcon className="w-3 h-3 shrink-0" />
      <span className="truncate">{display}</span>
    </a>
  );
}

export function EmailFieldRenderer({ value }: { value: string }) {
  if (!value) return null;
  return (
    <a
      href={`mailto:${value}`}
      className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
    >
      <Mail className="w-3 h-3 shrink-0" />
      <span className="truncate">{value}</span>
    </a>
  );
}

export function PhoneFieldRenderer({ value }: { value: string }) {
  if (!value) return null;
  return (
    <a
      href={`tel:${value}`}
      className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300"
    >
      <Phone className="w-3 h-3 shrink-0" />
      <span>{value}</span>
    </a>
  );
}

export function SelectFieldRenderer({ value }: { value: string }) {
  if (!value) return null;

  const colorMap: Record<string, string> = {
    yes: "bg-green-500/15 text-green-400 border-green-500/20",
    no: "bg-red-500/15 text-red-400 border-red-500/20",
    "maybe later": "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  };

  const colorClass =
    colorMap[value.toLowerCase()] ||
    "bg-purple-500/15 text-purple-400 border-purple-500/20";

  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colorClass}`}
    >
      {value}
    </span>
  );
}

export function PhotoFieldRenderer({ value }: { value: string }) {
  if (!value) return null;
  return (
    <img
      src={value}
      alt=""
      className="w-16 h-16 rounded-lg object-cover"
    />
  );
}

/** Renders a field value based on its type */
export function FieldRenderer({
  type,
  value,
}: {
  type: FieldType;
  value: string;
}) {
  switch (type) {
    case "text":
      return <TextFieldRenderer value={value} />;
    case "textarea":
      return <TextareaFieldRenderer value={value} />;
    case "url":
      return <UrlFieldRenderer value={value} />;
    case "email":
      return <EmailFieldRenderer value={value} />;
    case "phone":
      return <PhoneFieldRenderer value={value} />;
    case "select":
      return <SelectFieldRenderer value={value} />;
    case "photo":
      return <PhotoFieldRenderer value={value} />;
    default:
      return <TextFieldRenderer value={value} />;
  }
}
