# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A static single-page web app — [www.istherepoopinit.com](http://www.istherepoopinit.com) — that looks up restaurant health inspection ratings by querying city-specific Socrata Open Data APIs. No build system, no package manager, no server.

## Development

To run locally, serve the root directory with any static HTTP server:

```bash
python3 -m http.server 8080
# or
npx serve .
```

There are no build steps, no tests, no linting tools configured.

## Architecture

All application logic lives in `rater.js` (jQuery, ~235 lines). `index.html` is a static shell with a search form and empty result containers that `rater.js` populates.

### Key data structure: `regions`

The `regions` object in `rater.js` is the single source of truth for every supported city. Each city key (e.g. `"SEA"`, `"NYC"`, `"SFO"`, `"LAC"`) maps to a positional array:

| Index | Meaning |
|-------|---------|
| 0 | Socrata API URL |
| 1 | Dataset field for restaurant name |
| 2 | Dataset field for business ID (dedup key) |
| 3 | Dataset field for grade/score |
| 4 | `WHERE` clause fragment |
| 5 | Object mapping grade values → rating image paths |
| 6 | Scale image path, or a plain string like `"0-100"` |
| 7 | URL for "More Details" authority link |
| 8 | URL for "Open Data Source" attribution |
| 9 | Dataset field for street address |
| 10 | Human-readable region name |

To add a new city: add a `<option>` in `index.html` and a matching entry in `regions` in `rater.js`.

### Request/response flow

1. Form submit → `$.ajax` GET to `userregion[0]` with `$select`, `$where`, `$q`, `$limit=500`, and the Socrata app token.
2. Results are deduplicated into `resultsmap` keyed by business ID (index 2) — this collapses multiple inspection records for the same location into one entry.
3. `resultsmap` is iterated to build table rows; grades are mapped to images via `ratings[resultgrade]` (index 5). If no image match, the raw grade string is shown.
4. The scale display checks whether index 6 contains a `.` to decide between showing an image or a plain text string.

### Vendored assets (do not edit)

- `dist/` — Bootstrap 4 CSS and JS, vendored directly.
- `lib/soda-js.bundle.js` and `lib/soda-js.js` — Socrata SODA client library, auto-generated (per `lib/README`).

## Known Issues / Open TODOs

From the README:
- Typeahead suggestions
- Performance improvements
- Better string searches (e.g. "The Ragtrader" ≈ "The Rag Trader")
- Fix casing for results list (title-case logic is commented out in `rater.js`)
- UX v2

## Deployment

Deployed via GitHub Pages. `CNAME` contains `www.istherepoopinit.com`. Push to `master` to deploy; no CI pipeline.
