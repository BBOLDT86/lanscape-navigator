#!/usr/bin/env bash
# Rebuild and publish the Brazil 2026 runoff desk: commit the data edits, pull what the Action pushed meanwhile,
# rebuild index.html, commit it and push. Safe to re-run.
#   brazil2026/updater/publish.sh "Brazil desk: results 19:40 BRT"
set -uo pipefail
cd "$(dirname "$0")/../.."
MSG="${1:-Brazil desk: update}"
TRAILER="${COMMIT_TRAILER:-}"   # optional attribution lines appended to every commit message
msg() { if [ -n "$TRAILER" ]; then printf '%s\n\n%s\n' "$1" "$TRAILER"; else printf '%s\n' "$1"; fi; }
GEN="brazil2026/index.html brazil2026/data/model.json"
git config user.name  >/dev/null 2>&1 || git config user.name "Brazil Desk updater"
git config user.email >/dev/null 2>&1 || git config user.email "election-desk@users.noreply.github.com"
git add brazil2026 2>/dev/null
git commit -q -F <(msg "$MSG (data)") >/dev/null 2>&1 || true
for i in 1 2 3; do
  if ! git pull --rebase origin main; then
    for f in $GEN; do git checkout --ours -- "$f" 2>/dev/null || true; git add "$f" 2>/dev/null || true; done
    GIT_EDITOR=true git rebase --continue || { git rebase --abort; echo "rebase failed" >&2; exit 1; }
  fi
  python3 brazil2026/build.py --check || { echo "build failed; nothing pushed" >&2; exit 1; }
  git add $GEN brazil2026/data 2>/dev/null
  git commit -q -F <(msg "$MSG") >/dev/null 2>&1 || true
  if git push -q origin HEAD:main; then echo "published: $(git rev-parse --short HEAD)"; exit 0; fi
  echo "push rejected, retrying ($i)"; sleep 5
done
echo "publish failed after 3 tries" >&2; exit 1
