import { mock } from "bun:test";
import { createTestDb } from "./test-db";

// Mock @clerk/nextjs/server before any imports that use it
mock.module("@clerk/nextjs/server", () => ({
  auth: async () => ({ userId: null }),
  clerkClient: async () => ({
    users: {
      getUser: async () => ({
        emailAddresses: [
          {
            id: "email_1",
            emailAddress: "test@example.com",
            verification: { status: "verified" },
          },
        ],
        primaryEmailAddressId: "email_1",
        firstName: "Test",
        lastName: "User",
        imageUrl: "https://example.com/avatar.png",
      }),
    },
  }),
  clerkMiddleware: () => () => {},
}));

// Mock clerk-helpers with configurable defaults
let mockGetClerkUserEmail = async (_userId: string) =>
  ({ ok: true, email: "test@example.com", verified: true }) as const;

let mockGetClerkUserInfo = async (_userId: string) =>
  ({
    ok: true,
    email: "test@example.com",
    verified: true,
    name: "Test User",
    avatarUrl: "https://example.com/avatar.png",
  }) as const;

mock.module("@/lib/clerk-helpers", () => ({
  get getClerkUserEmail() {
    return mockGetClerkUserEmail;
  },
  get getClerkUserInfo() {
    return mockGetClerkUserInfo;
  },
}));

export function setMockClerkUserEmail(
  fn: typeof mockGetClerkUserEmail
) {
  mockGetClerkUserEmail = fn;
}

export function setMockClerkUserInfo(
  fn: typeof mockGetClerkUserInfo
) {
  mockGetClerkUserInfo = fn;
}

export function resetClerkMocks() {
  mockGetClerkUserEmail = async () =>
    ({ ok: true, email: "test@example.com", verified: true }) as const;
  mockGetClerkUserInfo = async () =>
    ({
      ok: true,
      email: "test@example.com",
      verified: true,
      name: "Test User",
      avatarUrl: "https://example.com/avatar.png",
    }) as const;
}

// Lazy import appRouter after mocks are set up
let _appRouter: Awaited<
  typeof import("@/server/routers/_app")
>["appRouter"] | null = null;

async function getAppRouter() {
  if (!_appRouter) {
    const mod = await import("@/server/routers/_app");
    _appRouter = mod.appRouter;
  }
  return _appRouter;
}

export async function createTestCaller(options?: {
  userId?: string | null;
}) {
  const db = createTestDb();
  const appRouter = await getAppRouter();
  const caller = appRouter.createCaller({
    db,
    userId: options?.userId ?? null,
  });
  return { caller, db };
}
