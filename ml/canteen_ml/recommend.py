"""Menu recommendations per student (SRS §3.10, UC-04).

Implicit feedback: a student "interacts" with an item each time a completed order
contains it. The hybrid score for student ``u`` and item ``i`` is

    w_reorder * reorder(u, i) + w_similar * similar(u, i) + w_popular * popular(i)

* ``reorder``  — share of the student's orders that contained ``i`` (canteen
                 regulars reorder favourites, so repeats are allowed)
* ``similar``  — item-item collaborative filtering: cosine similarity between
                 items' student vectors, weighted by the student's history
* ``popular``  — item order count over the last 30 days (the app's fallback)

Offline evaluation (FR-82, NFR-53) holds out each student's most recent order
(test) and the one before it (validation); weights are chosen on validation and
reported on test against the two baselines the app already uses.

Availability is NOT filtered here — the app excludes sold-out items at read time
so stored rankings never go stale when a stall toggles availability (BR-11).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from itertools import product

import numpy as np
import pandas as pd

from .metrics import ranking_metrics

K = 8  # recommendations shown on the home page
STORE_TOP = 20
MIN_ORDERS_FOR_EVAL = 3
POPULARITY_DAYS = 30
WEIGHT_GRID = [0.0, 0.25, 0.5, 1.0]
# Breaks ties among items a student has never ordered by campus popularity.
TIE_BREAK = 1e-3


@dataclass
class Model:
    items: list[str]
    users: list[str]
    counts: np.ndarray  # users x items, number of orders containing the item
    orders_per_user: np.ndarray
    similarity: np.ndarray  # items x items
    popularity: np.ndarray  # items, normalised to [0, 1]


def completed_orders(lines: pd.DataFrame) -> pd.DataFrame:
    """Distinct (order, student, item) for completed orders, newest last."""
    done = lines[lines["status"] == "COMPLETED"]
    return done.drop_duplicates(["order_id", "menu_item_id"])[["order_id", "student_id", "menu_item_id", "placed_at"]]


def fit(orders: pd.DataFrame, items: list[str], now: pd.Timestamp) -> Model:
    users = sorted(orders["student_id"].unique())
    u_index = {u: n for n, u in enumerate(users)}
    i_index = {i: n for n, i in enumerate(items)}
    counts = np.zeros((len(users), len(items)))
    known = orders[orders["menu_item_id"].isin(i_index)]
    np.add.at(counts, (known["student_id"].map(u_index).to_numpy(), known["menu_item_id"].map(i_index).to_numpy()), 1)
    orders_per_user = orders.groupby("student_id")["order_id"].nunique().reindex(users).fillna(0).to_numpy()

    binary = (counts > 0).astype(float)
    norms = np.linalg.norm(binary, axis=0)
    norms[norms == 0] = 1
    similarity = (binary.T @ binary) / np.outer(norms, norms)
    np.fill_diagonal(similarity, 0)

    recent = known[known["placed_at"] >= now - pd.Timedelta(days=POPULARITY_DAYS)]
    pop = recent.groupby("menu_item_id")["order_id"].nunique().reindex(items).fillna(0).to_numpy()
    if pop.max() == 0:  # no recent orders: fall back to all-time popularity
        pop = binary.sum(axis=0)
    popularity = pop / pop.max() if pop.max() else pop
    return Model(items, users, counts, orders_per_user, similarity, popularity)


def score(model: Model, weights: tuple[float, float, float]) -> tuple[np.ndarray, np.ndarray]:
    """Scores (users x items) and the dominant component per cell (0/1/2)."""
    w_reorder, w_similar, w_popular = weights
    per_order = np.maximum(model.orders_per_user[:, None], 1)
    reorder = model.counts / per_order
    history = model.counts / np.maximum(model.counts.sum(axis=1, keepdims=True), 1)
    similar = history @ model.similarity
    if similar.max() > 0:
        similar = similar / similar.max(axis=1, keepdims=True).clip(min=1e-9)
    popular = np.broadcast_to(model.popularity, reorder.shape)
    parts = np.stack([w_reorder * reorder, w_similar * similar, (w_popular + TIE_BREAK) * popular])
    return parts.sum(axis=0), parts.argmax(axis=0)


def top_k(model: Model, scores: np.ndarray, k: int) -> dict[str, list[str]]:
    order = np.argsort(-scores, axis=1, kind="stable")[:, :k]
    return {u: [model.items[j] for j in order[n]] for n, u in enumerate(model.users)}


def _split_last(orders: pd.DataFrame, holdout: int) -> tuple[pd.DataFrame, dict[str, set[str]]]:
    """Remove each eligible student's last ``holdout`` orders; truth = the earliest removed one."""
    per_user = orders[["student_id", "order_id", "placed_at"]].drop_duplicates("order_id").sort_values("placed_at")
    counts = per_user.groupby("student_id")["order_id"].transform("count")
    eligible = per_user[counts >= MIN_ORDERS_FOR_EVAL + holdout - 1]
    removed = eligible.groupby("student_id").tail(holdout)
    target_orders = removed.groupby("student_id").head(1)
    truth_lines = orders[orders["order_id"].isin(target_orders["order_id"])]
    truth = truth_lines.groupby("student_id")["menu_item_id"].apply(set).to_dict()
    return orders[~orders["order_id"].isin(removed["order_id"])], truth


def evaluate(orders: pd.DataFrame, items: list[str], weights: tuple[float, float, float], holdout: int, now) -> dict:
    train, truth = _split_last(orders, holdout)
    model = fit(train, items, now)
    return ranking_metrics(top_k(model, score(model, weights)[0], K), truth, K)


BASELINE_WEIGHTS = {"popularity": (0.0, 0.0, 1.0), "personal_frequency": (1.0, 0.0, 0.0)}


def weight_grid() -> list[tuple[float, float, float]]:
    """Distinct weightings, normalised to sum to 1 (only ratios affect ranking)."""
    seen = set()
    for w in product(WEIGHT_GRID, repeat=3):
        if any(w):
            seen.add(tuple(round(x / sum(w), 3) for x in w))
    return sorted(seen)


@dataclass
class RecommendRun:
    model_version: str
    rows: pd.DataFrame
    metrics: dict
    weights: tuple[float, float, float]
    train_rows: int
    synthetic_share: float
    data_from: pd.Timestamp
    data_to: pd.Timestamp


def run_recommend(lines: pd.DataFrame, menu: pd.DataFrame, now: pd.Timestamp) -> RecommendRun:
    orders = completed_orders(lines)
    if orders.empty:
        raise ValueError("No completed orders yet.")
    items = sorted(menu.loc[~menu["is_archived"], "menu_item_id"])

    grid = weight_grid()
    valid = {w: evaluate(orders, items, w, holdout=2, now=now) for w in grid}
    # Highest validation hit rate, then MRR; remaining ties go to the first in the grid.
    best = max(grid, key=lambda w: (round(valid[w][f"hit_rate@{K}"], 4), round(valid[w]["mrr"], 4)))

    test = {name: evaluate(orders, items, w, holdout=1, now=now) for name, w in BASELINE_WEIGHTS.items()}
    test["hybrid"] = evaluate(orders, items, best, holdout=1, now=now)

    model = fit(orders, items, now)
    scores, dominant = score(model, best)
    reasons = np.array(["REORDER", "SIMILAR", "POPULAR"])
    records = []
    order = np.argsort(-scores, axis=1, kind="stable")[:, :STORE_TOP]
    for n, user in enumerate(model.users):
        for rank, j in enumerate(order[n], start=1):
            records.append((user, model.items[j], rank, float(scores[n, j]), reasons[dominant[n, j]]))
    # Global ranking for new or anonymous students (user_id NULL).
    for rank, j in enumerate(np.argsort(-model.popularity, kind="stable")[:STORE_TOP], start=1):
        records.append((None, model.items[j], rank, float(model.popularity[j]), "POPULAR"))
    rows = pd.DataFrame(records, columns=["user_id", "menu_item_id", "rank", "score", "reason"])

    completed = lines[lines["status"] == "COMPLETED"].drop_duplicates("order_id")
    synthetic_share = float(completed["is_synthetic"].mean()) if len(completed) else 0.0
    hybrid, baseline = test["hybrid"][f"hit_rate@{K}"], test["popularity"][f"hit_rate@{K}"]
    metrics = {
        "protocol": "leave-last-order-out; weights chosen on the second-to-last order",
        "k": K,
        "weights": {"reorder": best[0], "similar": best[1], "popular": best[2]},
        "baseline": "popularity",
        "validation": {k: (round(v, 4) if isinstance(v, float) else v) for k, v in valid[best].items()},
        "test": {name: {k: (round(v, 4) if isinstance(v, float) else v) for k, v in m.items()} for name, m in test.items()},
        "improvement_vs_baseline_pct": round((hybrid - baseline) / baseline * 100, 1) if baseline else None,
        "synthetic_share": round(synthetic_share, 3),
    }
    return RecommendRun(
        model_version=f"rec-hybrid-{datetime.now():%Y%m%d%H%M}",
        rows=rows,
        metrics=metrics,
        weights=best,
        train_rows=len(orders),
        synthetic_share=synthetic_share,
        data_from=orders["placed_at"].min(),
        data_to=orders["placed_at"].max(),
    )
