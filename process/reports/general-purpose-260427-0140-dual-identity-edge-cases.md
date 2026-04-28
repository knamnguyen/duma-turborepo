# Dual-Identity Auth System: Comprehensive Edge Case Analysis

**Date:** 2026-04-27
**Scope:** Research-only analysis of `session.buildstuffs.com` dual-identity auth system
**Codebase reviewed:** Schema (`prisma/migration.sql`), routers (`post.ts`, `comment.ts`, `session.ts`), frontend (`[sessionSlug]/page.tsx`), device identity (`device.ts`), tRPC context (`trpc.ts`)

---

## 1. Identity & Ownership Edge Cases

### 1.1 Multiple Google Accounts on Same Device

**Scenario:** User has `alice@gmail.com` and `alice@work.com`. Posts anonymously with `alice@gmail.com`, signs in with `alice@work.com`.

**What currently happens:** `getMyPost` checks `userId OR deviceId`. Since they're on the same device, `deviceId` matches — they see the post as "theirs." But auto-link (not yet implemented) would match on email, and the emails don't match. The post stays with `userId=null`, `verified=0`. If auto-link runs, it finds no post matching `alice@work.com`, so nothing links. The post is still accessible via deviceId.

**What SHOULD happen:** The mismatch prompt (Rule 2: "If anonymous post email != signed-in email -> prompt: Link / Delete / Leave") should fire. User can choose to link (which would set `userId` on the post but keep the original email), delete, or leave it. If they link, the post gets `userId` but stays `verified=0` because the post's email doesn't match the signed-in email.

**Severity:** Important — This is a common real-world scenario (personal vs. work Google). The prompt flow must be clear about what "Link" means: it ties the post to your account but does NOT change the email or verification status.

---

### 1.2 Shared Device at Event (Two People, One Phone)

**Scenario:** Person A posts from a shared phone (gets `deviceId=X`). Person B uses the same phone to post in the same session.

**What currently happens:** `hasPostedInSession` checks `userId OR deviceId`. Since Person B has the same `deviceId=X`, the system thinks they already posted. They cannot create a new post — they'd see Person A's post as "theirs" via `getMyPost`.

**What SHOULD happen:** Two options:
- **(Recommended)** Since the unique constraint is on `sessionId + email`, and Person B would enter a different email, the DB would allow the insert. The problem is purely the frontend `hasPostedInSession` check blocking them. The fix: `hasPostedInSession` should also factor in email, not just deviceId/userId. OR: when the user enters the post form, the system should check by email first, then by deviceId as fallback.
- **(Alternative)** Accept this as a limitation and suggest "sign in to post from shared devices."

**Severity:** Critical — At an event, shared devices (friends, demo stations) are realistic. The current system completely blocks Person B.

---

### 1.3 Cleared localStorage (Lost deviceId)

**Scenario:** User posts anonymously (deviceId=X, no sign-in). Later clears browser data or uses incognito. Gets new deviceId=Y.

**What currently happens:** `getMyPost` returns null (no match on deviceId=Y, no userId). User sees no post, gets prompted to create a new one. But `Post_sessionId_email_key` unique constraint blocks them if they use the same email. They get error: "This email is already used in this session."

**What SHOULD happen:** The error message should guide them to use "Claim my profile" flow. Currently the claim button only shows when `!myPostQuery.data && posts exist`. That's correct — they'd see it. But the error from trying to create a new post is abrupt. Better UX: detect the duplicate email error and automatically suggest/open the claim modal.

**Severity:** Important — Common scenario (clearing cookies, switching browsers). The path exists (claim flow) but the UX bridge is missing.

---

### 1.4 Anonymous on Device A, Sign-In on Device B

**Scenario:** User posts anonymously on phone (deviceId=A, email=`user@example.com`). Later signs in on laptop (deviceId=B, userId=clerk_123, Clerk email=`user@example.com`).

**What currently happens:** On laptop, `getMyPost` checks `userId=clerk_123 OR deviceId=B` — no match. User sees no post. Auto-link (Rule 1) is not yet implemented in code. If it were, it would find the post by matching email and set `userId=clerk_123, verified=1`.

**What SHOULD happen:** Auto-link should execute on sign-in: find all posts where `email = Clerk verified email AND userId IS NULL`, then set `userId` and `verified=1`. After auto-link, `getMyPost` on laptop would find the post via `userId=clerk_123`. The post's `deviceId` should also be updated to `deviceId=B` so the user can edit from the laptop. (Currently `claimProfile` does update deviceId, but auto-link as described in rules doesn't mention updating deviceId — this is a gap.)

**Severity:** Critical — This is the primary cross-device use case. Auto-link implementation is essential, and it must update BOTH `userId` AND `deviceId` to the current device.

---

### 1.5 Signed-In User Signs Out, Posts Anonymously

**Scenario:** User is signed in (userId=clerk_123), signs out on the same device. Posts anonymously with a different email.

**What currently happens:** After sign-out, `ctx.userId` becomes null. New post gets `deviceId=X, userId=null, email=different@example.com`. `getMyPost` on this device with `deviceId=X` would now potentially match TWO posts: the old signed-in post (if it has `deviceId=X`) and the new anonymous post. But `LIMIT 1` returns only one.

**What SHOULD happen:** This shouldn't normally happen because `hasPostedInSession` would detect the existing post via `deviceId=X`. The user would see their old (verified) post. If they truly want a separate anonymous post with a different email, the system correctly prevents it via the deviceId check. This is actually correct behavior — one post per device per session. If the user wants to change their post's email, they should edit it.

**Severity:** Minor — The system's existing checks handle this, though the UX of "I signed out but still see my old post" might confuse users. A small explanatory message would help.

---

### 1.6 User Changes Google Account Email

**Scenario:** User had `old@gmail.com` when they posted. Google/Clerk email changes to `new@gmail.com`.

**What currently happens:** `userId` is the stable Clerk identifier, not the email. Post ownership via `userId` still works. But `verified` status was set based on the old email match. The post's `email` column still says `old@gmail.com`.

**What SHOULD happen:** Since ownership is via `userId` (stable), this works. However, if the user posts in a NEW session, their Clerk email is now `new@gmail.com` but their profile might pre-fill from their old post. Auto-link on new sessions should use the current Clerk email. Old posts should retain their original email (it's historical data). No action needed unless you want to offer "update email across all posts" feature.

**Severity:** Minor — userId-based ownership handles this cleanly. Edge case is cosmetic only.

---

## 2. Session & Post Edge Cases

### 2.1 Anonymous Post Without Email

**Scenario:** What if the email field is skippable or left empty?

**What currently happens:** The `postInput` schema has `email: z.string().email().max(254).transform(...)` — email is **required** and must be valid. The form enforces this. The unique constraint `Post_sessionId_email_key` includes email.

**What SHOULD happen:** Current behavior is correct. Email is mandatory. However, there's a subtle DB issue: the column was added via `ALTER TABLE "Post" ADD COLUMN "email" TEXT` — it's nullable at the DB level (no `NOT NULL`). Old posts from before this column was added would have `email=NULL`. Multiple NULL emails in the same session would NOT violate the unique index (SQLite treats NULLs as distinct in unique indexes). This is fine for legacy data but means the application layer is the sole enforcer of email-required.

**Severity:** Minor — Application layer correctly enforces. DB allows NULL for backward compatibility. No action needed unless migrating to require NOT NULL.

---

### 2.2 Throwaway Email, Then Wants Real Account

**Scenario:** User posts with `throwaway123@gmail.com` anonymously. Later wants to link to their real account `realuser@gmail.com`.

**What currently happens:** Auto-link matches on email. `throwaway123@gmail.com` != `realuser@gmail.com`, so auto-link won't find this post. The user can't claim it because claim works by email match. The post is orphaned from their real identity unless they still have the original deviceId.

**What SHOULD happen:** Two paths:
1. If they have the original deviceId, `getMyPost` still finds it. They can edit it (but can't change email in current edit flow — email is read-only during edit per line 624-625 in the frontend).
2. If they don't have the deviceId, the post is truly orphaned. They'd need admin intervention or a "change email" flow that verifies ownership of the old email (e.g., send verification code to throwaway email).

**Recommendation:** Add a warning during post creation: "Use an email you'll remember — this is how you reclaim your post on other devices." Consider allowing email change if the user can prove ownership via deviceId (they're on the original device).

**Severity:** Important — At events, people rush and use random emails. No recovery path exists without the original device.

---

### 2.3 Same Email Used by Different People in Different Sessions

**Scenario:** Person A uses `shared@company.com` in Session 1. Person B uses `shared@company.com` in Session 2.

**What currently happens:** Unique constraint is `sessionId + email`, so different sessions allow the same email. Auto-link (when implemented) would search for posts where `email = Clerk verified email`. If Person A signs in with a Google account tied to `shared@company.com`, auto-link would find BOTH posts across sessions and link them all to Person A's userId.

**What SHOULD happen:** Auto-link should NOT blindly link all posts with matching email. It should only link posts that have `userId IS NULL` (unclaimed). But even then, Person B's post in Session 2 would get linked to Person A. This is a fundamental problem with email-as-identity when emails are shared.

**Recommendation:** Auto-link should only link posts that match BOTH email AND deviceId, OR require explicit confirmation per post ("We found posts with your email in these sessions — which ones are yours?"). For shared corporate emails, the deviceId check provides an additional signal.

**Severity:** Critical — Shared emails (company aliases, family accounts) could cause Person A to hijack Person B's post silently.

---

### 2.4 Can Verification Be Revoked?

**Scenario:** A verified post (verified=1) — can it become unverified?

**What currently happens:** Nothing in the codebase ever sets `verified` back to 0. The `update` mutation doesn't touch `verified`. `claimProfile` doesn't touch `verified`.

**What SHOULD happen:** Verification should be revocable if:
- The linked userId is removed (user deletes their Clerk account)
- Admin action
- Email ownership is disputed

Currently there's no mechanism for any of these. This is acceptable for MVP but should be considered for abuse scenarios.

**Severity:** Minor — No immediate risk. Consider for admin tooling later.

---

## 3. Cross-Device / Cross-Session Edge Cases

### 3.1 Same Email, Multiple Sessions, Multiple Devices

**Scenario:** User posts in Session A on phone (deviceId=P, email=`user@example.com`), Session B on laptop (deviceId=L, email=`user@example.com`). Both anonymous.

**What currently happens:** Two separate posts, different deviceIds, same email. Each device sees its own post via deviceId match.

**What SHOULD happen:** This works correctly in the current model. Each device accesses its own session's post via deviceId. No conflict.

**Severity:** N/A — Works correctly.

---

### 3.2 Sign-In Should Auto-Link Across Sessions

**Scenario:** Same as 3.1, but user signs in on laptop. Should Session A's post (on phone) also get linked?

**What currently happens:** Auto-link is not implemented. If it were implemented per Rule 1, it would search ALL posts with matching email and set userId. Both posts (Session A and B) would get linked.

**What SHOULD happen:** Yes, auto-link should update all posts across all sessions where `email matches AND userId IS NULL`. After linking, the user can see/edit both posts from any device via userId. However, see edge case 2.3 — this is dangerous with shared emails. The auto-link should at minimum show a confirmation: "We found N posts with your email across N sessions. Link them all?"

**Severity:** Important — Desired behavior but needs the shared-email safeguard from 2.3.

---

### 3.3 Verified in Session A, Joins Session B — Auto-Verify?

**Scenario:** User is verified in Session A. They join Session B while signed in.

**What currently happens:** When creating a new post while signed in, the code sets `verified: 0` (hardcoded on line 62 of post.ts). The userId is set from `input.userId || ctx.userId`. But verified is always 0 on creation.

**What SHOULD happen:** Per Rule 3: "Post created while signed in + email verified -> verified=1." The creation logic should check: if `ctx.userId` is set AND the email matches the Clerk verified email, set `verified=1`. This is NOT currently implemented — verified is hardcoded to 0.

**Severity:** Important — Rule 3 is not implemented in code. Signed-in users creating posts should get auto-verified.

---

### 3.4 Comments When Post Ownership Changes

**Scenario:** Post has comments. Post gets claimed/linked to a new user. What happens to comments?

**What currently happens:** Comments are linked to posts by `postId`, not by the post's author. Claiming a post (`claimProfile`) only updates `deviceId` and `userId` on the Post row. Comments are unaffected.

**What SHOULD happen:** This is correct. Comments belong to the post, not the post's author. No issue here. However, comment ownership itself uses `deviceId` — if the commenter clears localStorage, they lose the ability to identify their own comments. Since comments currently have no edit/delete feature in the frontend, this is a non-issue for now.

**Severity:** Minor — Correct behavior. Only relevant if comment edit/delete is added later.

---

## 4. Timing & Race Conditions

### 4.1 Post Anonymously and Sign In Simultaneously

**Scenario:** User clicks "Post" (anonymous) and "Sign in with Google" at nearly the same time.

**What currently happens:** These are separate operations. The post creation sends `deviceId` and possibly `userId: undefined`. Sign-in happens in a different flow (Clerk redirect). If sign-in completes first, the next API call would have `ctx.userId` set. If post creation completes first, it's anonymous. If sign-in completes during post creation, `ctx.userId` from `createTRPCContext` is resolved at request start — it won't change mid-request.

**What SHOULD happen:** Current behavior is fine. tRPC context is resolved per-request. The post will either have userId or not, based on whether auth was complete when the request started. Auto-link will catch up later if needed.

**Severity:** Minor — No real race condition due to per-request context resolution.

---

### 4.2 Auto-Link Runs While User Edits Post

**Scenario:** User is editing their anonymous post. Auto-link fires (e.g., they just signed in in another tab) and updates `userId` on the post. User saves edit.

**What currently happens:** Auto-link is not implemented. But hypothetically: the `update` mutation checks ownership via `userId OR deviceId`. If auto-link set `userId`, the edit would still succeed via `deviceId` match. No conflict.

**What SHOULD happen:** This works correctly. The `OR` ownership check means both the old identity (deviceId) and new identity (userId) have access. The edit only updates content fields, not identity fields. No data loss.

**Severity:** Minor — OR-based ownership handles this gracefully.

---

### 4.3 Two Users Claim Same Post via Email

**Scenario:** Person A and Person B both know the email used for a post. Both click "Claim" simultaneously.

**What currently happens:** `claimProfile` does:
1. Check if claimer already has a post (by deviceId/userId)
2. Find post by email
3. Update post's deviceId and userId

If both requests pass step 1, both find the post in step 2, and both try to update in step 3. SQLite serializes writes, so one UPDATE runs first, then the second UPDATE overwrites the first. No error — the last writer wins.

**What SHOULD happen:** After step 2, verify the post still has `userId IS NULL` (or doesn't belong to someone else) before updating. Add a WHERE condition: `WHERE id = ? AND (userId IS NULL OR userId = ?)`. This prevents overwriting a claim that just completed.

**Severity:** Important — Last-writer-wins is a security issue. The claim should fail if the post is already claimed by someone else.

---

## 5. Security Edge Cases

### 5.1 Griefing: Post with Someone Else's Email

**Scenario:** Attacker knows victim's email. Posts first with victim's email in a session. Victim can't post (unique constraint blocks duplicate email).

**What currently happens:** The attacker successfully creates a post with the victim's email. When the victim tries to post, they get "This email is already used in this session." The victim can use "Claim" to take over the post (since they know their own email), but the attacker's content is now associated with them.

**What SHOULD happen:** This is a real griefing vector. Mitigations:
1. **Email verification on post creation** — Send a code to the email before allowing the post. This is the strongest fix but adds friction (bad for event QR flow).
2. **Allow overwrite claim** — When claiming, offer to either adopt the post content or delete it and create fresh. Currently claim only transfers ownership, keeping the attacker's content.
3. **Rate limiting** — Limit posts per deviceId across sessions to slow spray attacks.
4. **Moderation** — Let session creators delete/flag posts.

**Recommendation:** At minimum, the claim flow should allow the claimer to see the post content and choose "Adopt" or "Replace with new post." Also add basic rate limiting per deviceId.

**Severity:** Critical — Easy to execute, blocks legitimate users, and can associate offensive content with someone's email.

---

### 5.2 Signed-In User Seeing/Claiming Others' Posts

**Scenario:** Can a signed-in user claim someone else's anonymous post?

**What currently happens:** `claimProfile` requires knowing the email. It doesn't verify that the claimer actually owns that email. Any user (signed in or not) can claim any post if they know the email.

**What SHOULD happen:** Claiming should require proof of email ownership. Options:
1. Only allow claim if the email matches the Clerk verified email (for signed-in users)
2. Send a verification code to the email before allowing claim
3. At minimum, only allow claim if the post has `userId IS NULL` (unclaimed)

Currently, `claimProfile` doesn't even check if the post already has a userId — it would overwrite an existing claim (see 4.3).

**Severity:** Critical — Anyone who knows an email can steal any post. No verification of email ownership in the claim flow.

---

### 5.3 Google Account with Stolen Email

**Scenario:** Attacker creates a Google account using a victim's email (requires access to verify it — less likely but possible via temporary access).

**What currently happens:** If the attacker signs in with this Google account, auto-link would match their Clerk verified email to the victim's posts, linking all of them to the attacker's userId.

**What SHOULD happen:** This is ultimately a Google/Clerk account security issue, not the app's responsibility. However, the app can mitigate by:
1. Requiring both email match AND deviceId match for auto-link (not just email)
2. Showing confirmation before auto-linking: "We found posts from your email. Link them?"
3. Allowing the original poster to dispute via deviceId ownership

**Severity:** Important — Low likelihood (requires compromising a Google account) but high impact (full post takeover across all sessions).

---

### 5.4 Should "Verified" Badge Grant Extra Permissions?

**Scenario:** Beyond the visual badge, should verified users have different capabilities?

**What currently happens:** `verified` is only used for display (the badge). No backend logic gates on `verified` status.

**What SHOULD happen:** Keep it visual-only for now. Potential future uses:
- Verified posts ranked higher in display
- Only verified users can be session co-organizers
- Verified comments weighted differently
- **Do NOT** use verified for security-critical decisions (e.g., "verified users can delete others' posts") — verified only means "this Google account controls this email."

**Severity:** Minor — Current approach is correct. Document the principle: verified = visual trust signal, not authorization level.

---

### 5.5 Spam via Clearing localStorage

**Scenario:** Attacker clears localStorage, gets new deviceId, posts again in the same session.

**What currently happens:** New deviceId bypasses the `hasPostedInSession` deviceId check. But the email unique constraint (`Post_sessionId_email_key`) blocks duplicate emails. Attacker would need a new email for each post.

**What SHOULD happen:** The email constraint is the primary defense and it works. Additional mitigations:
- Rate limiting by IP address
- CAPTCHA after N posts from same IP
- Session creator moderation tools (delete/hide posts)

**Severity:** Minor — Email uniqueness constraint effectively prevents spam within a session. Cross-session spam (same deviceId, different sessions) is a separate concern but lower impact.

---

## 6. UX Flow Edge Cases

### 6.1 QR Scan -> Anonymous Post -> Sign In -> Link

**Scenario:** The ideal event flow: scan QR, post quickly (anonymous), organizer says "sign in to verify," user signs in.

**What currently happens:** User posts (deviceId=X, email=`user@example.com`, verified=0). Signs in with Google. `ctx.userId` is now set. `getMyPost` finds their post via deviceId. But the post stays `verified=0` and `userId=null` because no auto-link code runs.

**What SHOULD happen (ideal flow):**
1. User signs in -> frontend detects `isSignedIn` changed from false to true
2. Frontend calls an `autoLink` mutation (not yet built)
3. Backend: find posts where `email = Clerk email AND userId IS NULL`, set `userId = ctx.userId, verified = 1`
4. If email mismatch (Clerk email != post email), show prompt per Rule 2
5. Invalidate queries -> post now shows verified badge
6. Total friction: one Google sign-in click, zero additional steps

**Missing pieces:** Auto-link mutation, frontend trigger on sign-in state change, mismatch prompt UI.

**Severity:** Critical — This is THE core user journey. Without auto-link, the entire "sign in to verify" flow is broken.

---

### 6.2 Historical Posts: First Sign-In Links ALL Past Posts

**Scenario:** User has posted anonymously in 15 sessions over 6 months. Signs in for the first time.

**What currently happens:** Nothing links. Each post is only accessible via the deviceId of the device used at that session.

**What SHOULD happen:** Auto-link should find all 15 posts (matching email, userId IS NULL) and offer to link them. However:
- **Concern:** What if some posts used different emails? Only matching emails link.
- **Concern:** What if the user doesn't want ALL posts linked? (e.g., a post they're embarrassed about)
- **Recommendation:** Show a confirmation screen: "We found 15 posts with your email across N sessions. Link all? [Yes / Let me choose]." For the "Let me choose" option, show a list with session names and post previews.

**Severity:** Important — Bulk auto-link without confirmation could surprise users. But requiring per-post confirmation for 15 posts is too much friction. Default to "link all" with an undo option.

---

### 6.3 Auto-Link Matches a Post User Didn't Make (Malicious Email Use)

**Scenario:** Attacker posted with victim's email. Victim signs in. Auto-link finds attacker's post and links it to victim's account.

**What currently happens:** Auto-link not implemented. But if it were: yes, the victim's account would inherit the attacker's post with potentially offensive content.

**What SHOULD happen:** This reinforces the need for:
1. Confirmation before auto-link ("Is this your post? [preview]")
2. Ability to reject/delete a post during auto-link
3. Post flagging/reporting for session moderators

Without confirmation, auto-link becomes an attack vector for associating unwanted content with someone's verified identity.

**Severity:** Critical — Combines with griefing (5.1) to create an identity attack: post offensive content with victim's email -> victim signs in -> content gets verified badge under their name.

---

### 6.4 Returning User: Profile Source (Last Event vs. Google)

**Scenario:** User attended Event A (name: "Alice", custom selfie avatar). Attends Event B, signs in with Google (name: "Alice Smith", Google avatar).

**What currently happens:** The post form pre-fills from `getDeviceIdentity()` (localStorage) which stores the last-used name and avatar. If they cleared localStorage or use a different device, it's empty. Google profile data from `useUser()` is available via Clerk but NOT used to pre-fill the form.

**What SHOULD happen:** Priority order for pre-fill:
1. If editing existing post: use post data
2. If signed in: default to Clerk profile (name, avatar) but allow override
3. If anonymous returning user (has deviceId with stored name): use localStorage data
4. If fresh: empty form

Currently, Google profile is never used as a pre-fill source. This is a missed opportunity to reduce friction for signed-in users.

**Severity:** Minor — UX improvement, not a bug. Signed-in users should see their Google name/avatar as defaults.

---

## 7. Data Integrity Edge Cases

### 7.1 Auto-Link Updating 10+ Posts Across Sessions

**Scenario:** Auto-link finds 10 posts with matching email. Updates all 10 with `userId=clerk_123, verified=1`.

**What currently happens:** Not implemented. Hypothetically, this would be 10 UPDATE statements.

**What SHOULD happen:** Wrap in a transaction. D1 (Cloudflare) supports `db.batch()` for transactional multi-statement execution. If any update fails, all should roll back. Also, add an index on `email` column for Post table — currently there's no index on email, only on `(sessionId, email)` as a unique constraint. A standalone email index would make the auto-link query efficient.

**Severity:** Important — Without a transaction, partial auto-link (5 of 10 updated, then failure) leaves data in an inconsistent state. The unique index on `(sessionId, email)` helps for lookups within a session but a standalone email index helps for cross-session queries.

---

### 7.2 Unique Constraint (sessionId + email) and Auto-Link

**Scenario:** Does auto-link violate the unique constraint?

**What currently happens:** Auto-link updates `userId` and `verified` on existing posts. It does NOT change the `email` column. The unique constraint is on `(sessionId, email)`. Since we're not changing sessionId or email, the constraint is untouched.

**What SHOULD happen:** Current approach is correct — auto-link should NEVER modify the email column. It only sets `userId` and `verified`. No constraint violation possible.

**Severity:** N/A — No issue, as long as auto-link implementation never touches the email column.

---

### 7.3 Auto-Link with Email Mismatch: Does Changing Email Break Constraints?

**Scenario:** Per Rule 2, if anonymous post email != signed-in email, user can choose "Link." Does linking change the email?

**What currently happens:** Not implemented. The decision from Rule 2 says "Link / Delete / Leave."

**What SHOULD happen:** "Link" should mean: set `userId` on the post but KEEP the original email. Do NOT change the email. This avoids:
- Unique constraint violations (what if the new email already has a post in that session?)
- Historical data loss (the original email is part of the post's identity)
- "Delete" means: delete the anonymous post, user can create a new one with their real email
- "Leave" means: do nothing, post stays anonymous

If "Link" were to also update the email, it could violate the unique constraint if the signed-in email already has a post in that session. So "Link" must preserve the original email.

**Severity:** Important — Implementation of Rule 2's "Link" action must be carefully defined. Changing email during link would create constraint violations and data integrity issues.

---

## Summary: Priority Matrix

### Critical (Must fix before launch)

| # | Edge Case | Core Issue |
|---|-----------|------------|
| 1.2 | Shared device at event | Blocks Person B from posting entirely |
| 1.4 | Cross-device post access | Auto-link not implemented — core journey broken |
| 2.3 | Shared email auto-link | Silent post hijacking across sessions |
| 5.1 | Griefing with someone's email | Blocks legitimate users, associates bad content |
| 5.2 | Claim without email verification | Anyone can steal posts by knowing the email |
| 6.1 | QR -> Post -> Sign In flow | The primary user journey doesn't work end-to-end |
| 6.3 | Malicious post + auto-link | Offensive content verified under victim's name |

### Important (Should fix before launch)

| # | Edge Case | Core Issue |
|---|-----------|------------|
| 1.1 | Multiple Google accounts | Mismatch prompt (Rule 2) not implemented |
| 1.3 | Cleared localStorage | Error message doesn't guide to claim flow |
| 2.2 | Throwaway email recovery | No recovery path without original device |
| 3.2 | Cross-session auto-link scope | Needs shared-email safeguard |
| 3.3 | Auto-verify on new post while signed in | Rule 3 not implemented (verified hardcoded to 0) |
| 4.3 | Concurrent claim race condition | Last-writer-wins overwrites legitimate claim |
| 6.2 | Bulk historical post linking | Needs confirmation UX |
| 7.1 | Multi-post auto-link transaction | Needs transaction + email index |
| 7.3 | Link action must not change email | Constraint violation risk |

### Minor (Can defer)

| # | Edge Case | Core Issue |
|---|-----------|------------|
| 1.5 | Sign out + same device | Works correctly, minor UX confusion |
| 1.6 | Google email change | userId-based ownership handles it |
| 2.1 | Nullable email column | Application layer enforces, DB allows NULL |
| 2.4 | Verification revocation | No mechanism, not needed for MVP |
| 3.4 | Comments after ownership change | Correct behavior already |
| 4.1 | Simultaneous post + sign-in | Per-request context prevents race |
| 4.2 | Auto-link during edit | OR-ownership handles it |
| 5.4 | Verified badge permissions | Visual-only is correct |
| 5.5 | Spam via localStorage clear | Email constraint prevents it |
| 6.4 | Profile pre-fill source | UX improvement, not a bug |

---

## Unresolved Questions

1. **Should auto-link require deviceId match in addition to email match?** Stronger security but breaks the cross-device use case (1.4). Possible compromise: auto-link with email-only for same-device, require confirmation for cross-device.

2. **Should claim flow require email verification (send code)?** Strongest defense against 5.1 and 5.2 but adds significant friction at events. Could be optional (organizer setting).

3. **Should session creators have moderation powers?** (Delete/hide posts, ban deviceIds) — This would address griefing (5.1) even without email verification.

4. **What's the auto-link trigger point?** Options: (a) on every page load when signed in, (b) once on sign-in event, (c) explicit "Link my posts" button. Each has different performance and UX tradeoffs.

5. **Should the system support "unlinking" a post?** If auto-link makes a mistake, can the user undo it? This requires keeping the original deviceId as a fallback.
