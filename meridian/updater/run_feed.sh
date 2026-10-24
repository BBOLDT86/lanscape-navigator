#!/usr/bin/env bash
# Meridian feed relay, run by .github/workflows/meridian.yml.
#
#   run_feed.sh relay [--notams]   one cycle every 5 minutes for about 5 h 20 min; the workflow then starts a fresh
#                                  run that carries on (GitHub caps a job at 6 hours)
#   run_feed.sh once  [--notams]   a single cycle (a manual run while a relay is already going)
#
# A cycle: bring in the published feed, pull weather and the fleet, publish the result to the meridian-feed branch as
# one orphan commit. GitHub's own cron is only a backstop that restarts the relay if it ever stops: it routinely fires
# scheduled runs late or not at all, so the relay keeps its own time.
set -u
MODE=${1:-relay}; shift || true
FIRST_EXTRA="$*"                              # --notams applies to the first cycle only
EVERY=${MERIDIAN_EVERY_SEC:-300}
SPAN=${MERIDIAN_SPAN_SEC:-19200}              # 5 h 20 min, well inside the 345-minute job timeout
END=$(( $(date +%s) + SPAN ))
FILES="wx.json notams.json live.json live_state.json"
REPO_URL="https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"
cd "${GITHUB_WORKSPACE:-.}"
mkdir -p feed

bring_in() {
  # Start each cycle from what is published, so a manual run in between (fresh NOTAMs, say) isn't overwritten.
  # If the fetch fails, keep the local copy rather than starting from nothing.
  if git fetch -q --depth 1 origin meridian-feed 2>/dev/null; then
    for f in $FILES; do
      if git cat-file -e "FETCH_HEAD:$f" 2>/dev/null; then git show "FETCH_HEAD:$f" > "feed/$f"; else rm -f "feed/$f"; fi
    done
  else
    echo "couldn't read the feed branch; carrying on from the local copy"
  fi
}

publish() {
  rm -rf pub && mkdir pub
  for f in $FILES; do [ -f "feed/$f" ] && cp "feed/$f" pub/; done
  printf '# Meridian live feed\n\nMachine-written by .github/workflows/meridian.yml on main. Do not edit; every cycle replaces this branch.\n' > pub/README.md
  ( cd pub &&
    git init -q -b meridian-feed &&
    git config user.name "Meridian feed updater" &&
    git config user.email "meridian-feed@users.noreply.github.com" &&
    git add -A &&
    git commit -qm "Meridian live feed $(date -u +%Y-%m-%dT%H:%MZ)" &&
    git push -q --force "$REPO_URL" HEAD:meridian-feed )
}

newer_relay() {
  # Another relay that started after this one and has been running for 10+ minutes (so it's past its own start-up
  # check) means two relays overlap; the older one bows out.
  gh api "repos/${GITHUB_REPOSITORY}/actions/workflows/meridian.yml/runs?status=in_progress&per_page=20" \
    --jq "[.workflow_runs[] | select(.run_number > ${GITHUB_RUN_NUMBER} and (now - (.run_started_at | fromdateiso8601)) > 600)] | length" \
    2>/dev/null || echo 0
}

cycle=0
while :; do
  t0=$(date +%s)
  extra=""; [ "$cycle" -eq 0 ] && extra="$FIRST_EXTRA"
  echo "::group::cycle $((cycle + 1)) at $(date -u +%H:%M:%SZ)"
  bring_in
  python3 meridian/updater/fetch_wx.py --out feed $extra || echo "::warning::weather pull failed; kept the last copy"
  python3 meridian/updater/fetch_live.py --out feed || echo "::warning::live pull failed; kept the last copy"
  publish || echo "::warning::publish failed; the next cycle tries again"
  echo "::endgroup::"
  cycle=$((cycle + 1))

  [ "$MODE" = once ] && break
  next=$(( t0 + EVERY ))
  [ "$next" -ge "$END" ] && { echo "ran $cycle cycles; handing off"; break; }
  if [ "$(newer_relay)" -gt 0 ]; then
    echo "a newer relay is running; this one stops here"
    [ -n "${GITHUB_OUTPUT:-}" ] && echo "yielded=true" >> "$GITHUB_OUTPUT"
    break
  fi
  wait_s=$(( next - $(date +%s) )); [ "$wait_s" -gt 0 ] && sleep "$wait_s"
done
exit 0
