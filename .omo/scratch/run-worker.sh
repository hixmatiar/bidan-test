#!/bin/zsh
# usage: run-worker.sh <taskN> <marker> "<prompt>" "<model1 model2 ...>"
# Retries across free models; kills a worker whose log is frozen 120s.
# Success requires: marker at line start AND evidence file AND a new commit.
N=$1; MARK=$2; PROMPT=$3; MODELS=$4
REPO="/Users/pikachen/Documents/UNS/SEM 3/RSI/praktik-bidan"
EV=".omo/evidence/task-$N-praktik-bidan-monorepo.txt"
cd "$REPO" || exit 1
BASE=$(git rev-list --count HEAD)
for i in $(seq 1 15); do
  for m in ${=MODELS}; do
    log=".omo/evidence/task-$N-attempt-$i-${m}.log"
    opencode run --pure --dir "$REPO" -m "opencode/$m" "$PROMPT" > "$log" 2>&1 &
    pid=$!
    last=0; frozen=0; why=""
    for s in $(seq 1 900); do
      sleep 1
      cur=$(wc -c < "$log" 2>/dev/null | tr -d ' ')
      if grep -q "^$MARK" "$log" 2>/dev/null; then
        if [ -f "$EV" ] && [ "$(git rev-list --count HEAD)" -gt "$BASE" ]; then
          echo "SUCCESS attempt=$i model=$m"; exit 0
        fi
        why="marker without evidence/commit"
      fi
      if [ "$cur" = "$last" ]; then frozen=$((frozen+1)); else frozen=0; last=$cur; fi
      if [ $frozen -ge 150 ]; then why="stall bytes=$cur"; kill $pid 2>/dev/null; break; fi
      ps -p $pid >/dev/null 2>&1 || { why="exited"; break; }
    done
    kill $pid 2>/dev/null
    echo "RETRY attempt=$i model=$m reason=${why:-timeout}"
  done
done
echo "EXHAUSTED"; exit 1