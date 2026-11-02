# 3. Slot capacity model

Status: Accepted · Requirements: FR-38–FR-46, BR-05, BR-06, NFR-16, NFR-44

## Context

SRS §3.5 asks us to pick a capacity model: maximum orders, maximum items, or a workload limit.

## Decision

- **Capacity = maximum number of orders per 15-minute pickup slot, per stall.**
  Default comes from `stall.slot_capacity` (set by staff on *Pickup slots* or by admins).
- Slots are derived from stall hours (`opens_at`/`closes_at`, minutes from campus midnight).
  A `pickup_slot` row is created lazily on first booking (`INSERT … ON CONFLICT DO NOTHING`).
- Booking is a single conditional update inside the order transaction:
  `UPDATE pickup_slot SET booked_count = booked_count + 1 WHERE id = $1 AND booked_count < capacity`.
  PostgreSQL's row lock serializes concurrent bookings, so capacity can never be exceeded.
  If no row is updated the transaction aborts with `SLOT_FULL`.
- Cancellation/rejection decrements `booked_count` in the same transaction as the status change.
- Policy (admin settings): minimum lead time (default 15 min) and bookable days (default 2: today + tomorrow).
- Changing capacity updates future slot rows to `GREATEST(new, booked_count)` — existing bookings are never invalidated.

## Consequences

- Simple and verifiable: `tests/integration/orders.test.ts` runs 12 concurrent bookings for 3 places.
- Large orders count the same as small ones. A workload-based model (sum of prep time) is a possible
  future refinement and would only change the conditional update.
