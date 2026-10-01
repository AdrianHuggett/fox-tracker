# 04 · Workflow: setup, edit, test, deploy

## One-time setup on Adrian's PC (Windows)

Adrian runs these himself; Claude Code can guide him.

1. Install **Git for Windows** (https://git-scm.com) and **Node.js LTS** (https://nodejs.org) if they are missing. Check with `git --version` and `node --version`.
2. Install Claude Code (`npm install -g @anthropic-ai/claude-code`, or the desktop app's Code tab).
3. Clone the repo:
   ```
   cd D:\WOS
   git clone https://github.com/AdrianHuggett/fox-tracker.git
   cd fox-tracker
   ```
   Pushing needs his GitHub login: Git Credential Manager opens a browser window the first time. He signs in himself.
4. Copy this handoff into the repo: `CLAUDE.md` at the root, `docs\` and `tools\` beside it. Commit them:
   `git add CLAUDE.md docs tools && git commit -m "Add project guide for Claude Code" && git push`
5. For tests (optional but recommended): `pip install playwright` then `python -m playwright install chromium`.
6. Optional: Supabase CLI (`npm install -g supabase`, then `supabase login`, `supabase link --project-ref nhkyrurfcrorwbobqlrp`). He enters any password himself.

## The edit loop

1. `git pull` first; GitHub web edits may have happened.
2. Make the change: edit the files directly and keep the diff minimal.
3. If members will notice it, add an `UPDATES` entry (new id `YYYY-MM-DD-short`).
4. Bump the cache tag in `index.html` (two places): `style.css?v=YYYYMMDD-short` and `app.js?v=YYYYMMDD-short`.
5. Check:
   ```
   node -e "new Function(require('fs').readFileSync('app.js','utf8'))"
   python tools/smoke_test.py            # desktop + phone screenshots in tools/out/
   ```
   Look at the screenshots of what you changed. Extend the mock data in `tools/mock-supabase.js` when a feature needs it.
6. Commit and push:
   ```
   git add -A && git commit -m "Short imperative subject" -m "Why, if not obvious." && git push
   ```
7. Verify: `git rev-parse HEAD`, then fetch `https://raw.githubusercontent.com/AdrianHuggett/fox-tracker/<sha>/index.html` and check the cache tag. **Do not trust the branch URL** (CDN cache). Pages usually updates within about two minutes; Adrian confirms on the live site, with a normal refresh.
8. Report to Adrian in French: what changed, what to check, and anything not tested.

## Commit style

Short imperative English subject ("Cap each gear exchange at its weekly limit"), optional body explaining why. Small commits are fine. History before 27 Sep has many "Update app.js" commits from the web editor; do not copy that style.

## Database changes

See `02-database.md` → "How to change the database". Order: SQL approved, then run, then verified, **then** push the front end that uses it.

## Testing harness

- `tools/mock-supabase.js` replaces the jsDelivr Supabase script. It provides an in-memory DB (`window.__DB`), a log of writes (`window.__log`), `from()` with select/eq/order/update/upsert/insert/delete/maybeSingle/single, `rpc()`, and `auth`. The session is a signed-in admin by default; set `window.__MOCK_NO_SESSION = true` before load to test the sign-in screen.
- `tools/smoke_test.py` serves the repo from `file://`, routes the Supabase CDN URL to the mock, blocks other network requests, opens every tab at 1150px and 400px, saves screenshots to `tools/out/`, and fails if any page error occurs.
- The mock is deliberately simple: it ignores RLS. **Permission logic must be reasoned about against `02-database.md`**, and tested by Adrian on the live site.

## Things that bit us before

- `checkAdmin()` is asynchronous; code that needs `ADMIN` at load time must react when it resolves (see the Members-refresh fix).
- A new row type inside `#stock` or `#packs` breaks the phone `nth-child` grid unless it has `!important` display overrides.
- Phone media-query order: an override placed **before** an equal-specificity rule loses.
- GitHub's web editor re-saved files as CRLF; `.gitattributes` fixes it. Do not commit CRLF.
- Items are joined by **name** across tables; renaming one silently breaks pack contents, baselines, art and exchanges.
