# Idea Forge — 500 games · 500 apps · 500 websites

A searchable, listenable catalog of **1500 buildable product ideas**, with full detail on every one:
core loop, the twist, why it's addictive, level structure and how it stays endless, controls,
art direction, first-60-seconds design, difficulty curve, long-term depth, a stack-specific
prototype plan, retention hooks, monetisation, pitfalls and a prior-art note.

**Live site:** https://linccodes.github.io/idea-forge/

---

## What's in the box

| Path | What it is |
|---|---|
| `index.html` | The catalog app — no build step, no dependencies |
| `css/styles.css` | Styling, dark/light themes, mobile-first responsive |
| `js/expand.js` | Expansion engine: turns compact idea cores into full detail records |
| `js/app.js` | Search, filters, TTS, copy, favourites, export, deep links |
| `data/games.js` | 500 mobile-first game ideas |
| `data/apps.js` | 500 app ideas |
| `data/websites.js` | 500 website ideas |
| `tools/validate.mjs` | Structural check across all 1500 entries |
| `tools/normalise.mjs` | Idempotent normaliser for the compact authoring format |
| `tools/smoke.mjs` | Expansion integrity + DOM wiring tests |
| `sw.js`, `manifest.json` | Offline cache + installable PWA |

## Features

- **Search** across every field — title, loop, twist, tags, stack, category — with match highlighting.
- **Filters**: section (Games / Apps / Websites / All), category, build stack, multi-select tags,
  favourites-only, not-yet-built.
- **Sort**: best match, A→Z, Z→A, by stack, by category.
- **Text-to-speech**: read a single idea section-by-section with the active section highlighted, or
  queue up to 40 visible results to read in sequence. Adjustable speed and voice selection.
- **Copy**: full details as plain text, Markdown or JSON; plus per-section copy buttons inside the panel.
- **Favourites** and a **built tracker** (mark ideas as prototyped) stored in `localStorage`.
- **Export**: JSON / CSV / Markdown / plain text, for current results, everything, or favourites only.
- **Deep links**: every idea has a shareable URL like `#/games/g001`.
- **Stats** dashboard, random idea picker, keyboard shortcuts, offline PWA.

### Keyboard shortcuts

| Key | Action |
|---|---|
| `/` | Focus search |
| `Esc` | Close panel / clear search |
| `J` `K` | Next / previous idea |
| `Enter` | Open focused card |
| `S` | Speak focused idea |
| `C` | Copy focused idea |
| `F` | Favourite |
| `B` | Mark built |
| `R` | Random idea |
| `T` | Toggle theme |
| `1`–`4` | Switch section |

## The data format

Ideas are authored as one compact pipe-delimited line each, so the catalog is easy to extend by hand:

```
id|title|category|stack|controls|art|hook|loop|twist|levels|spark|tags
```

`js/expand.js` expands each core into ~16 detail fields at load time, deterministically
(the same idea always expands to the same text). Long fields are composed from three independent
phrase pools so the phrasing varies rather than repeating.

- `stack` is one of `js`, `godot`, `flutter` — and the prototype plan is written for that stack.
- `controls` is one of `tap`, `drag`, `swipe`, `tilt`, `hold`, `twoThumb`, `typing`, `voice`, `camera`, `shake`.

### Adding an idea

1. Append a line to the relevant `data/*.js` array.
2. `node tools/normalise.mjs` — cleans up field-count slips.
3. `node tools/validate.mjs` — checks ids, titles, stacks, controls and field counts.
4. Refresh the page. Done.

## Local development

```bash
python3 -m http.server 8080     # then open http://localhost:8080
```

Opening `index.html` directly from the filesystem also works — everything is relative and there is
no build step. The service worker only registers over `http(s)`.

## Honest caveats

- These are **concepts, not clearances**. Uniqueness claims describe what makes each idea *different*,
  not a legal guarantee that nothing similar exists. Run a store search, a trademark search and a
  prior-art check before you invest in art, a name or a launch.
- Store rules change constantly. Verify current App Store / Play Store policy before shipping.
- No idea here requires a server. That is deliberate: it keeps prototypes cheap and shipping fast.
- Monetisation suggestions are described, not endorsed. Several entries deliberately recommend
  shipping with no monetisation at all.
