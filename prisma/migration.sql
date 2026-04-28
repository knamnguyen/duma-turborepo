-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorAvatar" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrls" TEXT NOT NULL DEFAULT '[]',
    "deviceId" TEXT NOT NULL,
    "productLink" TEXT DEFAULT '',
    "contactInfo" TEXT DEFAULT '',
    "demoIntention" TEXT DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Post_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "postId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "authorAvatar" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "data" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'image/jpeg',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_slug_key" ON "Session"("slug");

-- CreateIndex
CREATE INDEX "Post_sessionId_idx" ON "Post"("sessionId");

-- CreateIndex
CREATE INDEX "Post_deviceId_idx" ON "Post"("deviceId");

-- CreateIndex
CREATE INDEX "Comment_postId_idx" ON "Comment"("postId");

-- AddColumn: email to Post
ALTER TABLE "Post" ADD COLUMN "email" TEXT;

-- AddColumn: creatorDeviceId to Session
ALTER TABLE "Session" ADD COLUMN "creatorDeviceId" TEXT;

-- CreateTable: SlugRedirect
CREATE TABLE IF NOT EXISTS "SlugRedirect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "oldSlug" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex: SlugRedirect unique on oldSlug
CREATE UNIQUE INDEX IF NOT EXISTS "SlugRedirect_oldSlug_key" ON "SlugRedirect"("oldSlug");

-- CreateIndex: Post composite unique on sessionId + email
CREATE UNIQUE INDEX IF NOT EXISTS "Post_sessionId_email_key" ON "Post"("sessionId", "email");

-- RFC-002: Dual Identity + userId on Posts/Comments
ALTER TABLE "Post" ADD COLUMN "userId" TEXT;
ALTER TABLE "Post" ADD COLUMN "verified" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Comment" ADD COLUMN "userId" TEXT;
ALTER TABLE "Session" ADD COLUMN "creatorUserId" TEXT;

-- UserProfile cache table
CREATE TABLE IF NOT EXISTS "UserProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT DEFAULT '',
    "verified" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "UserProfile_email_key" ON "UserProfile"("email");

-- RFC-004: Dynamic Form Schema on Session
ALTER TABLE "Session" ADD COLUMN "formSchema" TEXT DEFAULT '[]';

-- RFC-005: Dynamic Field Responses on Post
ALTER TABLE "Post" ADD COLUMN "fieldResponses" TEXT DEFAULT '{}';

-- RFC-007/008/009: Media Gallery + YouTube Playlist
CREATE TABLE IF NOT EXISTS "Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "postId" TEXT,
    "userId" TEXT,
    "deviceId" TEXT,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'image',
    "mimeType" TEXT DEFAULT '',
    "fileName" TEXT DEFAULT '',
    "sizeBytes" INTEGER DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Media_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE,
    CONSTRAINT "Media_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post" ("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "Media_sessionId_idx" ON "Media"("sessionId");
CREATE INDEX IF NOT EXISTS "Media_postId_idx" ON "Media"("postId");

ALTER TABLE "Session" ADD COLUMN "youtubePlaylistUrl" TEXT;

