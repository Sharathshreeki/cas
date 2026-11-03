# PES University Canteen Automation System

Web app for ordering ahead from campus canteen stalls: students browse menus, book a 15-minute pickup
slot and track their order; staff run a live order board and manage their menu; administrators manage
stalls, users and policies. Requirements: [`requirements/srs.md`](requirements/srs.md) ·
implementation status: [`requirements/overview.md`](requirements/overview.md).

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Prisma 7 + PostgreSQL ·
shadcn/ui + Tailwind CSS 4 · Motion · Zod · Vitest · Python 3 (pandas, scikit-learn) for the ML jobs in [`ml/`](ml/README.md).

## Setup

Requirements: Node.js 20+, PostgreSQL 14+.

```bash
npm install                      # also generates the Prisma client
cp .env.example .env             # then edit the values
createdb cas                     # and `createdb cas_test` for integration tests
npm run db:migrate               # apply migrations
npm run db:seed                  # demo accounts, stalls, menus, synthetic history (wipes app tables!)
npm run dev                      # http://localhost:3000
```

### Environment variables (NFR-38)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `SESSION_SECRET` | yes | ≥ 32 random characters for signing session cookies (`openssl rand -base64 32`) |
| `TEST_DATABASE_URL` | for integration tests | Separate database; must differ from `DATABASE_URL` |

### Demo accounts (after seeding)

| Role | Email | Password |
|---|---|---|
| Student | `student@pesu.pes.edu` | `Student@1234` |
| Staff (Main Canteen) | `staff.main@canteen.pes.edu` | `Staff@1234` |
| Staff (Food Court Express / Juice Junction / Snack Shack) | `staff.express@…`, `staff.juice@…`, `staff.snacks@canteen.pes.edu` | `Staff@1234` |
| Admin | `admin@canteen.pes.edu` | `Admin@1234` |

Seeded orders are **synthetic** (`orders.is_synthetic = true`).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm test` | Unit tests |
| `npm run test:integration` | Integration tests against `TEST_DATABASE_URL` |
| `npm run typecheck` / `lint` | Static checks |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma migrate (dev) / deploy (prod) / seed |
| `npm run ml:train` / `ml:test` | Train and publish the ML models / run their tests (set up `ml/.venv` first, see `ml/README.md`) |

## Project layout

```
app/            routes: (site) student pages, (auth), staff/, admin/, api/, actions/ (Server Actions)
components/     UI (shadcn in components/ui)
lib/            auth, domain rules, services, validation, time zone helpers
prisma/         schema, migrations, seed
ml/             Python ML jobs: demand forecasting and recommendations
tests/          unit/ and integration/
requirements/ architecture/ design/ decisions/ security/ schemas/ docs/   project artifacts (ADCE)
```

Key decisions are in [`decisions/`](decisions/0001-record-architecture-decisions.md). Backup and restore:
[`docs/operations/backup-restore.md`](docs/operations/backup-restore.md).
