/* 7ideals Ads — interface (réservée à l'administrateur) */
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = n => (+n || 0).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const F = {}, S = { r: null, auth: null, busy: false };
function toast(m) { const t = $('#toast'); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 4000); }
async function api(method, p, b) {
  const r = await fetch(p, { method, credentials: 'same-origin', headers: { 'X-App': '1', ...(b !== undefined ? { 'Content-Type': 'application/json' } : {}) }, body: b === undefined ? undefined : JSON.stringify(b) });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && p !== '/api/login') { S.auth = false; render(); throw new Error('auth'); }
  if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j;
}
const METHOD = [
  'Structure simple : 1 campagne, 1 audience large laissée à Meta (Advantage+), 3 à 6 pubs. Meta trouve lui-même les acheteurs.',
  'Le visuel fait l’essentiel du résultat : produit en action, avant/après, format carré ou vertical 4:5, peu de texte sur l’image.',
  'Accroche dans les 5 premiers mots, un bénéfice concret, une preuve, un appel à l’action. Jamais de faux avis ni de fausse urgence.',
  'Phase d’apprentissage : ne rien modifier pendant 3 à 4 jours. Juger une pub après au moins 1 000 affichages.',
  'Repères France : taux de clic ≥ 1 %, 5 à 10 € pour 1 000 affichages. Sous 0,6 % de clics, la pub est coupée.',
  'Budget augmenté de 20 % au plus tous les 3 jours, seulement si c’est rentable. Au-delà de 3,5 vues par personne : nouveau visuel.'
];
async function load() { try { S.r = await api('GET', '/api/ads'); S.auth = true; } catch (e) { if (e.message !== 'auth') S.r = { err: e.message }; } render(); }
const v = (k, d) => F[k] != null ? F[k] : d;
function vLogin() {
  return `<div class="login card"><h2>7ideals Ads</h2><p class="mut sm">Accès réservé à l’administrateur.</p>
  <form id="lf"><label>Mot de passe</label><input type="password" id="pw" autocomplete="current-password" required><button class="btn s" style="margin-top:12px;width:100%">Se connecter</button></form></div>`;
}
function vApp() {
  const r = S.r, head = `<div class="row"><div><h2>Campagnes Facebook + Instagram</h2><p class="mut sm" style="margin:4px 0 0">PELO et 7ideals DRIPSTUDIO. La plateforme est gratuite ; Meta facture seulement la diffusion, jamais au-delà de ton plafond.</p></div></div>`;
  const method = `<details class="card"><summary><b>La méthode appliquée</b></summary><ul>${METHOD.map(x => `<li class="sm">${esc(x)}</li>`).join('')}</ul></details>`;
  if (!r) return head + '<p class="mut">Chargement…</p>';
  if (r.err) return head + `<p class="neg sm">Erreur : ${esc(r.err)}</p><button class="btn" data-a="reload">Réessayer</button>`;
  const c = r.cfg || {};
  const cfg = `<div class="card"><b>Réglages et pilote automatique</b><div class="g g2">
    <div><label>Plafond de dépense (€ par jour, toutes campagnes)</label><input type="number" min="0" step="1" data-k="cap" value="${esc(v('cap', c.capDay))}"></div>
    <div><label>Coût par vente visé (€)</label><input type="number" min="1" step="1" data-k="cpa" value="${esc(v('cpa', c.cpa))}"></div>
    <div><label>Rentabilité visée (€ rapportés pour 1 € dépensé)</label><input type="number" min="0.5" step="0.1" data-k="roas" value="${esc(v('roas', c.roas))}"></div>
    <div><label>Lien PELO</label><input data-k="up" value="${esc(v('up', (c.urls || {}).pelo || ''))}"></div>
    <div><label>Lien 7ideals</label><input data-k="u7" placeholder="https://" value="${esc(v('u7', (c.urls || {})['7ideals'] || ''))}"></div></div>
    <div class="chips" style="margin-top:10px"><button class="btn${v('ap', c.autoPause) ? ' s' : ''}" data-a="tog" data-id="ap">${v('ap', c.autoPause) ? '✓ ' : ''}Couper les pubs qui gaspillent</button><button class="btn${v('as', c.autoScale) ? ' s' : ''}" data-a="tog" data-id="as">${v('as', c.autoScale) ? '✓ ' : ''}Augmenter ce qui rapporte (+20 %, dans le plafond)</button></div>
    <button class="btn s" style="margin-top:10px" data-a="cfg">Enregistrer</button></div>`;
  if (!r.connected) return head + `<div class="card"><b>Connexion à Meta</b><p class="sm">À ajouter dans Netlify (Project configuration → Environment variables), puis redéployer :</p><ul class="sm">${(r.missing || []).map(k => `<li><code>${esc(k)}</code></li>`).join('')}<li class="mut"><code>META_IG_ID</code>, <code>META_PIXEL_ID</code> : facultatifs</li></ul></div>` + cfg + method;
  const a = r.account || {}, w = r.week || {};
  const tiles = [['Dépensé aujourd’hui', eur(r.todaySpend) + (c.capDay ? ' / ' + eur(c.capDay) : '')], ['Dépense 7 jours', eur(w.spend)], ['Clics', String(w.clicks || 0)], ['Taux de clic', (w.ctr || 0) + ' %'], ['Ventes', String(w.purchases || 0)], ['Rentabilité', String(w.roas || 0)]]
    .map(([k, x]) => `<div class="card"><span class="mut sm">${esc(k)}</span><div class="big">${esc(x)}</div></div>`).join('');
  const camps = (r.campaigns || []).map(x => { const k = x.k || {}, on = x.eff === 'ACTIVE';
    return `<div class="card"><div class="row" style="flex-wrap:wrap"><span style="flex:1;min-width:220px"><b>${esc(x.name)}</b><span class="tag${on ? ' on' : ''}">${on ? 'active' : esc((x.eff || x.status || '').toLowerCase())}</span>
      <div class="mut sm">${eur(x.daily)} / jour · dépensé ${eur(k.spend)} · ${k.clicks || 0} clics · ${k.ctr || 0} % · ${k.purchases || 0} vente(s)${k.roas ? ' · rentabilité ' + k.roas : ''}</div></span>
      ${x.ours ? `<button class="btn${on ? '' : ' s'}" data-a="st" data-id="${esc(x.id)}" data-on="${on ? 0 : 1}">${on ? 'Mettre en pause' : 'Lancer'}</button>` : ''}</div>
      ${(x.why || []).length ? `<details style="margin-top:6px"><summary class="sm">Pourquoi ces résultats</summary><ul>${x.why.map(s => `<li class="sm">${esc(s)}</li>`).join('')}</ul></details>` : ''}</div>`; }).join('') || '<p class="mut sm">Aucune campagne pour l’instant.</p>';
  const brand = F.b || 'pelo', goal = F.g || 'trafic';
  const vars = (F.vars || []).map((x, i) => `<div class="card"><label>Titre ${i + 1}</label><input maxlength="60" data-k="h${i}" value="${esc(v('h' + i, x.head))}"><label>Texte ${i + 1}</label><textarea rows="5" maxlength="600" data-k="t${i}">${esc(v('t' + i, x.text))}</textarea></div>`).join('');
  const form = `<div class="card"><b>Nouvelle campagne</b>
    <label>Marque</label><div class="chips">${[['pelo', 'PELO'], ['7ideals', '7ideals DRIPSTUDIO']].map(([b, n]) => `<button class="btn${brand === b ? ' s' : ''}" data-a="b" data-id="${b}">${n}</button>`).join('')}</div>
    <label>Objectif</label><div class="chips">${[['trafic', 'Trafic (visites)'], ['notoriete', 'Notoriété'], ['ventes', 'Ventes (pixel requis)']].map(([g, n]) => `<button class="btn${goal === g ? ' s' : ''}" data-a="g" data-id="${g}"${g === 'ventes' && !r.pixel ? ' disabled' : ''}>${n}</button>`).join('')}</div>
    <div class="g g2"><div><label>Budget (€ par jour)</label><input type="number" min="1" step="1" data-k="bud" value="${esc(v('bud', 5))}"></div><div><label>Pays (codes séparés par des virgules)</label><input data-k="ct" value="${esc(v('ct', brand === 'pelo' ? 'FR,BE,LU' : 'FR,BE,CH,US'))}"></div>
    <div><label>Âge minimum</label><input type="number" min="18" max="65" data-k="amin" value="${esc(v('amin', brand === 'pelo' ? 25 : 18))}"></div><div><label>Âge maximum</label><input type="number" min="18" max="65" data-k="amax" value="${esc(v('amax', brand === 'pelo' ? 65 : 44))}"></div></div>
    <label>Lien de destination</label><input data-k="url" placeholder="https://" value="${esc(v('url', (c.urls || {})[brand] || ''))}">
    <label>Images (un lien https par ligne, format carré ou 4:5)</label><textarea rows="3" data-k="imgs" placeholder="https://…">${esc(v('imgs', ''))}</textarea>
    <label>Produit mis en avant</label><input maxlength="200" data-k="prod" value="${esc(v('prod', brand === 'pelo' ? 'Rouleau anti-poils réutilisable' : 'Nouvelle collection'))}">
    <button class="btn" style="margin-top:10px" data-a="gen"${S.busy ? ' disabled' : ''}>Écrire les textes</button>${vars}
    ${vars ? `<button class="btn s" style="margin-top:12px" data-a="create"${S.busy ? ' disabled' : ''}>Créer la campagne (en pause)</button>` : ''}</div>`;
  const log = (r.log || []).slice(0, 12).map(l => `<p class="mut sm" style="margin:4px 0 0">${esc(new Date(l.t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} — ${esc(l.msg)}</p>`).join('');
  return head + `<p class="sm" style="margin-top:8px">Compte publicitaire : <b>${esc(a.name || '')}</b> · ${esc(a.currency || '')} · pixel Meta : ${r.pixel ? 'oui' : 'non'}</p>
    <div class="tiles">${tiles}</div><h3>Campagnes</h3>${camps}${form}${cfg}
    <div class="card"><div class="row"><b>Journal du pilote automatique</b><button class="btn" data-a="run">Analyser maintenant</button></div>${log || '<p class="mut sm">Rien pour l’instant.</p>'}</div>${method}`;
}
function render() {
  $('#who').innerHTML = S.auth ? '<button class="btn" data-a="logout">Se déconnecter</button>' : '';
  $('#main').innerHTML = S.auth === false ? vLogin() : vApp();
  const lf = $('#lf'); if (lf) { $('#pw').focus(); lf.onsubmit = async e => { e.preventDefault(); try { await api('POST', '/api/login', { password: $('#pw').value }); S.auth = true; S.r = null; render(); load(); } catch (x) { toast(x.message); } }; }
}
const ACT = {
  reload() { S.r = null; render(); load(); },
  async logout() { try { await api('POST', '/api/logout', {}); } catch (e) {} S.auth = false; render(); },
  tog(k) { const c = (S.r && S.r.cfg) || {}; F[k] = v(k, k === 'ap' ? c.autoPause : c.autoScale) ? 0 : 1; render(); },
  b(x) { F.b = x; ['url', 'imgs', 'ct', 'amin', 'amax', 'prod', 'h0', 'h1', 'h2', 't0', 't1', 't2'].forEach(k => delete F[k]); F.vars = null; render(); },
  g(x) { F.g = x; render(); },
  async cfg() { const c = (S.r && S.r.cfg) || {};
    try { await api('POST', '/api/ads/cfg', { capDay: +v('cap', c.capDay), cpa: +v('cpa', c.cpa), roas: +v('roas', c.roas), autoPause: v('ap', c.autoPause), autoScale: v('as', c.autoScale), urls: { pelo: v('up', (c.urls || {}).pelo), '7ideals': v('u7', (c.urls || {})['7ideals']) } }); toast('Réglages enregistrés'); load(); } catch (e) { toast(e.message); } },
  async gen() { S.busy = true; render(); try { const r = await api('POST', '/api/ads/copy', { brand: F.b || 'pelo', product: v('prod', '') }); F.vars = r.variants; ['h0', 'h1', 'h2', 't0', 't1', 't2'].forEach(k => delete F[k]); } catch (e) { toast(e.message); } S.busy = false; render(); },
  async create() { const brand = F.b || 'pelo', c = (S.r && S.r.cfg) || {};
    const body = { brand, goal: F.g || 'trafic', budget: +v('bud', 5), countries: String(v('ct', brand === 'pelo' ? 'FR,BE,LU' : 'FR,BE,CH,US')).toUpperCase().split(/[\s,;]+/).filter(Boolean),
      ageMin: +v('amin', brand === 'pelo' ? 25 : 18), ageMax: +v('amax', brand === 'pelo' ? 65 : 44), url: v('url', (c.urls || {})[brand] || ''), images: String(v('imgs', '')).split(/\s+/).filter(Boolean),
      variants: (F.vars || []).map((x, i) => ({ head: v('h' + i, x.head), text: v('t' + i, x.text) })) };
    S.busy = true; render(); try { await api('POST', '/api/ads/create', body); toast('Campagne créée en pause. Vérifie-la puis lance-la.'); F.vars = null; } catch (e) { toast(e.message); } S.busy = false; load(); },
  async st(id, b) { try { await api('POST', '/api/ads/status', { id, on: b.dataset.on === '1' }); } catch (e) { toast(e.message); } load(); },
  async run() { try { const r = await api('POST', '/api/ads/auto', {}); toast(r.notes ? r.notes + ' action(s) du pilote' : 'Rien à corriger'); } catch (e) { toast(e.message); } load(); }
};
document.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b && ACT[b.dataset.a]) { e.preventDefault(); ACT[b.dataset.a](b.dataset.id, b); } });
document.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.k; if (k) F[k] = e.target.value; });
render(); load();
