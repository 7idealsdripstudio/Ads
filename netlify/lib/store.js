/* 7ideals Ads — stockage (Netlify Blobs) */
import { getStore } from '@netlify/blobs';
export const db = () => getStore({ name: 'ads', consistency: 'strong' });
export const getJ = async (k, d = null) => { try { const v = await db().get(k, { type: 'json' }); return v == null ? d : v; } catch (e) { return d; } };
export const setJ = (k, v) => db().setJSON(k, v);
export const del = k => db().delete(k);
export const list = async prefix => (await db().list({ prefix })).blobs.map(b => b.key);
