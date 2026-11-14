#!/bin/zsh
set -u
BASE="http://127.0.0.1:4101/api/v1"
OUT="/Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan/.omo/scratch"

echo "=== 1. login bidan (correct) ==="
LOGIN=$(curl -s -X POST "$BASE/auth/login" -H 'content-type: application/json' -d '{"username":"bidan","password":"Bidan#2026"}' -w '\nHTTP_STATUS:%{http_code}')
echo "$LOGIN"
TOKEN=$(echo "$LOGIN" | head -1 | python3 -c 'import sys,json; print(json.load(sys.stdin)["data"]["token"])')
echo "$TOKEN" > "$OUT/token.txt"

echo "=== 2. refresh with token ==="
REFRESH=$(curl -s -X POST "$BASE/auth/refresh" -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" -w '\nHTTP_STATUS:%{http_code}')
echo "$REFRESH"

echo "=== 3. logout with token ==="
curl -s -X POST "$BASE/auth/logout" -H 'content-type: application/json' -H "Authorization: Bearer $TOKEN" -w '\nHTTP_STATUS:%{http_code}'
echo

echo "=== 4. missing token on /logout ==="
curl -s -X POST "$BASE/auth/logout" -H 'content-type: application/json' -w '\nHTTP_STATUS:%{http_code}'
echo

echo "=== 5. wrong password ==="
curl -s -X POST "$BASE/auth/login" -H 'content-type: application/json' -d '{"username":"bidan","password":"WrongPass#1"}' -w '\nHTTP_STATUS:%{http_code}'
echo

echo "=== 6. reset failed_attempts/lock before the 5-attempt run ==="
echo "UPDATE dbo.users SET failed_attempts = 0, locked_until = NULL WHERE username = 'bidan';" | "$OUT/dbq.sh"

echo "=== 7. five consecutive wrong passwords ==="
for i in 1 2 3 4 5; do
  echo "--- wrong attempt $i ---"
  curl -s -X POST "$BASE/auth/login" -H 'content-type: application/json' -d '{"username":"bidan","password":"WrongPass#1"}' -w '\nHTTP_STATUS:%{http_code}'
  echo
done

echo "=== 8. sixth attempt with CORRECT password ==="
curl -s -X POST "$BASE/auth/login" -H 'content-type: application/json' -d '{"username":"bidan","password":"Bidan#2026"}' -w '\nHTTP_STATUS:%{http_code}'
echo

echo "=== 9. clear lock and failed_attempts (restore seed state) ==="
echo "UPDATE dbo.users SET failed_attempts = 0, locked_until = NULL, updated_at = SYSDATETIME() WHERE username = 'bidan';" | "$OUT/dbq.sh"
echo "SELECT username, failed_attempts, locked_until FROM dbo.users WHERE username = 'bidan';" | "$OUT/dbq.sh"

echo "=== 10. reset/request existing username ==="
EXISTING=$(curl -s -X POST "$BASE/auth/reset/request" -H 'content-type: application/json' -d '{"username":"bidan"}' -w '\nHTTP_STATUS:%{http_code}')
echo "$EXISTING"

echo "=== 11. reset/request non-existing username ==="
MISSING=$(curl -s -X POST "$BASE/auth/reset/request" -H 'content-type: application/json' -d '{"username":"nobodyhere"}' -w '\nHTTP_STATUS:%{http_code}')
echo "$MISSING"

echo "=== 12. log_notifikasi OTP rows ==="
echo "SELECT notif_id, jenis, no_telepon, status, waktu_kirim, LEFT(pesan, 50) AS pesan FROM dbo.log_notifikasi WHERE jenis = 'OTP' ORDER BY created_at DESC;" | "$OUT/dbq.sh"

echo "=== 13. final login after restore ==="
curl -s -X POST "$BASE/auth/login" -H 'content-type: application/json' -d '{"username":"bidan","password":"Bidan#2026"}' -w '\nHTTP_STATUS:%{http_code}'
echo
