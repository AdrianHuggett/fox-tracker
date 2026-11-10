// wos-sync: copies the FOX and NGT rosters and each member's map position from the whiteoutstats.com API
// into public.wos_players, which the site reads (Layout planner, Fortress rewards).
//
// Deployed from the Supabase dashboard (Edge Functions, "wos-sync", JWT verification on). pg_cron calls it
// every 5 minutes with the public anon key; see docs/02-database.md. The API key is the function secret
// WOS_API_KEY (set by Adrian in Edge Functions > Secrets); it never reaches the browser.
//
// Budget (free API key: 60 requests/minute, 5,000/day): a run does nothing if the previous one started less
// than 4 minutes ago, refreshes the two rosters once an hour, and looks up at most 40 players whose position
// is missing or older than 6 hours. A full refresh of ~200 players costs ~800 requests a day.
import { createClient } from 'npm:@supabase/supabase-js@2';

const API = 'https://api.whiteoutstats.com/v1';
const KID = 3685;
const TAGS = ['FOX', 'NGT'];
const MIN_GAP_MS = 4 * 60 * 1000;
const ROSTER_EVERY_MS = 60 * 60 * 1000;
const STALE_MS = 6 * 60 * 60 * 1000;
const BATCH = 40;
const CONCURRENCY = 5;
const START_BUDGET_MS = 45 * 1000;   // no new lookup starts after this
const REQUEST_TIMEOUT_MS = 95 * 1000; // the API may wait up to 90 s for fresh data

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function rankOf(m: Record<string, unknown>): number | null {
  const n = num(m.alliance_rank ?? m.rank);
  if (n !== null && n >= 1 && n <= 5) return n;
  const label = String(m.alliance_rank_label ?? m.rank_label ?? '');
  const hit = /R\s*([1-5])/i.exec(label);
  return hit ? Number(hit[1]) : null;
}

Deno.serve(async () => {
  const key = Deno.env.get('WOS_API_KEY');
  if (!key) return json({ ok: false, error: 'WOS_API_KEY is not set' }, 500);
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const started = Date.now();
  const now = new Date(started).toISOString();

  const { data: state } = await db.from('wos_sync_state').select('*').eq('id', 1).maybeSingle();
  if (state?.last_run && started - Date.parse(state.last_run) < MIN_GAP_MS) return json({ ok: true, skipped: 'ran less than 4 minutes ago' });
  await db.from('wos_sync_state').upsert({ id: 1, last_run: now });

  let limited = false;
  const errors: string[] = [];
  async function get(path: string) {
    const r = await fetch(API + path, { headers: { Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (r.status === 429) limited = true;
    const body = await r.json().catch(() => ({}));
    return { status: r.status, body: body as Record<string, any> };
  }

  // 1. Rosters, once an hour: names, ranks, power. Members who left get alliance = null.
  const out = { ok: true, rosters: {} as Record<string, number>, looked_up: 0, positions: 0, errors };
  if (!state?.roster_at || started - Date.parse(state.roster_at) >= ROSTER_EVERY_MS) {
    let allOk = true;
    for (const tag of TAGS) {
      try {
        const r = await get(`/alliances/${KID}/${encodeURIComponent(tag)}?include=info,roster`);
        const members: Record<string, any>[] = r.body.members ?? r.body.roster ?? r.body.alliance?.members ?? [];
        if (r.status !== 200 || !members.length) { allOk = false; errors.push(`${tag} roster: ${r.status} ${r.body.error ?? 'no members'}`); continue; }
        const rows = members.map((m) => ({
          chief_id: num(m.chief_id ?? m.fid), uid: num(m.uid), nick_name: String(m.nick_name ?? ''), alliance: tag,
          alliance_rank: rankOf(m), power: num(m.power), furnace_level: num(m.furnace_level), roster_at: now,
        })).filter((row) => row.chief_id !== null);
        const up = await db.from('wos_players').upsert(rows, { onConflict: 'chief_id' });
        if (up.error) { allOk = false; errors.push(`${tag} save: ${up.error.message}`); continue; }
        await db.from('wos_players').update({ alliance: null, alliance_rank: null }).eq('alliance', tag).lt('roster_at', now);
        out.rosters[tag] = rows.length;
      } catch (e) { allOk = false; errors.push(`${tag} roster: ${(e as Error).message}`); }
    }
    if (allOk) await db.from('wos_sync_state').update({ roster_at: now }).eq('id', 1);
  }

  // 2. Positions: the players whose position is missing or oldest, a few at a time.
  const cutoff = new Date(started - STALE_MS).toISOString();
  const { data: due } = await db.from('wos_players').select('chief_id').in('alliance', TAGS)
    .or(`pos_at.is.null,pos_at.lt.${cutoff}`).order('pos_at', { ascending: true, nullsFirst: true }).limit(BATCH);
  const queue = (due ?? []).map((row: { chief_id: number }) => row.chief_id);
  async function worker() {
    while (queue.length && !limited && Date.now() - started < START_BUDGET_MS) {
      const id = queue.shift()!;
      out.looked_up++;
      try {
        const r = await get(`/players/${id}?include=base`);
        if (r.status === 404) { await db.from('wos_players').update({ x: null, y: null, pos_at: now }).eq('chief_id', id); continue; }
        if (r.status !== 200) { errors.push(`player ${id}: ${r.status} ${r.body.error ?? ''}`); continue; }
        const p = r.body.player ?? {};
        const x = num(p.x), y = num(p.y);
        const patch: Record<string, unknown> = { x, y, pos_at: now };
        if (p.nick_name) patch.nick_name = String(p.nick_name);
        if (num(p.power) !== null) patch.power = num(p.power);
        if (num(p.furnace_level) !== null) patch.furnace_level = num(p.furnace_level);
        const abbr = p.alliance?.abbr;
        if (abbr !== undefined && !TAGS.includes(String(abbr))) { patch.alliance = null; patch.alliance_rank = null; }
        await db.from('wos_players').update(patch).eq('chief_id', id);
        if (x !== null && y !== null) out.positions++;
      } catch (e) { errors.push(`player ${id}: ${(e as Error).message}`); }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (limited) errors.push('rate limited (429): stopped early');
  await db.from('wos_sync_state').update({ last_error: errors.length ? errors.slice(0, 5).join(' | ') : null }).eq('id', 1);
  return json(out);
});
