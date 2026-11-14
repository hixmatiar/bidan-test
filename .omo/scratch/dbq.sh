#!/bin/zsh
P="$(docker inspect sql_server_pikachen --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MSSQL_SA_PASSWORD=//p')"
exec docker exec -i sql_server_pikachen /opt/mssql-tools18/bin/sqlcmd -I -C \
  -S localhost -U sa -P "$P" -d PraktikBidan -b -h -1 -W -s '|' "$@"
