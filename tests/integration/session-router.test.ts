import { describe, it, expect } from "bun:test";
import { createTestCaller } from "../helpers/test-caller";
import { DEFAULT_FORM_SCHEMA } from "@/lib/form-schema";

const BASE_INPUT = {
  name: "Test Session",
  date: "2026-01-01",
  description: "A test session",
  creatorDeviceId: "device-123",
} as const;

describe("session.create", () => {
  it("creates session with valid input and returns id/name/slug", async () => {
    const { caller } = await createTestCaller();
    const result = await caller.session.create(BASE_INPUT);

    expect(result.id).toBeTruthy();
    expect(result.name).toBe("Test Session");
    expect(result.slug).toBe("test-session");
  });
  it("generates correct slug from name", async () => {
    const { caller } = await createTestCaller();
    const result = await caller.session.create({
      ...BASE_INPUT,
      name: "Hello World! @#$ Test",
    });

    expect(result.slug).toBe("hello-world-test");
  });
  it("rejects empty name", async () => {
    const { caller } = await createTestCaller();
    await expect(
      caller.session.create({ ...BASE_INPUT, name: "" })
    ).rejects.toThrow();
  });
  it("rejects duplicate slug", async () => {
    const { caller } = await createTestCaller();
    await caller.session.create(BASE_INPUT);

    await expect(
      caller.session.create({ ...BASE_INPUT, creatorDeviceId: "device-456" })
    ).rejects.toThrow("A session with this name already exists");
  });
  it("cleans up SlugRedirect conflicts on create", async () => {
    const { caller } = await createTestCaller();

    // Create session A, change its slug so old slug becomes a redirect
    const sessionA = await caller.session.create({
      ...BASE_INPUT,
      name: "Alpha",
    });
    await caller.session.update({
      id: sessionA.id,
      creatorDeviceId: "device-123",
      slug: "alpha-renamed",
    });

    // Now create session B with the name "Alpha" (slug "alpha")
    // This should clean up the redirect and succeed
    const sessionB = await caller.session.create({
      ...BASE_INPUT,
      name: "Alpha",
      creatorDeviceId: "device-456",
    });
    expect(sessionB.slug).toBe("alpha");
  });
  it("stores formSchema when provided", async () => {
    const { caller } = await createTestCaller();
    const customSchema = [
      { id: "name", type: "text" as const, label: "Name", required: true, builtin: true },
    ];

    const result = await caller.session.create({
      ...BASE_INPUT,
      formSchema: customSchema,
    });

    expect(result.formSchema).toEqual(customSchema);
  });
  it("uses DEFAULT_FORM_SCHEMA when formSchema not provided", async () => {
    const { caller } = await createTestCaller();
    const result = await caller.session.create(BASE_INPUT);

    expect(result.formSchema).toEqual(DEFAULT_FORM_SCHEMA);
  });
  it("stores creatorDeviceId and creatorUserId", async () => {
    const { caller } = await createTestCaller();
    const result = await caller.session.create({
      ...BASE_INPUT,
      creatorUserId: "user-abc",
    });

    const session = await caller.session.getBySlug({ slug: result.slug });
    expect(session.creatorDeviceId).toBe("device-123");
    expect(session.creatorUserId).toBe("user-abc");
  });
});

describe("session.update", () => {
  it("updates name/description/date", async () => {
    const { caller } = await createTestCaller();
    const created = await caller.session.create(BASE_INPUT);

    const updated = await caller.session.update({
      id: created.id,
      creatorDeviceId: "device-123",
      name: "Updated Name",
      description: "Updated desc",
      date: "2026-06-01",
    });

    expect(updated!.name).toBe("Updated Name");
    expect(updated!.description).toBe("Updated desc");
    expect(updated!.date).toBe("2026-06-01");
  });
  it("rejects non-owner (wrong deviceId and no userId)", async () => {
    const { caller } = await createTestCaller();
    const created = await caller.session.create(BASE_INPUT);

    await expect(
      caller.session.update({
        id: created.id,
        creatorDeviceId: "wrong-device",
        name: "Hacked",
      })
    ).rejects.toThrow("Only the session creator can update this session");
  });
  it("allows owner by deviceId", async () => {
    const { caller } = await createTestCaller();
    const created = await caller.session.create(BASE_INPUT);

    const updated = await caller.session.update({
      id: created.id,
      creatorDeviceId: "device-123",
      name: "By Device",
    });

    expect(updated!.name).toBe("By Device");
  });

  it("allows owner by userId", async () => {
    const { caller } = await createTestCaller();
    const created = await caller.session.create({
      ...BASE_INPUT,
      creatorUserId: "user-owner",
    });

    const updated = await caller.session.update({
      id: created.id,
      creatorUserId: "user-owner",
      name: "By User",
    });

    expect(updated!.name).toBe("By User");
  });

  it("updates formSchema", async () => {
    const { caller } = await createTestCaller();
    const created = await caller.session.create(BASE_INPUT);
    const newSchema = [
      { id: "email", type: "email" as const, label: "Email", required: true, builtin: true },
    ];

    await caller.session.update({
      id: created.id,
      creatorDeviceId: "device-123",
      formSchema: newSchema,
    });

    const schema = await caller.session.getFormSchema({ sessionId: created.id });
    expect(schema).toEqual(newSchema);
  });

  it("updates youtubePlaylistUrl", async () => {
    const { caller } = await createTestCaller();
    const created = await caller.session.create(BASE_INPUT);

    await caller.session.update({
      id: created.id,
      creatorDeviceId: "device-123",
      youtubePlaylistUrl: "https://youtube.com/playlist?list=abc",
    });

    const session = await caller.session.getBySlug({ slug: created.slug });
    expect(session.youtubePlaylistUrl).toBe("https://youtube.com/playlist?list=abc");
  });

  it("returns unchanged session when no updates provided", async () => {
    const { caller } = await createTestCaller();
    const created = await caller.session.create(BASE_INPUT);

    const result = await caller.session.update({
      id: created.id,
      creatorDeviceId: "device-123",
    });

    expect(result!.name).toBe(created.name);
    expect(result!.slug).toBe(created.slug);
  });
});
