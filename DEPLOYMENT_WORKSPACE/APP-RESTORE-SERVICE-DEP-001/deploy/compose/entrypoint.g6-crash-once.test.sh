#!/bin/sh
set -eu

expected_sentinel='DEP-001-G6-CRASH-ONCE'
if [ "${DEP_G6_CRASH_ONCE:-}" != "$expected_sentinel" ]; then
  printf '%s\n' 'DEP G6 crash-once harness rejected: test configuration is not approved' >&2
  exit 78
fi

marker='/tmp/dep-g6-crash-once.marker'
if [ -e "$marker" ]; then
  exec /usr/local/bin/dep-entrypoint
fi

# Start the normal entrypoint as the child so its staging-label validation remains authoritative.
/usr/local/bin/dep-entrypoint &
api_pid=$!

attempt=0
max_attempts=30
healthy=0
while [ "$attempt" -lt "$max_attempts" ]; do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    break
  fi
  if node -e 'fetch("http://127.0.0.1:8080/healthz").then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))' >/dev/null 2>&1; then
    healthy=1
    break
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if [ "$healthy" -ne 1 ]; then
  kill -KILL "$api_pid" 2>/dev/null || true
  wait "$api_pid" 2>/dev/null || true
  exit 70
fi

marker_tmp="${marker}.$$"
( umask 077; : > "$marker_tmp" )
mv -f "$marker_tmp" "$marker"

kill -KILL "$api_pid" 2>/dev/null || true
wait "$api_pid" 2>/dev/null || true
exit 70
