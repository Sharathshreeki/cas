# Data model

Source of truth: `prisma/schema.prisma` (migrations in `prisma/migrations/`). Reconciles SRS §8.

| Table | Purpose | Notes |
|---|---|---|
| `app_user` | Students, staff, admins | `role`, `status` (ACTIVE/INACTIVE), unique `email` and `srn`, `stall_id` for staff, bcrypt `password_hash` |
| `stall` | Canteen stalls | `is_open`, `opens_at`/`closes_at` (minutes, campus time), `slot_capacity` |
| `menu_item` | Menu | `price numeric(10,2)`, `prep_time_minutes`, `is_available`, `is_veg`, `is_archived` (soft delete); unique (stall, name) |
| `pickup_slot` | 15-min windows | unique (stall, `starts_at`), `capacity`, `booked_count`; created on first booking |
| `orders` | Orders | unique `code`, student/stall/slot FKs, `status`, `total_amount`, payment method/status, per-status timestamps, `idempotency_key` (unique per student), `is_synthetic` |
| `order_item` | Lines | `item_name` and `unit_price` snapshots at purchase time |
| `payment` | 1:1 with order | amount, method, status, unique `transaction_ref` |
| `order_status_history` | Audit of transitions | from/to, actor, note, time |
| `notification` | Dashboard notifications | addressed to a user (student) or a stall (staff) |
| `audit_log` | Admin/security events | action, entity, JSON details (never secrets or locations) |
| `system_setting` | Admin settings | key/value JSON with code defaults (`lib/settings.ts`) |
| `forecast_result` | ML output (written by `ml/`) | item, date, period, predicted quantity, model version, generated time |
| `recommendation_event` | Recommendation interactions | CLICK / ADD_TO_CART, strategy |
| `recommendation_result` | ML output (written by `ml/`) | per-student or global (`user_id` NULL) ranking, score, reason, model version |
| `model_run` | ML training runs | task, model version, algorithm, held-out metrics JSON, synthetic share, data range |

## Conventions

- Primary keys: `cuid` strings. Timestamps: `timestamptz(3)` in UTC; display in Asia/Kolkata (`lib/time.ts`).
- Money: `numeric(10,2)`; arithmetic in integer paise (`lib/domain/money.ts`).
- Deletion: orders, payments and menu items are never hard-deleted while referenced (`onDelete: Restrict`);
  menu items are archived, users deactivated.
- Indexes follow query patterns: orders by (student, placed_at desc), (stall, status), (stall, placed_at), slot.
