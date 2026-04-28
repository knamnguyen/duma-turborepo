import { describe, it, expect } from "bun:test";
import { createTestCaller } from "../helpers/test-caller";

describe("user.syncProfile", () => {
  it("creates UserProfile on first sync with mocked Clerk data", async () => {
    const { caller } = await createTestCaller({ userId: "user-sync-1" });

    const profile = await caller.user.syncProfile();

    expect(profile).toBeDefined();
    expect(profile!.id).toBe("user-sync-1");
    expect(profile!.email).toBe("test@example.com");
    expect(profile!.name).toBe("Test User");
    expect(profile!.avatarUrl).toBe("https://example.com/avatar.png");
    expect(profile!.verified).toBe(1);
  });

  it("updates UserProfile on subsequent sync", async () => {
    const { caller } = await createTestCaller({ userId: "user-sync-2" });

    const first = await caller.user.syncProfile();
    expect(first).toBeDefined();

    // Sync again (same mocked data, but exercises the INSERT OR REPLACE path)
    const second = await caller.user.syncProfile();
    expect(second).toBeDefined();
    expect(second!.id).toBe("user-sync-2");
    expect(second!.email).toBe("test@example.com");
  });

  it("rejects when not signed in (userId = null)", async () => {
    const { caller } = await createTestCaller({ userId: null });

    expect(caller.user.syncProfile()).rejects.toThrow("Must be signed in");
  });

  it("preserves original createdAt on update", async () => {
    const { caller } = await createTestCaller({ userId: "user-sync-3" });

    const first = await caller.user.syncProfile();
    const originalCreatedAt = first!.createdAt;

    // Small delay to ensure timestamps differ
    await new Promise((resolve) => setTimeout(resolve, 10));

    const second = await caller.user.syncProfile();
    expect(second!.createdAt).toBe(originalCreatedAt);
    expect(second!.updatedAt).not.toBe(originalCreatedAt);
  });
});

describe("user.getProfile", () => {
  it("returns profile when exists", async () => {
    const { caller } = await createTestCaller({ userId: "user-get-1" });

    await caller.user.syncProfile();

    const profile = await caller.user.getProfile({ userId: "user-get-1" });
    expect(profile).toBeDefined();
    expect(profile!.id).toBe("user-get-1");
    expect(profile!.name).toBe("Test User");
  });

  it("returns null when profile does not exist", async () => {
    const { caller } = await createTestCaller();

    const profile = await caller.user.getProfile({ userId: "nonexistent-user" });
    expect(profile).toBeNull();
  });
});
