// /api/search — web search and page reading for Codeply's phone and web apps.
//
// POST { query, num? }        -> { ok, via, results: [{ title, url, snippet, content, published }], text }
// POST { urls: [...] }        -> { ok, via: 'fetch', results: [...], text }   (read pages the user linked)
//
// The apps used to call Exa's keyless MCP straight from the browser. That endpoint now rate-limits after a
// handful of calls, so searches failed. Here the server searches instead, fastest working source first:
//   1. Exa's API, when EXA_API_KEY is set (free account at dashboard.exa.ai; best results, page text included)
//   2. Brave Search, when BRAVE_API_KEY is set (free plan at api-dashboard.search.brave.com)
//   3. Keyless, raced: Exa's public MCP and DuckDuckGo's HTML results; Wikipedia if both fail
// Results without page text get the top pages read here, so the model answers from the pages, not snippets.
// Signed-in users only (Bearer token, like the other routes), so this is not an open proxy.
import { requireUser, getJsonBody } from './auth.js';
import { applyCors } from '../lib/cors.js';
import dns from 'node:dns/promises';
import net from 'node:net';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const PAGE_CHARS = 2600;     // text kept per result page
const LINK_CHARS = 9000;     // text kept per page the user linked
const cache = new Map();     // query -> { at, body }, per warm instance
const CACHE_MS = 10 * 60 * 1000;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', hellip: '...', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', copy: '(c)' };
function decodeEntities(s) {
  return String(s || '')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ''; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ''; } })
    .replace(/&([a-z]+);/gi, (m, n) => (ENTITIES[n.toLowerCase()] ?? m));
}
const stripTags = (s) => decodeEntities(String(s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

/** HTML -> readable text: the article if there is one, without menus, scripts and footers. */
function htmlToText(html) {
  let s = String(html);
  const main = /<(article|main)\b[^>]*>([\s\S]*?)<\/\1>/i.exec(s);
  if (main && main[2].length > 1500) s = main[2];
  s = s.replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|noscript|template|svg|iframe|head|nav|footer|header|aside|form|button|select)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n\n${'#'.repeat(Number(n))} ${stripTags(t)}\n\n`)
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|ul|ol|table|tr|blockquote|figure)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s).replace(/[ \t\f\v]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n');
  // drop lines that are only a word or two (leftover buttons and labels)
  return s.split('\n').filter((l) => !l.trim() || l.trim().split(' ').length > 3 || /^#/.test(l.trim())).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** A public http(s) address: never localhost, private ranges or cloud metadata. */
async function publicUrl(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(host)) return null;
  let addrs = [];
  try { addrs = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true })).map((a) => a.address); } catch { return null; }
  const priv = (ip) => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|::1$|::$|f[cd]|fe80:|::ffff:(10|127|169\.254|192\.168)\.)/i.test(ip);
  if (!addrs.length || addrs.some(priv)) return null;
  return u.href;
}

async function readPage(url, maxChars, ms = 7000) {
  // redirects are followed by hand, so each hop is checked for a private address too
  const signal = AbortSignal.timeout(ms);
  let safe = await publicUrl(url);
  let res;
  for (let hop = 0; ; hop++) {
    if (!safe) throw new Error('not a public web address');
    res = await fetch(safe, { redirect: 'manual', signal, headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.5', 'Accept-Language': 'en-US,en;q=0.9' } });
    const next = res.status >= 300 && res.status < 400 && res.headers.get('location');
    if (!next) break;
    if (hop >= 4) throw new Error('too many redirects');
    safe = await publicUrl(new URL(next, safe).href);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = (res.headers.get('content-type') || '').toLowerCase();
  if (!/html|text|json|xml/.test(type) && type) throw new Error(`not text (${type.split(';')[0]})`);
  const body = (await res.text()).slice(0, 2_000_000);
  const title = stripTags((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(body) || [])[1] || '');
  const text = /html/.test(type) || /^\s*<(!doctype|html)/i.test(body) ? htmlToText(body) : body;
  return { title, url: safe, content: text.slice(0, maxChars) };
}

// ─── Sources ────────────────────────────────────────────────────────────────
async function exaApi(query, num) {
  const res = await fetch('https://api.exa.ai/search', {
    method: 'POST', signal: AbortSignal.timeout(12000),
    headers: { 'x-api-key': process.env.EXA_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, numResults: num, type: 'auto', contents: { text: { maxCharacters: PAGE_CHARS }, livecrawl: 'fallback' } }),
  });
  if (!res.ok) throw new Error(`Exa ${res.status}`);
  const j = await res.json();
  const results = (j.results || []).map((r) => ({ title: r.title || r.url, url: r.url, published: r.publishedDate || '', snippet: '', content: (r.text || '').slice(0, PAGE_CHARS) }));
  if (!results.length) throw new Error('Exa: no results');
  return results;
}

async function brave(query, num) {
  const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${num}&extra_snippets=true`, {
    signal: AbortSignal.timeout(9000), headers: { Accept: 'application/json', 'X-Subscription-Token': process.env.BRAVE_API_KEY },
  });
  if (!res.ok) throw new Error(`Brave ${res.status}`);
  const j = await res.json();
  const results = ((j.web && j.web.results) || []).map((r) => ({ title: stripTags(r.title), url: r.url, published: r.page_age || r.age || '', snippet: stripTags([r.description, ...(r.extra_snippets || [])].join(' ')), content: '' }));
  if (!results.length) throw new Error('Brave: no results');
  return results;
}

/** Exa's keyless MCP: rate-limited per address, so it is one of two raced sources, never the only one. */
async function exaMcp(query, num) {
  const res = await fetch('https://mcp.exa.ai/mcp', {
    method: 'POST', signal: AbortSignal.timeout(6000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'web_search_exa', arguments: { query, numResults: num, objective: `Find current, reliable pages that answer: ${query}` } } }),
  });
  if (!res.ok) throw new Error(`Exa MCP ${res.status}`);
  const raw = await res.text();
  const payloads = raw.trimStart().startsWith('{') ? [raw] : raw.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim());
  for (const p of payloads) {
    let j; try { j = JSON.parse(p); } catch { continue; }
    if (j.error) throw new Error(/rate limit/i.test(j.error.message || '') ? 'Exa MCP rate limited' : 'Exa MCP error');
    const text = ((j.result && j.result.content) || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    // "Title: ...\nURL: ...\nPublished: ...\n...text" blocks
    const results = text.split(/\n(?=Title: )/).map((block) => {
      const get = (k) => ((new RegExp(`^${k}: (.*)$`, 'm')).exec(block) || [])[1] || '';
      const body = block.replace(/^(Title|URL|Published|Author|Highlights):.*$/gm, '').trim();
      return { title: get('Title'), url: get('URL'), published: get('Published').replace('N/A', ''), snippet: '', content: body.slice(0, PAGE_CHARS) };
    }).filter((r) => /^https?:/.test(r.url));
    if (results.length) return results.slice(0, num);
  }
  throw new Error('Exa MCP: no results');
}

async function duckduckgo(query, num) {
  const res = await fetch('https://html.duckduckgo.com/html/', {
    method: 'POST', signal: AbortSignal.timeout(6000),
    headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept-Language': 'en-US,en;q=0.9' },
    body: `q=${encodeURIComponent(query)}&kl=wt-wt`,
  });
  if (!res.ok) throw new Error(`DuckDuckGo ${res.status}`);
  const html = await res.text();
  const results = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/gi;
  let m;
  while ((m = re.exec(html)) && results.length < num) {
    let href = decodeEntities(m[1]);
    const u = /[?&]uddg=([^&]+)/.exec(href);
    if (u) { try { href = decodeURIComponent(u[1]); } catch {} }
    if (/duckduckgo\.com\/y\.js|bing\.com\/aclick/.test(href)) continue; // ads
    const title = stripTags(m[2]);
    if (title && /^https?:/.test(href)) results.push({ title, url: href, published: '', snippet: stripTags(m[3]), content: '' });
  }
  if (!results.length) throw new Error('DuckDuckGo: no results');
  return results;
}

async function wikipedia(query, num) {
  const res = await fetch(`https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${Math.min(num, 4)}&prop=extracts|info&inprop=url&exintro=1&explaintext=1&format=json`, {
    signal: AbortSignal.timeout(4000), headers: { 'User-Agent': 'Codeply/1.0 (https://codeply.app)' },
  });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const pages = Object.values(((await res.json()).query || {}).pages || {}).sort((a, b) => a.index - b.index);
  const results = pages.map((p) => ({ title: p.title, url: p.fullurl, published: '', snippet: '', content: String(p.extract || '').slice(0, PAGE_CHARS) }));
  if (!results.length) throw new Error('Wikipedia: no results');
  return results;
}

/** Fill in page text for the top results that only have a snippet. */
async function addPageText(results, deadline, n = 4) {
  const ms = Math.min(3500, deadline - Date.now()); // stay inside the function's time limit
  if (ms < 1000) return results;
  await Promise.all(results.slice(0, n).map(async (r) => {
    if (r.content && r.content.length > 400) return;
    try { const p = await readPage(r.url, PAGE_CHARS, ms); if (p.content.length > 200) r.content = p.content; } catch { /* the snippet stays */ }
  }));
  return results;
}

async function search(query, num) {
  const deadline = Date.now() + 8500;
  const errors = [];
  const attempt = async (name, fn) => { try { return { via: name, results: await fn() }; } catch (e) { errors.push(e.message); return null; } };
  let found = null;
  if (process.env.EXA_API_KEY) found = await attempt('exa', () => exaApi(query, num));
  if (!found && process.env.BRAVE_API_KEY) found = await attempt('brave', () => brave(query, num));
  if (!found) {
    // keyless: whichever of the two answers first
    found = await Promise.any([
      exaMcp(query, num).then((results) => ({ via: 'exa', results })),
      duckduckgo(query, num).then((results) => ({ via: 'duckduckgo', results })),
    ]).catch((agg) => { for (const e of agg.errors || []) errors.push(e.message); return null; });
  }
  if (!found) found = await attempt('wikipedia', () => wikipedia(query, num));
  if (!found) throw new Error(errors.join('; ') || 'no results');
  await addPageText(found.results, deadline);
  return found;
}

function asText(results) {
  return results.map((r, i) => [
    `[${i + 1}] ${r.title || r.url}`,
    `URL: ${r.url}`,
    r.published ? `Published: ${String(r.published).slice(0, 10)}` : '',
    r.snippet && !(r.content || '').includes(r.snippet.slice(0, 60)) ? r.snippet : '',
    r.content || '',
  ].filter(Boolean).join('\n')).join('\n\n---\n\n');
}

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed.' });
  }
  const user = await requireUser(req, res);
  if (!user) return;
  const body = getJsonBody(req);
  res.setHeader('Cache-Control', 'no-store');

  // Read pages the user linked
  if (Array.isArray(body.urls) && body.urls.length) {
    const urls = body.urls.slice(0, 3);
    const results = await Promise.all(urls.map((u) => readPage(u, LINK_CHARS, 10000).then((p) => ({ ...p, snippet: '', published: '' })).catch((e) => ({ title: String(u), url: String(u), snippet: '', published: '', content: `(could not read this page: ${e.message})` }))));
    return res.status(200).json({ ok: true, via: 'fetch', results, text: asText(results) });
  }

  const query = String(body.query || '').replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!query) return res.status(400).json({ ok: false, message: 'Nothing to search for.' });
  const num = Math.min(Math.max(Number(body.num) || 6, 1), 10);
  const key = `${num}:${query.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return res.status(200).json(hit.body);
  try {
    const { via, results } = await search(query, num);
    const out = { ok: true, via, results, text: asText(results) };
    cache.set(key, { at: Date.now(), body: out });
    if (cache.size > 200) cache.delete(cache.keys().next().value);
    return res.status(200).json(out);
  } catch (e) {
    return res.status(502).json({ ok: false, message: `The web search did not work (${e.message}).` });
  }
}
