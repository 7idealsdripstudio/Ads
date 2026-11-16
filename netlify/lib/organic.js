/* 7ideals Ads — canaux gratuits : publications Instagram + Facebook (API officielle de Meta, sans pub payante), flux Google Shopping (annonces gratuites) et flux Pinterest (épingles automatiques). */
import crypto from 'node:crypto';
import { db, getJ, setJ } from './store.js';
import { notify } from './notify.js';
export const err = (code, msg) => Object.assign(new Error(msg || 'error'), { status: code });
const VER = () => process.env.META_API_VERSION || 'v26.0', BASE = () => (process.env.META_GRAPH_BASE || 'https://graph.facebook.com').replace(/\/$/, '');
const TOKEN = () => process.env.META_TOKEN || process.env.META_ADS_TOKEN || '';
export const SITE = () => (process.env.URL || 'https://7ideals-ads.netlify.app').replace(/\/$/, '');
export const missing = () => TOKEN() ? [] : ['META_TOKEN'];
async function graph(path, params = {}, method = 'GET', token) {
  const tok = token || TOKEN(); if (!tok) throw err(400, 'Clé Meta manquante (META_TOKEN)');
  const flat = Object.fromEntries(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]));
  let url = `${BASE()}/${VER()}/${path}`, opt = { method, signal: AbortSignal.timeout(25000) };
  if (method === 'GET') url += '?' + new URLSearchParams({ ...flat, access_token: tok });
  else opt = { ...opt, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...flat, access_token: tok }) };
  const r = await fetch(url, opt), j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { const e = j.error || {}; throw err(502, 'Meta : ' + String(e.error_user_msg || e.message || 'HTTP ' + r.status).slice(0, 300)); }
  return j;
}
async function ids() {   // retrouve seul la page Facebook et le compte Instagram reliés à la clé (META_PAGE_ID / META_IG_ID restent possibles)
  const c = await getJ('ids'); if (c && c.page && Date.now() - c.at < 7 * 86400000) return c;
  let page = process.env.META_PAGE_ID || '', ig = process.env.META_IG_ID || '', name = '';
  if (!page) { const a = ((await graph('me/accounts', { fields: 'id,name,instagram_business_account', limit: 25 })).data || []); const pick = a.find(x => /7\s*ideals|drip/i.test(x.name)) || a.find(x => x.instagram_business_account) || a[0]; if (!pick) throw err(400, 'Aucune page Facebook n’est reliée à la clé Meta'); page = pick.id; name = pick.name; if (!ig && pick.instagram_business_account) ig = pick.instagram_business_account.id; }
  if (!ig) { const j = await graph(page, { fields: 'name,instagram_business_account' }); name = name || j.name; ig = (j.instagram_business_account || {}).id || ''; }
  const o = { page, ig, name, at: Date.now() }; await setJ('ids', o); return o;
}
export async function account() { try { const i = await ids(); let u = ''; if (i.ig) { try { u = (await graph(i.ig, { fields: 'username' })).username || ''; } catch (e) {} } return { page: i.name, ig: u, igOk: !!i.ig }; } catch (e) { return { error: e.message }; } }
async function pageToken() {   // la page Facebook se publie avec sa propre clé, obtenue à partir de la clé principale
  const c = await getJ('pagetok'); if (c && c.exp > Date.now()) return c.t;
  const j = await graph((await ids()).page, { fields: 'access_token' }); if (!j.access_token) throw err(502, 'Meta : pas d’accès à la page Facebook');
  await setJ('pagetok', { t: j.access_token, exp: Date.now() + 6 * 3600000 }); return j.access_token;
}
export async function log(msg) { const l = await getJ('log', []); l.unshift({ t: Date.now(), msg: String(msg).slice(0, 300) }); await setJ('log', l.slice(0, 200)); }

/* ---- réglages ---- */
const DEF = { auto: 0, perWeek: 3, nets: { ig: 1, fb: 1 }, brands: { pelo: 1, '7ideals': 1 }, urls: { pelo: 'https://boutique-pelo.netlify.app', '7ideals': '' } };
export async function cfg() { const c = await getJ('cfg2', {}); return { ...DEF, ...c, nets: { ...DEF.nets, ...(c.nets || {}) }, brands: { ...DEF.brands, ...(c.brands || {}) }, urls: { ...DEF.urls, ...(c.urls || {}) } }; }
export async function setCfg(d) {
  const c = await cfg(), u = d.urls || {}, ok = s => /^https:\/\/[^\s]+$/.test(s || '');
  const n = { auto: d.auto ? 1 : 0, perWeek: Math.max(1, Math.min(7, Math.round(+d.perWeek || c.perWeek))), nets: { ig: d.nets && d.nets.ig ? 1 : 0, fb: d.nets && d.nets.fb ? 1 : 0 }, brands: { pelo: d.brands && d.brands.pelo ? 1 : 0, '7ideals': d.brands && d.brands['7ideals'] ? 1 : 0 },
    urls: { pelo: ok(u.pelo) ? String(u.pelo).slice(0, 300) : c.urls.pelo, '7ideals': ok(u['7ideals']) ? String(u['7ideals']).slice(0, 300) : c.urls['7ideals'] } };
  await setJ('cfg2', n); await log(`Réglages : ${n.perWeek} publication(s) par semaine et par marque, pilote ${n.auto ? 'activé' : 'désactivé'}.`); return n;
}

/* ---- médiathèque : photos envoyées depuis l'iPad, servies en public (Instagram doit pouvoir les lire) ---- */
export async function addMedia(brand, b64, w, h) {
  const buf = Buffer.from(String(b64 || ''), 'base64'); if (buf.length < 1000 || buf.length > 6e6 || buf[0] !== 0xff || buf[1] !== 0xd8) throw err(400, 'Image JPEG attendue (6 Mo max)');
  const id = crypto.randomBytes(9).toString('base64url'); await db().set('img/' + id, buf);
  const lib = await getJ('media', []); lib.unshift({ id, brand: brand === '7ideals' ? '7ideals' : 'pelo', w: +w || 0, h: +h || 0, t: Date.now(), used: 0 }); await setJ('media', lib.slice(0, 500));
  return { id, url: SITE() + '/media/' + id + '.jpg' };
}
export async function delMedia(id) { const lib = await getJ('media', []); await setJ('media', lib.filter(x => x.id !== id)); try { await db().delete('img/' + id); } catch (e) {} return { ok: 1 }; }
export async function mediaFile(id) { if (!/^[\w-]{6,30}$/.test(id)) return null; return await db().get('img/' + id, { type: 'arrayBuffer' }); }
export const mediaUrl = id => SITE() + '/media/' + id + '.jpg';

/* ---- textes : savoir-faire de concepteur-rédacteur, enrichi par l'IA gratuite (Groq) si elle est configurée ---- */
const TPL = {
  pelo: { caps: ['Fini les poils sur le canapé. 🐾\nQuelques allers-retours, on ouvre, on vide : c’est réutilisable à l’infini, sans recharge ni adhésif.', 'Chien ou chat ? Votre canapé va enfin respirer.\nLe rouleau PELO ramasse les poils sur le canapé, le lit, les vêtements et la voiture.', 'Le geste du soir qui change tout : 30 secondes de PELO sur le plaid et c’est propre.\nLivraison offerte en France.', 'Ils perdent leurs poils, pas vous votre patience. 🐶🐱\nRouleau anti-poils réutilisable : -30 % sur le lot de 2.'],
    cta: 'Commandez sur boutique-pelo.netlify.app (lien en bio)', tags: '#chien #chat #poilsdechien #poilsdechat #animauxdecompagnie #astucemenage #maison #pelo' },
  '7ideals': { caps: ['Entre la rue et la galerie.\nChaque pièce 7ideals DRIPSTUDIO est produite en petite série, comme une œuvre.', 'Pensé à Paris. Porté partout.\n7ideals DRIPSTUDIO, streetwear et art contemporain.', 'Ce que tu portes raconte une histoire. Celle-ci est en série limitée.', 'Studio, galerie, rue : trois lieux, une même signature. 7’'],
    cta: 'Découvre la collection : lien en bio', tags: '#7ideals #dripstudio #streetwear #streetwearfrance #paris #artcontemporain #fashion #limitededition' }
};
export async function writeCaption(brand, hint, n = 0) {
  const T = TPL[brand] || TPL.pelo, base = T.caps[n % T.caps.length] + '\n\n' + T.cta + '\n\n' + T.tags;
  if (!process.env.GROQ_API_KEY) return base;
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { authorization: 'Bearer ' + process.env.GROQ_API_KEY, 'content-type': 'application/json' }, signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b', temperature: 0.8, max_completion_tokens: 600, messages: [{ role: 'system', content: 'Tu écris des légendes Instagram en français pour une marque. Accroche dans la première ligne, phrases courtes, un bénéfice concret, un appel à l’action, 6 à 9 hashtags pertinents à la fin. 600 caractères maximum. Pas de faux avis, pas de fausse urgence, pas de promesse inventée. Réponds uniquement avec la légende.' }, { role: 'user', content: `Marque : ${brand === 'pelo' ? 'PELO, rouleau anti-poils réutilisable pour chiens et chats, livraison offerte en France, -30 % sur le lot de 2' : '7ideals DRIPSTUDIO, streetwear et galerie d’art contemporain, Paris / New York / Cannes, séries limitées'}\nIdée de départ : ${hint || T.caps[n % T.caps.length]}\nFin obligatoire : « ${T.cta} »` }] }) });
    const j = await r.json(), t = String(((((j.choices || [])[0] || {}).message) || {}).content || '').trim(); return t.length > 40 ? t.slice(0, 2000) : base;
  } catch (e) { return base; }
}

/* ---- calendrier : créneaux où ton audience est la plus active (lundi et vendredi 18 h–21 h, mardi 21 h, heure de Paris) ---- */
const SLOTS = [[1, 19, 0], [5, 19, 30], [2, 21, 0], [4, 19, 0], [6, 11, 0], [3, 19, 0], [0, 18, 0]];
function parisToUtc(y, mo, d, h, mi) {   // heure de Paris → instant exact (gère l'heure d'été)
  const guess = Date.UTC(y, mo, d, h, mi), off = new Date(guess).toLocaleString('en-US', { timeZone: 'Europe/Paris', hour12: false, hour: '2-digit', minute: '2-digit' }).split(':').map(Number);
  return guess - ((off[0] % 24) * 60 + off[1] - (h * 60 + mi)) * 60000;
}
function nextSlots(count, after, taken) {   // meilleurs créneaux d'abord (ordre de SLOTS), à la prochaine date libre
  const occ = [];
  for (let day = 0; day < 14; day++) {
    const d = new Date(after + day * 86400000), parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d), g = k => parts.find(x => x.type === k).value;
    const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
    SLOTS.forEach(([w, h, mi], rank) => { if (w === wd) occ.push({ t: parisToUtc(+g('year'), +g('month') - 1, +g('day'), h, mi), rank }); });
  }
  const out = [];
  const week = o => o.t < after + 7 * 86400000 ? 0 : 1;   // d'abord la semaine qui vient, puis la suivante
  for (const o of occ.filter(o => o.t > after + 30 * 60000).sort((a, b) => week(a) - week(b) || a.rank - b.rank || a.t - b.t)) {
    if (out.length >= count) break; let t = o.t; const busy = x => taken.some(y => Math.abs(y - x) < 80 * 60000); if (busy(t)) t += 90 * 60000; if (busy(t)) continue; out.push(t); taken.push(t);
  }
  return out.sort((a, b) => a - b);
}
export async function posts() { return await getJ('posts', []); }
async function savePosts(p) { await setJ('posts', p.sort((a, b) => a.when - b.when).slice(-400)); }
async function peloImages() { try { const r = await fetch('https://boutique-pelo.netlify.app/api/product', { signal: AbortSignal.timeout(8000) }); const j = await r.json(); return (j.images || []).filter(u => /^https:\/\//.test(u)); } catch (e) { return []; } }
export async function planWeek(brand) {   // prépare les publications de la semaine pour une marque (photos de la médiathèque, puis photos produit PELO)
  const c = await cfg(), all = await posts(), lib = await getJ('media', []), mine = lib.filter(m => m.brand === brand).sort((a, b) => (a.used || 0) - (b.used || 0) || b.t - a.t);
  const pool = [...mine.map(m => ({ img: mediaUrl(m.id), mid: m.id })), ...(brand === 'pelo' ? (await peloImages()).map(u => ({ img: u })) : [])];
  if (!pool.length) throw err(400, brand === 'pelo' ? 'Aucune photo PELO : ajoute des photos dans la médiathèque.' : 'Aucune photo 7ideals : ajoute des photos dans la médiathèque.');
  const planned = all.filter(p => p.brand === brand && p.status === 'planned' && p.when > Date.now()), need = Math.max(0, c.perWeek - planned.filter(p => p.when < Date.now() + 7 * 86400000).length); if (!need) return { added: 0 };
  const slots = nextSlots(need, Date.now(), all.filter(p => p.status === 'planned').map(p => p.when)), n0 = all.filter(p => p.brand === brand).length;
  for (let i = 0; i < slots.length; i++) {
    const pick = pool[(n0 + i) % pool.length], cap = await writeCaption(brand, '', n0 + i);
    all.push({ id: crypto.randomBytes(6).toString('hex'), brand, img: pick.img, mid: pick.mid || '', caption: cap, when: slots[i], nets: { ...c.nets }, status: 'planned', t: Date.now() });
    if (pick.mid) { const m = lib.find(x => x.id === pick.mid); if (m) m.used = (m.used || 0) + 1; }
  }
  await setJ('media', lib); await savePosts(all); await log(`${slots.length} publication(s) ${brand === 'pelo' ? 'PELO' : '7ideals'} planifiée(s).`); return { added: slots.length };
}
export async function editPost(d) {
  const all = await posts(), p = all.find(x => x.id === d.id); if (!p) throw err(404, 'Publication introuvable');
  if (d.del) { await savePosts(all.filter(x => x.id !== d.id)); return { ok: 1 }; }
  if (p.status !== 'planned') throw err(400, 'Déjà publiée');
  if (d.caption != null) p.caption = String(d.caption).slice(0, 2200);
  if (d.when && +d.when > Date.now()) p.when = +d.when;
  if (d.now) p.when = Date.now() - 1000;
  if (d.img && /^https:\/\//.test(d.img)) p.img = String(d.img);
  await savePosts(all); return { post: p };
}
export async function addPost(d) {
  const all = await posts(), c = await cfg(), brand = d.brand === '7ideals' ? '7ideals' : 'pelo'; if (!/^https:\/\//.test(d.img || '')) throw err(400, 'Choisis une photo');
  const when = +d.when > Date.now() ? +d.when : nextSlots(1, Date.now(), all.filter(p => p.status === 'planned').map(p => p.when))[0];
  const p = { id: crypto.randomBytes(6).toString('hex'), brand, img: String(d.img), mid: String(d.mid || ''), caption: String(d.caption || await writeCaption(brand, '', all.length)).slice(0, 2200), when, nets: { ...c.nets }, status: 'planned', t: Date.now() };
  all.push(p); await savePosts(all); return { post: p };
}

/* ---- publication ---- */
async function publishOne(p) {
  const res = {}, errs = [];
  const I = await ids();
  if (p.nets.ig && I.ig) {
    try { const c = await graph(I.ig + '/media', { image_url: p.img, caption: p.caption }, 'POST');
      for (let i = 0; i < 6; i++) { const s = await graph(c.id, { fields: 'status_code' }); if (s.status_code === 'FINISHED') break; if (s.status_code === 'ERROR') throw err(502, 'Meta : image refusée par Instagram (format ou taille)'); await new Promise(r => setTimeout(r, 2500)); }
      const m = await graph(I.ig + '/media_publish', { creation_id: c.id }, 'POST'); res.ig = m.id; } catch (e) { errs.push('Instagram : ' + e.message); }
  }
  if (p.nets.fb && I.page) {
    try { const f = await graph(I.page + '/photos', { url: p.img, message: p.caption, published: true }, 'POST', await pageToken()); res.fb = f.post_id || f.id; } catch (e) { errs.push('Facebook : ' + e.message); }
  }
  return { res, errs };
}
export async function publishDue(limit = 3) {
  if (missing().length) return { skip: 'non configuré' };
  const all = await posts(), due = all.filter(p => p.status === 'planned' && p.when <= Date.now()).slice(0, limit); let done = 0;
  for (const p of due) {
    const { res, errs } = await publishOne(p); p.res = res; p.err = errs.join(' · ').slice(0, 400); p.at = Date.now();
    p.status = Object.keys(res).length ? 'done' : 'error'; if (p.status === 'done') done++;
    await log((p.status === 'done' ? 'Publié ' : 'Échec ') + (p.brand === 'pelo' ? 'PELO' : '7ideals') + (Object.keys(res).length ? ' sur ' + Object.keys(res).map(k => k === 'ig' ? 'Instagram' : 'Facebook').join(' et ') : '') + (p.err ? ' — ' + p.err : ''));
    if (p.err) await notify('⚠️ Publication', (p.brand === 'pelo' ? 'PELO : ' : '7ideals : ') + p.err);
  }
  if (due.length) await savePosts(all); return { published: done, tried: due.length };
}

/* ---- résultats : ce qui marche sur Instagram, et pourquoi ---- */
export async function refreshStats() {
  if (!TOKEN()) return { skip: 1 }; const I = await ids(); if (!I.ig) return { skip: 1 };
  const media = ((await graph(I.ig + '/media', { fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count', limit: 30 })).data || []);
  const out = [];
  for (const m of media) {
    let ins = {}; try { for (const x of ((await graph(m.id + '/insights', { metric: 'reach,saved,shares,views' })).data || [])) ins[x.name] = +((x.values || [])[0] || {}).value || +x.total_value?.value || 0; } catch (e) {}
    const eng = (+m.like_count || 0) + (+m.comments_count || 0) + (ins.saved || 0) + (ins.shares || 0);
    out.push({ id: m.id, type: m.media_type, img: m.thumbnail_url || m.media_url || '', link: m.permalink, t: Date.parse(m.timestamp), cap: String(m.caption || '').slice(0, 140), likes: +m.like_count || 0, comments: +m.comments_count || 0, reach: ins.reach || 0, views: ins.views || 0, saved: ins.saved || 0, shares: ins.shares || 0, eng, rate: ins.reach ? Math.round(eng / ins.reach * 1000) / 10 : 0 });
  }
  await setJ('stats', { at: Date.now(), media: out }); return { n: out.length };
}
export function lessons(media) {   // savoir-faire : tirer des règles simples de ses propres résultats
  const L = []; if (media.length < 4) return ['Pas encore assez de publications pour tirer des leçons : il en faut au moins 4.'];
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0, by = (f) => { const g = {}; for (const m of media) { const k = f(m); (g[k] = g[k] || []).push(m.reach || m.eng); } return Object.entries(g).map(([k, v]) => [k, avg(v), v.length]).filter(x => x[2] >= 2).sort((a, b) => b[1] - a[1]); };
  const ty = by(m => m.type === 'VIDEO' ? 'Reels / vidéos' : m.type === 'CAROUSEL_ALBUM' ? 'Carrousels' : 'Photos'); if (ty.length > 1 && ty[0][1] >= 1.3 * Math.max(1, ty[ty.length - 1][1])) L.push(`${ty[0][0]} touchent ${Math.round(ty[0][1] / Math.max(1, ty[ty.length - 1][1]) * 10) / 10} fois plus de monde que les ${ty[ty.length - 1][0].toLowerCase()}.`);
  const hr = by(m => { const h = +new Date(m.t).toLocaleString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }); return h < 12 ? 'le matin' : h < 17 ? 'l’après-midi' : h < 22 ? 'le soir (17 h–22 h)' : 'la nuit'; }); if (hr.length > 1) L.push(`Meilleur moment : ${hr[0][0]}.`);
  const best = [...media].sort((a, b) => b.eng - a.eng)[0]; if (best) L.push(`Publication la plus forte : « ${best.cap.split('\n')[0].slice(0, 70)} » (${best.eng} interactions). Refaire le même angle.`);
  const sv = media.filter(m => m.saved > 0).length; L.push(sv ? `${sv} publication(s) enregistrées par des abonnés : le contenu utile (astuces, avant/après) est celui qu’on garde.` : 'Personne n’enregistre encore les publications : ajouter des contenus utiles (astuce, avant/après, coulisses).');
  return L;
}

/* ---- catalogue et flux gratuits : Google Shopping (annonces gratuites) et Pinterest (épingles automatiques via flux RSS) ---- */
export async function catalog() { return await getJ('catalog', []); }
export async function saveCatalog(items) {
  const ok = s => /^https:\/\/[^\s]+$/.test(s || '');
  const clean = (Array.isArray(items) ? items : []).slice(0, 100).map(x => ({ id: String(x.id || crypto.randomBytes(5).toString('hex')).replace(/[^\w-]/g, '').slice(0, 40), title: String(x.title || '').slice(0, 150), desc: String(x.desc || '').slice(0, 2000), price: Math.max(0, +x.price || 0), link: ok(x.link) ? x.link : '', img: ok(x.img) ? x.img : '', brand: '7ideals DRIPSTUDIO' })).filter(x => x.title && x.price && x.link && x.img);
  await setJ('catalog', clean); return { items: clean };
}
async function peloItem() {
  try { const r = await fetch('https://boutique-pelo.netlify.app/api/product', { signal: AbortSignal.timeout(8000) }), j = await r.json(), imgs = (j.images || []).filter(u => /^https:\/\//.test(u)); if (!imgs.length) return [];
    const d = 'Rouleau anti-poils réutilisable pour chiens et chats : ramasse les poils sur le canapé, le lit, les vêtements et les sièges auto. Sans recharge, sans adhésif, sans pile. Livraison offerte en France.';
    return [{ id: 'PELO-1', title: 'PELO – Rouleau anti-poils réutilisable pour chien et chat', desc: d, price: 24.9, link: 'https://boutique-pelo.netlify.app/', img: imgs[0], more: imgs.slice(1, 10), brand: 'PELO', gpc: '6383' },
      { id: 'PELO-2', title: 'PELO – Lot de 2 rouleaux anti-poils réutilisables (maison + voiture)', desc: d, price: 34.9, link: 'https://boutique-pelo.netlify.app/', img: imgs[0], more: imgs.slice(1, 10), brand: 'PELO', gpc: '6383' }]; } catch (e) { return []; }
}
const X = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
export async function googleFeed() {
  const items = [...await peloItem(), ...await catalog()];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>7ideals · PELO</title><link>${X(SITE())}</link><description>Produits PELO et 7ideals DRIPSTUDIO</description>\n` + items.map(i => `<item><g:id>${X(i.id)}</g:id><title>${X(i.title)}</title><description>${X(i.desc)}</description><link>${X(i.link)}</link><g:image_link>${X(i.img)}</g:image_link>${(i.more || []).map(u => `<g:additional_image_link>${X(u)}</g:additional_image_link>`).join('')}<g:availability>in_stock</g:availability><g:price>${i.price.toFixed(2)} EUR</g:price><g:brand>${X(i.brand)}</g:brand><g:condition>new</g:condition><g:identifier_exists>no</g:identifier_exists>${i.gpc ? `<g:google_product_category>${i.gpc}</g:google_product_category>` : ''}<g:shipping><g:country>FR</g:country><g:price>0.00 EUR</g:price></g:shipping></item>`).join('\n') + '\n</channel></rss>';
}
export async function pinterestFeed() {   // Pinterest lit ce flux et crée seul les épingles (Paramètres → Création groupée → publication automatique)
  const c = await cfg(), items = [...(await peloItem()).slice(0, 1), ...await catalog()].map(i => ({ title: i.title, desc: i.desc, link: i.link, img: i.img, t: Date.now() - 86400000 }));
  const done = (await posts()).filter(p => p.status === 'done').slice(-40).map(p => ({ title: p.caption.split('\n')[0].slice(0, 100), desc: p.caption.slice(0, 480), link: c.urls[p.brand] || c.urls.pelo, img: p.img, t: p.at || p.when }));
  return `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>7ideals · PELO</title><link>${X(SITE())}</link><description>Épingles PELO et 7ideals DRIPSTUDIO</description>\n` + [...done, ...items].filter(i => i.link && i.img).map((i, n) => `<item><title>${X(i.title)}</title><link>${X(i.link)}</link><description>${X(i.desc)}</description><guid isPermaLink="false">${X(crypto.createHash('sha1').update(i.img + i.title).digest('hex'))}</guid><pubDate>${new Date(i.t).toUTCString()}</pubDate><enclosure url="${X(i.img)}" type="image/jpeg" length="0"/></item>`).join('\n') + '\n</channel></rss>';
}

/* ---- passage automatique (toutes les 30 min) ---- */
export async function autoRun() {
  const out = { pub: await publishDue() }, c = await cfg();
  if (c.auto && !missing().length) for (const b of ['pelo', '7ideals']) if (c.brands[b]) { try { out[b] = await planWeek(b); } catch (e) { const k = 'warn-' + b, w = await getJ(k); if (!w || Date.now() - w > 86400000) { await log(e.message); await setJ(k, Date.now()); } } }
  const s = await getJ('stats'); if (!s || Date.now() - s.at > 12 * 3600000) { try { out.stats = await refreshStats(); } catch (e) { out.stats = e.message; } }
  return out;
}
