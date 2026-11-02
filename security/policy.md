# Security and privacy policy

Requirements: NFR-06–NFR-15, NFR-21, NFR-46–NFR-51. See also ADR 0002 and `/privacy`.

## Authentication

- bcrypt (cost 12) password hashes; no plaintext passwords stored or logged.
- Password policy: 8–72 characters with at least one letter and one digit.
- Login errors are generic ("Incorrect email or password") and timing-equalised with a dummy hash.
- Session: HS256 JWT in an `httpOnly`, `SameSite=Lax`, `Secure` (production) cookie, 7-day expiry.

## Authorization

- Enforced server-side in the Data Access Layer (`lib/auth/dal.ts`) for every page, Server Action and Route Handler.
  `proxy.ts` is only an optimistic redirect.
- Students can read and act only on their own orders (other students' order codes return 404).
- Staff queries and mutations are always filtered by their assigned `stall_id`.
- Admin actions require `ADMIN`; admins cannot deactivate or demote themselves.
- Payment status changes only through: simulated payment by the owning student, cash collection at
  handover by the stall's staff, or refund on cancellation (ADR 0004).

## Input and data handling

- All action input is validated with Zod; database access uses Prisma's parameterised queries
  (raw SQL only via tagged templates).
- Prices and totals are recomputed on the server; client prices are only used to detect changes.
- Errors shown to users are generic; details go to server logs only.
- Secrets (`DATABASE_URL`, `SESSION_SECRET`) come from environment variables; `.env*` is git-ignored
  except `.env.example`.

## Logging

`audit_log` records sign-ins, failed sign-ins (no email/password stored), registrations, password changes,
account/role/stall changes, stall and menu changes and settings updates. Never tokens, passwords or locations.

## Privacy

- Data collected: name, email, SRN, phone, orders, payments. Location is used transiently for geofencing
  only when enabled and never stored.
- ML uses order history in aggregate; personal recommendations only use the student's own completed orders.
- Retention: orders and payments are kept for reporting; accounts are deactivated rather than deleted so
  transaction history stays consistent. Deletion requests go to the administrator.

## Production checklist

- Serve over HTTPS (NFR-12); set a strong `SESSION_SECRET`; use a least-privilege DB role with TLS.
- Run `npm run db:deploy` (not `migrate dev`); never run the seed against production (it refuses when `NODE_ENV=production`).
