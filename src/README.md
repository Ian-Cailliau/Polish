# Source

- `app.html` – the whole app (single file, no framework). It is also the Claude artifact version; blocks between `<!--CLAUDE-ONLY-->` and `<!--/CLAUDE-ONLY-->` are removed for GitHub Pages.
- `build.py` – builds the GitHub Pages version into the repo root: `python3 src/build.py` (or `python3 src/build.py /some/out/dir`). Adds the iPhone/PWA head, service worker, icons, gist sync between devices, and the feedback button. Needs Pillow.
- `icon.png` – app icon source.
- `tests/` – Playwright checks (need `playwright-core`; set `CHROME` to a Chromium binary). Serve the built folder first, e.g. `python3 -m http.server 8765`.
  - `rounds.js PORT` – plays ~14 rounds and checks the six round rules (no card for a written term, no warm-up for a written term, easy direction never counted, a term counts once per round, no same answer twice in a round, review only when due).
  - `diagnose.js PORT` – wrong answers and the explanation each gets.
  - `feedback.js` / `feedback-round.js` (`PORT` env) – feedback button against a fake GitHub API.

Progress lives in localStorage `pl-test1` (term id → state), the open round in `pl-test1-round`, and is synced through a private gist (`pl-gh-token`, `pl-gh-gist`). Term ids are the keys of that progress: keep them stable.
