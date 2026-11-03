"""Feature engineering for daily item demand (SRS §3.9 "Proposed input features").

A *panel* row is (menu item, campus date) on a day the item's stall was
operating. The target is the quantity of that item in non-cancelled orders whose
pickup slot falls on that date.

Leakage rule (NFR-54): every feature for date ``d`` uses only data from dates
``<= d - 7``. Forecasting up to 7 days past the last complete day therefore
needs nothing that would not be known at forecast time.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

LAGS = (7, 14, 21, 28)
MAX_HORIZON = 7
FEATURES = [
    "dow",
    "lag_7",
    "lag_14",
    "lag_21",
    "lag_28",
    "same_weekday_mean",
    "recent_mean",
    "stall_recent_mean",
    "price",
    "item_code",
    "category_code",
    "stall_code",
]


def daily_demand(lines: pd.DataFrame) -> pd.DataFrame:
    """Quantity per (item, date) plus the set of operating days per stall."""
    return (
        lines.groupby(["stall_id", "menu_item_id", "demand_date"], as_index=False)["quantity"]
        .sum()
        .rename(columns={"demand_date": "date"})
    )


def operating_days(lines: pd.DataFrame) -> pd.DataFrame:
    """A stall operated on a date if it had at least one valid order for that date."""
    return lines[["stall_id", "demand_date"]].drop_duplicates().rename(columns={"demand_date": "date"})


def _item_series(demand: pd.DataFrame, days: pd.DataFrame, menu: pd.DataFrame, start, end) -> pd.DataFrame:
    """Continuous calendar per item: quantity on operating days, NaN otherwise."""
    calendar = pd.date_range(start, end, freq="D")
    frames = []
    for item in menu.itertuples():
        frame = pd.DataFrame({"date": calendar})
        frame["menu_item_id"] = item.menu_item_id
        frame["stall_id"] = item.stall_id
        open_days = set(days.loc[days.stall_id == item.stall_id, "date"])
        frame["operating"] = frame["date"].isin(open_days) & (frame["date"] >= item.created_date)
        frames.append(frame)
    panel = pd.concat(frames, ignore_index=True)
    panel = panel.merge(demand[["menu_item_id", "date", "quantity"]], on=["menu_item_id", "date"], how="left")
    panel["quantity"] = np.where(panel["operating"], panel["quantity"].fillna(0), np.nan)
    return panel


def build_panel(lines: pd.DataFrame, menu: pd.DataFrame, end: pd.Timestamp) -> pd.DataFrame:
    """Feature panel for every calendar date from the first order to ``end``.

    Rows after the last observed date have NaN targets and are used for
    prediction; their features are still computable as long as ``date - 7``
    is within the observed range.
    """
    menu = menu[~menu["is_archived"]].copy()
    demand = daily_demand(lines)
    days = operating_days(lines)
    start = lines["demand_date"].min()
    panel = _item_series(demand, days, menu, start, end)

    panel = panel.sort_values(["menu_item_id", "date"]).reset_index(drop=True)
    grouped = panel.groupby("menu_item_id")["quantity"]
    for lag in LAGS:
        panel[f"lag_{lag}"] = grouped.shift(lag)
    panel["same_weekday_mean"] = panel[[f"lag_{lag}" for lag in LAGS]].mean(axis=1, skipna=True)
    # Mean over the 28 calendar days ending 7 days before the target.
    panel["recent_mean"] = grouped.transform(lambda s: s.shift(MAX_HORIZON).rolling(28, min_periods=1).mean())

    stall_daily = (
        panel.groupby(["stall_id", "date"])["quantity"].mean().rename("stall_mean").reset_index().sort_values("date")
    )
    stall_daily["stall_recent_mean"] = stall_daily.groupby("stall_id")["stall_mean"].transform(
        lambda s: s.shift(MAX_HORIZON).rolling(28, min_periods=1).mean()
    )
    panel = panel.merge(stall_daily[["stall_id", "date", "stall_recent_mean"]], on=["stall_id", "date"], how="left")

    panel["dow"] = panel["date"].dt.day_of_week
    panel = panel.merge(menu[["menu_item_id", "price", "category"]], on="menu_item_id", how="left")
    panel["item_code"] = panel["menu_item_id"].astype("category").cat.codes
    panel["category_code"] = panel["category"].astype("category").cat.codes
    panel["stall_code"] = panel["stall_id"].astype("category").cat.codes
    return panel


def training_rows(panel: pd.DataFrame, last_complete: pd.Timestamp) -> pd.DataFrame:
    """Observed rows with at least two weeks of same-weekday history."""
    rows = panel[(panel["date"] <= last_complete) & panel["operating"]].copy()
    history = rows[[f"lag_{lag}" for lag in LAGS]].notna().sum(axis=1)
    return rows[history >= 2].reset_index(drop=True)


def weekday_operating(panel: pd.DataFrame, last_complete: pd.Timestamp, weeks: int = 4) -> pd.DataFrame:
    """Whether each stall operated on each weekday in the recent weeks.

    Used to predict zero demand on weekdays a stall has been closed (e.g. Sundays).
    """
    recent = panel[(panel["date"] <= last_complete) & (panel["date"] > last_complete - pd.Timedelta(days=7 * weeks))]
    by_dow = recent.groupby(["stall_id", recent["date"].dt.day_of_week])["operating"].any().rename("open").reset_index()
    return by_dow.rename(columns={"date": "dow"})
