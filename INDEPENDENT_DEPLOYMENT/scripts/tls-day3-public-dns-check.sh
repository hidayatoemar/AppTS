#!/usr/bin/env bash
set -euo pipefail
: "${INDEP_HOST:?INDEP_HOST is required}"
ROOT="$(git rev-parse --show-toplevel)"
E="$ROOT/INDEPENDENT_DEPLOYMENT/evidence/day3-dns-${GITHUB_RUN_ID:-manual}"
mkdir -p "$E"
HOSTNAME="dev.appts.cifo.id"

mapfile -t public_ips < <(getent ahostsv4 "$HOSTNAME" | awk '{print $1}' | sort -u)
mapfile -t target_ips < <(getent ahostsv4 "$INDEP_HOST" | awk '{print $1}' | sort -u)

resolves=false
match=false
if [ "${#public_ips[@]}" -gt 0 ]; then resolves=true; fi
for a in "${public_ips[@]:-}"; do
  for b in "${target_ips[@]:-}"; do
    if [ -n "$a" ] && [ "$a" = "$b" ]; then match=true; fi
  done
done

{
  echo "hostname=$HOSTNAME"
  echo "dns_resolves=$resolves"
  echo "dns_target_match=$match"
  echo "resolved_address_count=${#public_ips[@]}"
  for p in 80 443 8080 5432; do
    if timeout 3 bash -c "</dev/tcp/${INDEP_HOST}/${p}" >/dev/null 2>&1; then
      echo "pre_external_tcp_${p}=OPEN"
    else
      echo "pre_external_tcp_${p}=CLOSED_OR_FILTERED"
    fi
  done
} | tee "$E/01-dns-boundary.txt"

DISPOSITION=READY
BLOCKER=NONE
if [ "$resolves" != true ]; then
  DISPOSITION=STOP
  BLOCKER=CONTROLLED_HOSTNAME_DNS_NOT_RESOLVING
elif [ "$match" != true ]; then
  DISPOSITION=STOP
  BLOCKER=CONTROLLED_HOSTNAME_DNS_DOES_NOT_BIND_CURRENT_DT_TARGET
fi
if grep -Fxq 'pre_external_tcp_8080=OPEN' "$E/01-dns-boundary.txt" || grep -Fxq 'pre_external_tcp_5432=OPEN' "$E/01-dns-boundary.txt"; then
  DISPOSITION=STOP
  BLOCKER=DIRECT_INTERNAL_BACKEND_OR_DATABASE_PORT_PUBLICLY_REACHABLE
fi

{
  echo 'mcr_to_dt=020'
  echo 'authentication_gate=PASS_FROM_RUN_32696028493'
  echo "hostname=$HOSTNAME"
  echo "dns_check_disposition=$DISPOSITION"
  echo "first_blocker=$BLOCKER"
  echo 'public_activation=NOT_PERFORMED'
} | tee "$E/SUMMARY.txt"
