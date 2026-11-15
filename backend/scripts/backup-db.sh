#!/usr/bin/env bash
set -euo pipefail

# SQL Server native backup helper for PraktikBidan (dev/prod).
# Usage: DB_HOST=localhost DB_PORT=1433 DB_USER=sa DB_PASSWORD=*** DB_NAME=PraktikBidan ./backup-db.sh [full|log]
# Requires: sqlcmd (mssql-tools18) or docker exec access to sql_server_pikachen for local dev.

MODE="${1:-full}"
DB_NAME="${DB_NAME:-PraktikBidan}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-1433}"
DB_USER="${DB_USER:-sa}"
DB_PASSWORD="${DB_PASSWORD:-}"
OUT_DIR="${OUT_DIR:-/var/opt/mssql/backup}"
TS="$(date +%Y%m%d_%H%M%S)"

if [[ -z "$DB_PASSWORD" ]]; then
  echo "DB_PASSWORD is required" >&2
  exit 1
fi

mkdir -p "$OUT_DIR" 2>/dev/null || true

if [[ "$MODE" == "full" ]]; then
  FILE="$OUT_DIR/${DB_NAME}_full_${TS}.bak"
  SQL="BACKUP DATABASE [${DB_NAME}] TO DISK=N'${FILE}' WITH INIT, COMPRESSION, STATS=10;"
elif [[ "$MODE" == "log" ]]; then
  FILE="$OUT_DIR/${DB_NAME}_log_${TS}.trn"
  SQL="BACKUP LOG [${DB_NAME}] TO DISK=N'${FILE}' WITH INIT, COMPRESSION, STATS=10;"
else
  echo "Unknown mode: $MODE (use full|log)" >&2
  exit 1
fi

if command -v sqlcmd >/dev/null 2>&1; then
  sqlcmd -I -C -S "${DB_HOST},${DB_PORT}" -U "$DB_USER" -P "$DB_PASSWORD" -Q "$SQL"
elif command -v /opt/mssql-tools18/bin/sqlcmd >/dev/null 2>&1; then
  /opt/mssql-tools18/bin/sqlcmd -I -C -S "${DB_HOST},${DB_PORT}" -U "$DB_USER" -P "$DB_PASSWORD" -Q "$SQL"
else
  echo "sqlcmd not found; for local docker dev run inside container:" >&2
  echo "  docker exec sql_server_pikachen /opt/mssql-tools18/bin/sqlcmd -I -C -S localhost -U sa -P \"\$P\" -Q \"$SQL\"" >&2
  exit 2
fi

echo "Backup written: $FILE"
