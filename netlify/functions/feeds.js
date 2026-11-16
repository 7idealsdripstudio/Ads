/* 7ideals Ads — flux gratuits : Google Shopping (annonces gratuites) et Pinterest (épingles automatiques). */
import { googleFeed, pinterestFeed } from '../lib/organic.js';
export const config = { path: ['/feed/google.xml', '/feed/pinterest.xml'] };
export default async req => {
  const p = new URL(req.url).pathname, xml = p.endsWith('google.xml') ? await googleFeed() : await pinterestFeed();
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=1800' } });
};
