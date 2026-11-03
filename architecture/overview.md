# Architecture overview

Implements the logical architecture of SRS §2.1. Status of each component is stated explicitly.

```text
Browser (student / staff / admin)
   │  HTTPS (production)
   ▼
Next.js 16 app (App Router, Cache Components, React 19)
   ├─ proxy.ts ............ optimistic auth redirects (cookie only)
   ├─ app/ ................ pages (Server Components) + client islands
   ├─ app/actions/ ........ Server Actions (all mutations, each re-authorizes)
   ├─ app/api/ ............ Route Handlers: /api/stalls/{id}/slots, /api/health
   ├─ lib/auth/ ........... session token, cookie, Data Access Layer
   ├─ lib/services/ ....... business logic + queries (orders, catalog, reports, insights)
   ├─ lib/domain/ ......... pure rules (lifecycle, slots, money, geofence) — unit tested
   └─ lib/db.ts ........... Prisma Client (driver adapter @prisma/adapter-pg)
   │
   ▼
PostgreSQL (`cas`) ◄──── ml/ (Python batch jobs: python -m canteen_ml all)
                          reads orders; writes forecast_result, recommendation_result, model_run
```

## Layers (NFR-33)

| Layer | Location | Rule |
|---|---|---|
| UI | `app/**/page.tsx`, `components/` | No direct business rules; server pages call services, client components call actions. |
| Actions / API | `app/actions/`, `app/api/` | Validate input with Zod (`lib/validation.ts`), authorize via DAL, call services, `refresh()` the router. |
| Services | `lib/services/` | Business logic and scoped queries; return plain DTOs (no `Decimal`). |
| Domain | `lib/domain/` | Pure functions, importable by client and server. |
| Data | `prisma/schema.prisma`, `lib/db.ts` | Schema and migrations only through Prisma. |
| ML | `ml/canteen_ml` + `forecast_result`, `recommendation_result`, `model_run`, `recommendation_event` | Python batch jobs; integration through the database only (ADR 0006, `ml/README.md`). |

## Rendering model

Cache Components is enabled. Every page renders a static shell (headers, titles, skeletons) and streams
request-specific content inside `<Suspense>`. Anything reading cookies, the database or the clock runs
inside a boundary; public reads call `connection()` first. Nothing is cached with `use cache` because
menus, availability and slots must be fresh. After a mutation, actions call `refresh()`;
live views (order tracking, staff board, notifications) poll with `router.refresh()` every 10–20 s.

## Key flows

- **Place order (UC-01)**: cart (client, single stall) → `GET /api/stalls/{id}/slots` → `placeOrder` action →
  `lib/services/orders.placeOrder`: idempotency check → settings/geofence → stall open → item availability
  and price check → slot validation → one transaction: create slot row if missing, conditional capacity
  increment, order + items (price snapshots) + payment + history + staff notification.
- **Manage order (UC-02)**: staff board → `updateOrderStatus` → `transitionOrder` (stall scoping,
  lifecycle check, optimistic concurrency, slot release, payment update, history, student notification).
- **Forecast (UC-03)** and **recommendations (UC-04)**: `lib/services/insights.ts` (ADR 0006).

See `architecture/data-model.md` for the schema and `design/overview.md` for the UI.
