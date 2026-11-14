#!/bin/zsh
set -e
P="$(docker inspect sql_server_pikachen --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MSSQL_SA_PASSWORD=//p')"
cd "/Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan/backend"
exec env PORT=4101 \
  DB_HOST=127.0.0.1 \
  DB_PORT=1433 \
  DB_NAME=PraktikBidan \
  DB_USER=sa \
  DB_PASSWORD="$P" \
  JWT_SECRET=test \
  WA_API_URL=http://127.0.0.1:1 \
  WA_API_TOKEN=x \
  node dist/server.js
