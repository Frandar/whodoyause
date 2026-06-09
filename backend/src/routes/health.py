from src import db


def handle(_event: dict) -> dict:
    ok = db.healthcheck()
    status_code = 200 if ok else 503
    return {
        "statusCode": status_code,
        "body": {"status": "ok" if ok else "error", "db": ok},
    }
