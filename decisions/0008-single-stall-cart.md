# 8. Single-stall cart

Status: Accepted · Requirements: FR-26, BR-02

## Decision

A cart (and therefore an order) contains items from exactly one stall. Adding an item from a different
stall asks the student to start a new cart. The server independently rejects items that do not belong to
the order's stall.

## Rationale

Each order needs one stall, one pickup slot and one queue (BR-02, FR-40). Multi-stall carts would need
order splitting and multiple slots, which adds complexity without clear benefit for a campus canteen.

The cart lives in `localStorage` (client); prices there are display-only and the server recomputes totals.
