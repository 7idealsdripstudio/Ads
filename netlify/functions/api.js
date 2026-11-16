/* 7ideals Ads — API de l'application (réservée à l'administrateur). */
import { ipOf, pwOk, banned, fail, limited, newSession, session, secLog } from '../lib/auth.js';
import { err, adsState, adsCfg, adsCreate, adsSetStatus, adsAuto, adsCopy, adsLog } from '../lib/ads.js';
import { getJ, setJ, del } from '../lib/store.js';
export const config = { path: '/api/*' };
const J = (s, o, cookie) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...(cookie ? { 'set-cookie': cookie } : {}) } });
const body = async req => { const t = await req.text(); if (t.length > 100000) throw err(413, 'trop gros'); try { return t ? JSON.parse(t) : {}; } catch (e) { throw err(400, 'json'); } };
const num = x => +x || 0;
async function route(req) {
  const u = new URL(req.url), p = u.pathname, m = req.method, ip = ipOf(req);
  if (await banned(ip)) throw err(403, 'accès bloqué');
  if (m !== 'GET') {   // protection contre les requêtes envoyées depuis un autre site
    if (req.headers.get('x-app') !== '1') throw err(403, 'csrf');
    const o = req.headers.get('origin'); if (o && new URL(o).host !== u.host) throw err(403, 'csrf');
  }
  if (p === '/api/login' && m === 'POST') {
    if (await limited(ip)) throw err(429, 'Trop d’essais. Réessaie dans 15 minutes.');
    const d = await body(req);
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) throw err(500, 'ADMIN_PASSWORD manquant (12 caractères minimum)');
    if (pwOk(d.password)) { await secLog('Connexion', ip, true); return J(200, { ok: 1 }, await newSession()); }
    await fail(ip); await new Promise(r => setTimeout(r, 600)); throw err(401, 'Mot de passe incorrect');
  }
  const s = await session(req); if (!s) throw err(401, 'auth');
  if (p === '/api/logout' && m === 'POST') { await del(s.k); return J(200, { ok: 1 }, 'sid=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'); }
  if (p === '/api/ads' && m === 'GET') return J(200, await adsState());
  if (p === '/api/security' && m === 'GET') return J(200, { log: (await getJ('sec/log', [])).slice(0, 50) });
  if (m !== 'POST') throw err(404, 'introuvable');
  const d = await body(req);
  if (p === '/api/ads/cfg') { const c = await adsCfg(), urls = d.urls || {};
    const n = { capDay: Math.max(0, Math.min(1000, num(d.capDay))), cpa: Math.max(1, Math.min(500, num(d.cpa) || c.cpa)), roas: Math.max(0.5, Math.min(20, num(d.roas) || c.roas)), autoPause: d.autoPause ? 1 : 0, autoScale: d.autoScale ? 1 : 0,
      urls: { pelo: /^https:\/\//.test(urls.pelo || '') ? String(urls.pelo).slice(0, 300) : c.urls.pelo, '7ideals': /^https:\/\//.test(urls['7ideals'] || '') ? String(urls['7ideals']).slice(0, 300) : c.urls['7ideals'] } };
    await setJ('cfg', n); await adsLog(`Réglages : plafond ${n.capDay} € / jour, coût par vente visé ${n.cpa} €, rentabilité visée ${n.roas}.`); return J(200, { cfg: n }); }
  if (p === '/api/ads/copy') return J(200, await adsCopy(d.brand === '7ideals' ? '7ideals' : 'pelo', String(d.product || '').slice(0, 200)));
  if (p === '/api/ads/create') return J(200, await adsCreate(d));
  if (p === '/api/ads/status') return J(200, await adsSetStatus(String(d.id || '').replace(/\D/g, ''), !!d.on));
  if (p === '/api/ads/auto') return J(200, await adsAuto());
  throw err(404, 'introuvable');
}
export default async req => {
  try { return await route(req); }
  catch (e) { if (!e.status || e.status >= 500) console.error(e); return J(e.status || 500, { error: e.status && e.status < 500 || e.status === 502 ? e.message : 'erreur serveur' }); }
};
