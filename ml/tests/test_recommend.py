import pandas as pd

from canteen_ml.metrics import ranking_metrics
from canteen_ml.recommend import fit, run_recommend, score, top_k, weight_grid

NOW = pd.Timestamp("2026-03-01", tz="UTC")
ITEMS = ["coffee", "dosa", "idli", "juice", "puff"]
MENU = pd.DataFrame({"menu_item_id": ITEMS, "is_archived": [False] * len(ITEMS)})


def orders_from(spec):
    """spec: {student: [[items in order 1], [items in order 2], ...]} in time order."""
    rows, n = [], 0
    for student, orders in spec.items():
        for k, items in enumerate(orders):
            n += 1
            for item in items:
                rows.append(
                    dict(order_id=f"o{n}", student_id=student, menu_item_id=item, status="COMPLETED", is_synthetic=False,
                         placed_at=NOW - pd.Timedelta(days=len(orders) - k), stall_id="S", quantity=1,
                         demand_date=NOW.tz_localize(None))
                )
    return pd.DataFrame(rows)


def test_ranking_metrics():
    m = ranking_metrics({"u": ["a", "b", "c"]}, {"u": {"b", "z"}}, k=2)
    assert m["hit_rate@2"] == 1.0 and m["precision@2"] == 0.5 and m["recall@2"] == 0.5 and m["mrr"] == 0.5


def test_reorder_component_ranks_a_students_favourite_first():
    lines = orders_from({"s1": [["dosa"], ["dosa", "coffee"], ["dosa"]], "s2": [["juice"], ["juice"], ["puff"]]})
    model = fit(lines, ITEMS, NOW)
    recs = top_k(model, score(model, (1.0, 0.0, 0.0))[0], 2)
    assert recs["s1"][0] == "dosa" and recs["s2"][0] == "juice"


def test_similarity_suggests_items_bought_together():
    # Everyone who buys idli also buys coffee; s3 has only bought idli.
    lines = orders_from({"a": [["idli", "coffee"]] * 3, "b": [["idli", "coffee"]] * 3, "s3": [["idli"]]})
    model = fit(lines, ITEMS, NOW)
    recs = top_k(model, score(model, (0.0, 1.0, 0.0))[0], 1)
    assert recs["s3"] == ["coffee"]


def test_weight_grid_is_normalised_and_unique():
    grid = weight_grid()
    assert all(abs(sum(w) - 1) < 1e-2 for w in grid)
    assert len(grid) == len(set(grid))


def test_run_produces_personal_and_global_rows():
    spec = {f"s{i}": [["dosa", "coffee"], ["dosa"], ["idli"], ["dosa"]] for i in range(5)}
    spec["new"] = [["puff"]]
    run = run_recommend(orders_from(spec), MENU, NOW)
    rows = run.rows
    assert set(rows["reason"]) <= {"REORDER", "SIMILAR", "POPULAR"}
    assert rows[rows.user_id.isna()]["rank"].tolist() == list(range(1, len(ITEMS) + 1))
    assert rows[rows.user_id == "s0"].sort_values("rank").iloc[0]["menu_item_id"] == "dosa"
    assert run.metrics["test"]["hybrid"]["users"] == 5
