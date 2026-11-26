# Security Specification: Longclaw Firestore Rules

## 1. Data Invariants
- **Identity Isolation**: Users can only access their own user profile document `/users/{userId}` where `userId == request.auth.uid`.
- **Subcollection Ownership**: Chats are stored under `/users/{userId}/chats/{chatId}` and can only be read, listed, created, updated, or deleted by the authenticated user whose `request.auth.uid == userId`.
- **User Verification**: Write operations require an authenticated user (`request.auth != null`).
- **Path Hardening**: Document IDs and path variables must adhere to `^[a-zA-Z0-9_\\-]+$` and size <= 128 bytes.
- **Strict Keys & Size Limits**: Titles cannot exceed 200 characters; user messages cannot exceed 50,000 characters; ghost fields are strictly prohibited.
- **Immortal Fields**: Once created, `id`, `userId`, and `createdAt` cannot be modified on update.
- **Connectivity Testing**: Document in `/test/connection` allows read access for SDK initialization check.

## 2. Dirty Dozen Security Attack Payloads
1. **Ghost Field Injection**: User attempts to inject `isAdmin: true` into `/users/{userId}`.
2. **Identity Spoofing**: User A attempts to write a chat into `/users/{userB}/chats/{chatId}`.
3. **Cross-Tenant List Scraping**: User A attempts to run an unbounded `collectionGroup('chats')` list query across all users.
4. **ID Poisoning Attack**: Attacker supplies a 5KB junk string containing special symbols as `chatId`.
5. **Immutable Field Tampering**: User attempts to update `userId` or `createdAt` of an existing chat session.
6. **Unauthenticated Read**: Anonymous/unauthenticated visitor tries to read `/users/{userId}/chats/{chatId}`.
7. **Denial of Wallet Payload**: Attacker attempts to post a 5MB payload into the chat title field.
8. **Invalid Enum Mode**: Attacker sets `mode: "exploit_admin"` instead of `"chat" | "sum" | "write"`.
9. **Invalid Depth Option**: Attacker sets `depth: "unrestricted"` instead of `"fast" | "mid" | "deep"`.
10. **Ghost Field in Chat**: Attacker appends a `serverOverride: true` field inside the chat session document.
11. **Negative Timestamp / Future Time Tampering**: Attacker sets a spoofed past or future time in `createdAt`.
12. **Foreign Profile Modification**: User A attempts to update or delete User B's profile document.

## 3. Test Runner Design
Automated assertions ensure all 12 malicious payloads receive `PERMISSION_DENIED` while authorized user operations succeed.
