# 6. ML integration boundary and non-ML fallbacks

Status: Accepted · Requirements: FR-66–FR-82, NFR-05, NFR-49, NFR-52–NFR-58, NFR-62, BR-12–BR-14

## Context

The forecasting and recommendation models will be Python code added later to `ml/` (currently empty).
The web app must work — and meet the "fallback" requirements — before any model exists.

## Decision

- **Boundary is the database.** The ML service reads order data (`orders`, `order_item`, `pickup_slot`,
  `menu_item`) and writes predictions to `forecast_result` (item, date, period, predicted quantity,
  model version, generated time). Recommendation interactions are logged to `recommendation_event`
  for offline evaluation. The web app never calls Python synchronously, so ML failures cannot block ordering.
- **Forecast fallback:** when no `forecast_result` rows exist for the stall/date, the staff page shows a
  labelled *baseline*: mean quantity sold on the same weekday over the previous 4 weeks, requiring ≥ 2 weeks
  of history; otherwise "Insufficient data".
- **Recommendation fallback:** students with ≥ 3 completed orders see items they reorder most; otherwise the
  most-ordered items of the last 30 days; with no data, newest available items. Unavailable items, closed
  stalls and archived items are always excluded.
- Seeded demo orders have `orders.is_synthetic = true` so model evaluation can exclude them (SRS §8.2).

## Consequences

- These fallbacks are heuristics, not ML, and the UI says so.
- To connect a model: write rows to `forecast_result` (the staff page switches to "Model forecast · <version>"
  automatically), and for recommendations replace `getRecommendations` in `lib/services/insights.ts`
  with a lookup of model output, keeping the same exclusion rules.
