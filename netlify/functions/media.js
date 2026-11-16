/* 7ideals Ads — photos de la médiathèque, lisibles par Instagram, Facebook, Google et Pinterest. */
import { mediaFile } from '../lib/organic.js';
export const config = { path: '/media/:id' };
export default async (req, ctx) => {
  const id = String((ctx.params && ctx.params.id) || '').replace(/\.jpg$/, ''), f = await mediaFile(id);
  if (!f) return new Response('introuvable', { status: 404 });
  return new Response(f, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000, immutable', 'x-robots-tag': 'noindex' } });
};
