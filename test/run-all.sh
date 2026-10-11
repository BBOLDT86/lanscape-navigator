#!/bin/sh
# Build LANscape and run every test suite. Fixtures are made on first run.
# Chromium needs a UTF-8 locale to read file names such as "Tracker — Rev 3.html" (a desktop always has one).
export LANG=C.UTF-8 LC_ALL=C.UTF-8
cd "$(dirname "$0")/.." || exit 1
node build.js || exit 1
[ -d test/Workbench ] || python3 test/make-workbench.py
[ -d test/AllTypes ] || python3 test/make-alltypes.py
[ -d test/Movies ] || sh test/make-movies.sh
fail=0
for t in names-node.js mkv-node.js; do
  echo "== $t"; node "test/$t" | tail -1; node "test/$t" > /dev/null || fail=1
done
for t in dupes.js demo.js folders.js viewers.js spider2.js pinball.js mkv.js; do
  echo "== $t"
  out=$(timeout 600 node "test/$t" 2>&1); code=$?
  echo "$out" | grep -E "^FAIL|passed" | head -20
  [ $code -eq 0 ] || echo "$out" | grep -q " 0 failed" || fail=1
done
[ $fail -eq 0 ] && echo "ALL SUITES PASSED" || { echo "SOME SUITES FAILED"; exit 1; }
