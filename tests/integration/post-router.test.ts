import { describe, it, expect } from "bun:test";
import { createTestCaller } from "../helpers/test-caller";

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
    content: "Hello world",
    imageUrls: ["img1.png"],
    deviceId: "device-1",
    email: "alice@example.com",
    productLink: "https://example.com",
    contactInfo: "@alice",
    demoIntention: "yes" as const,
    fieldResponses: '{"q1":"a1"}',
    ...overrides,
  };
}

describe("post.create", () => {
  it("creates post and stores all fields correctly", async () => {
    const { caller } = await createTestCaller();
    const session = await createSession(caller);
    const result = await caller.post.create(postInput(session.id));
    expect(result.id).toBeString();
    const posts = await caller.post.listBySession({ sessionId: session.id });
    expect(posts).toHaveLength(1);
    const post = posts[0]!;
    expect(post.authorName).toBe("Alice");
    expect(post.content).toBe("Hello world");
    expect(post.imageUrls).toEqual(["img1.png"]);
    expect(post.productLink).toBe("https://example.com");
    expect(post.contactInfo).toBe("@alice");
    expect(post.demoIntention).toBe("yes");
    expect(post.fieldResponses).toBe('{"q1":"a1"}');
    expect(post.email).toBe("alice@example.com");
  });

  it("sets verified=1 when userId provided and Clerk email matches", async () => {
    const { caller } = await createTestCaller({ userId: "user-1" });
    const session = await createSession(caller);
    await caller.post.create(postInput(session.id, { email: "test@example.com" }));
    const posts = await caller.post.listBySession({ sessionId: session.id });
    expect(posts[0]!.verified).toBe(1);
  });

  it("sets verified=0 when no userId", async () => {
    const { caller } = await createTestCaller();
    const session = await createSession(caller);
    await caller.post.create(postInput(session.id));
    const posts = await caller.post.listBySession({ sessionId: session.id });
    expect(posts[0]!.verified).toBe(0);
  });

  it("rejects duplicate email in same session", async () => {
    const { caller } = await createTestCaller();
    const session = await createSession(caller);
    await caller.post.create(postInput(session.id, { deviceId: "d1" }));
    await expect(
      caller.post.create(postInput(session.id, { deviceId: "d2", authorName: "Bob" }))
    ).rejects.toThrow("email");
  });

  it("allows same email in different sessions", async () => {
    const { caller } = await createTestCaller();
    const s1 = await createSession(caller);
    const s2 = await createSession(caller);
    await caller.post.create(postInput(s1.id));
    const result = await caller.post.create(postInput(s2.id));
    expect(result.id).toBeString();
  });
});

describe("post.update", () => {
  it("updates fields and verifies changes", async () => {
    const { caller } = await createTestCaller();
    const session = await createSession(caller);
    const { id } = await caller.post.create(postInput(session.id));
    await caller.post.update({ id, deviceId: "device-1", authorName: "Bob", content: "Updated" });
    const post = await caller.post.getMyPost({ sessionId: session.id, deviceId: "device-1" });
    expect(post!.authorName).toBe("Bob");
    expect(post!.content).toBe("Updated");
  });

  it("rejects update by non-owner", async () => {
    const { caller } = await createTestCaller();
    const session = await createSession(caller);
    const { id } = await caller.post.create(postInput(session.id));
    await expect(
      caller.post.update({ id, deviceId: "wrong-device", authorName: "Hacker" })
    ).rejects.toThrow("not yours");
  });

  it("allows update by deviceId or userId owner", async () => {
    const { caller: c1 } = await createTestCaller();
    const s1 = await createSession(c1);
    const p1 = await c1.post.create(postInput(s1.id));
    expect((await c1.post.update({ id: p1.id, deviceId: "device-1", authorName: "X" })).id).toBe(p1.id);

    const { caller: c2 } = await createTestCaller({ userId: "user-1" });
    const s2 = await createSession(c2);
    const p2 = await c2.post.create(postInput(s2.id, { email: "test@example.com" }));
    expect((await c2.post.update({ id: p2.id, userId: "user-1", authorName: "Y" })).id).toBe(p2.id);
  });

  it("returns { id } when no changes", async () => {
    const { caller } = await createTestCaller();
    const session = await createSession(caller);
    const { id } = await caller.post.create(postInput(session.id));
    expect(await caller.post.update({ id, deviceId: "device-1" })).toEqual({ id });
  });
});

describe("post.delete", () => {
  it("deletes post and its comments", async () => {
    const { caller } = await createTestCaller();
    const session = await createSession(caller);
    const { id } = await caller.post.create(postInput(session.id));
    await caller.comment.create({
      postId: id, authorName: "Bob", authorAvatar: "", content: "Hi", deviceId: "d2",
    });
    await caller.post.delete({ id, deviceId: "device-1" });
    expect(await caller.post.listBySession({ sessionId: session.id })).toHaveLength(0);
  });

  it("rejects delete by non-owner", async () => {
    const { caller } = await createTestCaller();
    const session = await createSession(caller);
    const { id } = await caller.post.create(postInput(session.id));
    await expect(caller.post.delete({ id, deviceId: "wrong" })).rejects.toThrow("not yours");
  });

  it("allows delete by deviceId and userId", async () => {
    const { caller: c1 } = await createTestCaller();
    const s1 = await createSession(c1);
    const p1 = await c1.post.create(postInput(s1.id));
    expect((await c1.post.delete({ id: p1.id, deviceId: "device-1" })).ok).toBe(true);

    const { caller: c2 } = await createTestCaller({ userId: "user-1" });
    const s2 = await createSession(c2);
    const p2 = await c2.post.create(postInput(s2.id, { email: "test@example.com" }));
    expect((await c2.post.delete({ id: p2.id, userId: "user-1" })).ok).toBe(true);
  });
});

describe("post.listBySession", () => {
  it("returns posts with comment count, parsed imageUrls, and fieldResponses", async () => {
    const { caller } = await createTestCaller();
    const session = await createSession(caller);
    await caller.post.create(postInput(session.id, { email: "a@example.com", deviceId: "d1" }));
    await caller.post.create(postInput(session.id, { email: "b@example.com", deviceId: "d2" }));
    const posts = await caller.post.listBySession({ sessionId: session.id });
    expect(posts).toHaveLength(2);
    expect(posts[0]!._count.comments).toBe(0);
    expect(Array.isArray(posts[0]!.imageUrls)).toBe(true);
    expect(posts[0]!.fieldResponses).toBe('{"q1":"a1"}');
  });
});

describe("post.getMyPost", () => {
  it("returns own post by deviceId or userId, null when none", async () => {
    const { caller } = await createTestCaller();
    const session = await createSession(caller);
    expect(await caller.post.getMyPost({ sessionId: session.id, deviceId: "device-1" })).toBeNull();

    await caller.post.create(postInput(session.id));
    const byDevice = await caller.post.getMyPost({ sessionId: session.id, deviceId: "device-1" });
    expect(byDevice).not.toBeNull();
    expect(byDevice!.authorName).toBe("Alice");

    const { caller: c2 } = await createTestCaller({ userId: "user-1" });
    const s2 = await createSession(c2);
    await c2.post.create(postInput(s2.id, { email: "test@example.com" }));
    expect(await c2.post.getMyPost({ sessionId: s2.id, userId: "user-1" })).not.toBeNull();
  });
});

describe("post.hasPostedInSession", () => {
  it("returns correct hasPosted boolean", async () => {
    const { caller } = await createTestCaller();
    const session = await createSession(caller);
    const before = await caller.post.hasPostedInSession({ sessionId: session.id, deviceId: "device-1" });
    expect(before.hasPosted).toBe(false);
    await caller.post.create(postInput(session.id));
    const after = await caller.post.hasPostedInSession({ sessionId: session.id, deviceId: "device-1" });
    expect(after.hasPosted).toBe(true);
  });
});
