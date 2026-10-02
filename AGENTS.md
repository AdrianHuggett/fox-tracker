# FOX Prep Tracker: instructions for AI coding agents

This file is for any AI agent (ChatGPT/Codex, Claude Code, others). The full project guide is in `CLAUDE.md`; the name is historical and the content applies to every agent.

Before changing anything:

1. Read `CLAUDE.md` completely: project summary, working rules, and the table of docs.
2. Open the doc you need in `docs/` (architecture, database, features, workflow, history, open items).

Rules that always apply (details in `CLAUDE.md`):

- Talk to Adrian in French. Everything in the repo (UI text, code comments, commit messages) is English.
- Any Supabase change (SQL, policies, settings) needs Adrian's explicit "oui" first, and he runs it himself in the Supabase dashboard.
- Never ask for, read or store the Supabase service role key, the database password, or any other password or token.
- Every deploy bumps the cache tag on `style.css?v=` and `app.js?v=` in `index.html`, and every member-visible change adds an entry to the `UPDATES` array in `app.js`.
- Test before pushing and verify after pushing, as described in `docs/04-workflow.md`.
