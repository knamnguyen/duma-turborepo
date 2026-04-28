import { z } from "zod";

export const FIELD_TYPES = ["text", "textarea", "url", "email", "phone", "select", "photo"] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const formFieldSchema = z.object({
  id: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  label: z.string().min(1).max(200),
  required: z.boolean(),
  builtin: z.boolean(),
  options: z.array(z.string()).optional(),
});

export type FormField = z.infer<typeof formFieldSchema>;

export const formSchemaValidator = z.array(formFieldSchema);

export const DEFAULT_FORM_SCHEMA: FormField[] = [
  { id: "name", type: "text", label: "Name", required: true, builtin: true },
  { id: "email", type: "email", label: "Email", required: true, builtin: true },
  { id: "selfie", type: "photo", label: "Selfie", required: true, builtin: true },
  { id: "bio", type: "textarea", label: "About you", required: true, builtin: false },
  { id: "projectLink", type: "url", label: "Project Link", required: false, builtin: false },
  { id: "contactInfo", type: "text", label: "Contact Info", required: false, builtin: false },
  {
    id: "demoIntention",
    type: "select",
    label: "Will you demo?",
    required: false,
    builtin: false,
    options: ["Yes", "No", "Maybe later"],
  },
];

export const BUILTIN_FIELDS: FormField[] = [
  { id: "name", type: "text", label: "Name", required: true, builtin: true },
  { id: "email", type: "email", label: "Email", required: true, builtin: true },
  { id: "selfie", type: "photo", label: "Selfie", required: true, builtin: true },
];

export const OPTIONAL_PREDEFINED_FIELDS: FormField[] = [
  { id: "bio", type: "textarea", label: "About you", required: true, builtin: false },
  { id: "projectLink", type: "url", label: "Project Link", required: false, builtin: false },
  { id: "contactInfo", type: "text", label: "Contact Info", required: false, builtin: false },
  {
    id: "demoIntention",
    type: "select",
    label: "Will you demo?",
    required: false,
    builtin: false,
    options: ["Yes", "No", "Maybe later"],
  },
];

/** Map legacy Post columns to fieldResponses format */
export function mapLegacyToFieldResponses(post: {
  authorName: string;
  content: string;
  productLink: string | null;
  contactInfo: string | null;
  demoIntention: string | null;
}) {
  return {
    name: post.authorName,
    bio: post.content,
    projectLink: post.productLink || "",
    contactInfo: post.contactInfo || "",
    demoIntention: post.demoIntention || "",
  } as const;
}
