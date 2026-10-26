# The Hinge: source

The page at `../index.html` is built from these files:

```sh
cd the-hinge/src
python3 v2/build_data2.py      # data/*.json + econ/derived.json -> v2/data2.js (the forecast, the money tab, the backtest)
python3 v2/build_html2.py      # template2.html + data2.js + engine.js + app_*.js -> ../index.html
```

`build_data2.py` imports `build_data.py` (the v1 model: polls, fundamentals, race files) and `v2/build_money.py`.
It needs Python 3 with numpy. Inputs the updater edits: `data/polls_compact.txt` (one JSON object per line; `race` is
the state abbreviation of one of the 12 modeled Senate races; Ohio governor polls live in `data/ohio.json`), `data/markets.json` (`current` prices),
`data/senate.json` and `data/races_compact.txt` (ratings and candidates). `data/money_*.json` and
`data/ad_scores.json` feed the Money tab. Every number in those files carries its source.

## The Brazil tab (`brazil/`, `v2/app_brazil.js`)

A post-mortem of Brazil's Oct. 25, 2026 presidential runoff: the polls and the markets against the TSE's count.

```sh
python3 brazil/fetch_tse.py      # the TSE's per-state files for both rounds -> brazil/tse_rounds.json (needs a network the TSE answers; the workflow runs it)
python3 brazil/build_brazil.py   # + ../../brazil2026/data/*.json + brazil/notes.json -> v2/brazil_data.js (numpy, scipy)
python3 v2/build_html2.py        # -> ../index.html
```

`.github/workflows/hinge-brazil.yml` does all three every two hours through Oct. 28 and on demand. `brazil/notes.json`
holds what the data files don't: prices and counts published during the night, Datafolha's record since 2014, the
three reads' defaults, the voting extension, the videos and the sources, each with its link.
