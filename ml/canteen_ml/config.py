"""Runtime configuration, read from the environment (or the repo's .env)."""

from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env")

# Campus calendar decisions (demand dates, "today") use the same zone as the app.
CAMPUS_TZ = ZoneInfo("Asia/Kolkata")

# Orders in these states never count as demand (SRS §8.2: handled consistently).
EXCLUDED_STATUSES = ("CANCELLED", "REJECTED")


def database_url() -> str:
    """DATABASE_URL without Prisma-only query parameters that libpq rejects."""
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise SystemExit("DATABASE_URL is not set (export it or add it to the repo .env).")
    parts = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parts.query) if k not in {"schema", "connection_limit", "pgbouncer"}]
    return urlunsplit(parts._replace(query=urlencode(query)))
