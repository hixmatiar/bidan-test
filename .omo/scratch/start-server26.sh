#!/bin/zsh
# Starts the API for the task-26 live check on port 4226 (always backgrounded by the caller).
P="$(docker inspect sql_server_pikachen --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MSSQL_SA_PASSWORD=//p')"
cd "/Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan/backend" || exit 1
exec env PORT=4226 \
  DB_HOST=127.0.0.1 \
  DB_PORT=1433 \
  DB_NAME=PraktikBidan \
  DB_USER=sa \
  DB_PASSWORD="$P" \
  JWT_SECRET=task26-dev-secret-min-32-characters-long \
  WA_API_URL=http://127.0.0.1:1 \
  WA_API_TOKEN=x \
  node dist/server.js
