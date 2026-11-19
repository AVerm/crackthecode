# Crack the Code!

A solitaire deduction game for phones: find a three-digit code (each digit 1–5) by testing it against predicates that answer ⊤ or ⊥. Play it at [crackthe.xyz](https://crackthe.xyz).

## What is served

GitHub Pages publishes only the `www/` folder, through the workflow in `.github/workflows/pages.yml` (Settings → Pages → Source: GitHub Actions). It runs whenever a push changes `www/`. The folder holds:

- `index.html`: the whole game in one self-contained file, with no network requests.
- `404.html`: the page Pages shows for any address that does not exist, in the game's styles and theme.
- `manifest.webmanifest` and `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`: what phones use to install the game on the home screen.
- `sw.js`: the service worker that keeps an offline copy. It fetches from the network first, so online players always get the newest version; offline, or when the network takes over four seconds, it serves the last copy seen. Each build stamps a new version into it, which replaces the old copy.
- The icons: `favicon.svg` and `favicon.ico` for browser tabs and `apple-touch-icon.png` for phone home screens, each with a `-dark` twin the page switches to on a dark theme.

The custom domain, crackthe.xyz, is set in the Pages settings.

Saved games and settings live in each player's browser, per site address.

## Sources

`src/` is not served. `www/index.html` is built from it:

| File | What it is |
|---|---|
| `app.js` | The game: engine, screens, worksheet, generator, saving |
| `style.css` | All styles, including the themes |
| `template.html` | The page shell the script and styles are poured into |
| `404.html` | The not-found page's shell; the build pours the same styles into it |
| `sw.js` | The service worker; the build stamps the release's version into it |
| `library.json` | The 95 predicates and their checker cards |
| `tm_compat.json` | Turing Machine criteria and verification numbers mapped onto the library |
| `generate_puzzles.py` | Puzzle generator; the build uses it for the starter list, and it also runs on its own (`--help`) |
| `build.py` | Builds `www/index.html`, `www/404.html` and `www/sw.js` |
| `test.js` | Engine tests run against the built page |
| `icons/` | Sources for the home-screen icons, including the maskable one (the same art at 80%, so round masks never cut it) |

To rebuild and test (Python 3 and Node):

```
python3 src/build.py
node src/test.js
```

The build is deterministic: the same sources always give the same page. The tests print a summary and report any failure as a line starting `FAIL`.
