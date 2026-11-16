/* Alertes sur le téléphone via ntfy (gratuit) : NTFY_URL = https://ntfy.sh/<sujet secret> */
export async function notify(title, body, tags = 'loudspeaker') {
  const u = process.env.NTFY_URL; if (!/^https:\/\/ntfy\.sh\/[A-Za-z0-9_-]{8,64}$/.test(u || '')) return false;
  try { await fetch(u, { method: 'POST', headers: { Title: encodeURIComponent(title), Tags: tags, 'Content-Type': 'text/plain; charset=utf-8' }, body: String(body).slice(0, 1000), signal: AbortSignal.timeout(6000) }); return true; } catch (e) { return false; }
}
