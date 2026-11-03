"""Evaluation metrics (SRS §3.9 MAE; §3.10 ranking metrics)."""

from __future__ import annotations

from collections.abc import Sequence

import numpy as np


def mae(actual: Sequence[float], predicted: Sequence[float]) -> float:
    a, p = np.asarray(actual, dtype=float), np.asarray(predicted, dtype=float)
    return float(np.mean(np.abs(a - p))) if len(a) else float("nan")


def ranking_metrics(recommended: dict[str, list[str]], truth: dict[str, set[str]], k: int) -> dict[str, float]:
    """Hit rate, precision, recall and MRR at k, averaged over users with truth."""
    hits, precisions, recalls, rr = [], [], [], []
    for user, relevant in truth.items():
        if not relevant:
            continue
        top = recommended.get(user, [])[:k]
        found = [item for item in top if item in relevant]
        hits.append(1.0 if found else 0.0)
        precisions.append(len(found) / k)
        recalls.append(len(found) / len(relevant))
        rank = next((i + 1 for i, item in enumerate(top) if item in relevant), None)
        rr.append(1.0 / rank if rank else 0.0)
    n = len(hits)
    if n == 0:
        return {"users": 0, f"hit_rate@{k}": float("nan"), f"precision@{k}": float("nan"), f"recall@{k}": float("nan"), "mrr": float("nan")}
    return {
        "users": n,
        f"hit_rate@{k}": float(np.mean(hits)),
        f"precision@{k}": float(np.mean(precisions)),
        f"recall@{k}": float(np.mean(recalls)),
        "mrr": float(np.mean(rr)),
    }
