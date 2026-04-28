import { describe, it, expect } from "bun:test";
import { createTestCaller } from "../helpers/test-caller";

async function createSessionAndPost(caller: Awaited<ReturnType<typeof createTestCaller>>["caller"]) {
  const session = await caller.session.create({
    name: "Test Session",
    date: "2026-01-01",
    description: "Test",
    creatorDeviceId: "device-1",
  });
  const post = await caller.post.create({
    sessionId: session.id,
    authorName: "Test User",
    authorAvatar: "https://example.com/avatar.png",
    content: "Test content",
    deviceId: "device-1",
    email: "test@example.com",
  });
  return { session, post };
}

describe("comment.create", () => {
  it("creates a comment with valid input and returns id", async () => {
    const { caller } = await createTestCaller();
    const { post } = await createSessionAndPost(caller);

    const result = await caller.comment.create({
      postId: post.id,
      authorName: "Commenter",
      authorAvatar: "https://example.com/commenter.png",
      content: "Great post!",
      deviceId: "device-2",
    });

    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe("string");
  });

  it("stores authorName, content, deviceId, and userId", async () => {
    const { caller } = await createTestCaller({ userId: "user-abc" });
    const { post } = await createSessionAndPost(caller);

    const result = await caller.comment.create({
      postId: post.id,
      authorName: "Named User",
      authorAvatar: "",
      content: "Stored fields test",
      deviceId: "device-3",
      userId: "user-abc",
    });

    const comments = await caller.comment.listByPost({ postId: post.id });
    const comment = comments.find((c) => c.id === result.id);

    expect(comment).toBeDefined();
    expect(comment!.authorName).toBe("Named User");
    expect(comment!.content).toBe("Stored fields test");
    expect(comment!.deviceId).toBe("device-3");
    expect(comment!.userId).toBe("user-abc");
  });
});

describe("comment.listByPost", () => {
  it("returns empty array for post with no comments", async () => {
    const { caller } = await createTestCaller();
    const { post } = await createSessionAndPost(caller);

    const comments = await caller.comment.listByPost({ postId: post.id });
    expect(comments).toEqual([]);
  });

  it("returns comments ordered by createdAt ASC", async () => {
    const { caller } = await createTestCaller();
    const { post } = await createSessionAndPost(caller);

    await caller.comment.create({
      postId: post.id,
      authorName: "First",
      authorAvatar: "",
      content: "First comment",
    });
    await caller.comment.create({
      postId: post.id,
      authorName: "Second",
      authorAvatar: "",
      content: "Second comment",
    });
    await caller.comment.create({
      postId: post.id,
      authorName: "Third",
      authorAvatar: "",
      content: "Third comment",
    });

    const comments = await caller.comment.listByPost({ postId: post.id });

    expect(comments).toHaveLength(3);
    expect(comments[0].authorName).toBe("First");
    expect(comments[1].authorName).toBe("Second");
    expect(comments[2].authorName).toBe("Third");
  });
});

describe("comment cascade delete", () => {
  it("deleting a post cascades to its comments", async () => {
    const { caller, db } = await createTestCaller();
    const { post } = await createSessionAndPost(caller);

    await caller.comment.create({
      postId: post.id,
      authorName: "Will be deleted",
      authorAvatar: "",
      content: "This should be gone",
    });

    const beforeDelete = await caller.comment.listByPost({ postId: post.id });
    expect(beforeDelete).toHaveLength(1);

    await caller.post.delete({ id: post.id, deviceId: "device-1" });

    // Query DB directly since the post is gone
    const result = await db
      .prepare('SELECT COUNT(*) as cnt FROM "Comment" WHERE postId = ?')
      .bind(post.id)
      .first<{ cnt: number }>();

    expect(result!.cnt).toBe(0);
  });
});
