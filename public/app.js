/* 7ideals Ads — interface (réservée à l'administrateur). Canaux gratuits : Instagram, Facebook, Google Shopping, Pinterest. */
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fr = n => (+n || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const when = t => new Date(t).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
const BR = { pelo: 'PELO', '7ideals': '7ideals' };
const F = { brand: 'pelo', tab: 'cal' }, S = { r: null, auth: null, busy: '' };
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 4500); }
async function api(method, p, b) {
  const r = await fetch(p, { method, credentials: 'same-origin', headers: { 'X-App': '1', ...(b !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && p !== '/api/login') { S.auth = false; render(); throw new Error('auth'); }
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j;
}
async function load() { try { S.r = await api('GET', '/api/state'); S.auth = true; } catch (e) { if (e.message !== 'auth') S.r = { err: e.message }; } render(); }
const v = (k, d) => F[k] != null ? F[k] : d;
const busy = k => S.busy === k ? ' disabled' : '';

function vLogin() {
  return `<div class="login card"><h2>7ideals Ads</h2><p class="mut sm">Accès réservé à l’administrateur.</p>
  <form id="lf"><label>Mot de passe</label><input type="password" id="pw" autocomplete="current-password" required><button class="btn s" style="margin-top:12px;width:100%">Se connecter</button></form></div>`;
}
const TABS = [['cal', 'Calendrier'], ['media', 'Médiathèque'], ['res', 'Résultats'], ['shop', 'Google Shopping'], ['pin', 'Pinterest'], ['set', 'Réglages']];
function vSetup(r) {
  return `<div class="card"><b>Connexion à Instagram et Facebook</b><p class="sm">Pour publier, ajoute dans Netlify (Project configuration → Environment variables) puis redéploie :</p>
  <ul class="sm">${r.missing.map(k => `<li><code>${esc(k)}</code></li>`).join('')}</ul><p class="mut sm">En attendant, la médiathèque, le calendrier, Google Shopping et Pinterest fonctionnent déjà.</p></div>`;
}
function vCal(r) {
  const up = r.posts.filter(p => p.status === 'planned').sort((a, b) => a.when - b.when), past = r.posts.filter(p => p.status !== 'planned').sort((a, b) => (b.at || b.when) - (a.at || a.when)).slice(0, 12);
  const card = p => `<div class="card post"><img src="${esc(p.img)}" alt="" loading="lazy"><div class="pbody">
    <div class="row"><b>${BR[p.brand]} · ${esc(when(p.when))}</b><span class="tag${p.status === 'done' ? ' on' : p.status === 'error' ? ' bad' : ''}">${p.status === 'planned' ? 'prévue' : p.status === 'done' ? 'publiée' : 'échec'}</span></div>
    ${p.status === 'planned' ? `<textarea rows="5" maxlength="2200" data-k="cap_${p.id}">${esc(v('cap_' + p.id, p.caption))}</textarea>
      <div class="chips" style="margin-top:6px"><button class="btn" data-a="psave" data-id="${p.id}">Enregistrer</button><button class="btn" data-a="pnow" data-id="${p.id}">Publier maintenant</button><button class="btn" data-a="pdel" data-id="${p.id}">Supprimer</button></div>`
      : `<p class="sm mut" style="white-space:pre-line;margin:6px 0 0">${esc(p.caption.slice(0, 220))}${p.caption.length > 220 ? '…' : ''}</p>${p.err ? `<p class="sm neg">${esc(p.err)}</p>` : ''}`}</div></div>`;
  return `<div class="card"><b>Préparer les prochaines publications</b><p class="sm mut" style="margin:4px 0 8px">La plateforme choisit les photos, écrit les légendes et place les publications aux heures où ton audience est active (lundi et vendredi soir, mardi 21 h).</p>
    <div class="chips"><button class="btn s" data-a="plan" data-id="pelo"${busy('plan')}>Semaine PELO</button><button class="btn s" data-a="plan" data-id="7ideals"${busy('plan')}>Semaine 7ideals</button><button class="btn" data-a="run"${busy('run')}>Publier ce qui est dû</button></div></div>
    <h3>À venir (${up.length})</h3>${up.map(card).join('') || '<p class="mut sm">Rien de prévu. Prépare une semaine ou crée une publication depuis la médiathèque.</p>'}
    <h3>Publiées récemment</h3>${past.map(card).join('') || '<p class="mut sm">Aucune pour l’instant.</p>'}`;
}
function vMedia(r) {
  const b = F.brand, items = r.media.filter(m => m.brand === b), sel = items.find(m => m.id === F.sel);
  return `<div class="card"><div class="chips">${['pelo', '7ideals'].map(x => `<button class="btn${b === x ? ' s' : ''}" data-a="brand" data-id="${x}">${x === 'pelo' ? 'PELO' : '7ideals DRIPSTUDIO'}</button>`).join('')}</div>
    <label>Ajouter des photos ${b === 'pelo' ? 'PELO' : '7ideals'} (recadrées automatiquement au format Instagram)</label><input type="file" id="up" accept="image/*" multiple>
    ${S.busy === 'up' ? '<p class="sm mut">Envoi en cours…</p>' : ''}</div>
    <div class="grid">${items.map(m => `<div class="tile${F.sel === m.id ? ' on' : ''}" data-a="sel" data-id="${m.id}"><img src="${esc(m.url)}" alt="" loading="lazy"><span class="mut sm">${m.used ? 'utilisée ' + m.used + '×' : 'jamais utilisée'}</span></div>`).join('') || '<p class="mut sm">Aucune photo pour cette marque.</p>'}</div>
    ${sel ? `<div class="card"><b>Nouvelle publication avec cette photo</b><div class="post" style="margin-top:8px"><img src="${esc(sel.url)}" alt=""><div class="pbody">
      <label>Légende</label><textarea rows="6" maxlength="2200" data-k="ncap">${esc(v('ncap', ''))}</textarea>
      <div class="chips" style="margin-top:6px"><button class="btn" data-a="wcap"${busy('wcap')}>Écrire la légende</button></div>
      <label>Date et heure (vide = prochain bon créneau)</label><input type="datetime-local" data-k="nwhen" value="${esc(v('nwhen', ''))}">
      <div class="chips" style="margin-top:10px"><button class="btn s" data-a="padd"${busy('padd')}>Ajouter au calendrier</button><button class="btn" data-a="mdel" data-id="${sel.id}">Supprimer la photo</button></div></div></div></div>` : ''}`;
}
function vRes(r) {
  const top = [...r.stats].sort((a, b) => b.eng - a.eng).slice(0, 9);
  return `<div class="card"><div class="row"><b>Ce qui marche sur ton Instagram</b><button class="btn" data-a="stats"${busy('stats')}>Actualiser</button></div>
    <p class="mut sm">${r.statsAt ? 'Lu le ' + esc(when(r.statsAt)) : 'Pas encore lu.'}</p><ul>${r.lessons.map(l => `<li class="sm">${esc(l)}</li>`).join('') || '<li class="sm mut">Les leçons apparaîtront après la première lecture.</li>'}</ul></div>
    <div class="grid">${top.map(m => `<a class="tile" href="${esc(m.link)}" target="_blank" rel="noopener"><img src="${esc(m.img)}" alt="" loading="lazy"><span class="sm"><b>${m.eng}</b> interactions · ${fr(m.reach)} vues uniques${m.saved ? ' · ' + m.saved + ' enregistr.' : ''}</span></a>`).join('')}</div>`;
}
function vShop(r) {
  const cat = r.catalog;
  return `<div class="card"><b>Google Shopping : annonces gratuites</b><p class="sm">Tes produits apparaissent gratuitement dans l’onglet Shopping de Google. La plateforme fournit le catalogue à jour ; Google le relit chaque jour.</p>
    <label>Adresse du catalogue à donner à Google</label><input readonly value="${esc(r.feeds.google)}"><button class="btn" style="margin-top:6px" data-a="copy" data-id="${esc(r.feeds.google)}">Copier</button>
    <ol class="sm" style="margin:10px 0 0 18px"><li>Ouvre <b>merchants.google.com</b> avec ton compte Google et crée ton compte marchand (gratuit).</li><li>Produits → Sources de produits → <b>Ajouter des produits à partir d’un fichier</b> → saisir un lien, colle l’adresse ci-dessus, récupération <b>quotidienne</b>.</li><li>Vérifie que l’option <b>Fiches gratuites</b> est activée. Google valide en quelques jours.</li></ol></div>
    <div class="card"><b>Produits 7ideals dans le catalogue</b><p class="mut sm">Le produit PELO y est déjà, automatiquement. Ajoute ici les pièces 7ideals qui ont une page où l’on peut les acheter.</p>
    ${cat.map((x, i) => `<div class="row sm" style="margin-top:6px"><span>${esc(x.title)} · ${fr(x.price)} €</span><button class="btn" data-a="catdel" data-id="${i}">Retirer</button></div>`).join('')}
    <div class="g g2"><div><label>Nom de la pièce</label><input data-k="ct_t" maxlength="150" value="${esc(v('ct_t', ''))}"></div><div><label>Prix TTC (€)</label><input type="number" min="1" step="0.01" data-k="ct_p" value="${esc(v('ct_p', ''))}"></div>
    <div><label>Lien de la page produit</label><input data-k="ct_l" placeholder="https://" value="${esc(v('ct_l', ''))}"></div><div><label>Lien de la photo (ou une photo de la médiathèque)</label><input data-k="ct_i" placeholder="https://" value="${esc(v('ct_i', ''))}"></div></div>
    <label>Description</label><textarea rows="3" maxlength="2000" data-k="ct_d">${esc(v('ct_d', ''))}</textarea><button class="btn s" style="margin-top:8px" data-a="catadd">Ajouter au catalogue</button></div>`;
}
function vPin(r) {
  return `<div class="card"><b>Pinterest : épingles automatiques</b><p class="sm">Pinterest lit le flux de la plateforme et crée seul une épingle pour chaque produit et chaque publication, avec le lien vers ta boutique. Gratuit, et une épingle continue d’amener des visites pendant des mois.</p>
    <label>Adresse du flux à donner à Pinterest</label><input readonly value="${esc(r.feeds.pinterest)}"><button class="btn" style="margin-top:6px" data-a="copy" data-id="${esc(r.feeds.pinterest)}">Copier</button>
    <ol class="sm" style="margin:10px 0 0 18px"><li>Crée un compte <b>Pinterest professionnel</b> (gratuit), ou convertis ton compte.</li><li>Paramètres → <b>Création groupée d’Épingles</b> → <b>Publier automatiquement depuis un flux RSS</b>.</li><li>Colle l’adresse ci-dessus et choisis un tableau (par exemple « PELO » ou « 7ideals »). Pinterest vérifie le flux chaque jour.</li></ol></div>`;
}
function vSet(r) {
  const c = r.cfg, tog = (k, on, label) => `<button class="btn${on ? ' s' : ''}" data-a="tog" data-id="${k}">${on ? '✓ ' : ''}${label}</button>`;
  return `<div class="card"><b>Pilote automatique</b><p class="mut sm">Activé, il garde toujours une semaine de publications prête et publie à l’heure, sans toi.</p>
    <div class="chips">${tog('auto', v('auto', c.auto), 'Pilote automatique')}${tog('ig', v('ig', c.nets.ig), 'Instagram')}${tog('fb', v('fb', c.nets.fb), 'Facebook')}${tog('bp', v('bp', c.brands.pelo), 'PELO')}${tog('b7', v('b7', c.brands['7ideals']), '7ideals')}</div>
    <div class="g g2"><div><label>Publications par semaine et par marque</label><input type="number" min="1" max="7" data-k="pw" value="${esc(v('pw', c.perWeek))}"></div>
    <div><label>Lien PELO</label><input data-k="up" value="${esc(v('up', c.urls.pelo))}"></div><div><label>Lien 7ideals</label><input data-k="u7" placeholder="https://" value="${esc(v('u7', c.urls['7ideals']))}"></div></div>
    <button class="btn s" style="margin-top:10px" data-a="cfg">Enregistrer</button><p class="sm mut" style="margin-top:8px">Rédaction des légendes : ${r.groq ? 'IA gratuite (Groq)' : 'modèles intégrés (ajoute GROQ_API_KEY pour l’IA gratuite)'}.</p></div>
    <div class="card"><b>Sécurité</b>${r.security.map(x => `<p class="sm mut" style="margin:4px 0 0">${esc(when(x.t))} — ${esc(x.ev)} — ${esc(x.ip)}</p>`).join('') || '<p class="sm mut">Aucun événement.</p>'}</div>`;
}
function vApp() {
  const r = S.r; if (!r) return '<p class="mut">Chargement…</p>';
  if (r.err) return `<p class="neg sm">Erreur : ${esc(r.err)}</p><button class="btn" data-a="reload">Réessayer</button>`;
  const view = { cal: vCal, media: vMedia, res: vRes, shop: vShop, pin: vPin, set: vSet }[F.tab](r);
  const log = r.log.slice(0, 8).map(l => `<p class="mut sm" style="margin:4px 0 0">${esc(when(l.t))} — ${esc(l.msg)}</p>`).join('');
  return `<div><h2>Publicité gratuite · PELO et 7ideals</h2><p class="mut sm" style="margin:4px 0 0">Instagram, Facebook, Google Shopping et Pinterest, sans aucune pub payante.</p></div>
    ${r.missing.length ? vSetup(r) : ''}<nav class="tabs">${TABS.map(([k, n]) => `<button class="tab${F.tab === k ? ' on' : ''}" data-a="tab" data-id="${k}">${n}</button>`).join('')}</nav>${view}
    <div class="card"><b>Journal</b>${log || '<p class="mut sm">Rien pour l’instant.</p>'}</div>`;
}
function render() {
  $('#who').innerHTML = S.auth ? '<button class="btn" data-a="logout">Se déconnecter</button>' : '';
  $('#main').innerHTML = S.auth === false ? vLogin() : vApp();
  const lf = $('#lf'); if (lf) { $('#pw').focus(); lf.onsubmit = async e => { e.preventDefault(); try { await api('POST', '/api/login', { password: $('#pw').value }); S.auth = true; S.r = null; render(); load(); } catch (x) { toast(x.message); } }; }
  const up = $('#up'); if (up) up.onchange = () => upload([...up.files]);
}
/* photo → JPEG recadré entre 4:5 et 1,91:1 (exigence Instagram), 1440 px max */
async function toJpeg(file) {
  const url = URL.createObjectURL(file), img = new Image(); img.src = url; await img.decode(); URL.revokeObjectURL(url);
  let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0; const r = sw / sh;
  if (r < 0.8) { const h = sw / 0.8; sy = (sh - h) / 2; sh = h; } else if (r > 1.91) { const w = sh * 1.91; sx = (sw - w) / 2; sw = w; }
  const k = Math.min(1, 1440 / sw), c = document.createElement('canvas'); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  const b64 = c.toDataURL('image/jpeg', 0.88).split(',')[1]; return { b64, w: c.width, h: c.height };
}
async function upload(files) {
  S.busy = 'up'; render(); let n = 0;
  for (const f of files.slice(0, 20)) { try { const j = await toJpeg(f); await api('POST', '/api/media', { brand: F.brand, ...j }); n++; } catch (e) { toast('Photo refusée : ' + e.message); } }
  S.busy = ''; toast(n + ' photo(s) ajoutée(s)'); load();
}
const ACT = {
  reload() { S.r = null; render(); load(); },
  tab(k) { F.tab = k; render(); },
  brand(b) { F.brand = b; F.sel = null; render(); },
  sel(id) { F.sel = F.sel === id ? null : id; delete F.ncap; render(); },
  async logout() { try { await api('POST', '/api/logout', {}); } catch (e) {} S.auth = false; render(); },
  copy(t) { navigator.clipboard.writeText(t).then(() => toast('Copié'), () => toast(t)); },
  async plan(b) { S.busy = 'plan'; render(); try { const r = await api('POST', '/api/plan', { brand: b }); toast(r.added ? r.added + ' publication(s) ajoutée(s)' : 'La semaine est déjà prête'); } catch (e) { toast(e.message); } S.busy = ''; load(); },
  async run() { S.busy = 'run'; render(); try { const r = await api('POST', '/api/run', {}); toast(r.pub && r.pub.tried ? r.pub.published + ' publiée(s) sur ' + r.pub.tried : 'Rien à publier pour l’instant'); } catch (e) { toast(e.message); } S.busy = ''; load(); },
  async psave(id) { try { await api('POST', '/api/post/edit', { id, caption: F['cap_' + id] }); toast('Enregistré'); } catch (e) { toast(e.message); } load(); },
  async pnow(id) { if (!confirm('Publier maintenant sur les réseaux choisis ?')) return; try { await api('POST', '/api/post/edit', { id, caption: F['cap_' + id], now: 1 }); await ACT.run(); } catch (e) { toast(e.message); } },
  async pdel(id) { if (!confirm('Supprimer cette publication du calendrier ?')) return; try { await api('POST', '/api/post/edit', { id, del: 1 }); } catch (e) { toast(e.message); } load(); },
  async wcap() { S.busy = 'wcap'; render(); try { const r = await api('POST', '/api/caption', { brand: F.brand }); F.ncap = r.caption; } catch (e) { toast(e.message); } S.busy = ''; render(); },
  async padd() { const m = S.r.media.find(x => x.id === F.sel); if (!m) return; S.busy = 'padd'; render();
    try { await api('POST', '/api/post', { brand: F.brand, img: m.url, mid: m.id, caption: F.ncap || '', when: F.nwhen ? new Date(F.nwhen).getTime() : 0 }); toast('Ajoutée au calendrier'); F.sel = null; delete F.ncap; delete F.nwhen; F.tab = 'cal'; } catch (e) { toast(e.message); } S.busy = ''; load(); },
  async mdel(id) { if (!confirm('Supprimer cette photo ?')) return; try { await api('POST', '/api/media/del', { id }); F.sel = null; } catch (e) { toast(e.message); } load(); },
  async stats() { S.busy = 'stats'; render(); try { await api('POST', '/api/stats', {}); } catch (e) { toast(e.message); } S.busy = ''; load(); },
  async catadd() { const it = { title: F.ct_t, price: +F.ct_p, link: F.ct_l, img: F.ct_i || (F.sel && S.r.media.find(x => x.id === F.sel) || {}).url, desc: F.ct_d };
    try { const r = await api('POST', '/api/catalog', { items: [...S.r.catalog, it] }); if (r.items.length === S.r.catalog.length) throw new Error('Nom, prix, lien de page et photo (liens https) obligatoires'); ['ct_t', 'ct_p', 'ct_l', 'ct_i', 'ct_d'].forEach(k => delete F[k]); toast('Ajouté'); } catch (e) { toast(e.message); } load(); },
  async catdel(i) { try { await api('POST', '/api/catalog', { items: S.r.catalog.filter((_, n) => n !== +i) }); } catch (e) { toast(e.message); } load(); },
  tog(k) { const c = S.r.cfg, cur = { auto: c.auto, ig: c.nets.ig, fb: c.nets.fb, bp: c.brands.pelo, b7: c.brands['7ideals'] }[k]; F[k] = v(k, cur) ? 0 : 1; render(); },
  async cfg() { const c = S.r.cfg;
    try { await api('POST', '/api/cfg', { auto: v('auto', c.auto), perWeek: +v('pw', c.perWeek), nets: { ig: v('ig', c.nets.ig), fb: v('fb', c.nets.fb) }, brands: { pelo: v('bp', c.brands.pelo), '7ideals': v('b7', c.brands['7ideals']) }, urls: { pelo: v('up', c.urls.pelo), '7ideals': v('u7', c.urls['7ideals']) } }); toast('Réglages enregistrés'); } catch (e) { toast(e.message); } load(); }
};
document.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && ACT[b.dataset.a]) { e.preventDefault(); ACT[b.dataset.a](b.dataset.id, b); } });
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.k; if (k) F[k] = e.target.value; });
render(); load();
