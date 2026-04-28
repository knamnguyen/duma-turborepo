import { describe, it, expect } from "bun:test";
import { createTestCaller } from "../helpers/test-caller";

const BASE_INPUT = {
  name: "Test Session",
  date: "2026-01-01",
  description: "A test session",
  creatorDeviceId: "device-123",
} as const;

describe("session.resolveSlug", () => {
  it("returns { slug, redirect: false } for existing session slug", async () => {
    const { caller } = await createTestCaller();
    await caller.session.create(BASE_INPUT);

    const result = await caller.session.resolveSlug({ slug: "test-session" });
    expect(result).toEqual({ slug: "test-session", redirect: false });
  });

  it("returns { slug, redirect: true } for old slug that was changed", async () => {
    const { caller } = await createTestCaller();
    const created = await caller.session.create(BASE_INPUT);

    await caller.session.update({
      id: created.id,
      creatorDeviceId: "device-123",
      slug: "new-slug",
    });

    const result = await caller.session.resolveSlug({ slug: "test-session" });
    expect(result).toEqual({ slug: "new-slug", redirect: true });
  });

  it("throws for non-existent slug", async () => {
    const { caller } = await createTestCaller();
    await expect(
      caller.session.resolveSlug({ slug: "does-not-exist" })
    ).rejects.toThrow("Session not found");
  });
});

describe("slug change flow", () => {
  it("old slug redirects to new after slug change", async () => {
    const { caller } = await createTestCaller();
    const created = await caller.session.create(BASE_INPUT);

    await caller.session.update({
      id: created.id,
      creatorDeviceId: "device-123",
      slug: "renamed",
    });

    const resolved = await caller.session.resolveSlug({ slug: "test-session" });
    expect(resolved).toEqual({ slug: "renamed", redirect: true });

    // New slug resolves directly
    const direct = await caller.session.resolveSlug({ slug: "renamed" });
    expect(direct).toEqual({ slug: "renamed", redirect: false });
  });

  it("changing slug twice: both old slugs redirect to current", async () => {
    const { caller } = await createTestCaller();
    const created = await caller.session.create(BASE_INPUT);

    // First rename: test-session -> slug-v2
    await caller.session.update({
      id: created.id,
      creatorDeviceId: "device-123",
      slug: "slug-v2",
    });

    // Second rename: slug-v2 -> slug-v3
    await caller.session.update({
      id: created.id,
      creatorDeviceId: "device-123",
      slug: "slug-v3",
    });

    // Both old slugs should redirect to current slug
    const r1 = await caller.session.resolveSlug({ slug: "test-session" });
    expect(r1).toEqual({ slug: "slug-v3", redirect: true });

    const r2 = await caller.session.resolveSlug({ slug: "slug-v2" });
    expect(r2).toEqual({ slug: "slug-v3", redirect: true });

    // Current slug resolves directly
    const r3 = await caller.session.resolveSlug({ slug: "slug-v3" });
    expect(r3).toEqual({ slug: "slug-v3", redirect: false });
  });

  it("reverting to original slug cleans up redirect", async () => {
    const { caller } = await createTestCaller();
    const created = await caller.session.create(BASE_INPUT);

    // Rename away
    await caller.session.update({
      id: created.id,
      creatorDeviceId: "device-123",
      slug: "temporary",
    });

    // Revert back to original
    await caller.session.update({
      id: created.id,
      creatorDeviceId: "device-123",
      slug: "test-session",
    });

    // Original slug resolves directly (redirect was cleaned up)
    const result = await caller.session.resolveSlug({ slug: "test-session" });
    expect(result).toEqual({ slug: "test-session", redirect: false });

    // "temporary" should redirect back
    const tempResult = await caller.session.resolveSlug({ slug: "temporary" });
    expect(tempResult).toEqual({ slug: "test-session", redirect: true });
  });

  it("new session cannot use slug reserved by redirect from another session", async () => {
    const { caller } = await createTestCaller();

    // Create session A and rename it
    const sessionA = await caller.session.create({
      ...BASE_INPUT,
      name: "Original Name",
    });
    await caller.session.update({
      id: sessionA.id,
      creatorDeviceId: "device-123",
      slug: "new-name",
    });

    // Session B tries to update its slug to "original-name" (reserved by A's redirect)
    const sessionB = await caller.session.create({
      ...BASE_INPUT,
      name: "Other Session",
      creatorDeviceId: "device-456",
    });

    await expect(
      caller.session.update({
        id: sessionB.id,
        creatorDeviceId: "device-456",
        slug: "original-name",
      })
    ).rejects.toThrow("reserved by a redirect");
  });

  it("can create new session with slug freed by revert", async () => {
    const { caller } = await createTestCaller();

    // Session A: create with "alpha", rename to "beta"
    const sessionA = await caller.session.create({
      ...BASE_INPUT,
      name: "Alpha",
    });
    await caller.session.update({
      id: sessionA.id,
      creatorDeviceId: "device-123",
      slug: "beta",
    });

    // "alpha" is now a redirect for session A
    // Revert session A back to "alpha" (cleans up "alpha" redirect)
    await caller.session.update({
      id: sessionA.id,
      creatorDeviceId: "device-123",
      slug: "alpha",
    });

    // "beta" is now a redirect, "alpha" is the current slug
    // Create session B with name "Beta" (slug "beta")
    // This should succeed because session.create cleans up redirect conflicts
    const sessionB = await caller.session.create({
      ...BASE_INPUT,
      name: "Beta",
      creatorDeviceId: "device-789",
    });
    expect(sessionB.slug).toBe("beta");
  });
});
