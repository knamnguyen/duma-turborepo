import { describe, it, expect } from "bun:test";
import {
  formSchemaValidator,
  mapLegacyToFieldResponses,
  DEFAULT_FORM_SCHEMA,
  BUILTIN_FIELDS,
} from "@/lib/form-schema";

describe("formSchemaValidator", () => {
  it("accepts a valid schema", () => {
    const valid = [
      {
        id: "name",
        type: "text",
        label: "Name",
        required: true,
        builtin: true,
      },
    ];
    const result = formSchemaValidator.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it("rejects field missing id", () => {
    const invalid = [
      { type: "text", label: "Name", required: true, builtin: true },
    ];
    const result = formSchemaValidator.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects field missing type", () => {
    const invalid = [
      { id: "name", label: "Name", required: true, builtin: true },
    ];
    const result = formSchemaValidator.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects field missing label", () => {
    const invalid = [
      { id: "name", type: "text", required: true, builtin: true },
    ];
    const result = formSchemaValidator.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects invalid field type", () => {
    const invalid = [
      {
        id: "name",
        type: "checkbox",
        label: "Name",
        required: true,
        builtin: true,
      },
    ];
    const result = formSchemaValidator.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("accepts an empty array", () => {
    const result = formSchemaValidator.safeParse([]);
    expect(result.success).toBe(true);
  });

  it("accepts schema with options for select type", () => {
    const valid = [
      {
        id: "demo",
        type: "select",
        label: "Will you demo?",
        required: false,
        builtin: false,
        options: ["Yes", "No"],
      },
    ];
    const result = formSchemaValidator.safeParse(valid);
    expect(result.success).toBe(true);
  });
});

describe("mapLegacyToFieldResponses", () => {
  it("maps all legacy columns correctly", () => {
    const post = {
      authorName: "John",
      content: "My bio",
      productLink: "https://example.com",
      contactInfo: "@john",
      demoIntention: "Yes",
    };
    const result = mapLegacyToFieldResponses(post);
    expect(result).toEqual({
      name: "John",
      bio: "My bio",
      projectLink: "https://example.com",
      contactInfo: "@john",
      demoIntention: "Yes",
    });
  });

  it("handles null values by converting to empty string", () => {
    const post = {
      authorName: "John",
      content: "My bio",
      productLink: null,
      contactInfo: null,
      demoIntention: null,
    };
    const result = mapLegacyToFieldResponses(post);
    expect(result.projectLink).toBe("");
    expect(result.contactInfo).toBe("");
    expect(result.demoIntention).toBe("");
  });

  it("preserves non-null values", () => {
    const post = {
      authorName: "Jane",
      content: "Hello",
      productLink: "https://example.com",
      contactInfo: "jane@test.com",
      demoIntention: "Maybe later",
    };
    const result = mapLegacyToFieldResponses(post);
    expect(result.name).toBe("Jane");
    expect(result.bio).toBe("Hello");
    expect(result.projectLink).toBe("https://example.com");
    expect(result.contactInfo).toBe("jane@test.com");
    expect(result.demoIntention).toBe("Maybe later");
  });
});

describe("DEFAULT_FORM_SCHEMA", () => {
  it("has exactly 7 fields", () => {
    expect(DEFAULT_FORM_SCHEMA).toHaveLength(7);
  });

  it("first 3 fields are builtin", () => {
    const first3 = DEFAULT_FORM_SCHEMA.slice(0, 3);
    expect(first3.every((f) => f.builtin)).toBe(true);
    expect(first3.map((f) => f.id)).toEqual([
      "name",
      "email",
      "selfie",
    ]);
  });

  it("demoIntention has options array", () => {
    const demo = DEFAULT_FORM_SCHEMA.find(
      (f) => f.id === "demoIntention"
    );
    expect(demo).toBeDefined();
    expect(demo!.options).toBeDefined();
    expect(Array.isArray(demo!.options)).toBe(true);
    expect(demo!.options!.length).toBeGreaterThan(0);
  });
});

describe("BUILTIN_FIELDS", () => {
  it("has exactly 3 fields", () => {
    expect(BUILTIN_FIELDS).toHaveLength(3);
  });

  it("all fields are builtin and required", () => {
    expect(BUILTIN_FIELDS.every((f) => f.builtin)).toBe(true);
    expect(BUILTIN_FIELDS.every((f) => f.required)).toBe(true);
  });
});
