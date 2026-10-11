# LANscape Navigator

A serverless, 1990s-style web browser for the files on your own computer. Point it at a folder and it builds you a private little Internet: every page and document gets a domain name, similar pages are linked into web rings, a search engine indexes every word, and documents, music, video and photos open in programs of their own.

**Open it: <https://bboldt86.github.io/lanscape-navigator/>**

Everything runs in your browser. Your files are read on your own device and never uploaded; the index lives in your browser's own storage.

## What it does

- **Domain names for your files.** A page titled "Cayenne Tracker" lives at `www.cayennetracker.com`; a folder with an `index.html` becomes a multi-page website; every folder is also an FTP server.
- **Web rings.** Pages about the same thing are grouped and named automatically, with Prev / Random / Next to surf them (RingHub).
- **Search.** HyperHound ranks every word, with `"phrases"`, `-exclude`, `site:`, `ring:`, `intitle:` and spelling suggestions.
- **Copies and versions fold into one.** `v2`, `Rev 3`, `_final`, `(1)`, "Copy of", dated saves, copied website folders, the same song in MP3 and FLAC, a picture and its resized copy. The newest leads; older ones stay one click away at `/versions/`, with a **Compare** view. Fix anything in the Duplicate Finder.
- **Programs.** Write (`.docx`, `.rtf`, `.md`), Ledger (`.xlsx`, `.csv`), Reader (PDF with mark-ups), Jukebox and LANamp, Rewind (video, MKV included), Photo Album, Slide Show (`.pptx`), ZIP and Font viewers, Calculator, Notepad, and RingHub Pinball.
- **The Spider** reads pages that build their text with JavaScript and paints a preview of each one.

## Using it

1. Open the link above. Chrome or Edge on a computer works best.
2. **File › Add Folder…**, or drag a folder onto the window.
3. Surf from the home page: the Directory, Web Rings, HyperHound, What's New.

It also works offline: save `index.html` and open it from your disk.

| Browser | Notes |
| --- | --- |
| Chrome, Edge | Everything, including re-reading folders by themselves (**Re-sync**). |
| Firefox, Safari | Add folders with the folder picker or drag and drop; pick a folder again to bring in changes. |

## Building from source

The app is a single HTML file assembled from the pieces in `src/`:

```sh
node build.js        # writes index.html
```

`build.js` joins `src/*.js` in name order inside `src/00-head.html` and adds `libs/embedded-libs.html` (pdf.js and pdf-lib, compressed). GitHub Pages serves the `index.html` at the top of the repository, so rebuild and commit it after changing `src/`.

### Tests

The tests drive the app in Chromium with Playwright. They also need Python 3 (Pillow, python-docx, openpyxl, python-pptx, reportlab) and ffmpeg to make their test folders.

```sh
npm install
npx playwright install chromium
npm test
```

## Layout

```
index.html               the app: built, and what GitHub Pages serves
src/                     the source, joined in name order by build.js
libs/embedded-libs.html  pdf.js and pdf-lib, gzipped and base64-encoded
test/                    browser and Node tests, and the scripts that make their test folders
the-hinge/index.html     The Hinge, a separate page (see below)
```

## Also hosted here: The Hinge

**Open it: <https://bboldt86.github.io/lanscape-navigator/the-hinge/>**

A single-file, serverless forecast of the 2026 U.S. Senate, House and Ohio governor races. It blends three independent reads — a calibrated polling model, a history-only model built on presidential approval, real incomes and war, and live prices from Kalshi, Polymarket and PredictIt — and lets you change how much each one counts. Data were gathered on October 11, 2026; new polls can be added in the page's Tracker tab and are kept in your browser. It is not part of the LANscape app and is not affiliated with any campaign, party or exchange.

## Credits

PDF viewing uses [PDF.js](https://github.com/mozilla/pdf.js) (Apache 2.0) and mark-up export uses [pdf-lib](https://github.com/Hopding/pdf-lib) (MIT). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
