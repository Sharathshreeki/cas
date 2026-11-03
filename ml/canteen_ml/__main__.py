"""Command line: ``python -m canteen_ml {forecast,recommend,all} [options]``."""

from __future__ import annotations

import argparse
import json
from datetime import datetime

import pandas as pd

from . import db
from .config import CAMPUS_TZ
from .forecast import run_forecast
from .recommend import run_recommend


def _today() -> pd.Timestamp:
    return pd.Timestamp(datetime.now(CAMPUS_TZ).date())


def _synthetic_note(share: float) -> str:
    if share >= 0.5:
        return f"NOTE: {share:.0%} of the training data is SYNTHETIC — metrics are not real-world accuracy (SRS §8.2)."
    return f"Synthetic share of training data: {share:.0%}."


def forecast(conn, args) -> None:
    lines = db.load_order_lines(conn, include_synthetic=not args.real_only)
    menu = db.load_menu(conn)
    run = run_forecast(lines, menu, _today(), horizon=args.horizon)
    print(f"Forecast model: {run.algorithm} ({run.model_version})")
    print(json.dumps(run.metrics, indent=2))
    print(_synthetic_note(run.synthetic_share))
    if args.dry_run:
        print(run.predictions.head(10).to_string(index=False))
        return
    with conn.transaction():
        n = db.write_forecasts(conn, run.predictions, run.model_version)
        db.record_run(
            conn,
            task="FORECAST",
            model_version=run.model_version,
            algorithm=run.algorithm,
            metrics=run.metrics,
            synthetic_share=run.synthetic_share,
            train_rows=run.train_rows,
            data_from=run.data_from.date(),
            data_to=run.data_to.date(),
        )
    print(f"Wrote {n} forecast rows.")


def recommend(conn, args) -> None:
    lines = db.load_order_lines(conn, include_synthetic=not args.real_only)
    menu = db.load_menu(conn)
    run = run_recommend(lines, menu, pd.Timestamp.now(tz="UTC"))
    print(f"Recommendation model: hybrid {run.weights} ({run.model_version})")
    print(json.dumps(run.metrics, indent=2))
    print(_synthetic_note(run.synthetic_share))
    if args.dry_run:
        print(run.rows.head(10).to_string(index=False))
        return
    with conn.transaction():
        n = db.replace_recommendations(conn, run.rows, run.model_version)
        db.record_run(
            conn,
            task="RECOMMEND",
            model_version=run.model_version,
            algorithm="hybrid reorder + item-item CF + popularity",
            metrics=run.metrics,
            synthetic_share=run.synthetic_share,
            train_rows=run.train_rows,
            data_from=run.data_from.date(),
            data_to=run.data_to.date(),
        )
    print(f"Wrote {n} recommendation rows.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="canteen_ml", description=__doc__)
    parser.add_argument("job", choices=["forecast", "recommend", "all"])
    parser.add_argument("--horizon", type=int, default=7, help="days to forecast, starting today (max 7)")
    parser.add_argument("--real-only", action="store_true", help="exclude synthetic (seeded) orders")
    parser.add_argument("--dry-run", action="store_true", help="train and evaluate without writing results")
    args = parser.parse_args()

    with db.connect() as conn:
        if args.job in ("forecast", "all"):
            forecast(conn, args)
        if args.job in ("recommend", "all"):
            recommend(conn, args)


if __name__ == "__main__":
    main()
