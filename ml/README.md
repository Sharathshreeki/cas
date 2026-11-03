# ML modules — demand forecasting and recommendations

Python batch jobs for SRS §3.9 (demand forecasting) and §3.10 (food recommendations).
They read order data from the app's PostgreSQL database and write results back to it;
the web app only reads those tables, so ordering never waits on ML (ADR 0006, NFR-05, NFR-62).

```
order data (orders, order_item, pickup_slot, menu_item)
        │  python -m canteen_ml all
        ▼
forecast_result ─────► staff "Demand forecast" page
recommendation_result ► student "Recommended for you"
model_run ───────────► evaluation shown to staff/admin (FR-71, FR-74)
```

## Setup and running

```bash
cd ml
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

.venv/bin/python -m canteen_ml all             # train, evaluate and publish both models
.venv/bin/python -m canteen_ml forecast --dry-run   # evaluate only, write nothing
.venv/bin/python -m canteen_ml recommend --real-only  # ignore synthetic (seeded) orders
.venv/bin/python -m pytest -q                  # tests (no database needed)
```

From the repo root: `npm run ml:train` and `npm run ml:test`. The jobs read `DATABASE_URL`
from the environment or the repo's `.env`. To publish to the hosted database, run with
`DATABASE_URL=<that url>`. Retrain whenever new orders accumulate, e.g. nightly (FR-73, NFR-58).

## Demand forecasting (`canteen_ml/forecast.py`)

- **Target:** portions of each menu item per campus day, from non-cancelled, non-rejected
  orders, dated by pickup slot (Asia/Kolkata). Only days a stall operated are training targets.
- **Features** (`features.py`): weekday; same-weekday lags 7/14/21/28 days and their mean;
  28-day item and stall means; price; item, category and stall codes. Every feature uses data at
  least 7 days old, so forecasts up to 7 days ahead cannot leak future information (NFR-54).
- **Candidates:** seasonal naive (same weekday last week), **4-week same-weekday mean (baseline —
  what the app shows without a model)**, histogram gradient boosting (Poisson loss), random forest.
- **Evaluation:** chronological split — most recent ~20% of days (≥ 7) test, the ~15% before (≥ 5)
  validation, the rest (≥ 10) training. Lowest validation MAE is chosen; test MAE of every candidate
  is recorded. The chosen model is refit on all history and predicts today + 6 days. Weekdays a stall
  has not operated in the last 4 weeks are predicted as 0.
- Needs at least 22 operating days with two weeks of history; until then the job exits and the
  app keeps showing its baseline (FR-72).

## Recommendations (`canteen_ml/recommend.py`)

- **Signal:** a student "interacts" with an item each time a completed order contains it.
- **Hybrid score:** `w_reorder · reorder + w_similar · item-item cosine CF + w_popular · 30-day popularity`.
  Canteen regulars reorder favourites, so already-ordered items are allowed.
- **Evaluation (FR-82, NFR-53):** leave-last-order-out. Weights (normalised grid) are chosen on each
  student's second-to-last order and reported on the last order as hit rate, precision, recall @ 8
  and MRR, next to the popularity and personal-frequency baselines.
- **Output:** top 20 items per student plus a global popularity ranking (`user_id` NULL) for new or
  anonymous students. Availability is applied by the app at read time (BR-11).

## Results on the seeded demo data

All seeded orders are synthetic (`orders.is_synthetic`), so these numbers demonstrate the pipeline
and are **not** real-world accuracy (SRS §8.2). Run on 3 Nov 2026:

| Forecast (test MAE, portions/item/day) | |
|---|---|
| Seasonal naive | 3.51 |
| 4-week same-weekday mean (baseline) | 2.75 |
| Histogram gradient boosting | 2.63 |
| **Random forest (chosen)** | **2.46** (10.6% better than baseline) |

| Recommendations (test, k = 8, 41 students) | Hit rate | Recall | MRR |
|---|---|---|---|
| Popularity (baseline) | 0.44 | 0.28 | 0.15 |
| Personal frequency | 0.73 | 0.50 | 0.43 |
| **Hybrid (chosen weights: reorder 1.0)** | **0.73** | **0.50** | **0.43** |

On this data the weight search selects pure reorder frequency: the seed gives each student random
favourites with no "bought together" structure, so collaborative filtering adds nothing. On real
orders the same search will weight similarity and popularity if they help on validation.
