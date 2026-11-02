# 4. Payments: cash at pickup and simulated online payment

Status: Accepted · Requirements: FR-47–FR-52, BR-10, NFR-15

## Context

No payment gateway account is available. SRS §3.6 permits cash-on-pickup or simulated payment for a
prototype but forbids claiming a real gateway.

## Decision

Two methods, recorded on `orders.payment_method` and in a 1:1 `payment` row:

| Method | Flow |
|---|---|
| `CASH_ON_PICKUP` | `PENDING` until staff hand the order over (`READY → COMPLETED`), which marks it `PAID` with reference `CASH-<code>`. |
| `SIMULATED_ONLINE` | Student opens a clearly labelled *Simulated payment* dialog and chooses success or failure. Success → `PAID` with `SIM-…` reference; failure → `FAILED` (retry allowed). |

- Only the owning student can record a simulated payment, only on an active, unpaid order.
- Online orders cannot be handed over until `PAID`.
- Cancelling/rejecting a `PAID` order sets `REFUNDED` (simulated refund). Unpaid cancelled orders are shown as "Not charged".
- Sales reports count only `PAID` orders.

## Consequences

The UI and this ADR state plainly that no real money moves. Integrating a gateway later means
replacing `simulateOnlinePayment` with a server-verified webhook handler; the data model already has
`transaction_ref` and the status enum.
