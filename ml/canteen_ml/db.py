"""Database access. The ML side reads order data and writes predictions only."""

from __future__ import annotations

import json
import uuid
from datetime import date

import pandas as pd
import psycopg

from .config import EXCLUDED_STATUSES, database_url


def connect() -> psycopg.Connection:
    # Autocommit, so each `with conn.transaction():` block is its own committed
    # transaction rather than a savepoint inside an implicit outer one.
    return psycopg.connect(database_url(), autocommit=True)


def _frame(conn: psycopg.Connection, sql: str, params: tuple = ()) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(sql, params)
        columns = [c.name for c in cur.description]
        return pd.DataFrame(cur.fetchall(), columns=columns)


def load_order_lines(conn: psycopg.Connection, include_synthetic: bool = True) -> pd.DataFrame:
    """One row per order line. Only the fields the models need (NFR-49).

    ``demand_date`` is the campus-local date of the pickup slot, matching how
    the app's staff forecast page defines a day of demand.
    """
    sql = """
        SELECT o.id AS order_id,
               o.student_id,
               o.stall_id,
               o.status,
               o.is_synthetic,
               o.placed_at,
               (s.starts_at AT TIME ZONE 'Asia/Kolkata')::date AS demand_date,
               oi.menu_item_id,
               oi.quantity
        FROM orders o
        JOIN pickup_slot s ON s.id = o.slot_id
        JOIN order_item oi ON oi.order_id = o.id
        WHERE o.status <> ALL(%s)
    """
    params: tuple = (list(EXCLUDED_STATUSES),)
    if not include_synthetic:
        sql += " AND o.is_synthetic = false"
    df = _frame(conn, sql, params)
    if not df.empty:
        df["demand_date"] = pd.to_datetime(df["demand_date"])
        df["placed_at"] = pd.to_datetime(df["placed_at"], utc=True)
        df["quantity"] = df["quantity"].astype(int)
    return df


def load_menu(conn: psycopg.Connection) -> pd.DataFrame:
    df = _frame(
        conn,
        """
        SELECT m.id AS menu_item_id, m.stall_id, m.name, m.category,
               m.price::float AS price, m.is_archived,
               (m.created_at AT TIME ZONE 'Asia/Kolkata')::date AS created_date
        FROM menu_item m
        """,
    )
    if not df.empty:
        df["created_date"] = pd.to_datetime(df["created_date"])
    return df


def _new_id() -> str:
    return uuid.uuid4().hex


def write_forecasts(conn: psycopg.Connection, rows: pd.DataFrame, model_version: str) -> int:
    """Insert forecast rows (stall_id, menu_item_id, forecast_date, predicted_quantity)."""
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO forecast_result
              (id, stall_id, menu_item_id, forecast_date, period, predicted_quantity, model_version, generated_at)
            VALUES (%s, %s, %s, %s, 'DAY', %s, %s, now())
            ON CONFLICT (menu_item_id, forecast_date, period, model_version)
            DO UPDATE SET predicted_quantity = EXCLUDED.predicted_quantity, generated_at = now()
            """,
            [
                (_new_id(), r.stall_id, r.menu_item_id, r.forecast_date, round(float(r.predicted_quantity), 2), model_version)
                for r in rows.itertuples()
            ],
        )
    return len(rows)


def replace_recommendations(conn: psycopg.Connection, rows: pd.DataFrame, model_version: str) -> int:
    """Replace all stored recommendations with this run's (user_id may be None)."""
    with conn.cursor() as cur:
        cur.execute("DELETE FROM recommendation_result")
        cur.executemany(
            """
            INSERT INTO recommendation_result (id, user_id, menu_item_id, rank, score, reason, model_version, generated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, now())
            """,
            [
                (_new_id(), None if pd.isna(r.user_id) else r.user_id, r.menu_item_id, int(r.rank), float(r.score),
                 r.reason, model_version)
                for r in rows.itertuples()
            ],
        )
    return len(rows)


def record_run(
    conn: psycopg.Connection,
    *,
    task: str,
    model_version: str,
    algorithm: str,
    metrics: dict,
    synthetic_share: float,
    train_rows: int,
    data_from: date,
    data_to: date,
) -> None:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO model_run
              (id, task, model_version, algorithm, metrics, synthetic_share, train_rows, data_from, data_to, created_at)
            VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, now())
            """,
            (_new_id(), task, model_version, algorithm, json.dumps(metrics), synthetic_share, train_rows, data_from, data_to),
        )

