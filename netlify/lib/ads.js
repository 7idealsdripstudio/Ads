/* 7ideals Ads — cœur : API Marketing de Meta, création de campagnes, lecture des résultats, pilote automatique. */
import { getJ, setJ } from './store.js';
import { notify } from './notify.js';
export const err = (code, msg) => Object.assign(new Error(msg || 'error'), { status: code });
async function flushSync() {   // dépenses PELO → app Projets (Compta + Finance), via la synchronisation PELO existante
  const q = await getJ('sync', []), url = process.env.PROJETS_URL, key = process.env.PELO_SYNC_KEY; if (!q.length || !url || !key) return;
  try { const r = await fetch(url.replace(/\/$/, '') + '/api/pelo/sync', { method: 'POST', headers: { 'content-type': 'application/json', 'X-App': '1', 'x-pelo-key': key }, body: JSON.stringify({ items: q.slice(0, 100) }), signal: AbortSignal.timeout(15000) });
    const j = await r.json().catch(() => ({})); if (r.ok && Array.isArray(j.done)) await setJ('sync', q.filter(x => !j.done.includes(x.id))); } catch (e) {}
}
const ADS_VER = () => process.env.META_API_VERSION || 'v26.0', ADS_BASE = () => (process.env.META_GRAPH_BASE || 'https://graph.facebook.com').replace(/\/$/, '');
const ADS_ACT = () => { const a = String(process.env.META_AD_ACCOUNT || '').trim(); return a ? (a.startsWith('act_') ? a : 'act_' + a) : ''; };
const ADS_DEF = { capDay: 0, cpa: 15, roas: 2, autoPause: 1, autoScale: 0, urls: { pelo: 'https://boutique-pelo.netlify.app', '7ideals': '' } };
export async function adsCfg() { const c = (await getJ('cfg', {})); return { ...ADS_DEF, ...c, urls: { ...ADS_DEF.urls, ...(c.urls || {}) } }; }
async function adsMine() { return (await getJ('mine', {})); }
export async function adsLog(msg) { const l = (await getJ('log', [])); l.unshift({ t: Date.now(), msg: String(msg).slice(0, 300) }); await setJ('log', l.slice(0, 150)); }
function adsMissing() { return ['META_ADS_TOKEN', 'META_AD_ACCOUNT', 'META_PAGE_ID'].filter(k => !process.env[k]); }
async function graph(path, params = {}, method = 'GET') {   // appel à l'API Marketing de Meta
  const tok = process.env.META_ADS_TOKEN; if (!tok) throw err(400, 'Clé Meta manquante');
  const flat = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)]));
  let url = `${ADS_BASE()}/${ADS_VER()}/${path}`, opt = { method, signal: AbortSignal.timeout(20000) };
  if (method === 'GET') url += '?' + new URLSearchParams({ ...flat(params), access_token: tok });
  else opt = { ...opt, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...flat(params), access_token: tok }) };
  const r = await fetch(url, opt), j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) { const e = j.error || {}; throw err(502, 'Meta : ' + String(e.error_user_msg || e.message || 'HTTP ' + r.status).slice(0, 300)); }
  return j;
}
const num = x => +x || 0, eur2 = x => Math.round(num(x) * 100) / 100;
function adsAct(list, type) { const a = (list || []).find(x => x.action_type === type || x.action_type === 'offsite_conversion.fb_pixel_' + type || x.action_type === 'omni_' + type); return a ? num(a.value) : 0; }
function adsKpi(i) {   // chiffres utiles d'une ligne d'insights
  const spend = num(i.spend), purchases = adsAct(i.actions, 'purchase'), revenue = adsAct(i.action_values, 'purchase'), clicks = num(i.inline_link_clicks || i.clicks), imp = num(i.impressions);
  return { spend: eur2(spend), imp, reach: num(i.reach), clicks, ctr: imp ? Math.round(clicks / imp * 10000) / 100 : 0, cpc: clicks ? eur2(spend / clicks) : 0, cpm: imp ? eur2(spend / imp * 1000) : 0, freq: Math.round(num(i.frequency) * 100) / 100, purchases, revenue: eur2(revenue), roas: spend ? Math.round(revenue / spend * 100) / 100 : 0, cpa: purchases ? eur2(spend / purchases) : 0 };
}
/* Savoir-faire : lecture des chiffres comme le ferait un média-buyer (repères e-commerce France, Facebook + Instagram) */
function adsWhy(k, cfg, goal) {
  const w = [];
  if (k.imp < 1000) return ['Pas encore assez de diffusion pour juger (moins de 1 000 affichages) : laisser tourner 3 à 4 jours sans rien toucher.'];
  w.push(k.ctr >= 1.5 ? `Accroche forte : ${k.ctr} % de clics (repère : 1 %). Le visuel et la première phrase arrêtent le défilement.` : k.ctr >= 0.9 ? `Clics dans la moyenne (${k.ctr} %). Tester une accroche plus directe ou un visuel du produit en action.` : `Peu de clics (${k.ctr} %, repère 1 %) : le visuel n'arrête pas le défilement. Montrer le résultat (avant/après) dès la première seconde.`);
  if (k.cpm) w.push(k.cpm <= 8 ? `Diffusion peu chère (${k.cpm} € pour 1 000 affichages) : l'audience large fonctionne.` : `Diffusion chère (${k.cpm} € pour 1 000) : élargir l'audience ou laisser Meta choisir (Advantage+).`);
  if (k.freq >= 3.5) w.push(`Usure : chaque personne a vu la pub ${k.freq} fois. Remplacer le visuel avant que les résultats baissent.`);
  if (goal === 'ventes' || k.purchases) w.push(k.purchases ? `Rentabilité : ${k.purchases} vente(s), ${k.cpa} € par vente, chaque euro dépensé rapporte ${k.roas} € (objectif ${cfg.roas}).` : k.spend >= cfg.cpa ? `Aucune vente pour ${k.spend} € dépensés : la page d'arrivée ou le prix freinent, les clics ne se transforment pas.` : 'Pas encore de vente : normal sous le coût par vente visé.');
  return w;
}
/* Textes de pub prêts à l'emploi (accroche, texte, titre) pour chaque marque ; enrichis par l'IA gratuite (Groq) si elle est configurée */
const ADS_TPL = {
  pelo: { hooks: ['Fini les poils sur le canapé. 🐾', 'Chien ou chat ? Votre canapé va enfin respirer.', 'Le rouleau anti-poils qu’on ne jette jamais.'],
    body: 'Quelques allers-retours et les poils de chien et de chat disparaissent du canapé, du lit, des vêtements et de la voiture. Réutilisable à l’infini : sans recharge, sans adhésif, sans pile.\n✅ Livraison offerte en France\n✅ -30 % sur le lot de 2',
    heads: ['Rouleau anti-poils réutilisable', 'Livraison offerte · -30 % le lot de 2', 'Fini les poils, pour de bon'], cta: 'SHOP_NOW' },
  '7ideals': { hooks: ['Entre la rue et la galerie.', 'Pièces en série limitée. Pensées à Paris.', 'Ce que tu portes raconte une histoire.'],
    body: '7ideals DRIPSTUDIO : streetwear et art contemporain, Paris · New York · Cannes. Chaque collection est produite en petite série, comme une œuvre.\nDécouvre la nouvelle collection avant qu’elle ne disparaisse.',
    heads: ['7ideals DRIPSTUDIO · nouvelle collection', 'Série limitée · Paris', 'Le streetwear qui s’expose'], cta: 'SHOP_NOW' }
};
export async function adsCopy(brand, product) {
  const T = ADS_TPL[brand] || ADS_TPL.pelo, base = T.hooks.map((h, i) => ({ text: h + '\n\n' + T.body, head: T.heads[i % T.heads.length] }));
  if (!process.env.GROQ_API_KEY) return { variants: base, eng: 'modèles' };
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { authorization: 'Bearer ' + process.env.GROQ_API_KEY, 'content-type': 'application/json' }, signal: AbortSignal.timeout(20000),
      body: JSON.stringify({ model: (process.env.GROQ_MODEL || 'openai/gpt-oss-120b'), temperature: 0.7, max_completion_tokens: 1200, messages: [{ role: 'system', content: 'Tu es un média-buyer et concepteur-rédacteur expert des publicités Facebook et Instagram en France. Tu écris en français, phrases courtes, accroche dans les 5 premiers mots, bénéfice concret, preuve, appel à l’action. Pas de promesse fausse, pas de fausse urgence, pas de faux avis. Réponds uniquement en JSON : {"variants":[{"text":"…","head":"…"}]} avec 3 variantes, angles différents (problème/solution, bénéfice, preuve ou exclusivité). Titre ≤ 40 caractères, texte ≤ 450 caractères.' }, { role: 'user', content: 'Marque : ' + brand + '\nProduit : ' + (product || '') + '\nInformations : ' + T.body }] }) });
    const j = await r.json(), m = String(((((j.choices || [])[0] || {}).message) || {}).content || '').match(/\{[\s\S]*\}/), o = m ? JSON.parse(m[0]) : null;
    const v = (o && Array.isArray(o.variants) ? o.variants : []).map(x => ({ text: String(x.text || '').slice(0, 600), head: String(x.head || '').slice(0, 60) })).filter(x => x.text && x.head);
    return v.length ? { variants: v.slice(0, 3), eng: 'IA' } : { variants: base, eng: 'modèles' };
  } catch (e) { return { variants: base, eng: 'modèles' }; }
}
const ADS_GOALS = { trafic: { objective: 'OUTCOME_TRAFFIC', opt: 'LINK_CLICKS' }, notoriete: { objective: 'OUTCOME_AWARENESS', opt: 'REACH' }, ventes: { objective: 'OUTCOME_SALES', opt: 'OFFSITE_CONVERSIONS' } };
export async function adsState() {
  const cfg = await adsCfg(), mine = await adsMine(), log = ((await getJ('log', []))).slice(0, 30), missing = adsMissing();
  if (missing.length) return { connected: false, missing, cfg, log, pixel: !!process.env.META_PIXEL_ID };
  const act = ADS_ACT(), out = { connected: true, cfg, log, pixel: !!process.env.META_PIXEL_ID };
  out.account = await graph(act, { fields: 'name,currency,account_status,amount_spent,spend_cap,timezone_name' });
  const camps = (await graph(act + '/campaigns', { fields: 'id,name,status,effective_status,objective,daily_budget,created_time', limit: 50 })).data || [];
  const ins = (await graph(act + '/insights', { level: 'campaign', date_preset: 'last_7d', fields: 'campaign_id,spend,impressions,reach,clicks,inline_link_clicks,frequency,actions,action_values', limit: 100 })).data || [];
  const today = (await graph(act + '/insights', { date_preset: 'today', fields: 'spend' })).data || [];
  out.todaySpend = eur2((today[0] || {}).spend); out.week = adsKpi(ins.reduce((a, i) => { for (const k of ['spend', 'impressions', 'reach', 'clicks', 'inline_link_clicks']) a[k] = num(a[k]) + num(i[k]); a.actions = [...(a.actions || []), ...(i.actions || [])]; a.action_values = [...(a.action_values || []), ...(i.action_values || [])]; return a; }, {}));
  out.campaigns = camps.map(c => { const i = ins.find(x => x.campaign_id === c.id) || {}, k = adsKpi(i), me = mine[c.id] || {}; return { id: c.id, name: c.name, status: c.status, eff: c.effective_status, objective: c.objective, daily: eur2(num(c.daily_budget) / 100), brand: me.brand || '', goal: me.goal || '', k, why: adsWhy(k, cfg, me.goal), ours: !!mine[c.id] }; });
  return out;
}
export async function adsCreate(d) {
  const miss = adsMissing(); if (miss.length) throw err(400, 'À configurer : ' + miss.join(', '));
  const brand = d.brand === '7ideals' ? '7ideals' : 'pelo', goal = ADS_GOALS[d.goal] ? d.goal : 'trafic', G = ADS_GOALS[goal], act = ADS_ACT();
  if (goal === 'ventes' && !process.env.META_PIXEL_ID) throw err(400, 'L’objectif Ventes demande un pixel Meta (META_PIXEL_ID). Choisis Trafic en attendant.');
  const budget = Math.round(num(d.budget) * 100); if (budget < 100) throw err(400, 'Budget minimum : 1 € par jour');
  const url = String(d.url || '').trim(); if (!/^https:\/\/[^\s]+$/.test(url)) throw err(400, 'Lien de destination invalide (https://…)');
  const imgs = (Array.isArray(d.images) ? d.images : []).map(s => String(s).trim()).filter(s => /^https:\/\/[^\s]+$/.test(s)).slice(0, 5); if (!imgs.length) throw err(400, 'Ajoute au moins une image (lien https)');
  const vars = (Array.isArray(d.variants) ? d.variants : []).map(v => ({ text: String(v.text || '').slice(0, 600), head: String(v.head || '').slice(0, 60) })).filter(v => v.text && v.head).slice(0, 3); if (!vars.length) throw err(400, 'Ajoute au moins un texte');
  const countries = (Array.isArray(d.countries) ? d.countries : ['FR']).filter(c => /^[A-Z]{2}$/.test(c)).slice(0, 10), ageMin = Math.min(65, Math.max(18, num(d.ageMin) || 18)), ageMax = Math.min(65, Math.max(ageMin, num(d.ageMax) || 65));
  const tag = (brand === 'pelo' ? 'PELO' : '7ideals') + ' · ' + { trafic: 'Trafic', notoriete: 'Notoriété', ventes: 'Ventes' }[goal] + ' · ' + new Date().toISOString().slice(0, 10);
  const camp = await graph(act + '/campaigns', { name: tag, objective: G.objective, status: 'PAUSED', special_ad_categories: [], daily_budget: budget, bid_strategy: 'LOWEST_COST_WITHOUT_CAP' }, 'POST');
  const ids = { brand, goal, campaign: camp.id, adsets: [], ads: [], created: Date.now() };
  try {
    const as = await graph(act + '/adsets', { name: tag + ' · audience large', campaign_id: camp.id, billing_event: 'IMPRESSIONS', optimization_goal: G.opt, status: 'PAUSED', destination_type: goal === 'notoriete' ? undefined : 'WEBSITE',
      promoted_object: goal === 'ventes' ? { pixel_id: process.env.META_PIXEL_ID, custom_event_type: 'PURCHASE' } : undefined,
      targeting: { geo_locations: { countries }, age_min: ageMin, age_max: ageMax, targeting_automation: { advantage_audience: 1 } } }, 'POST');
    ids.adsets.push(as.id);
    let n = 0;
    for (const img of imgs) for (const v of vars) {
      if (n >= 6) break; n++;
      const cr = await graph(act + '/adcreatives', { name: tag + ' · visuel ' + n, object_story_spec: { page_id: process.env.META_PAGE_ID, ...(process.env.META_IG_ID ? { instagram_user_id: process.env.META_IG_ID } : {}), link_data: { link: url, message: v.text, name: v.head, picture: img, call_to_action: { type: (ADS_TPL[brand] || ADS_TPL.pelo).cta, value: { link: url } } } } }, 'POST');
      const ad = await graph(act + '/ads', { name: tag + ' · pub ' + n, adset_id: as.id, creative: { creative_id: cr.id }, status: 'PAUSED' }, 'POST'); ids.ads.push(ad.id);
    }
  } catch (e) { try { await graph(camp.id, {}, 'DELETE'); } catch (e2) {} throw e; }   // rien de bancal : si une étape échoue, la campagne est supprimée
  const mine = await adsMine(); mine[camp.id] = ids; await setJ('mine', mine);
  await adsLog(`Campagne créée en pause : ${tag} (${ids.ads.length} pub(s), ${budget / 100} € / jour). Rien n’est dépensé tant qu’elle n’est pas lancée.`);
  return { id: camp.id, ads: ids.ads.length };
}
export async function adsSetStatus(id, on) {
  const mine = await adsMine(), me = mine[id]; if (!me) throw err(404, 'Campagne inconnue de la plateforme');
  if (on) {
    const cfg = await adsCfg(); if (!(cfg.capDay > 0)) throw err(400, 'Fixe d’abord ton plafond de dépense par jour (réglages de la plateforme)');
    const camps = (await graph(ADS_ACT() + '/campaigns', { fields: 'id,effective_status,daily_budget', limit: 100 })).data || [];
    const active = camps.filter(c => c.id !== id && ['ACTIVE', 'IN_PROCESS', 'WITH_ISSUES'].includes(c.effective_status)).reduce((a, c) => a + num(c.daily_budget) / 100, 0), mineBudget = num((camps.find(c => c.id === id) || {}).daily_budget) / 100;
    if (active + mineBudget > cfg.capDay) throw err(400, `Plafond dépassé : ${eur2(active)} € déjà actifs + ${eur2(mineBudget)} € > ${cfg.capDay} € par jour. Baisse un budget ou relève le plafond.`);
    for (const x of [...me.ads, ...me.adsets]) await graph(x, { status: 'ACTIVE' }, 'POST');
  }
  await graph(id, { status: on ? 'ACTIVE' : 'PAUSED' }, 'POST');
  await adsLog((on ? 'Lancée : ' : 'Mise en pause : ') + id); return { ok: 1 };
}
/* Pilote automatique (toutes les 3 h) : coupe ce qui gaspille, signale l'usure, augmente ce qui rapporte, ne dépasse jamais le plafond, reporte la dépense en Compta / Finance */
export async function adsAuto() {
  if (adsMissing().length) return { skip: 'non configuré' };
  const cfg = await adsCfg(), mine = await adsMine(), act = ADS_ACT(), notes = [];
  const today = num((((await graph(act + '/insights', { date_preset: 'today', fields: 'spend' })).data || [])[0] || {}).spend);
  const camps = (await graph(act + '/campaigns', { fields: 'id,name,effective_status,daily_budget', limit: 100 })).data || [], live = camps.filter(c => mine[c.id] && c.effective_status === 'ACTIVE');
  if (cfg.capDay > 0 && today > cfg.capDay * 1.2) { for (const c of live) await graph(c.id, { status: 'PAUSED' }, 'POST'); notes.push(`Sécurité : ${eur2(today)} € dépensés aujourd’hui pour un plafond de ${cfg.capDay} € → toutes les campagnes mises en pause.`); }
  else for (const c of live) {
    const me = mine[c.id], ads = (await graph(c.id + '/insights', { level: 'ad', date_preset: 'last_3d', fields: 'ad_id,ad_name,spend,impressions,clicks,inline_link_clicks,frequency,actions,action_values' })).data || [];
    let alive = ads.length;
    for (const a of ads) {
      const k = adsKpi(a);
      if (cfg.autoPause && alive > 1 && ((k.imp >= 1500 && k.ctr < 0.6) || (me.goal === 'ventes' && k.spend >= 2 * cfg.cpa && !k.purchases))) { await graph(a.ad_id, { status: 'PAUSED' }, 'POST'); alive--; notes.push(`Pub coupée (${a.ad_name}) : ${k.ctr < 0.6 ? 'trop peu de clics (' + k.ctr + ' %)' : k.spend + ' € sans vente'}.`); }
      else if (k.freq >= 3.5) notes.push(`Usure sur « ${a.ad_name} » (vue ${k.freq} fois par personne) : prévoir un nouveau visuel.`);
    }
    const tot = adsKpi(ads.reduce((s, i) => { for (const k of ['spend', 'impressions', 'clicks', 'inline_link_clicks']) s[k] = num(s[k]) + num(i[k]); s.actions = [...(s.actions || []), ...(i.actions || [])]; s.action_values = [...(s.action_values || []), ...(i.action_values || [])]; return s; }, {}));
    if (cfg.autoScale && tot.roas >= cfg.roas && tot.purchases >= 2) {
      const cur = num(c.daily_budget) / 100, others = live.filter(x => x.id !== c.id).reduce((s, x) => s + num(x.daily_budget) / 100, 0), next = Math.min(Math.round(cur * 1.2 * 100) / 100, cfg.capDay - others);
      if (next > cur + 0.5 && (!me.scaled || Date.now() - me.scaled > 72 * 3600000)) { await graph(c.id, { daily_budget: Math.round(next * 100) }, 'POST'); me.scaled = Date.now(); notes.push(`Budget augmenté sur ${c.name} : ${cur} € → ${next} € par jour (rentabilité ${tot.roas}).`); }
    }
  }
  await setJ('mine', mine);
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10), booked = (await getJ('booked', {}));
  if (!booked[y]) {   // dépense de la veille → Compta (achat) et Finance (projet PELO), une fois par jour
    const queue = await getJ('sync', []), spendLog = await getJ('spend', []);
    const rows = (await graph(act + '/insights', { level: 'campaign', time_range: { since: y, until: y }, fields: 'campaign_id,campaign_name,spend' })).data || [];
    for (const r of rows) { const sp = eur2(r.spend); if (!(sp > 0)) continue; const me = mine[r.campaign_id] || {}, id = 'ads-' + y + '-' + r.campaign_id, label = 'Publicité Meta · ' + r.campaign_name;
      if (me.brand === 'pelo') queue.push({ id, kind: 'buy', amount: sp, date: y, label, who: 'Meta Platforms Ireland', ref: r.campaign_id });
      spendLog.push({ date: y, brand: me.brand || '?', campaign: r.campaign_name, spend: sp }); }
    await setJ('sync', queue.slice(-300)); await setJ('spend', spendLog.slice(-1000));
    booked[y] = 1; await setJ('booked', Object.fromEntries(Object.entries(booked).slice(-60)));
  }
  for (const n of notes) await adsLog(n);
  if (notes.length) await notify('📣 7ideals Ads', notes.join('\n'));
  await flushSync();
  return { notes: notes.length };
}
