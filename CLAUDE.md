# FOX Prep Tracker: Claude Code project guide

_Handoff of 2 Oct 2026, checked against `main` at commit `6d3fcb2` (cache tag `20261002-r4load`)._
_Put this file at the repo root, and the `docs/` and `tools/` folders next to it. Keep them up to date as you work._

This is the entry point. Read it fully, then open the doc you need:

| File | What it covers |
|---|---|
| `docs/01-architecture.md` | Files, `app.js` code map (every function by section), CSS and phone-layout rules |
| `docs/02-database.md` | Supabase tables, RLS, grants, functions (exact SQL where known), schema-dump query |
| `docs/03-features.md` | What every tab does and the maths behind it (projection, free/day, exchanges, pack verdicts, R4, auth) |
| `docs/04-workflow.md` | Setup on Adrian's Windows PC, edit/test/deploy loop, SQL procedure, verification, commit style |
| `docs/05-history.md` | Change log and the decisions behind the current design |
| `docs/06-open-items.md` | What is pending, in priority order, with ready-to-use SQL/code where prepared |
| `tools/mock-supabase.js`, `tools/smoke_test.py` | Local test harness: the site runs against a fake Supabase in Playwright |

## The project in one paragraph

This is a static web app (no build) for the FOX alliance in Whiteout Survival (State #3685, FC5-Gen5). Each member logs their backpack (Have and Target per item) and the packs they have bought. The app projects where they will be on SvS day using measured free income, ranks packs by how well they close the member's gaps, and lets members plan in-game material exchanges. An R4 roles tab shows who leads or backs up each alliance task. Members log in with Supabase auth; all data lives in Supabase Postgres behind RLS.

| | |
|---|---|
| Live | https://adrianhuggett.github.io/fox-tracker/ (GitHub Pages from `main`, repo root) |
| Repo | https://github.com/AdrianHuggett/fox-tracker (public) |
| Backend | Supabase project `nhkyrurfcrorwbobqlrp` |
| Owner / only admin | Adrian (`profiles.is_admin = true`) |
| Users | About 5 alliance members |

## Rules for working with Adrian (always apply)

1. **Speak French with him. Everything in the repo is English**: UI text, code comments and commit messages.
2. **Be short.** Give the answer or the result first, in a few lines. No investigation diary.
3. **Supabase changes need his explicit "oui"** before anything runs: explain what will change in one or two sentences, then wait. This applies to additive changes too, and doubly to anything that deletes or rewrites data or loosens permissions.
4. **Secrets**: the anon key in `index.html` is public by design. Never ask for, read, print or store the **service role key** or the **DB password**; if a CLI needs them, Adrian types them himself. Never type passwords into anything for him, never create real accounts, and only use disposable test accounts that you delete afterwards.
5. **Every deploy bumps the cache tag** on both `style.css?v=` and `app.js?v=` in `index.html` (format `YYYYMMDD-short`).
6. **Every change members will notice gets a What's new entry, and its new texts get a row in `i18n-data.js`** (Spanish, Turkish, Norwegian; see `docs/03-features.md`, "Languages"). The What's new entries live in the `UPDATES` array in `app.js` (newest first, new unique `id`).
7. **Test before pushing**: syntax check plus `tools/smoke_test.py` at 1150px and 400px (see `docs/04-workflow.md`).
8. **Verify after pushing** against the commit-SHA raw URL, not the branch URL (the CDN caches it for minutes).
9. **Cost**: avoid dumping whole files into the conversation; read the parts you need. Say so when a task deserves a stronger model; otherwise stay economical.
10. On his tablet he prefers paste-ready code blocks to files.

## Fast orientation

- `index.html` holds the markup for every tab, plus `CONFIG` (Supabase URL and anon key) and the two cache-busted includes.
- `app.js` (about 1,450 lines) is one IIFE: state, maths, rendering, saving, auth. Entry point: `boot()` at the bottom.
- `style.css` (about 760 lines) is a dark theme using CSS variables (`--ice`, `--orange`, `--coral`, `--good`, `--muted`, `--faint`, `--line`, `--surface`, `--edit`, `--edit-b`, `--ink`, …). The phone layout lives under `@media (max-width:820px)`.
- Item art: `item-<slug>.png`, mapped by item name in `ITEM_ART` (`app.js`).

## Most likely next tasks

See `docs/06-open-items.md`. The top three:

1. Password reset by email is done: Adrian configured SMTP and the URL settings (confirmed 2 Oct 2026). The admin "temporary password" fallback in `docs/06-open-items.md` stays prepared but unapproved.
2. Move the site off the URL that contains Adrian's name. Recommended: a GitHub organization plus a repo transfer; waiting for the name he wants.
3. Confirm whether the in-game weekly exchange limits cap the quantity given or the quantity received.
