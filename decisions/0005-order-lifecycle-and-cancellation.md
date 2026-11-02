# 5. Order lifecycle and cancellation policy

Status: Accepted · Requirements: FR-34–FR-36, BR-08, BR-15, NFR-19

## Decision

```
PLACED ──► ACCEPTED ──► PREPARING ──► READY ──► COMPLETED
  │  └──► REJECTED (staff)
  └──► CANCELLED (student or staff)      ACCEPTED ──► CANCELLED (staff)
```

- Rules live in `lib/domain/order-status.ts` and are unit-tested.
- **Students** may cancel only while `PLACED`. **Staff** may reject/cancel while `PLACED`, cancel while `ACCEPTED`.
  Once preparation starts the order can only move forward.
- Every transition is an optimistic-concurrency update (`WHERE status = <expected>`), stamps the
  matching timestamp column, writes an `order_status_history` row with the actor, and notifies the other party.
- Cancellation/rejection releases slot capacity and refunds paid online orders (ADR 0004).
- Cancelled/rejected orders keep their records; deletion is never used.
