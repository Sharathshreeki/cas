"""Daily demand forecasting per menu item (SRS §3.9, UC-03).

Candidates (SRS "Candidate algorithms"):
  * ``seasonal_naive``       — same weekday last week (lag 7)
  * ``same_weekday_mean_4w`` — mean of the same weekday over 4 weeks; this is the
                               baseline the app shows when no model output exists
  * ``hist_gradient_boosting`` and ``random_forest`` — scikit-learn regressors

Evaluation is chronological (NFR-54): the most recent ~20% of operating dates
(at least 7) are held out for reporting, the ~15% before them (at least 5)
select the model, and the rest (at least 10) train it. The selected model is refit on all history and predicts the next
``horizon`` days. If no ML model beats the baseline on validation, the baseline
itself is published, and the run record says so.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor

from .features import FEATURES, MAX_HORIZON, build_panel, training_rows, weekday_operating
from .metrics import mae

BASELINE = "same_weekday_mean_4w"
MIN_TEST_DAYS, MIN_VALID_DAYS, MIN_TRAIN_DAYS = 7, 5, 10


def _baseline_predict(name: str, rows: pd.DataFrame) -> np.ndarray:
    if name == "seasonal_naive":
        fallback = rows["same_weekday_mean"].fillna(rows["recent_mean"]).fillna(0)
        return rows["lag_7"].fillna(fallback).to_numpy()
    if name == BASELINE:
        return rows["same_weekday_mean"].fillna(rows["recent_mean"]).fillna(0).to_numpy()
    raise ValueError(name)


def _make_model(name: str, seed: int):
    if name == "hist_gradient_boosting":
        return HistGradientBoostingRegressor(
            loss="poisson", max_iter=300, learning_rate=0.05, max_leaf_nodes=15, min_samples_leaf=20, random_state=seed
        )
    if name == "random_forest":
        return RandomForestRegressor(n_estimators=300, min_samples_leaf=5, max_features=0.6, n_jobs=-1, random_state=seed)
    raise ValueError(name)


MODELS = ("hist_gradient_boosting", "random_forest")
BASELINES = ("seasonal_naive", BASELINE)


def _fit_predict(name: str, train: pd.DataFrame, target: pd.DataFrame, seed: int) -> np.ndarray:
    if name in BASELINES:
        return _baseline_predict(name, target)
    model = _make_model(name, seed)
    model.fit(train[FEATURES], train["quantity"])
    return np.clip(model.predict(target[FEATURES]), 0, None)


@dataclass
class ForecastRun:
    algorithm: str
    model_version: str
    predictions: pd.DataFrame
    metrics: dict
    train_rows: int
    synthetic_share: float
    data_from: pd.Timestamp
    data_to: pd.Timestamp
    notes: list[str] = field(default_factory=list)


def run_forecast(
    lines: pd.DataFrame,
    menu: pd.DataFrame,
    today: pd.Timestamp,
    horizon: int = MAX_HORIZON,
    seed: int = 42,
) -> ForecastRun:
    if horizon > MAX_HORIZON:
        raise ValueError(f"horizon must be <= {MAX_HORIZON} days (features use data at least 7 days old)")
    if lines.empty:
        raise ValueError("No order data available.")

    last_complete = today - pd.Timedelta(days=1)
    history = lines[lines["demand_date"] <= last_complete]
    if history.empty:
        raise ValueError("No completed days of order data yet.")
    end = today + pd.Timedelta(days=horizon - 1)
    panel = build_panel(history, menu, end)
    rows = training_rows(panel, last_complete)

    dates = np.sort(rows["date"].unique())
    test_days = max(MIN_TEST_DAYS, round(len(dates) * 0.20))
    valid_days = max(MIN_VALID_DAYS, round(len(dates) * 0.15))
    if len(dates) - test_days - valid_days < MIN_TRAIN_DAYS:
        raise ValueError(
            f"Need at least {MIN_TEST_DAYS + MIN_VALID_DAYS + MIN_TRAIN_DAYS} operating days with two weeks of "
            f"history to train and evaluate; have {len(dates)}. Until then the app shows its baseline."
        )
    test_start, valid_start = dates[-test_days], dates[-(test_days + valid_days)]
    train = rows[rows["date"] < valid_start]
    valid = rows[(rows["date"] >= valid_start) & (rows["date"] < test_start)]
    train_valid = rows[rows["date"] < test_start]
    test = rows[rows["date"] >= test_start]

    candidates = (*BASELINES, *MODELS)
    valid_mae = {name: mae(valid["quantity"], _fit_predict(name, train, valid, seed)) for name in candidates}
    test_mae = {name: mae(test["quantity"], _fit_predict(name, train_valid, test, seed)) for name in candidates}
    chosen = min(candidates, key=lambda n: valid_mae[n])

    # Refit the chosen model on all history and predict the horizon.
    future = panel[(panel["date"] >= today) & (panel["date"] <= end)].copy()
    future["predicted_quantity"] = _fit_predict(chosen, rows, future, seed)
    open_days = weekday_operating(panel, last_complete)
    future = future.merge(open_days, on=["stall_id", "dow"], how="left")
    future.loc[future["open"] != True, "predicted_quantity"] = 0.0  # noqa: E712 — NaN means "no recent data"
    future["predicted_quantity"] = future["predicted_quantity"].clip(lower=0).round(1)
    future["forecast_date"] = future["date"].dt.date

    baseline_test = test_mae[BASELINE]
    improvement = (baseline_test - test_mae[chosen]) / baseline_test * 100 if baseline_test else 0.0
    synthetic_share = float(history["is_synthetic"].mean()) if "is_synthetic" in history else 0.0
    version = f"fc-{chosen.replace('_', '-')}-{datetime.now():%Y%m%d%H%M}"

    metrics = {
        "metric": "MAE (portions per item per day)",
        "baseline": BASELINE,
        "chosen": chosen,
        "selection": "lowest validation MAE",
        "validation_mae": {k: round(v, 3) for k, v in valid_mae.items()},
        "test_mae": {k: round(v, 3) for k, v in test_mae.items()},
        "improvement_vs_baseline_pct": round(improvement, 1),
        "split": {
            "train_from": str(pd.Timestamp(dates[0]).date()),
            "valid_from": str(pd.Timestamp(valid_start).date()),
            "test_from": str(pd.Timestamp(test_start).date()),
            "test_to": str(pd.Timestamp(dates[-1]).date()),
        },
        "days": {"train": len(dates) - valid_days - test_days, "valid": valid_days, "test": test_days},
        "horizon_days": horizon,
        "demand_definition": "quantity in non-cancelled, non-rejected orders by pickup-slot date (Asia/Kolkata)",
        "synthetic_share": round(synthetic_share, 3),
    }
    return ForecastRun(
        algorithm=chosen,
        model_version=version,
        predictions=future[["stall_id", "menu_item_id", "forecast_date", "predicted_quantity"]],
        metrics=metrics,
        train_rows=len(rows),
        synthetic_share=synthetic_share,
        data_from=pd.Timestamp(dates[0]),
        data_to=pd.Timestamp(dates[-1]),
    )
