/* 7ideals Ads — passage automatique toutes les 30 minutes : publie ce qui est prévu, prépare la semaine, relit les résultats. */
import { autoRun } from '../lib/organic.js';
export const config = { schedule: '*/30 * * * *' };
export default async () => { try { console.log('auto', JSON.stringify(await autoRun())); } catch (e) { console.error('auto', e.message); } return new Response('ok'); };
