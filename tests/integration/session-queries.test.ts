import { describe, it, expect } from "bun:test";
import { createTestCaller } from "../helpers/test-caller";
import { DEFAULT_FORM_SCHEMA } from "@/lib/form-schema";

const BASE_INPUT = {
  name: "Test Session",
  date: "2026-01-01",
  description: "A test session",
  creatorDeviceId: "device-123",
} as const;

describe("session.list", () => {
  it("returns empty array when no sessions", async () => {
    const { caller } = await createTestCaller();
    const result = await caller.session.list();
    expect(result).toEqual([]);
  });

  it("returns sessions ordered by createdAt DESC and includes postCount", async () => {
    const { caller, db } = await createTestCaller();

    // Insert directly with controlled timestamps for deterministic ordering
    await db
      .prepare(
        'INSERT INTO "Session" (id, name, slug, date, description, "creatorDeviceId", "creatorUserId", "formSchema", createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind("s1", "First", "first", "2026-01-01", "", "d1", null, "[]", "2026-01-01T00:00:00.000Z")
      .run();
    await db
      .prepare(
        'INSERT INTO "Session" (id, name, slug, date, description, "creatorDeviceId", "creatorUserId", "formSchema", createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      )
      .bind("s2", "Second", "second", "2026-01-01", "", "d2", null, "[]", "2026-01-02T00:00:00.000Z")
      .run();

    const result = await caller.session.list();
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Second");
    expect(result[1].name).toBe("First");
    expect(result[0]._count.posts).toBe(0);
  });
});

describe("session.getBySlug", () => {
  it("returns session by slug", async () => {
    const { caller } = await createTestCaller();
    await caller.session.create(BASE_INPUT);

    const session = await caller.session.getBySlug({ slug: "test-session" });
    expect(session.name).toBe("Test Session");
  });

  it("parses formSchema from JSON", async () => {
    const { caller } = await createTestCaller();
    const customSchema = [
      { id: "name", type: "text" as const, label: "Name", required: true, builtin: true },
    ];
    await caller.session.create({ ...BASE_INPUT, formSchema: customSchema });

    const session = await caller.session.getBySlug({ slug: "test-session" });
    expect(session.formSchema).toEqual(customSchema);
  });

  it("returns DEFAULT_FORM_SCHEMA when formSchema is null/empty", async () => {
    const { caller } = await createTestCaller();
    await caller.session.create(BASE_INPUT);

    const session = await caller.session.getBySlug({ slug: "test-session" });
    expect(session.formSchema).toEqual(DEFAULT_FORM_SCHEMA);
  });

  it("throws for non-existent slug", async () => {
    const { caller } = await createTestCaller();
    await expect(
      caller.session.getBySlug({ slug: "does-not-exist" })
    ).rejects.toThrow("Session not found");
  });
});

describe("session.getFormSchema", () => {
  it("returns form schema for session", async () => {
    const { caller } = await createTestCaller();
    const customSchema = [
      { id: "email", type: "email" as const, label: "Email", required: true, builtin: true },
    ];
    const created = await caller.session.create({ ...BASE_INPUT, formSchema: customSchema });

    const schema = await caller.session.getFormSchema({ sessionId: created.id });
    expect(schema).toEqual(customSchema);
  });

  it("returns DEFAULT_FORM_SCHEMA for session without custom schema", async () => {
    const { caller } = await createTestCaller();
    const created = await caller.session.create(BASE_INPUT);

    const schema = await caller.session.getFormSchema({ sessionId: created.id });
    expect(schema).toEqual(DEFAULT_FORM_SCHEMA);
  });

  it("throws for non-existent session", async () => {
    const { caller } = await createTestCaller();
    await expect(
      caller.session.getFormSchema({ sessionId: "nonexistent" })
    ).rejects.toThrow("Session not found");
  });
});
