import { describe, it, expect, beforeEach } from "bun:test";
import { createTestCaller, resetClerkMocks } from "../helpers/test-caller";

type TestCaller = Awaited<ReturnType<typeof createTestCaller>>["caller"];

async function createSession(caller: TestCaller) {
  return caller.session.create({
    name: `Test Session ${Math.random().toString(36).slice(2, 8)}`,
    date: "2026-01-01",
    description: "A test",
    creatorDeviceId: "device-1",
  });
}

function postInput(sessionId: string, overrides?: Record<string, unknown>) {
  return {
    sessionId,
    authorName: "Alice",
    authorAvatar: "avatar.png",
    content: "Hello",
    deviceId: "device-1",
    email: "test@example.com",
    ...overrides,
  };
}

async function authCallerOnDb(db: D1Database, userId: string) {
  const { appRouter } = await import("@/server/routers/_app");
  return appRouter.createCaller({ db, userId });
}

beforeEach(() => {
  resetClerkMocks();
});

describe("post.autoLink", () => {
  it("returns empty arrays when not signed in", async () => {
    const { caller } = await createTestCaller();
    const result = await caller.post.autoLink({ deviceId: "device-1" });
    expect(result.autoLinked).toEqual([]);
    expect(result.candidates).toEqual([]);
    expect(result.mismatched).toEqual([]);
  });

  it("auto-links same-device posts with matching email", async () => {
    const { caller: anonCaller, db } = await createTestCaller();
    const session = await createSession(anonCaller);
    const { id: postId } = await anonCaller.post.create(postInput(session.id));

    const authCaller = await authCallerOnDb(db, "user-1");
    const result = await authCaller.post.autoLink({ deviceId: "device-1" });
    expect(result.autoLinked).toContain(postId);
  });

  it("returns cross-device posts as candidates (not auto-linked)", async () => {
    const { caller: anonCaller, db } = await createTestCaller();
    const session = await createSession(anonCaller);
    const { id: postId } = await anonCaller.post.create(
      postInput(session.id, { deviceId: "device-other" })
    );

    const authCaller = await authCallerOnDb(db, "user-1");
    const result = await authCaller.post.autoLink({ deviceId: "device-1" });
    expect(result.autoLinked).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.id).toBe(postId);
  });

  it("returns same-device posts with different email as mismatched", async () => {
    const { caller: anonCaller, db } = await createTestCaller();
    const session = await createSession(anonCaller);
    await anonCaller.post.create(
      postInput(session.id, { email: "other@example.com" })
    );

    const authCaller = await authCallerOnDb(db, "user-1");
    const result = await authCaller.post.autoLink({ deviceId: "device-1" });
    expect(result.mismatched).toHaveLength(1);
    expect(result.mismatched[0]!.email).toBe("other@example.com");
  });

  it("does not link posts that already have userId", async () => {
    const { caller: authCaller } = await createTestCaller({ userId: "user-1" });
    const session = await createSession(authCaller);
    await authCaller.post.create(postInput(session.id));

    const result = await authCaller.post.autoLink({ deviceId: "device-1" });
    expect(result.autoLinked).toEqual([]);
    expect(result.candidates).toEqual([]);
  });
});

describe("post.confirmLink", () => {
  it("links specified posts (sets userId + verified + deviceId)", async () => {
    const { caller: anonCaller, db } = await createTestCaller();
    const session = await createSession(anonCaller);
    const { id: postId } = await anonCaller.post.create(
      postInput(session.id, { deviceId: "device-other" })
    );

    const authCaller = await authCallerOnDb(db, "user-1");
    const result = await authCaller.post.confirmLink({
      postIds: [postId],
      deviceId: "device-1",
    });
    expect(result.linked).toContain(postId);

    const post = await authCaller.post.getMyPost({
      sessionId: session.id,
      userId: "user-1",
    });
    expect(post).not.toBeNull();
    expect(post!.verified).toBe(1);
  });

  it("only links unclaimed posts (userId IS NULL guard)", async () => {
    const { caller: authCaller } = await createTestCaller({ userId: "user-1" });
    const session = await createSession(authCaller);
    const { id: postId } = await authCaller.post.create(postInput(session.id));

    const result = await authCaller.post.confirmLink({
      postIds: [postId],
      deviceId: "device-1",
    });
    expect(result.linked).toEqual([]);
  });

  it("rejects when not signed in", async () => {
    const { caller } = await createTestCaller();
    await expect(
      caller.post.confirmLink({ postIds: ["post-1"], deviceId: "device-1" })
    ).rejects.toThrow("Must be signed in");
  });
});

describe("post.handleMismatch", () => {
  it("link action: sets userId + verified on post", async () => {
    const { caller: anonCaller, db } = await createTestCaller();
    const session = await createSession(anonCaller);
    const { id: postId } = await anonCaller.post.create(
      postInput(session.id, { email: "other@example.com" })
    );

    const authCaller = await authCallerOnDb(db, "user-1");
    await authCaller.post.handleMismatch({ postId, action: "link", deviceId: "device-1" });

    const post = await authCaller.post.getMyPost({ sessionId: session.id, userId: "user-1" });
    expect(post).not.toBeNull();
    expect(post!.verified).toBe(1);
  });

  it("delete action: removes post and its comments", async () => {
    const { caller: anonCaller, db } = await createTestCaller();
    const session = await createSession(anonCaller);
    const { id: postId } = await anonCaller.post.create(
      postInput(session.id, { email: "other@example.com" })
    );
    await anonCaller.comment.create({
      postId, authorName: "Bob", authorAvatar: "", content: "A comment", deviceId: "device-1",
    });

    const authCaller = await authCallerOnDb(db, "user-1");
    await authCaller.post.handleMismatch({ postId, action: "delete", deviceId: "device-1" });

    const posts = await anonCaller.post.listBySession({ sessionId: session.id });
    expect(posts).toHaveLength(0);
  });

  it("leave action: no-op, returns ok", async () => {
    const { caller: anonCaller, db } = await createTestCaller();
    const session = await createSession(anonCaller);
    const { id: postId } = await anonCaller.post.create(
      postInput(session.id, { email: "other@example.com" })
    );

    const authCaller = await authCallerOnDb(db, "user-1");
    const result = await authCaller.post.handleMismatch({ postId, action: "leave", deviceId: "device-1" });
    expect(result.ok).toBe(true);

    const posts = await anonCaller.post.listBySession({ sessionId: session.id });
    expect(posts).toHaveLength(1);
  });

  it("rejects when not signed in", async () => {
    const { caller } = await createTestCaller();
    await expect(
      caller.post.handleMismatch({ postId: "p1", action: "link", deviceId: "d1" })
    ).rejects.toThrow("Must be signed in");
  });
});
