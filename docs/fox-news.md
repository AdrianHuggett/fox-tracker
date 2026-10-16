# FOX News

FOX News is a main navigation tab and the default page after sign-in. Dashboard
is the first section of My Prep. Reloads preserve the current tab.

Production articles live in `fox-news-data.js` as `window.FOX_NEWS_POSTS`.
Each article has a unique id, title, newline-separated bullet summary, HTTPS
source_url, ISO created_at publication date, category `game`, pinned boolean,
and a unique local banner filename (`news-*.png` or `news-*.webp`).
`fox-news.js` renders this public editorial content safely. There is no news
database or browser editor; updates are committed and deployed via GitHub Pages.
Supabase remains responsible for existing account and tracker features only.

Daily automation at 05:00 Indian/Mauritius checks Century Games and the official
wiki, deduplicates sources and subjects, writes concise English bullet summaries,
creates one relevant banner per new article and publishes verified changes.
Planned changes must be labelled accordingly. FOX messages stay on Discord.
Read full source articles and check dates; do not republish old material as new.

Before publishing: update cache tags (including fox-news-data.js), add an UPDATES
entry and translations, check JavaScript syntax, run desktop/mobile smoke checks
and `node tools/news-test.cjs`. Verify the commit-specific raw assets after push.
The test uses mock Supabase for accounts but the real production news data.
