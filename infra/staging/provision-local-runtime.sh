#!/usr/bin/env bash
# AppTS local-only staging runtime provisioning.
# Mutating by design, bounded to the disposable AppTS staging host.
set -euo pipefail

EXPECTED_SHA="${1:?candidate commit SHA required}"
ARTIFACT="${2:?artifact path required}"
EXPECTED_ARTIFACT_SHA="${3:?artifact SHA256 required}"

if [[ ! "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "invalid commit SHA"
  exit 2
fi
if [[ ! "$EXPECTED_ARTIFACT_SHA" =~ ^[0-9a-f]{64}$ ]]; then
  echo "invalid artifact SHA256"
  exit 2
fi
test -f "$ARTIFACT"

actual_artifact_sha="$(sha256sum "$ARTIFACT" | awk '{print $1}')"
test "$actual_artifact_sha" = "$EXPECTED_ARTIFACT_SHA"
test "$(node -p 'process.versions.node.split(".")[0]')" = "22"

ROOT="/opt/appts-restore-service"
RELEASES="$ROOT/releases"
RELEASE="$RELEASES/$EXPECTED_SHA"
CURRENT="$ROOT/current"
CONFIG_ROOT="/etc/appts-restore-service"
DATA_ROOT="/var/lib/appts-restore-service/runtime"

sudo install -d -m 0755 "$RELEASES"

if [ -e "$RELEASE" ]; then
  test -f "$RELEASE/DEPLOYED_COMMIT"
  test "$(cat "$RELEASE/DEPLOYED_COMMIT")" = "$EXPECTED_SHA"
  echo "release_state=ALREADY_PRESENT"
else
  workdir="$(mktemp -d)"
  trap 'rm -rf "$workdir"' EXIT
  tar -xzf "$ARTIFACT" -C "$workdir"
  test "$(cat "$workdir/DEPLOYED_COMMIT")" = "$EXPECTED_SHA"
  test -f "$workdir/dist/src/staging/main.js"
  test -f "$workdir/infra/staging/appts-restore-service-local.service"
  test -f "$workdir/infra/staging/synthetic-trial-fixture.example.json"

  sudo install -d -m 0755 "$RELEASE"
  sudo cp -a "$workdir/." "$RELEASE/"
  sudo chown -R root:root "$RELEASE"
  sudo find "$RELEASE" -type d -exec chmod 0755 {} +
  sudo find "$RELEASE" -type f -exec chmod 0644 {} +
  echo "release_state=INSTALLED"
fi

if ! getent group appts-runtime >/dev/null 2>&1; then
  sudo groupadd --system appts-runtime
fi
if ! id appts-runtime >/dev/null 2>&1; then
  sudo useradd --system --gid appts-runtime --home-dir /var/lib/appts-restore-service --shell /sbin/nologin appts-runtime
fi

sudo install -d -o root -g appts-runtime -m 0750 "$CONFIG_ROOT"
sudo install -d -o appts-runtime -g appts-runtime -m 0750 "$DATA_ROOT"

config_tmp="$(mktemp)"
cat > "$config_tmp" <<'JSON'
{
  "profile": "SYNTHETIC_TRIAL_LOCAL_ONLY",
  "bindAddress": "127.0.0.1",
  "port": 8080,
  "dataDir": "/var/lib/appts-restore-service/runtime",
  "trialFixturePath": "/etc/appts-restore-service/synthetic-trial-fixture.json"
}
JSON
sudo install -o root -g appts-runtime -m 0640 "$config_tmp" "$CONFIG_ROOT/runtime.json"
rm -f "$config_tmp"

sudo install -o root -g appts-runtime -m 0640   "$RELEASE/infra/staging/synthetic-trial-fixture.example.json"   "$CONFIG_ROOT/synthetic-trial-fixture.json"
sudo install -o root -g root -m 0644   "$RELEASE/infra/staging/appts-restore-service-local.service"   /etc/systemd/system/appts-restore-service-local.service

sudo ln -sfn "$RELEASE" "$CURRENT"
sudo systemctl daemon-reload
sudo systemctl enable appts-restore-service-local.service >/dev/null
sudo systemctl restart appts-restore-service-local.service
sudo systemctl is-active --quiet appts-restore-service-local.service

node --input-type=module <<'NODE'
for (let attempt = 0; attempt < 30; attempt += 1) {
  try {
    const health = await fetch("http://127.0.0.1:8080/healthz");
    const ready = await fetch("http://127.0.0.1:8080/readyz");
    if (health.ok && ready.ok) {
      console.log("local_runtime_readiness=PASS");
      process.exit(0);
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 500));
}
console.error("local_runtime_readiness=TIMEOUT");
process.exit(1);
NODE

listener="$(ss -lntH | awk '{print $4}' | grep -E '(^|])?:8080$' || true)"
test "$listener" = "127.0.0.1:8080"
test -z "$(ss -lntH | awk '{print $4}' | grep -E '(^|:)(80|443)$' || true)"

echo "artifact_sha256=$actual_artifact_sha"
echo "deployed_commit=$(cat "$CURRENT/DEPLOYED_COMMIT")"
echo "current_target=$(readlink -f "$CURRENT")"
echo "local_runtime_listener=$listener"
echo "provision_local_runtime=PASS"
