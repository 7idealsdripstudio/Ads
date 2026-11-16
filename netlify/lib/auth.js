/* 7ideals Ads — accès réservé à l'administrateur : mot de passe (ADMIN_PASSWORD), session 12 h, limite d'essais, blocage 24 h des adresses qui insistent. */
import crypto from 'node:crypto';
import { getJ, setJ, del } from './store.js';
import { notify } from './notify.js';
const H = s => crypto.createHash('sha256').update(String(s)).digest('hex');
export const ipOf = req => String(req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for') || '?').split(',')[0].trim().slice(0, 64);
export function pwOk(p) {
  const pw = process.env.ADMIN_PASSWORD || ''; if (pw.length < 12) return false;
  const salt = crypto.randomBytes(16);
  return crypto.timingSafeEqual(crypto.scryptSync(String(p || '').slice(0, 200), salt, 64), crypto.scryptSync(pw, salt, 64));
}
export async function secLog(ev, ip, alert) { const l = await getJ('sec/log', []); l.unshift({ t: Date.now(), ev, ip }); await setJ('sec/log', l.slice(0, 200)); if (alert) await notify('🛡️ 7ideals Ads', ev + ' — IP ' + ip, 'shield'); }
export async function banned(ip) { const b = await getJ('sec/ban/' + H(ip).slice(0, 32)); return !!(b && b.until > Date.now()); }
export async function fail(ip) {   // un échec de connexion de plus ; renvoie true si l'adresse doit attendre
  const k = 'sec/rl/' + H(ip).slice(0, 32), n = Date.now(), a = (await getJ(k, [])).filter(t => n - t < 86400000); a.push(n); await setJ(k, a.slice(-50));
  if (a.length === 10) { await setJ('sec/ban/' + H(ip).slice(0, 32), { until: n + 86400000, ip }); await secLog('Adresse bloquée 24 h après 10 échecs de connexion', ip, true); }
  else await secLog('Échec de connexion', ip, a.length >= 3);
  return a.filter(t => n - t < 900000).length >= 5;
}
export async function limited(ip) { const n = Date.now(); return (await getJ('sec/rl/' + H(ip).slice(0, 32), [])).filter(t => n - t < 900000).length >= 5; }
export async function newSession() { const t = crypto.randomBytes(32).toString('base64url'); await setJ('sess/' + H(t), { exp: Date.now() + 12 * 3600000 }); return `sid=${t}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${12 * 3600}`; }
export async function session(req) {
  const m = /(?:^|;\s*)sid=([\w-]+)/.exec(req.headers.get('cookie') || ''); if (!m) return null;
  const k = 'sess/' + H(m[1]), s = await getJ(k); if (!s) return null; if (s.exp < Date.now()) { await del(k); return null; } return { k };
}
