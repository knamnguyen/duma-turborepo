import { clerkClient } from "@clerk/nextjs/server";

export async function getClerkUserEmail(userId: string) {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const primaryEmail = user.emailAddresses.find(
      (e) => e.id === user.primaryEmailAddressId
    );

    if (!primaryEmail?.emailAddress) {
      return { ok: false, error: "No primary email found" } as const;
    }

    return {
      ok: true,
      email: primaryEmail.emailAddress.toLowerCase(),
      verified: primaryEmail.verification?.status === "verified",
    } as const;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message } as const;
  }
}
