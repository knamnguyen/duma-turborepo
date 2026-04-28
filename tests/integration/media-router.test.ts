import { describe, it, expect } from "bun:test";
import { createTestCaller } from "../helpers/test-caller";

async function createSessionAndPost(caller: Awaited<ReturnType<typeof createTestCaller>>["caller"]) {
  const session = await caller.session.create({
    name: "Media Test Session",
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
    email: "media-test@example.com",
  });
  return { session, post };
}

describe("media.upload", () => {
  it("creates media records for multiple files and returns ids", async () => {
    const { caller } = await createTestCaller();
    const { session, post } = await createSessionAndPost(caller);

    const result = await caller.media.upload({
      sessionId: session.id,
      postId: post.id,
      deviceId: "device-1",
      files: [
        { url: "https://cdn.example.com/a.jpg", type: "image", mimeType: "image/jpeg", fileName: "a.jpg", sizeBytes: 1024 },
        { url: "https://cdn.example.com/b.mp4", type: "video", mimeType: "video/mp4", fileName: "b.mp4", sizeBytes: 2048 },
      ],
    });

    expect(result.ids).toHaveLength(2);
    expect(typeof result.ids[0]).toBe("string");
    expect(typeof result.ids[1]).toBe("string");
  });

  it("stores sessionId, postId, type, mimeType, fileName, sizeBytes", async () => {
    const { caller } = await createTestCaller();
    const { session, post } = await createSessionAndPost(caller);

    await caller.media.upload({
      sessionId: session.id,
      postId: post.id,
      files: [
        { url: "https://cdn.example.com/photo.png", type: "image", mimeType: "image/png", fileName: "photo.png", sizeBytes: 5000 },
      ],
    });

    const media = await caller.media.listBySession({ sessionId: session.id });
    expect(media).toHaveLength(1);
    expect(media[0].sessionId).toBe(session.id);
    expect(media[0].postId).toBe(post.id);
    expect(media[0].type).toBe("image");
    expect(media[0].mimeType).toBe("image/png");
    expect(media[0].fileName).toBe("photo.png");
    expect(media[0].sizeBytes).toBe(5000);
  });

  it("works without postId (gallery upload)", async () => {
    const { caller } = await createTestCaller();
    const { session } = await createSessionAndPost(caller);

    const result = await caller.media.upload({
      sessionId: session.id,
      files: [
        { url: "https://cdn.example.com/gallery.jpg", type: "image" },
      ],
    });

    expect(result.ids).toHaveLength(1);

    const media = await caller.media.listBySession({ sessionId: session.id });
    const galleryItem = media.find((m) => m.url === "https://cdn.example.com/gallery.jpg");
    expect(galleryItem).toBeDefined();
    expect(galleryItem!.postId).toBeNull();
  });

  it("associates userId from context", async () => {
    const { caller } = await createTestCaller({ userId: "user-media-1" });
    const { session } = await createSessionAndPost(caller);

    await caller.media.upload({
      sessionId: session.id,
      files: [{ url: "https://cdn.example.com/user.jpg", type: "image" }],
    });

    const media = await caller.media.listBySession({ sessionId: session.id });
    const item = media.find((m) => m.url === "https://cdn.example.com/user.jpg");
    expect(item!.userId).toBe("user-media-1");
  });
});

describe("media.listBySession", () => {
  it("includes author info from linked post", async () => {
    const { caller } = await createTestCaller();
    const { session, post } = await createSessionAndPost(caller);

    await caller.media.upload({
      sessionId: session.id,
      postId: post.id,
      files: [{ url: "https://cdn.example.com/linked.jpg", type: "image" }],
    });

    const media = await caller.media.listBySession({ sessionId: session.id });
    expect(media[0].authorName).toBe("Test User");
    expect(media[0].authorAvatar).toBe("https://example.com/avatar.png");
  });

  it('returns "Anonymous" when no linked post', async () => {
    const { caller } = await createTestCaller();
    const { session } = await createSessionAndPost(caller);

    await caller.media.upload({
      sessionId: session.id,
      files: [{ url: "https://cdn.example.com/anon.jpg", type: "image" }],
    });

    const media = await caller.media.listBySession({ sessionId: session.id });
    const anon = media.find((m) => m.url === "https://cdn.example.com/anon.jpg");
    expect(anon!.authorName).toBe("Anonymous");
  });

  it("orders by createdAt DESC", async () => {
    const { caller } = await createTestCaller();
    const { session } = await createSessionAndPost(caller);

    await caller.media.upload({
      sessionId: session.id,
      files: [{ url: "https://cdn.example.com/first.jpg", type: "image" }],
    });
    await caller.media.upload({
      sessionId: session.id,
      files: [{ url: "https://cdn.example.com/second.jpg", type: "image" }],
    });

    const media = await caller.media.listBySession({ sessionId: session.id });
    expect(media).toHaveLength(2);
    expect(new Date(media[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(media[1].createdAt).getTime()
    );
  });
});

describe("media.delete", () => {
  it("deletes own media by userId and returns { ok: true }", async () => {
    const { caller } = await createTestCaller({ userId: "user-del-1" });
    const { session } = await createSessionAndPost(caller);

    const { ids } = await caller.media.upload({
      sessionId: session.id,
      files: [{ url: "https://cdn.example.com/del.jpg", type: "image" }],
    });

    const result = await caller.media.delete({ id: ids[0], userId: "user-del-1" });
    expect(result.ok).toBe(true);

    const media = await caller.media.listBySession({ sessionId: session.id });
    expect(media.find((m) => m.id === ids[0])).toBeUndefined();
  });

  it("deletes own media by deviceId", async () => {
    const { caller } = await createTestCaller();
    const { session } = await createSessionAndPost(caller);

    const { ids } = await caller.media.upload({
      sessionId: session.id,
      deviceId: "device-del",
      files: [{ url: "https://cdn.example.com/dev.jpg", type: "image" }],
    });

    const result = await caller.media.delete({ id: ids[0], deviceId: "device-del" });
    expect(result.ok).toBe(true);
  });

  it("rejects delete by non-owner", async () => {
    const { caller } = await createTestCaller({ userId: "owner-user" });
    const { session } = await createSessionAndPost(caller);

    const { ids } = await caller.media.upload({
      sessionId: session.id,
      files: [{ url: "https://cdn.example.com/owned.jpg", type: "image" }],
    });

    expect(
      caller.media.delete({ id: ids[0], userId: "not-the-owner", deviceId: "wrong-device" })
    ).rejects.toThrow("Media not found or not yours");
  });
});
