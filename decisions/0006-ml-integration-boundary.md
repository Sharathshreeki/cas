# 6. ML integration boundary and non-ML fallbacks

Status: Accepted (amended 2026-11-03: models implemented in ml/) · Requirements: FR-66–FR-82, NFR-05, NFR-49, NFR-52–NFR-58, NFR-62, BR-12–BR-14

## Context

The forecasting and recommendation models are Python batch jobs in `ml/` (see `ml/README.md`).
The web app must work — and meet the "fallback" requirements — before any model exists.

## Decision

- **Boundary is the database.** The ML service reads order data (`orders`, `order_item`, `pickup_slot`,
  `menu_item`) and writes predictions to `forecast_result` (item, date, period, predicted quantity,
  model version, generated time) and `recommendation_result` (student or global ranking), plus one
  `model_run` row per training run with its held-out metrics and synthetic-data share. Recommendation
  interactions are logged to `recommendation_event` for offline evaluation. The web app never calls Python synchronously, so ML failures cannot block ordering.
- **Forecast fallback:** when no `forecast_result` rows exist for the stall/date, the staff page shows a
  labelled *baseline*: mean quantity sold on the same weekday over the previous 4 weeks, requiring ≥ 2 weeks
  of history; otherwise "Insufficient data".
- **Recommendation fallback:** students with ≥ 3 completed orders see items they reorder most; otherwise the
  most-ordered items of the last 30 days; with no data, newest available items. Unavailable items, closed
  stalls and archived items are always excluded.
- Seeded demo orders have `orders.is_synthetic = true` so model evaluation can exclude them (SRS §8.2).

- **Models:** forecasting compares seasonal-naive, the 4-week baseline, gradient boosting and random
  forest on a chronological split and publishes the best on validation; recommendations use a hybrid of
  reorder frequency, item-item collaborative filtering and popularity with weights tuned on held-out
  orders. Both run as `python -m canteen_ml all` (manually or on a schedule).
- **Read path:** the staff forecast page uses the latest `forecast_result` version for the date and shows
  its `model_run` evaluation; `getRecommendations` uses the latest `recommendation_result` version
  (student's rows, else global rows), still excluding unavailable items, then fills gaps with the heuristics.

## Consequences

- The heuristics remain as fallbacks and are labelled as such when used.
- Model quality on seeded data is reported but flagged as synthetic; real accuracy needs real orders.
- A failed or skipped ML run leaves the previous results (or the fallbacks) in place.
