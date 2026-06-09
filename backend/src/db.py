import os
import psycopg

_DATABASE_URL = os.environ.get("DATABASE_URL", "")


def get_connection():
    return psycopg.connect(_DATABASE_URL, autocommit=True, connect_timeout=5)


def healthcheck() -> bool:
    try:
        with get_connection() as conn:
            conn.execute("select 1")
        return True
    except Exception as exc:
        # Log the reason so a db:false (usually a bad pooler string) is diagnosable
        # in CloudWatch. "ERROR" prefix is caught by the metric filter.
        print(f"ERROR healthcheck failed: {exc}", flush=True)
        return False
