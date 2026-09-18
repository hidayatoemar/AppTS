#!/usr/bin/env bash
# AppTS staging kernel provisioning.
# Mutating by design, bounded to the disposable AppTS staging host.
set -euo pipefail

EXPECTED_SHA="${1:?verified commit SHA required}"
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
if [ ! -f "$ARTIFACT" ]; then
  echo "artifact not found: $ARTIFACT"
  exit 2
fi

actual_artifact_sha="$(sha256sum "$ARTIFACT" | awk '{print $1}')"
if [ "$actual_artifact_sha" != "$EXPECTED_ARTIFACT_SHA" ]; then
  echo "artifact SHA256 mismatch"
  exit 2
fi

ensure_node22() {
  if command -v node >/dev/null 2>&1; then
    major="$(node -p 'process.versions.node.split(".")[0]')"
    if [ "$major" = "22" ]; then
      return 0
    fi
  fi

  sudo dnf -y module reset nodejs || true
  sudo dnf -y module enable nodejs:22
  sudo dnf -y install nodejs
}

ensure_node22

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$node_major" != "22" ]; then
  echo "Node.js 22 required, found $(node --version)"
  exit 3
fi

ROOT="/opt/appts-restore-service"
RELEASES="$ROOT/releases"
RELEASE="$RELEASES/$EXPECTED_SHA"
CURRENT="$ROOT/current"

sudo install -d -m 0755 "$RELEASES"

if [ -e "$RELEASE" ]; then
  if [ ! -f "$RELEASE/DEPLOYED_COMMIT" ] || [ "$(cat "$RELEASE/DEPLOYED_COMMIT")" != "$EXPECTED_SHA" ]; then
    echo "existing release path does not match expected immutable release identity"
    exit 4
  fi
  echo "release_state=ALREADY_PRESENT"
else
  workdir="$(mktemp -d)"
  trap 'rm -rf "$workdir"' EXIT
  tar -xzf "$ARTIFACT" -C "$workdir"
  test -f "$workdir/DEPLOYED_COMMIT"
  test "$(cat "$workdir/DEPLOYED_COMMIT")" = "$EXPECTED_SHA"
  test -f "$workdir/package.json"
  test -f "$workdir/dist/src/index.js"

  sudo install -d -m 0755 "$RELEASE"
  sudo cp -a "$workdir/." "$RELEASE/"
  sudo chown -R root:root "$RELEASE"
  sudo find "$RELEASE" -type d -exec chmod 0755 {} +
  sudo find "$RELEASE" -type f -exec chmod 0644 {} +
  echo "release_state=INSTALLED"
fi

sudo ln -sfn "$RELEASE" "$CURRENT"

node --input-type=module -e "
  const m = await import('file://$CURRENT/dist/src/index.js');
  if (!m || Object.keys(m).length === 0) throw new Error('kernel export surface empty');
  console.log('kernel_import_smoke=PASS exports=' + Object.keys(m).length);
"

echo "node_version=$(node --version)"
if command -v npm >/dev/null 2>&1; then
  echo "npm_version=$(npm --version)"
else
  echo "npm_version=NOT_REQUIRED_NOT_INSTALLED"
fi
echo "artifact_sha256=$actual_artifact_sha"
echo "deployed_commit=$(cat "$CURRENT/DEPLOYED_COMMIT")"
echo "current_target=$(readlink -f "$CURRENT")"
echo "provision_result=PASS"
