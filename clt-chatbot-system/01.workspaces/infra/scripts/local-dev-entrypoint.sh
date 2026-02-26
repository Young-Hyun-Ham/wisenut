#!/bin/sh
set -euo pipefail

cd /app

pip install -r requirements.txt

python - <<'PY'
import os
import time
from sqlalchemy import create_engine
from sqlalchemy.exc import OperationalError

db_url = os.environ["DATABASE_URL"]
engine = create_engine(db_url, future=True)

print("waiting for database to become available...")
while True:
    try:
        with engine.connect():
            print("database connection established")
            break
    except OperationalError as exc:
        print(f"database not ready yet: {exc}")
        time.sleep(1)
PY

exec "$@"
