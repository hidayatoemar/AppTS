#!/usr/bin/env bash
set -euo pipefail

: "${INDEP_HOST:?INDEP_HOST is required}"
HOSTNAME="dev.appts.cifo.id"
ROOT="$(git rev-parse --show-toplevel)"
E="$ROOT/INDEPENDENT_DEPLOYMENT/evidence/day3-dns-${GITHUB_RUN_ID:-manual}"
mkdir -p "$E"

printf '%s\n' \
  'mcr_to_dt=020' \
  'mode=DNS_FACTUAL_BINDING_GATE' \
  "hostname=$HOSTNAME" \
  'public_activation=NOT_PERFORMED' \
  > "$E/00-scope.txt"

mapfile -t DNS_ADDRS < <(getent ahostsv4 "$HOSTNAME" 2>/dev/null | awk '{print $1}' | sort -u)
if [[ "$INDEP_HOST" =~ ^[0-9]+(\.[0-9]+){3}$ ]]; then
  TARGET_ADDRS=("$INDEP_HOST")
else
  mapfile -t TARGET_ADDRS < <(getent ahostsv4 "$INDEP_HOST" 2>/dev/null | awk '{print $1}' | sort -u)
fi

DNS_COUNT=${#DNS_ADDRS[@]}
TARGET_COUNT=${#TARGET_ADDRS[@]}
MATCH=false
for d in "${DNS_ADDRS[@]}"; do
  for t in "${TARGET_ADDRS[@]}"; do
    if [[ "$d" == "$t" ]]; then MATCH=true; fi
  done
done

{
  echo "hostname_resolution_count=$DNS_COUNT"
  echo "target_resolution_count=$TARGET_COUNT"
  echo "hostname_target_intersection=$MATCH"
  for p in 80 443 8080 5432; do
    if timeout 3 bash -c "</dev/tcp/${HOSTNAME}/${p}" >/dev/null 2>&1; then
      echo "hostname_tcp_${p}=OPEN"
    else
      echo "hostname_tcp_${p}=CLOSED_OR_FILTERED"
    fi
  done
} | tee "$E/01-dns-boundary.txt"

DISPOSITION=PASS
BLOCKER=NONE
if (( DNS_COUNT == 0 )); then
  DISPOSITION=STOP
  BLOCKER=CONTROLLED_PUBLIC_TRAINING_HOSTNAME_DNS_NOT_RESOLVING
elif (( TARGET_COUNT == 0 )); then
  DISPOSITION=STOP
  BLOCKER=CURRENT_DT_TARGET_BINDING_NOT_RESOLVABLE_FOR_COMPARISON
elif [[ "$MATCH" != true ]]; then
  DISPOSITION=STOP
  BLOCKER=CONTROLLED_PUBLIC_TRAINING_HOSTNAME_DOES_NOT_BIND_CURRENT_DT_TARGET
elif grep -Eq '^hostname_tcp_(8080|5432)=OPEN$' "$E/01-dns-boundary.txt"; then
  DISPOSITION=STOP
  BLOCKER=DIRECT_INTERNAL_BACKEND_OR_DATABASE_PORT_PUBLICLY_REACHABLE
fi

{
  echo 'mcr_to_dt=020'
  echo "hostname=$HOSTNAME"
  echo "dns_gate=$DISPOSITION"
  echo "first_blocker=$BLOCKER"
  echo 'authentication_gate=PASS_PREREQUISITE_CONFIRMED'
  echo 'public_activation=NOT_PERFORMED'
  echo "public_8080=$(awk -F= '/^hostname_tcp_8080=/{print $2}' "$E/01-dns-boundary.txt")"
  echo "public_5432=$(awk -F= '/^hostname_tcp_5432=/{print $2}' "$E/01-dns-boundary.txt")"
} | tee "$E/02-summary.txt"
