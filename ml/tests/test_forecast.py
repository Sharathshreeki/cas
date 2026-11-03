import numpy as np
import pandas as pd
import pytest

from canteen_ml.features import build_panel, training_rows
from canteen_ml.forecast import BASELINE, run_forecast
from canteen_ml.metrics import mae

TODAY = pd.Timestamp("2026-03-01")


def synthetic_lines(days=70, closed_dow=6, seed=0):
    """Two items at one stall; item A sells 10 on weekdays and 4 on Saturdays."""
    rng = np.random.default_rng(seed)
    rows, order = [], 0
    for d in pd.date_range(TODAY - pd.Timedelta(days=days), TODAY - pd.Timedelta(days=1)):
        if d.day_of_week == closed_dow:
            continue
        base = 4 if d.day_of_week == 5 else 10
        for item, qty in (("A", base + rng.integers(-1, 2)), ("B", 3)):
            order += 1
            rows.append(
                dict(order_id=f"o{order}", student_id="s1", stall_id="S", status="COMPLETED", is_synthetic=True,
                     placed_at=d.tz_localize("UTC"), demand_date=d, menu_item_id=item, quantity=int(qty))
            )
    return pd.DataFrame(rows)


MENU = pd.DataFrame(
    {
        "menu_item_id": ["A", "B"],
        "stall_id": ["S", "S"],
        "name": ["A", "B"],
        "category": ["Meals", "Snacks"],
        "price": [50.0, 20.0],
        "is_archived": [False, False],
        "created_date": [TODAY - pd.Timedelta(days=200)] * 2,
    }
)


def test_lag_features_never_use_the_last_seven_days():
    lines = synthetic_lines()
    panel = build_panel(lines, MENU, TODAY + pd.Timedelta(days=6))
    row = panel[(panel.menu_item_id == "A") & (panel.date == TODAY - pd.Timedelta(days=3))].iloc[0]
    week_ago = panel[(panel.menu_item_id == "A") & (panel.date == TODAY - pd.Timedelta(days=10))].iloc[0]
    assert row.lag_7 == week_ago.quantity
    # Mutating the most recent week must not change any feature of that row.
    recent = lines[lines.demand_date > TODAY - pd.Timedelta(days=10)].index
    changed = lines.copy()
    changed.loc[recent, "quantity"] = 999
    panel2 = build_panel(changed, MENU, TODAY + pd.Timedelta(days=6))
    row2 = panel2[(panel2.menu_item_id == "A") & (panel2.date == TODAY - pd.Timedelta(days=3))].iloc[0]
    for col in ("lag_7", "lag_14", "same_weekday_mean", "recent_mean"):
        assert row[col] == row2[col]


def test_training_rows_are_operating_days_with_history():
    lines = synthetic_lines()
    panel = build_panel(lines, MENU, TODAY)
    rows = training_rows(panel, TODAY - pd.Timedelta(days=1))
    assert (rows["date"].dt.day_of_week != 6).all()  # closed Sundays never become zero-demand targets
    assert rows[["lag_7", "lag_14", "lag_21", "lag_28"]].notna().sum(axis=1).min() >= 2


def test_forecast_selects_on_validation_and_learns_weekly_pattern():
    run = run_forecast(synthetic_lines(), MENU, TODAY)
    valid = run.metrics["validation_mae"]
    assert valid[run.algorithm] == min(valid.values())
    assert BASELINE in run.metrics["test_mae"]  # the baseline is always reported alongside
    preds = run.predictions.set_index(["menu_item_id", "forecast_date"])["predicted_quantity"]
    dates = {pd.Timestamp(d).day_of_week: d for d in run.predictions["forecast_date"].unique()}
    assert preds[("A", dates[6])] == 0  # stall closed on Sundays
    assert preds[("A", dates[0])] > preds[("A", dates[5])]  # weekdays busier than Saturdays
    assert (run.predictions["predicted_quantity"] >= 0).all()
    assert len(run.predictions) == 2 * 7
    assert run.synthetic_share == 1.0


def test_split_is_chronological():
    split = run_forecast(synthetic_lines(), MENU, TODAY).metrics["split"]
    assert split["train_from"] < split["valid_from"] < split["test_from"] <= split["test_to"]


def test_rejects_insufficient_history():
    with pytest.raises(ValueError, match="Need at least"):
        run_forecast(synthetic_lines(days=20), MENU, TODAY)


def test_horizon_is_limited_to_a_week():
    with pytest.raises(ValueError, match="horizon"):
        run_forecast(synthetic_lines(), MENU, TODAY, horizon=8)


def test_mae():
    assert mae([1, 2, 3], [1, 2, 6]) == 1.0
