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
