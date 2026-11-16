/* 7ideals TV — programme public de la chaîne 01, repris de l'app Projets (lecture seule, mis en cache 5 min). */
export const config = { path: '/api/programme' };
const EMPTY = { items: [], cfg: { extra: [], off: [] } };
export default async () => {
  const base = (process.env.PROJETS_URL || 'https://projets.7idealsdripstudio.com').replace(/\/$/, '');
  let out = EMPTY;
  try {
    const r = await fetch(base + '/api/tv/public', { signal: AbortSignal.timeout(8000), headers: { accept: 'application/json' } });
    if (r.ok) { const j = await r.json(), ok = s => /^[\w-]{6,12}$/.test(String(s || ''));
      out = { items: (Array.isArray(j.items) ? j.items : []).filter(x => (x.src === 'yt' || x.src === 'vm') && ok(x.vid)).slice(0, 200).map(x => ({ id: String(x.id || '').slice(0, 40), src: x.src, vid: x.vid, title: String(x.title || '').slice(0, 200), place: String(x.place || '').slice(0, 200), dates: String(x.dates || '').slice(0, 80), dur: Math.max(1, Math.min(600, +x.dur || 10)), pos: +x.pos || 0 })),
        cfg: { extra: (j.cfg && Array.isArray(j.cfg.extra) ? j.cfg.extra : []).slice(0, 30).map(c => ({ k: String(c.k || '').slice(0, 40), n: String(c.n || '').slice(0, 60), city: String(c.city || '').slice(0, 60), list: String(c.list || '').replace(/[^\w-]/g, '').slice(0, 64) })).filter(c => c.k && c.list),
          off: (j.cfg && Array.isArray(j.cfg.off) ? j.cfg.off : []).map(String).slice(0, 50) } }; }
  } catch (e) {}
  return new Response(JSON.stringify(out), { headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60', 'netlify-cdn-cache-control': 'public, max-age=300, stale-while-revalidate=600' } });
};
