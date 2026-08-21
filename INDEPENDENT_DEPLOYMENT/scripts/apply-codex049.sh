#!/usr/bin/env bash
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

BASE=7a813276bf5e4d5e73a48cc6276141f3b9b4d0c5
ARTIFACT_ID=9460248041
EXPECTED_ZIP_SHA=1a8b6a65cdc565f1d02976841def8cec81024839f635a26a364d6f7b950b5aa3
TMP="${RUNNER_TEMP:-/tmp}/dt-codex049"
ZIP="$TMP/CODEX049_DT_TRANSFER_v1.0_CONTROLLED.zip"

P1='DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/apps/api/src/trial/pre-ticket-trial-owner-flow.ts'
P2='DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/deploy/db/grant-runtime.sh'
P3='DEPLOYMENT_WORKSPACE/APP-RESTORE-SERVICE-DEP-001/tests/dep001/idempotency-minimum-runtime-writer.test.mjs'

rm -rf "$TMP"
mkdir -p "$TMP/extract"

git fetch --no-tags --deepen=100 origin experiment/independent-restore-deploy
git cat-file -e "$BASE^{commit}"
git merge-base --is-ancestor "$BASE" HEAD
git diff --quiet "$BASE" -- "$P1" "$P2" "$P3"

curl -L --fail-with-body -sS \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  -o "$ZIP" \
  "https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/artifacts/${ARTIFACT_ID}/zip"

echo "$EXPECTED_ZIP_SHA  $ZIP" | sha256sum -c -
unzip -q "$ZIP" -d "$TMP/extract"
(cd "$TMP/extract" && sha256sum -c SHA256SUMS)

rsync -a "$TMP/extract/overlay/" ./
printf 'post_copy_sha256:\n'
sha256sum "$P1" "$P2" "$P3"
printf '%s  %s\n' \
  'fa6a57a4bb50fdd63884d86ce43fe2b18137c3c0b0554b2b990d57d2771c6106' "$P1" \
  '41b48d45bb88c7e510a88235840b8601658d08e5347e9f7660419f7efc321f0f' "$P2" \
  'cba0366d557510b456e725198a38297dad30f5f1d2421e3f381ed032887ee32f' "$P3" | sha256sum -c -

expected="$(printf '%s\n' "$P1" "$P2" "$P3" | sort)"
actual="$(git diff --name-only | sort)"
printf 'admitted_paths:\n%s\nactual_changed_paths:\n%s\n' "$expected" "$actual"
# Every actual source change must be one of the three admitted paths. A path
# already byte-identical to the canonical overlay is a valid no-op application.
if [ -n "$actual" ]; then
  while IFS= read -r path; do
    printf '%s\n' "$expected" | grep -Fxq -- "$path"
  done <<< "$actual"
else
  echo 'BLOCKED: canonical overlay produced no source delta' >&2
  exit 2
fi

git add -- "$P1" "$P2" "$P3"
staged="$(git diff --cached --name-only | sort)"
printf 'staged_paths:\n%s\n' "$staged"
test "$staged" = "$actual"

git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git commit -m 'feat(experiment): apply admitted CODEX049 minimum runtime writer overlay'
git push origin HEAD:refs/heads/experiment/independent-restore-deploy

printf '%s\n' \
  "CODEX049_TRANSFER_SHA256=$EXPECTED_ZIP_SHA" \
  'CODEX049_OVERLAY_HASHES=PASS' \
  'CODEX049_CANONICAL_PATHS=3' \
  "CODEX049_CHANGED_PATHS=$(printf '%s\n' "$actual" | sed '/^$/d' | wc -l)" \
  'CODEX049_RESULT=PASS'
