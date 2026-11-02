# Testing strategy

| Level | Tool | Command | Scope |
|---|---|---|---|
| Unit | Vitest | `npm test` | Pure rules in `lib/domain` and validation: lifecycle transitions, slot windows/lead time/booking days, campus time zone, money in paise, geofence, Zod schemas. |
| Integration | Vitest + PostgreSQL (`TEST_DATABASE_URL`) | `npm run test:integration` | Services against a real database: order placement, capacity, concurrency, lifecycle, authorization scoping, payments, insight fallbacks. Global setup runs `prisma migrate deploy`; each test truncates tables. |
| Static | TypeScript, ESLint | `npm run typecheck`, `npm run lint` | Types (including generated route types) and lint rules. |
| End-to-end (manual / scripted) | Browser | see below | Full role journeys on mobile and desktop widths. |

## SRS acceptance mapping (§9)

| Test | Covered by |
|---|---|
| TC-01, TC-02 | `registerSchema` unit tests; duplicate email/SRN check in `app/actions/auth.ts` (manual E2E) |
| TC-03 | DAL `requireUser(["STAFF"])` → 403 page (E2E: student opening `/staff`) |
| TC-04, TC-05, TC-12 | `orders.test.ts` "rejects unavailable items"; cart UI blocks sold-out items |
| TC-06 | `orders.test.ts` "stores one consistent order…" |
| TC-07, TC-08 | `orders.test.ts` slot capacity + 12-way concurrent race |
| TC-09, TC-10 | `orders.test.ts` lifecycle + other-stall rejection |
| TC-11 | `orders.test.ts` recommendations fallback |
| TC-13 | `orders.test.ts` forecast insufficient data |
| TC-14 | By design: no runtime ML dependency (ADR 0006) |
| TC-15 | `orders.test.ts` private order access |
| TC-16 | `docs/operations/backup-restore.md` procedure (manual) |
| TC-17 | E2E at 390 px and 1366 px widths |
| TC-18 | Not yet run — define a k6/autocannon workload against `/stalls` and order placement (NFR-01–NFR-04) |

## E2E journey used during development

Student (mobile): browse → add items → cart → choose slot → place order → simulated payment.
Staff (desktop): see new order → accept → menu, slots, forecast, reports pages.
Student: `/staff` shows 403; order page shows "Accepted". Admin: every admin page loads.
Run against `next build && next start` with seeded data.
