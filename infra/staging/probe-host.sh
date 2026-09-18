#!/usr/bin/env bash
# AppTS staging host probe — READ ONLY.
# Purpose: verify deployment facts before any staging change.
# This script must not install packages, change services, edit files, or alter firewall/DNS.
set -u

DOMAIN="${APPTS_STAGING_DOMAIN:-staging.ts.cifo.id}"
EXPECTED_IP="${APPTS_STAGING_EXPECTED_IP:-103.127.99.11}"
APP_PATH="${APPTS_STAGING_APP_PATH:-/opt/appts-restore-service}"
LOCAL_PORT="${APPTS_STAGING_LOCAL_PORT:-8080}"

section() { printf '\n=== %s ===\n' "$1"; }
kv() { printf '%-28s %s\n' "$1" "$2"; }
have() { command -v "$1" >/dev/null 2>&1; }
safe_run() {
  local label="$1"; shift
  printf '%-28s ' "$label"
  if "$@" 2>/dev/null; then :; else printf '%s\n' "<unavailable-or-failed>"; fi
}
version_line() {
  local name="$1"; shift
  if have "$name"; then
    local out
    out="$("$@" 2>&1 | head -n 1)"
    kv "$name" "$out"
  else
    kv "$name" "<not-found>"
  fi
}

section "PROBE IDENTITY"
kv "probe_mode" "READ_ONLY"
kv "domain" "$DOMAIN"
kv "expected_public_ipv4" "$EXPECTED_IP"
kv "expected_app_path" "$APP_PATH"
kv "expected_local_port" "$LOCAL_PORT"
kv "utc_time" "$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || true)"
kv "hostname" "$(hostname 2>/dev/null || true)"
kv "kernel" "$(uname -srmo 2>/dev/null || true)"
kv "user" "$(id -un 2>/dev/null || true)"

section "OPERATING SYSTEM"
if [ -r /etc/os-release ]; then
  grep -E '^(NAME|VERSION|VERSION_ID|PRETTY_NAME)=' /etc/os-release || true
else
  kv "os-release" "<unavailable>"
fi
if have getenforce; then kv "selinux" "$(getenforce 2>/dev/null || true)"; fi

section "RUNTIME / WEB SERVER INVENTORY"
version_line python3 python3 --version
version_line node node --version
version_line npm npm --version
version_line caddy caddy version
version_line nginx nginx -v
if have httpd; then
  version_line httpd httpd -v
elif have apache2; then
  version_line apache2 apache2 -v
else
  kv "apache/httpd" "<not-found>"
fi
version_line docker docker --version
version_line podman podman --version
version_line systemctl systemctl --version

section "ACTIVE SERVICE / PROCESS SIGNALS"
if have systemctl; then
  systemctl --no-pager --plain --type=service --state=running 2>/dev/null \
    | awk 'BEGIN{IGNORECASE=1} /caddy|nginx|httpd|apache|docker|podman|python|node|appts/ {print}' \
    || true
else
  kv "systemctl" "<not-found>"
fi
if have ps; then
  ps -eo comm= 2>/dev/null | sort -u \
    | grep -Ei '^(caddy|nginx|httpd|apache2|dockerd|podman|python[0-9.]*|node)$' \
    || true
fi

section "LISTENING TCP PORTS"
if have ss; then
  ss -lnt 2>/dev/null || true
elif have netstat; then
  netstat -lnt 2>/dev/null || true
else
  kv "socket_tool" "<ss/netstat-not-found>"
fi

section "APPLICATION PATH"
if [ -e "$APP_PATH" ]; then
  kv "app_path_exists" "YES"
  safe_run "app_path_owner_mode" stat -c '%U:%G %a %F' "$APP_PATH"
  for f in package.json package-lock.json tsconfig.json README.md; do
    if [ -e "$APP_PATH/$f" ]; then kv "$f" "present"; else kv "$f" "absent"; fi
  done
else
  kv "app_path_exists" "NO"
fi

section "DNS"
if have getent; then
  safe_run "domain_ipv4_local_resolver" getent ahostsv4 "$DOMAIN"
else
  kv "getent" "<not-found>"
fi

if have python3; then
  APPTS_PROBE_DOMAIN="$DOMAIN" python3 - <<'PY' || true
import json
import os
import urllib.parse
import urllib.request

domain = os.environ["APPTS_PROBE_DOMAIN"]
providers = [
    ("google_doh_ipv4", "https://dns.google/resolve?" + urllib.parse.urlencode({"name": domain, "type": "A"}), {}),
    ("cloudflare_doh_ipv4", "https://cloudflare-dns.com/dns-query?" + urllib.parse.urlencode({"name": domain, "type": "A"}), {"Accept": "application/dns-json"}),
]
for label, url, headers in providers:
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as resp:
            doc = json.load(resp)
        answers = sorted({a.get("data") for a in doc.get("Answer", []) if a.get("type") == 1 and a.get("data")})
        print(f"{label:28} {' '.join(answers) if answers else '<no-A-answer>'}")
    except Exception:
        print(f"{label:28} <unavailable-or-failed>")
PY
else
  kv "dns_over_https" "<python3-not-found>"
fi

section "LOCAL HEALTH"
if have curl; then
  for path in /healthz /readyz; do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$LOCAL_PORT$path" 2>/dev/null || true)"
    kv "127.0.0.1:$LOCAL_PORT$path" "HTTP=${code:-000}"
  done
else
  kv "curl" "<not-found>"
fi

section "PUBLIC HTTP/TLS REACHABILITY"
if have curl; then
  for scheme in http https; do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "$scheme://$DOMAIN/" 2>/dev/null || true)"
    kv "$scheme://$DOMAIN/" "HTTP=${code:-000}"
  done
fi
if have openssl && have timeout; then
  cert_line="$(timeout 8 openssl s_client -connect "$DOMAIN:443" -servername "$DOMAIN" </dev/null 2>/dev/null \
    | openssl x509 -noout -subject -issuer -dates 2>/dev/null \
    | tr '\n' ';' || true)"
  kv "tls_certificate" "${cert_line:-<unavailable>}"
fi

section "HOST NETWORK"
if have ip; then
  ip -4 -brief addr show 2>/dev/null || true
  ip route show 2>/dev/null || true
fi

section "FIREWALL READBACK"
if have firewall-cmd; then
  safe_run "firewalld_state" firewall-cmd --state
  safe_run "firewalld_services" firewall-cmd --list-services
  safe_run "firewalld_ports" firewall-cmd --list-ports
else
  kv "firewall-cmd" "<not-found>"
fi

section "CAPACITY"
safe_run "disk_root" df -h /
if have free; then safe_run "memory" free -h; fi

section "SUMMARY"
kv "probe_completed" "YES"
kv "mutation_performed" "NO"
printf '%s\n' "Review this output before any install, service restart, firewall, DNS, TLS, or deployment action."
