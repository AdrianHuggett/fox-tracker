const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
  'Cache-Control': 'no-store',
};
const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const fail = (error, message, status, extra = {}) => response({ ok: false, error, message, ...extra }, status);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const pick = (value, fields) => object(value) ? Object.fromEntries(fields.filter(k => value[k] !== undefined).map(k => [k, value[k]])) : null;
const retry = value => Math.min(86400, Math.max(30, Math.ceil(Number(value) || 30)));

// Keep source field names: later questionnaire steps must explicitly map known fields.
// In particular, absent values stay absent and arena defence is not a full roster.
export function snapshot(data, chiefId, stateId) {
  const player = data.player;
  if (!object(player)) throw new Error('invalid_response');
  const returnedId = String(player.chief_id ?? player.fid ?? data.chief_id ?? '');
  if (returnedId !== chiefId) throw new Error('identity_mismatch');
  if (String(player.kid) !== stateId) throw new Error('state_mismatch');
  if (typeof player.nick_name !== 'string' || !player.nick_name.trim()) throw new Error('invalid_response');
  // API sections have appeared at the wrapper and player level; do not merge conflicting copies.
  const section = key => data[key] ?? player[key];
  const heroes = section('heroes');
  const chiefGear = section('chief_gear');
  const troops = section('troops');
  const items = value => Array.isArray(value) ? value.slice(0, 100) : null;
  return {
    identity: { chiefId, stateId, name: player.nick_name.slice(0, 120),
      ...pick(player, ['uid', 'power', 'furnace_level', 'vip']),
      alliance: pick(player.alliance, ['abbr', 'name', 'rank', 'rank_label']) },
    source: { provider: 'WhiteoutStats', ...pick(data, ['fresh', 'cached_at', 'age_seconds', 'refresh', 'retry_after']) },
    heroes: Array.isArray(heroes) ? heroes.slice(0, 5).filter(object).map(h => ({
      ...pick(h, ['id', 'name', 'level', 'star', 'stars', 'star_label', 'quality', 'position', 'exclusive_gear_level']),
      skill_levels: items(h.skill_levels)?.map(s => pick(s, ['id', 'level'])) ?? null,
      exclusive_gear: pick(h.exclusive_gear, ['id', 'name', 'level', 'pve_skill_id', 'slg_skill_id']),
      gear: items(h.gear)?.map(g => pick(g, ['eid', 'sid', 'slot', 'name', 'quality', 'enhancement_level', 'refine_level'])) ?? null,
    })) : null,
    chief_gear: object(chiefGear) ? {
      hidden: typeof chiefGear.hidden === 'boolean' ? chiefGear.hidden : null,
      items: chiefGear.hidden === true ? null : items(chiefGear.items)?.map(g => pick(g, ['id', 'slot', 'name', 'quality', 'tier', 'star', 'strength_level', 'gems'])) ?? null,
    } : null,
    troops: items(troops)?.map(t => pick(t, ['type', 'tier', 'fire_crystal_level', 'troop_id'])) ?? null,
    troops_checked_at: section('troops_checked_at') ?? null,
  };
}

export function createHandler({ client, getKey, fetcher = fetch }) {
  return async function handle(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (req.method !== 'POST') return fail('method', 'Use POST.', 405);
    const authorization = req.headers.get('authorization') || '';
    if (!/^Bearer\s+\S+$/i.test(authorization)) return fail('auth', 'Sign in again to find your account.', 401);
    try {
      const text = await req.text();
      if (text.length > 256) return fail('input', 'Enter a valid State and Chief ID.', 400);
      let body;
      try { body = JSON.parse(text); } catch { return fail('input', 'Enter a valid State and Chief ID.', 400); }
      const chiefId = String(body?.chiefId ?? '').trim(), stateId = String(body?.stateId ?? '').trim();
      if (!/^[1-9]\d{0,14}$/.test(chiefId) || !/^[1-9]\d{0,5}$/.test(stateId)) return fail('input', 'Enter a valid State and Chief ID.', 400);
      const db = client(authorization);
      const user = await db.auth.getUser();
      if (user.error || !user.data?.user) return fail('auth', 'Sign in again to find your account.', 401);
      // RLS and the quota RPC independently require the owner of the private preview.
      const access = await db.from('private_feature_previews').select('id').eq('id', 'account-optimizer').eq('owner_id', user.data.user.id).maybeSingle();
      if (access.error || !access.data) return fail('access', 'This preview is not available for your account.', 403);
      const key = getKey();
      if (!key) return fail('unavailable', 'Account lookup is not available yet. Please try later.', 503);
      const quota = await db.rpc('claim_private_profile_lookup');
      if (quota.error || !quota.data) return fail('unavailable', 'Account lookup is not available yet. Please try later.', 503);
      if (!quota.data.allowed) return fail('limited', 'Please wait before searching again.', 429, { retryAfter: retry(quota.data.retry_after) });
      const upstream = await fetcher(`https://api.whiteoutstats.com/v1/players/${chiefId}?id_type=chief_id&include=base,heroes,chief_gear,troops&wait=20&max_age=3600`, {
        headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(30000), redirect: 'error',
      });
      if (upstream.status === 429) return fail('limited', 'WhiteoutStats is busy. Please try again later.', 429, { retryAfter: retry(upstream.headers.get('Retry-After')) });
      if (upstream.status === 404) return fail('not_found', 'No player found. Check your Chief ID and try again.', 404);
      const raw = await upstream.text();
      if (raw.length > 500000) return fail('upstream', 'The player response could not be read. Please try later.', 502);
      let data;
      try { data = JSON.parse(raw); } catch { return fail('upstream', 'WhiteoutStats could not answer. Please try later.', 502); }
      if (upstream.status === 202 || (upstream.ok && data.pending === true)) return response({ ok: false, error: 'pending', message: 'WhiteoutStats is finding this player. Please try again shortly.', retryAfter: retry(data.retry_after ?? upstream.headers.get('Retry-After')) }, 202);
      if (!upstream.ok || data.ok === false) return fail('upstream', 'WhiteoutStats could not answer. Please try later.', 502);
      try { return response({ ok: true, snapshot: snapshot(data, chiefId, stateId) }); }
      catch (e) {
        if (e.message === 'state_mismatch') return fail('state_mismatch', 'This Chief ID belongs to another State. Check both numbers and search again.', 409);
        return fail('upstream', 'The returned player could not be verified. Nothing was imported.', 502);
      }
    } catch (e) {
      return fail('unavailable', e.name === 'TimeoutError' || e.name === 'AbortError' ? 'The lookup timed out. Please try again.' : 'Account lookup failed. Please try again later.', 503);
    }
  };
}
