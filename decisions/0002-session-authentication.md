# 2. Signed-cookie sessions with a Data Access Layer

Status: Accepted · Requirements: FR-03–FR-09, NFR-06, NFR-07, NFR-13

## Context

University SSO is not available (SRS §2.5.6). We need login for three roles, enforced on the server,
without adding an external auth service. Next.js 16 renames middleware to `proxy.ts` and recommends
doing authorization next to data access, not only in the proxy.

## Decision

- Passwords are hashed with bcrypt (cost 12) via `bcryptjs`. Login always runs a bcrypt comparison
  (against a dummy hash for unknown emails) so timing does not reveal account existence.
- On login a JWT (HS256, `jose`) carrying only `sub` (user id) and `role` is stored in an `httpOnly`,
  `SameSite=Lax` cookie (`Secure` in production), valid for 7 days. `SESSION_SECRET` ≥ 32 chars.
- `proxy.ts` performs **optimistic** redirects only (anonymous users → `/login`).
- `lib/auth/dal.ts` is the single authorization point: `getCurrentUser()` verifies the token **and**
  re-reads the user from the database, rejecting `INACTIVE` accounts immediately.
  Pages use `requireUser(roles)` / `requireStaff()`; Server Actions use `authorizeAction(roles)`.
- Wrong-role access renders a 403 page via `forbidden()` (`experimental.authInterrupts`).
- Staff are bound to a stall through `app_user.stall_id`; every staff query and mutation is
  scoped by that id.

## Consequences

- Deactivation takes effect on the next request without a session store.
- Logging out deletes the cookie; tokens are not server-revocable before expiry, but a deactivated
  user's token is useless because the DAL checks status.
- Role changes take effect on the next sign-in for the proxy and immediately for the DAL.
