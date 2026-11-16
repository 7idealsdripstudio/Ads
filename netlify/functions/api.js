/* 7ideals Ads — API de l'application (réservée à l'administrateur). Canaux gratuits uniquement : aucune pub payante ne peut partir d'ici. */
import { ipOf, pwOk, banned, fail, limited, newSession, session, secLog } from '../lib/auth.js';
import * as O from '../lib/organic.js';
import { getJ, del } from '../lib/store.js';
export const config = { path: '/api/*' };
const err = O.err;
const J = (s, o, cookie) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...(cookie ? { 'set-cookie': cookie } : {}) } });
const body = async req => { const t = await req.text(); if (t.length > 9e6) throw err(413, 'trop gros'); try { return t ? JSON.parse(t) : {}; } catch (e) { throw err(400, 'json'); } };
async function route(req) {
  const u = new URL(req.url), p = u.pathname, m = req.method, ip = ipOf(req);
  if (await banned(ip)) throw err(403, 'accès bloqué');
  if (m !== 'GET') { if (req.headers.get('x-app') !== '1') throw err(403, 'csrf'); const o = req.headers.get('origin'); if (o && new URL(o).host !== u.host) throw err(403, 'csrf'); }
  if (p === '/api/login' && m === 'POST') {
    if (await limited(ip)) throw err(429, 'Trop d’essais. Réessaie dans 15 minutes.');
    const d = await body(req); if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) throw err(500, 'ADMIN_PASSWORD manquant (12 caractères minimum)');
    if (pwOk(d.password)) { await secLog('Connexion', ip, true); return J(200, { ok: 1 }, await newSession()); }
    await fail(ip); await new Promise(r => setTimeout(r, 600)); throw err(401, 'Mot de passe incorrect');
  }
  const s = await session(req); if (!s) throw err(401, 'auth');
  if (m === 'GET' && p === '/api/state') {
    const st = await getJ('stats'), media = await getJ('media', []);
    return J(200, { missing: O.missing(), account: O.missing().length ? null : await O.account(), groq: !!process.env.GROQ_API_KEY, cfg: await O.cfg(), posts: (await O.posts()).filter(x => x.status === 'planned' || Date.now() - (x.at || x.when) < 30 * 86400000).slice(-80),
      media: media.map(x => ({ ...x, url: O.mediaUrl(x.id) })), stats: st ? st.media : [], statsAt: st ? st.at : 0, lessons: st ? O.lessons(st.media) : [], catalog: await O.catalog(), log: (await getJ('log', [])).slice(0, 25),
      feeds: { google: O.SITE() + '/feed/google.xml', pinterest: O.SITE() + '/feed/pinterest.xml' }, security: (await getJ('sec/log', [])).slice(0, 10) });
  }
  if (m !== 'POST') throw err(404, 'introuvable');
  if (p === '/api/logout') { await del(s.k); return J(200, { ok: 1 }, 'sid=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'); }
  const d = await body(req);
  if (p === '/api/cfg') return J(200, { cfg: await O.setCfg(d) });
  if (p === '/api/media') return J(200, await O.addMedia(d.brand, d.b64, d.w, d.h));
  if (p === '/api/media/del') return J(200, await O.delMedia(String(d.id || '')));
  if (p === '/api/plan') return J(200, await O.planWeek(d.brand === '7ideals' ? '7ideals' : 'pelo'));
  if (p === '/api/post') return J(200, await O.addPost(d));
  if (p === '/api/post/edit') return J(200, await O.editPost(d));
  if (p === '/api/caption') return J(200, { caption: await O.writeCaption(d.brand === '7ideals' ? '7ideals' : 'pelo', String(d.hint || '').slice(0, 300), Math.floor(Math.random() * 4)) });
  if (p === '/api/run') return J(200, await O.autoRun());
  if (p === '/api/stats') return J(200, await O.refreshStats());
  if (p === '/api/catalog') return J(200, await O.saveCatalog(d.items));
  throw err(404, 'introuvable');
}
export default async req => {
  try { return await route(req); }
  catch (e) { if (!e.status || e.status >= 500 && e.status !== 502) console.error(e); return J(e.status || 500, { error: e.status && (e.status < 500 || e.status === 502) ? e.message : 'erreur serveur' }); }
};
