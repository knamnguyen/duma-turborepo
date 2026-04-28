import { describe, it, expect } from "bun:test";
import {
  createTestCaller,
  setMockClerkUserEmail,
  resetClerkMocks,
} from "../helpers/test-caller";

type TestCaller = Awaited<ReturnType<typeof createTestCaller>>["caller"];

async function createSession(caller: TestCaller) {
  return caller.session.create({
    name: `Test Session ${Math.random().toString(36).slice(2, 8)}`,
    date: "2026-01-01",
    description: "A test",
    creatorDeviceId: "device-creator",
  });
}

function postInput(sessionId: string, overrides?: Record<string, unknown>) {
  return {
    sessionId,
    authorName: "Alice",
    authorAvatar: "avatar.png",
    content: "Hello",
    deviceId: "device-original",
    email: "alice@example.com",
    ...overrides,
  };
}

describe("post.claimProfile", () => {
  it("transfers ownership (deviceId updated) and sets userId", async () => {
    // Create post as anonymous user with email matching Clerk mock (test@example.com)
    const { caller: anonCaller, db } = await createTestCaller();
    const session = await createSession(anonCaller);
    await anonCaller.post.create(
      postInput(session.id, { email: "test@example.com" })
    );

    // Claim as signed-in user on new device (same DB)
    // Default Clerk mock returns test@example.com which matches the claim email
    resetClerkMocks();
    const { appRouter } = await import("@/server/routers/_app");
    const claimerCaller = appRouter.createCaller({ db, userId: "user-claimer" });

    const result = await claimerCaller.post.claimProfile({
      sessionId: session.id,
      email: "test@example.com",
      newDeviceId: "device-claimer",
      userId: "user-claimer",
    });
    expect(result.id).toBeString();

    // Verify the post is now accessible by the claimer's deviceId
    const post = await claimerCaller.post.getMyPost({
      sessionId: session.id,
      deviceId: "device-claimer",
    });
    expect(post).not.toBeNull();
    expect(post!.userId).toBe("user-claimer");
  });

  it("rejects when claimer already has a post in session", async () => {
    const { caller } = await createTestCaller();
    const session = await createSession(caller);
    await caller.post.create(postInput(session.id, { email: "a@example.com", deviceId: "d-other" }));
    // Create a post for the claimer's device
    await caller.post.create(postInput(session.id, { email: "b@example.com", deviceId: "device-claimer" }));

    await expect(
      caller.post.claimProfile({
        sessionId: session.id,
        email: "a@example.com",
        newDeviceId: "device-claimer",
      })
    ).rejects.toThrow("already have a post");
  });

  it("rejects when no post found with email", async () => {
    const { caller } = await createTestCaller();
    const session = await createSession(caller);
    await expect(
      caller.post.claimProfile({
        sessionId: session.id,
        email: "nobody@example.com",
        newDeviceId: "device-claimer",
      })
    ).rejects.toThrow("No post found");
  });

  it("rejects when post already linked to account (userId not null)", async () => {
    // Create post with userId set (post is already claimed)
    const { caller: creator, db } = await createTestCaller({ userId: "user-owner" });
    const session = await createSession(creator);
    await creator.post.create(postInput(session.id, { email: "test@example.com" }));

    // Try to claim from same DB but different caller (no userId, different device)
    const { appRouter } = await import("@/server/routers/_app");
    const claimer = appRouter.createCaller({ db, userId: null });

    await expect(
      claimer.post.claimProfile({
        sessionId: session.id,
        email: "test@example.com",
        newDeviceId: "device-claimer",
      })
    ).rejects.toThrow("already linked");
  });

  it("rejects when Clerk email does not match claim email (when signed in)", async () => {
    // Clerk mock returns test@example.com but we claim with different email
    resetClerkMocks();
    const { caller: anonCaller } = await createTestCaller();
    const session = await createSession(anonCaller);
    await anonCaller.post.create(postInput(session.id, { email: "other@example.com" }));

    const { caller: claimerCaller } = await createTestCaller({ userId: "user-claimer" });
    await expect(
      claimerCaller.post.claimProfile({
        sessionId: session.id,
        email: "other@example.com",
        newDeviceId: "device-claimer",
        userId: "user-claimer",
      })
    ).rejects.toThrow("matching your verified email");
  });
});
