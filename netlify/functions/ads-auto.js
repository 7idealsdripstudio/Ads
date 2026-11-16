/* 7ideals Ads — pilote automatique toutes les 3 heures. */
import { adsAuto } from '../lib/ads.js';
export const config = { schedule: '7 */3 * * *' };
export default async () => { try { const r = await adsAuto(); console.log('ads-auto', JSON.stringify(r)); } catch (e) { console.error('ads-auto', e.message); } return new Response('ok'); };
