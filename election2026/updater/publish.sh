#!/usr/bin/env bash
# Rebuild and publish Election Desk 2026 (and The Hinge if its data changed): commit the data edits, pull what the
# automated updater pushed meanwhile, rebuild the generated files, commit them and push. Safe to re-run.
#   election2026/updater/publish.sh "Election Desk: results 11:40 PM ET"
set -uo pipefail
cd "$(dirname "$0")/../.."
MSG="${1:-Election Desk: update}"
GEN="election2026/index.html election2026/data/model.json the-hinge/index.html the-hinge/src/v2/data2.js"
git config user.name  >/dev/null 2>&1 || git config user.name "Election Desk updater"
git config user.email >/dev/null 2>&1 || git config user.email "election-desk@users.noreply.github.com"
git add election2026/data the-hinge/src 2>/dev/null
git commit -qm "$MSG (data)" >/dev/null 2>&1 || true
for i in 1 2 3; do
  if ! git pull --rebase origin main; then
    # conflicts can only be in generated files: take upstream's copy, we rebuild below
    for f in $GEN; do git checkout --ours -- "$f" 2>/dev/null || true; git add "$f" 2>/dev/null || true; done
    GIT_EDITOR=true git rebase --continue || { git rebase --abort; echo "rebase failed" >&2; exit 1; }
  fi
  if [ -f the-hinge/src/v2/build_data2.py ] && [ "${REBUILD_HINGE:-0}" = "1" ]; then
    (cd the-hinge/src && python3 v2/build_data2.py >/dev/null && python3 v2/build_html2.py >/dev/null) || echo "warning: the Hinge did not rebuild" >&2
    python3 election2026/updater/hinge_numbers.py || true
  fi
  python3 election2026/build.py --check || { echo "build failed; nothing pushed" >&2; exit 1; }
  git add $GEN election2026/data 2>/dev/null
  git commit -qm "$MSG" >/dev/null 2>&1 || true
  if git push -q origin HEAD:main; then echo "published: $(git rev-parse --short HEAD)"; exit 0; fi
  echo "push rejected, retrying ($i)"; sleep 5
done
echo "publish failed after 3 tries" >&2; exit 1
