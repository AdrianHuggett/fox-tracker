// wos-sync: copies alliance rosters and each member's map position from the whiteoutstats.com API into
// public.wos_players, which the site reads (Layout planner, Fortress rewards).
//
// Deployed from the Supabase dashboard (Edge Functions, "wos-sync", JWT verification on). The API key is the
// function secret WOS_API_KEY (set by Adrian in Edge Functions > Secrets); it never reaches the browser.
//
// Two ways in:
// - Background (pg_cron every 5 minutes, empty body, public anon key): keeps FOX and NGT fresh. A run does
//   nothing within 4 minutes of the previous one, refreshes both rosters once an hour and looks up at most 40
//   players whose position is missing or older than 6 hours.
// - On demand (body {tag, roster}): the Layout planner's per-alliance Sync button, for any alliance tag of
//   state 3685. Only a signed-in admin or R4 editor may ask (it spends Adrian's API quota). {roster: true}
//   refreshes the roster first; each call then looks up at most 30 positions older than 20 minutes and says
//   how many remain, so the page calls again until none remain.
// Free API key: 60 requests a minute and 5,000 a day; a 429 stops the run and is reported as `limited`.
import { createClient } from 'npm:@supabase/supabase-js@2';

const API = 'https://api.whiteoutstats.com/v1';
const KID = 3685;
const TAGS = ['FOX', 'NGT'];
const MIN_GAP_MS = 4 * 60 * 1000;
const ROSTER_EVERY_MS = 60 * 60 * 1000;
const STALE_MS = 6 * 60 * 60 * 1000;
const BATCH = 40;
const DEMAND_STALE_MS = 20 * 60 * 1000;
const DEMAND_BATCH = 30;
const CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 90 * 1000; // the API may wait up to 90 s for fresh data

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

Deno.serve(async (req) => {
  const key = Deno.env.get('WOS_API_KEY');
  if (!key) return json({ ok: false, error: 'WOS_API_KEY is not set' }, 500);
  const url = Deno.env.get('SUPABASE_URL')!;
  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const started = Date.now();
  const now = new Date(started).toISOString();
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { body = {}; }

  let limited = false;
  const errors: string[] = [];
  async function get(path: string) {
    const r = await fetch(API + path, { headers: { Authorization: 'Bearer ' + key }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (r.status === 429) limited = true;
    const data = await r.json().catch(() => ({}));
    return { status: r.status, body: data as Record<string, any> };
  }
  // One alliance roster: names, ranks, power. Members who left get alliance = null. Returns the member count.
  async function roster(tag: string): Promise<number> {
    const r = await get(`/alliances/${KID}/${encodeURIComponent(tag)}?include=info,roster`);
    const members: Record<string, any>[] = r.body.members ?? r.body.roster ?? r.body.alliance?.members ?? [];
    if (r.status !== 200 || !members.length) throw new Error(r.status === 404 ? 'not_found' : `${r.status} ${r.body.error ?? 'no members'}`);
    const rows = members.map((m) => ({
      chief_id: num(m.chief_id ?? m.fid), uid: num(m.uid), nick_name: String(m.nick_name ?? ''), alliance: tag,
      alliance_rank: rankOf(m), power: num(m.power), furnace_level: num(m.furnace_level), roster_at: now,
    })).filter((row) => row.chief_id !== null);
    const up = await db.from('wos_players').upsert(rows, { onConflict: 'chief_id' });
    if (up.error) throw new Error('save: ' + up.error.message);
    await db.from('wos_players').update({ alliance: null, alliance_rank: null }).eq('alliance', tag).lt('roster_at', now);
    return rows.length;
  }
  // Looks up the positions of these players, a few at a time, until the time budget is spent.
  async function positions(queue: { chief_id: number; alliance: string | null }[], budgetMs: number) {
    let looked = 0;
    async function worker() {
      while (queue.length && !limited && Date.now() - started < budgetMs) {
        const row = queue.shift()!;
        looked++;
        try {
          const r = await get(`/players/${row.chief_id}?include=base`);
          if (r.status === 404) { await db.from('wos_players').update({ x: null, y: null, pos_at: now }).eq('chief_id', row.chief_id); continue; }
          if (r.status !== 200) { errors.push(`player ${row.chief_id}: ${r.status} ${r.body.error ?? ''}`); continue; }
          const p = r.body.player ?? {};
          const patch: Record<string, unknown> = { x: num(p.x), y: num(p.y), pos_at: now };
          if (p.nick_name) patch.nick_name = String(p.nick_name);
          if (num(p.power) !== null) patch.power = num(p.power);
          if (num(p.furnace_level) !== null) patch.furnace_level = num(p.furnace_level);
          const abbr = p.alliance?.abbr;
          if (abbr !== undefined && String(abbr || '') !== String(row.alliance || '')) { patch.alliance = abbr ? String(abbr) : null; patch.alliance_rank = null; }
          await db.from('wos_players').update(patch).eq('chief_id', row.chief_id);
        } catch (e) { errors.push(`player ${row.chief_id}: ${(e as Error).message}`); }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    return looked;
  }

  // ---------- on demand: one alliance, for a signed-in admin or R4 editor ----------
  const tag = typeof body.tag === 'string' ? body.tag.trim() : '';
  if (tag) {
    if (!/^[\p{L}\p{N}]{1,5}$/u.test(tag)) return json({ ok: false, error: 'bad_tag' }, 400);
    const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: who } = await db.auth.getUser(jwt);
    if (!who?.user) return json({ ok: false, error: 'sign_in' }, 401);
    const { data: prof } = await db.from('profiles').select('is_admin, r4_editor').eq('id', who.user.id).maybeSingle();
    if (!prof?.is_admin && !prof?.r4_editor) return json({ ok: false, error: 'r4_only' }, 403);
    let members: number | null = null;
    if (body.roster) {
      try { members = await roster(tag); } catch (e) {
        const m = (e as Error).message;
        return json({ ok: false, error: m === 'not_found' ? 'not_found' : 'roster', detail: m, limited }, m === 'not_found' ? 404 : 502);
      }
    }
    const cutoff = new Date(started - DEMAND_STALE_MS).toISOString();
    const due = (state: string) => db.from('wos_players').select('chief_id, alliance', { count: 'exact' }).eq('alliance', tag).or(`pos_at.is.null,pos_at.lt.${state}`);
    const { data: todo } = await due(cutoff).order('pos_at', { ascending: true, nullsFirst: true }).limit(DEMAND_BATCH);
    const looked = await positions((todo ?? []) as { chief_id: number; alliance: string | null }[], 30 * 1000);
    const { count: remaining } = await due(cutoff).limit(1);
    const { count: total } = await db.from('wos_players').select('chief_id', { count: 'exact' }).eq('alliance', tag).limit(1);
    return json({ ok: true, tag, members: members ?? total ?? 0, looked_up: looked, remaining: remaining ?? 0, limited, errors });
  }

  // ---------- background (pg_cron): FOX and NGT ----------
  const { data: state } = await db.from('wos_sync_state').select('*').eq('id', 1).maybeSingle();
  if (state?.last_run && started - Date.parse(state.last_run) < MIN_GAP_MS) return json({ ok: true, skipped: 'ran less than 4 minutes ago' });
  await db.from('wos_sync_state').upsert({ id: 1, last_run: now });
  const out = { ok: true, rosters: {} as Record<string, number>, looked_up: 0, errors };
  if (!state?.roster_at || started - Date.parse(state.roster_at) >= ROSTER_EVERY_MS) {
    let allOk = true;
    for (const t of TAGS) {
      try { out.rosters[t] = await roster(t); } catch (e) { allOk = false; errors.push(`${t} roster: ${(e as Error).message}`); }
    }
    if (allOk) await db.from('wos_sync_state').update({ roster_at: now }).eq('id', 1);
  }
  const cutoff = new Date(started - STALE_MS).toISOString();
  const { data: due } = await db.from('wos_players').select('chief_id, alliance').in('alliance', TAGS)
    .or(`pos_at.is.null,pos_at.lt.${cutoff}`).order('pos_at', { ascending: true, nullsFirst: true }).limit(BATCH);
  out.looked_up = await positions((due ?? []) as { chief_id: number; alliance: string | null }[], 45 * 1000);
  if (limited) errors.push('rate limited (429): stopped early');
  await db.from('wos_sync_state').update({ last_error: errors.length ? errors.slice(0, 5).join(' | ') : null }).eq('id', 1);
  return json(out);
});
