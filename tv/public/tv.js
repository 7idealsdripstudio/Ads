/* 7ideals TV — site public : même chaîne, même grille et mêmes chaînes de musées que l'onglet TV de l'app Projets (lecture seule). */
'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TV_MUS = [
  { k: 'moma', n: 'MoMA', city: 'New York', id: 'UC9CswYtb5rL31CHwyVoyJvQ' },
  { k: 'met', n: 'The Met', city: 'New York', id: 'UCDlz9C2bhSW6dcVn_PO5mYw' },
  { k: 'gugg', n: 'Guggenheim', city: 'New York', id: 'UChrvkZPNMeC6nwMzoD6Gj6w' },
  { k: 'whitney', n: 'Whitney Museum', city: 'New York', id: 'UCkIysc598DcproKIPlHBfCg' },
  { k: 'sfmoma', n: 'SFMOMA', city: 'San Francisco', id: 'UC-T9CjFxdi-mQt-5gM4404w' },
  { k: 'aic', n: 'Art Institute', city: 'Chicago', id: 'UCXflF3_PL_QuDX1CsCImuFA' }
];
const TV_EPOCH = Date.UTC(2026, 0, 1);
const TV = { ch: 'own', key: '', timer: 0, pick: '', pickAt: 0, items: [], cfg: { extra: [], off: [] }, open: false };
const tvChans = () => [{ k: 'own', n: '7ideals TV', city: 'Expositions DRIPSTUDIO' }, ...TV_MUS.map(c => ({ ...c, list: 'UU' + c.id.slice(2) })), ...(TV.cfg.extra || [])].filter(c => c.k === 'own' || !(TV.cfg.off || []).includes(c.k));
const tvItems = () => TV.items.filter(x => x.vid).sort((a, b) => (a.pos || 0) - (b.pos || 0));
function tvNowOwn() {
  const it = tvItems(); if (!it.length) return null; const dur = x => Math.max(1, +x.dur || 10) * 60;
  if (TV.pick) { const x = it.find(y => y.id === TV.pick), off = (Date.now() - TV.pickAt) / 1000; if (x && off < dur(x)) return { x, off: Math.floor(off), left: dur(x) - off, next: it[(it.indexOf(x) + 1) % it.length] }; TV.pick = ''; }
  const tot = it.reduce((a, x) => a + dur(x), 0); let s = ((Date.now() - TV_EPOCH) / 1000) % tot;
  for (let i = 0; i < it.length; i++) { const d = dur(it[i]); if (s < d) return { x: it[i], off: Math.floor(s), left: d - s, next: it[(i + 1) % it.length] }; s -= d; }
  return { x: it[0], off: 0, left: dur(it[0]), next: it[1 % it.length] };
}
function tvSrc(c) {
  if (c.k === 'own') { const n = tvNowOwn(); if (!n) return { key: 'own:empty' };
    const x = n.x, src = x.src === 'vm' ? `https://player.vimeo.com/video/${x.vid}?autoplay=1&dnt=1#t=${n.off}s` : `https://www.youtube-nocookie.com/embed/${x.vid}?autoplay=1&playsinline=1&rel=0&start=${n.off}`;
    return { key: 'own:' + x.id + ':' + (TV.pick ? 'p' + TV.pickAt : 's'), src, left: n.left, now: n }; }
  const day = Math.floor((Date.now() - TV_EPOCH) / 86400000);
  return { key: c.k + ':' + day, src: `https://www.youtube-nocookie.com/embed/videoseries?list=${encodeURIComponent(c.list)}&index=${day % 15}&autoplay=1&playsinline=1&rel=0` };
}
function tvScreen(c, s) {
  if (!s.src) return '<div class="tvempty"><span class="px">7ideals TV</span><p class="sm" style="margin-top:8px">Programme bientôt à l’antenne : choisissez une chaîne de musée en attendant.</p></div>';
  return `<iframe src="${esc(s.src)}" title="${esc(c.n)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" loading="eager"></iframe>`;
}
function tvNowHTML(c, s) {
  if (c.k !== 'own') return `<b>${esc(c.n)}</b> <span class="mut">· ${esc(c.city || '')}</span><p class="mut sm" style="margin-top:4px">Les dernières vidéos publiées par le musée, en continu. Le point de départ change chaque jour.</p>`;
  if (!s.now) return '';
  const x = s.now.x, nx = s.now.next;
  return `<span class="tvtag">À l’antenne</span> <b>${esc(x.title || '')}</b>${x.place ? ` <span class="mut">· ${esc(x.place)}</span>` : ''}${x.dates ? ` <span class="mut">· ${esc(x.dates)}</span>` : ''}
    ${nx && nx.id !== x.id ? `<p class="mut sm" style="margin-top:4px">À suivre : ${esc(nx.title || '')}${nx.place ? ' · ' + esc(nx.place) : ''}</p>` : ''}`;
}
function tvSide() {
  const cs = tvChans(), it = tvItems(), cur = TV.ch;
  const chans = cs.map((c, i) => `<button class="tvch${cur === c.k ? ' on' : ''}" data-a="ch" data-id="${esc(c.k)}" aria-pressed="${cur === c.k}"><span class="px tvn">${String(i + 1).padStart(2, '0')}</span><span class="tvcn"><b>${esc(c.n)}</b><span class="mut sm">${esc(c.city || '')}</span></span></button>`).join('');
  const prog = it.map(x => `<div class="tvit"><span class="tvth">${x.src === 'yt' ? `<img src="https://i.ytimg.com/vi/${esc(x.vid)}/mqdefault.jpg" alt="" loading="lazy">` : '<span class="px">VIMEO</span>'}</span>
      <span style="flex:1;min-width:0"><b class="sm">${esc(x.title || '')}</b><br><span class="mut sm">${esc([x.place, x.dates, (+x.dur || 10) + ' min'].filter(Boolean).join(' · '))}</span>
      <span class="row" style="gap:4px;margin-top:4px;justify-content:flex-start"><button class="btn" data-a="play" data-id="${esc(x.id)}">▶ Regarder</button></span></span></div>`).join('');
  return `<div class="card"><b>Chaînes</b><div class="tvchs">${chans}</div></div>
    <details class="card"${TV.open ? ' open' : ''} id="prog"><summary><b>Programme de la chaîne 01</b> <span class="mut sm">${it.length}</span></summary>${prog || '<p class="mut sm" style="margin-top:8px">Programme bientôt à l’antenne.</p>'}</details>`;
}
function draw(force) {
  const cs = tvChans(), c = cs.find(x => x.k === TV.ch) || cs[0], s = tvSrc(c); TV.ch = c.k;
  if (force || TV.key !== s.key) { $('#tvscreen').innerHTML = tvScreen(c, s); TV.key = s.key; }
  $('#tvnow').innerHTML = tvNowHTML(c, s); $('#tvside').innerHTML = tvSide();
  clearTimeout(TV.timer); if (s.left) TV.timer = setTimeout(() => draw(), Math.ceil(s.left * 1000) + 800);
}
async function load() {
  try { const r = await fetch('/api/programme', { headers: { accept: 'application/json' } }), j = await r.json(); TV.items = j.items || []; TV.cfg = j.cfg || { extra: [], off: [] }; } catch (e) {}
  draw();
}
document.addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; e.preventDefault();
  if (b.dataset.a === 'ch') { TV.ch = b.dataset.id; TV.pick = ''; draw(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  if (b.dataset.a === 'play') { TV.ch = 'own'; TV.pick = b.dataset.id; TV.pickAt = Date.now(); draw(true); window.scrollTo({ top: 0, behavior: 'smooth' }); } });
document.addEventListener('toggle', e => { if (e.target.id === 'prog') TV.open = e.target.open; }, true);
setInterval(() => { if (!document.hidden) load(); }, 5 * 60000);
draw(); load();
