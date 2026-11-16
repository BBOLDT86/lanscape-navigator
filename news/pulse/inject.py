#!/usr/bin/env python3
"""Put The Pulse (news/pulse/pulse.js) on every page of The Watch.

Adds one <script defer> tag before </head> of every HTML page in the repository that does not have it yet. Pages
rebuilt by other workflows lose the tag until the next run of this script (pulse.yml runs it hourly and on every push);
pages that load the shared article.js / house.js / money.js / mandate.js / lessons.js also load pulse.js from there.

    python3 news/pulse/inject.py          # add the tag where missing
    python3 news/pulse/inject.py --check  # list pages without it, change nothing
    python3 news/pulse/inject.py --remove # take it off again
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TAG = '<script defer src="/lanscape-navigator/news/pulse/pulse.js"></script>'
MARK = 'news/pulse/pulse.js'
SKIP_DIRS = {'.git', '.github', 'node_modules', 'libs', 'src', 'test', 'LICENSES'}
SKIP_FILES = {
    os.path.join(ROOT, 'index.html'),          # LANscape Navigator itself: a file browser, not a page of The Watch
}
SKIP_NAMES = re.compile(r'(^|/)(render[\w-]*\.html|.*\.fragment\.html)$')


def pages():
    for dirpath, dirnames, filenames in os.walk(ROOT):
        rel = os.path.relpath(dirpath, ROOT)
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith('.')]
        if rel.split(os.sep)[0] in SKIP_DIRS:
            continue
        for f in filenames:
            if not f.endswith('.html'):
                continue
            p = os.path.join(dirpath, f)
            r = os.path.relpath(p, ROOT).replace(os.sep, '/')
            if p in SKIP_FILES or SKIP_NAMES.search(r) or r.startswith('news/pulse/'):
                continue
            yield p, r


# The translated sections also get news/i18n/lang.js (the same list as PAGES in news/i18n/translate.py). It is loaded
# in the head, not deferred, so a Portuguese reader never sees the English page flash by; pulse.js loads it as a
# fallback on pages a builder has just rewritten.
LANG_TAG = '<script src="/lanscape-navigator/news/i18n/lang.js"></script>'
LANG_MARK = 'news/i18n/lang.js'
LANG_DIRS = ('news/mandate/', 'news/eras/', 'news/prices/', 'news/prophecy/', 'news/wave/', 'news/money/',
             'news/sports/dressage-finals/', 'news/household/craftmas/')


def lang(mode):
    n = 0
    for p, r in pages():
        if not r.startswith(LANG_DIRS) or '/tools/' in r:
            continue
        try:
            s = open(p, encoding='utf-8').read()
        except (UnicodeDecodeError, OSError):
            continue
        if mode == 'remove':
            s2 = re.sub(r'\s*<script src="[^"]*news/i18n/lang\.js"></script>', '', s)
        elif LANG_MARK in s or 'data-wl-off' in s[:600]:
            continue
        else:
            m = re.search(r'</head\s*>', s, re.I)
            if not m:
                continue
            if mode == 'check':
                print('no lang.js:', r)
                n += 1
                continue
            s2 = s[:m.start()] + LANG_TAG + '\n' + s[m.start():]
        if s2 != s:
            open(p, 'w', encoding='utf-8').write(s2)
            n += 1
    print(f'lang.js: {"missing on" if mode == "check" else "removed from" if mode == "remove" else "added to"} {n} pages')


def main():
    mode = (sys.argv[1] if len(sys.argv) > 1 else '').lstrip('-')
    lang(mode)
    added = missing = removed = skipped = 0
    for p, r in pages():
        try:
            s = open(p, encoding='utf-8').read()
        except (UnicodeDecodeError, OSError):
            skipped += 1
            continue
        has = MARK in s
        if mode == 'remove':
            if has:
                s2 = re.sub(r'\s*<script defer src="[^"]*news/pulse/pulse\.js"></script>', '', s)
                if s2 != s:
                    open(p, 'w', encoding='utf-8').write(s2)
                    removed += 1
            continue
        if has:
            continue
        if 'data-pulse="off"' in s[:4000]:
            skipped += 1
            continue
        m = re.search(r'</head\s*>', s, re.I) or re.search(r'</body\s*>', s, re.I)
        if not m:
            skipped += 1
            continue
        if mode == 'check':
            print('missing:', r)
            missing += 1
            continue
        s = s[:m.start()] + TAG + '\n' + s[m.start():]
        open(p, 'w', encoding='utf-8').write(s)
        added += 1
    if mode == 'remove':
        print(f'pulse: removed from {removed} pages')
    elif mode == 'check':
        print(f'pulse: {missing} pages without the tracker ({skipped} skipped)')
        sys.exit(1 if missing else 0)
    else:
        print(f'pulse: added to {added} pages ({skipped} skipped)')


if __name__ == '__main__':
    main()
