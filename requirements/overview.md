# Requirements overview and implementation status

The canonical requirements are in [`srs.md`](./srs.md) (SRS v1.0). This page records what is
implemented, so the final SRS can distinguish implemented from planned features (SRS submission note).

Legend: ✅ implemented · 🟡 implemented with a documented simplification · ⏳ planned / not implemented

| Area | Requirements | Status | Notes |
|---|---|---|---|
| Authentication & users | FR-01–FR-09 | ✅ | Email + password; SRN unique; roles STUDENT/STAFF/ADMIN; deactivation (ADR 0002) |
| Stalls & menu | FR-10–FR-19 | ✅ | Search, category/veg/availability filters; archive instead of delete |
| Cart | FR-20–FR-26 | ✅ | Single-stall cart (ADR 0008); server price/availability check |
| Orders | FR-27–FR-37 | ✅ | Order codes, history, idempotency, cancellation policy (ADR 0005) |
| Pickup slots | FR-38–FR-46 | ✅ | Max orders per 15-min slot, race-safe (ADR 0003) |
| Payments | FR-47–FR-52 | 🟡 | Cash at pickup + **simulated** online payment; no real gateway (ADR 0004) |
| Staff dashboard | FR-53–FR-59 | ✅ | Live board, menu, slots, reports, forecast page |
| Admin dashboard | FR-60–FR-65 | ✅ | Stalls, users, settings, reports, audit log |
| Demand forecasting | FR-66–FR-74 | ✅ | `ml/`: random forest / gradient boosting vs seasonal baselines, chronological split, MAE, model version + run record; baseline / "insufficient data" fallback in the app. Evaluated on **synthetic** data only so far. Retraining is a manual or scheduled command. |
| Recommendations | FR-75–FR-82 | ✅ | `ml/`: hybrid reorder + item-item CF + popularity, leave-last-order-out evaluation (hit rate, precision, recall, MRR); app filters availability and falls back to heuristics. Evaluated on **synthetic** data only so far. |
| Geo-fencing | FR-83–FR-86 | ✅ | Optional, off by default, location never stored (ADR 0007) |
| Reporting & notifications | FR-87–FR-92 | ✅ | Dashboard notifications via polling; no SMS/email/push |
| Performance | NFR-01–NFR-05 | ⏳ | Load test not yet run (TC-18) |
| Backup | NFR-20 | 🟡 | Procedure documented; restore test to be performed |

See `architecture/overview.md`, `security/policy.md` and `docs/testing/strategy.md` for details.
