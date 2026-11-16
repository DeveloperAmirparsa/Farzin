'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Tiny .env reader keeps the app dependency-free. Environment variables already
// supplied by the shell always take precedence over values from the local file.
const localEnv = path.join(__dirname, '.env');
if (fs.existsSync(localEnv)) {
  for (const line of fs.readFileSync(localEnv, 'utf8').split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const ROOT = path.join(__dirname, 'public');
const DATA_DIR = process.env.FARZIN_DATA_DIR ? path.resolve(process.env.FARZIN_DATA_DIR) : path.join(__dirname, 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const PORT = Number(process.env.PORT || 3000);
const ADMIN_USER = String(process.env.ADMIN_USER || 'admin');
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || '');
// Listen on all interfaces so a TV / second device on the shop LAN can open the board.
const requestedHost = String(process.env.HOST || '').trim();
// Earlier v4/v5 .env files used 127.0.0.1. Override that legacy default so
// a TV or secondary device on the shop LAN can connect without editing .env.
const HOST = !requestedHost || ['127.0.0.1', 'localhost', '::1'].includes(requestedHost.toLowerCase())
  ? '0.0.0.0' : requestedHost;
const TGJU_FALLBACK_FEEDS = [
  'https://call.tgju.org/ajax.json',
  'https://call4.tgju.org/ajax.json',
  'https://call1.tgju.org/ajax.json',
  'https://call3.tgju.org/ajax.json'
];
// Optional endpoint override is useful for a trusted local proxy or an isolated test.
const TGJU_FEEDS = [...new Set([process.env.TGJU_FEED_URL, ...TGJU_FALLBACK_FEEDS].filter(Boolean))];
const TGJU_POLL_MS = 30_000;
const TGJU_ERROR_RETRY_MS = 8_000;
const TGJU_TIMEOUT_MS = 4_500;
const HISTORY_FILE = path.join(DATA_DIR, 'tgju-history.json');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon'
};

fs.mkdirSync(DATA_DIR, { recursive: true });

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2), { encoding: 'utf8', mode: 0o600 });
}
const responseCache = new Map();
const inflightRequests = new Map();
async function cached(key, ttlMs, factory) {
  const item = responseCache.get(key);
  if (item && Date.now() - item.at < ttlMs) return item.value;
  if (inflightRequests.has(key)) return inflightRequests.get(key);
  const request = Promise.resolve().then(factory).then(value => {
    responseCache.set(key, { at: Date.now(), value });
    return value;
  }).finally(() => inflightRequests.delete(key));
  inflightRequests.set(key, request);
  return request;
}
const DEFAULT_NEWS_FEED = 'https://feeds.bbci.co.uk/persian/rss.xml';
const LEGACY_DEFAULT_NEWS_FEED = 'https://news.google.com/rss/search?q=%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF+%D8%A7%DB%8C%D8%B1%D8%A7%D9%86+OR+%D8%B7%D9%84%D8%A7+OR+%D8%A7%D8%B1%D8%B2+OR+%D9%86%D9%81%D8%AA&hl=fa&gl=IR&ceid=IR:fa';
const DEFAULT_NEWS_FEEDS = [
  { url: DEFAULT_NEWS_FEED, name: 'BBC فارسی' },
  { url: 'https://rss.dw.com/syndication/feeds/dwworld.per.xml', name: 'دویچه‌وله فارسی' }
];
function decodeXml(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/\s+/g, ' ').trim();
}
async function fetchSingleNewsFeed(feedUrl, sourceLabel = '') {
  const safeUrl = String(feedUrl || '').trim();
  if (!safeUrl) throw new Error('نشانی خبرخوان تنظیم نشده است.');
  let parsed; try { parsed = new URL(safeUrl); } catch { throw new Error('نشانی خبرخوان معتبر نیست.'); }
  if (parsed.protocol !== 'https:') throw new Error('خبرخوان باید با HTTPS شروع شود.');
  const response = await fetch(parsed, { headers: { 'User-Agent': 'Mozilla/5.0 FarzinStoryStudio/6.4', 'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml' }, signal: AbortSignal.timeout(4_800) });
  if (!response.ok) throw new Error(`خبرخوان HTTP ${response.status}`);
  const xml = await response.text();
  const items = [...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map(match => {
    const chunk = match[2];
    const get = tag => { const m = chunk.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')); return decodeXml(m?.[1] || ''); };
    const title = get('title');
    const linkMatch = chunk.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i);
    const link = get('link') || linkMatch?.[1] || '';
    const published = get('pubDate') || get('published') || get('updated');
    const source = sourceLabel || get('source') || get('author') || parsed.hostname;
    return { title, link, source, published, timestamp: published && !Number.isNaN(Date.parse(published)) ? new Date(published).toISOString() : null };
  }).filter(item => item.title).slice(0, 30);
  return items;
}
async function fetchNewsFeed(feedUrl) {
  const safeUrl = String(feedUrl || '').trim();
  const feeds = safeUrl === DEFAULT_NEWS_FEED
    ? DEFAULT_NEWS_FEEDS
    : [{ url: safeUrl, name: '' }];
  const results = await Promise.allSettled(feeds.map(feed => fetchSingleNewsFeed(feed.url, feed.name)));
  const items = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
  if (!items.length) {
    const firstError = results.find(result => result.status === 'rejected')?.reason;
    throw new Error(firstError?.message || 'هیچ خبر فارسی از خبرخوان‌ها دریافت نشد.');
  }
  const seen = new Set();
  return items.filter(item => {
    // Persian editions are used by default; do not show English-only headlines.
    if (!/[\u0600-\u06FF]/.test(item.title)) return false;
    const key = item.title.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key); return true;
  }).sort((a, b) => (Date.parse(b.timestamp || '') || 0) - (Date.parse(a.timestamp || '') || 0)).slice(0, 24);
}

function parseNumeric(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined || value === '') return null;
  const fa = String(value).replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const cleaned = fa.replace(/٬|،|,/g, '').replace(/\s/g, '').replace(/٪|%/g, '').replace(/[^0-9+\-.]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '+') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}
function tgjuStamp(item, receivedAt) {
  const raw = item?.ts || item?.timestamp || item?.updated_at || item?.updatedAt || item?.datetime;
  if (raw !== undefined && raw !== null && raw !== '') {
    if (typeof raw === 'number' || /^\d{10,13}$/.test(String(raw).trim())) {
      const numeric = Number(raw);
      const milliseconds = String(Math.trunc(numeric)).length <= 10 ? numeric * 1000 : numeric;
      const date = new Date(milliseconds);
      if (Number.isFinite(date.getTime())) return date.toISOString();
    }
    const text = String(raw).trim();
    // TGJU's feed commonly returns local Tehran time without an offset.
    const normalized = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(text)
      ? text.replace(' ', 'T') + '+03:30'
      : text;
    const date = new Date(normalized);
    if (Number.isFinite(date.getTime())) return date.toISOString();
  }
  // Some TGJU quote objects only include the clock in `dt`; retain receipt time
  // rather than inventing an exchange timestamp from an incomplete clock.
  return receivedAt;
}
function getTgjuRecord(current, keys) {
  for (const key of keys) {
    const item = current?.[key];
    if (item && typeof item === 'object') return { key, item };
  }
  return null;
}
const TGJU_MAP = {
  mazaneh: { keys: ['mesghal'], toman: true, unit: 'تومان' },
  gram18: { keys: ['geram18'], toman: true, unit: 'تومان' },
  coin_full: { keys: ['sekee', 'emami'], toman: true, unit: 'تومان' },
  coin_old: { keys: ['sekeb', 'sekeb_old', 'bahar'], toman: true, unit: 'تومان' },
  coin_half: { keys: ['nim', 'nim_sekeh'], toman: true, unit: 'تومان' },
  coin_quarter: { keys: ['rob', 'rob_sekkeh'], toman: true, unit: 'تومان' },
  coin_gerami: { keys: ['gerami'], toman: true, unit: 'تومان' },
  gram24: { keys: ['geram24'], toman: true, unit: 'تومان' },
  ounce: { keys: ['ons', 'gold_global'], toman: false, unit: 'دلار' },
  usd: { keys: ['price_dollar_rl'], toman: true, unit: 'تومان' },
  aed: { keys: ['price_aed'], toman: true, unit: 'تومان' },
  eur: { keys: ['price_eur'], toman: true, unit: 'تومان' },
  silver: { keys: ['silver_999'], toman: true, unit: 'تومان / گرم' },
  oil: { keys: ['energy_brent_oil', 'energy-brent-oil', 'oil-brent', 'oil_brent', 'brent'], toman: false, unit: 'دلار / بشکه' }
};
let tgjuRefreshPromise = null;
let tgjuLastAttemptAt = 0;
let tgjuLastSuccessAt = null;
let tgjuLastError = '';
let tgjuSnapshot = {
  status: 'connecting', source: 'TGJU', updated_at: null, received_at: null,
  prices: {}, sideRates: {}, assets: {}, history: { points: [] }, errors: { tgju: 'در انتظار اولین دریافت از TGJU' },
  providers: { tgju: false }, hasPrices: false, market_open: null, cache_window_seconds: 30
};
let priceHistory = readJson(HISTORY_FILE, []);
if (!Array.isArray(priceHistory)) priceHistory = [];

function normalizeTgjuRecord(item, map, receivedAt, previousValue) {
  const rawPrice = parseNumeric(item?.p ?? item?.price ?? item?.value ?? item?.last);
  if (!Number.isFinite(rawPrice) || rawPrice <= 0) return null;
  const price = map.toman ? rawPrice / 10 : rawPrice;
  const pctRaw = parseNumeric(item?.dp ?? item?.change_pct ?? item?.changePercent ?? item?.percent);
  const changeAmount = parseNumeric(item?.d ?? item?.change ?? item?.diff);
  const rawTrend = String(item?.dt ?? item?.direction ?? item?.trend ?? '').toLowerCase();
  const explicitDown = /down|نزول|کاه|negative|bear|(^|\s)-/.test(rawTrend);
  const explicitUp = /up|صعود|افزای|positive|bull|(^|\s)\+/.test(rawTrend);
  let pct = Number.isFinite(pctRaw) ? pctRaw : (Number.isFinite(changeAmount) && rawPrice ? (changeAmount / (rawPrice - changeAmount || rawPrice)) * 100 : 0);
  if (explicitDown) pct = -Math.abs(pct);
  else if (explicitUp) pct = Math.abs(pct);
  const direction = explicitDown ? 'down' : explicitUp ? 'up' : (previousValue && price > previousValue ? 'up' : previousValue && price < previousValue ? 'down' : pct > 0.0001 ? 'up' : pct < -0.0001 ? 'down' : 'flat');
  if (direction === 'down') pct = -Math.abs(pct);
  return {
    price, change_pct: Number.isFinite(pct) ? pct : 0, direction,
    updated_at: tgjuStamp(item, receivedAt), timestamp_is_fallback: !(item?.ts || item?.timestamp || item?.updated_at || item?.updatedAt), source: 'TGJU', unit: map.unit,
    raw_symbol: item?.symbol || null, low: parseNumeric(item?.l ?? item?.low) === null ? null : parseNumeric(item?.l ?? item?.low) / (map.toman ? 10 : 1),
    high: parseNumeric(item?.h ?? item?.high) === null ? null : parseNumeric(item?.h ?? item?.high) / (map.toman ? 10 : 1)
  };
}
async function fetchTgjuFrom(base) {
  const url = `${base}?_=${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36',
      'Accept': 'application/json, text/plain, */*', 'Referer': 'https://www.tgju.org/',
      'Origin': 'https://www.tgju.org', 'Cache-Control': 'no-cache', 'Pragma': 'no-cache'
    }, signal: AbortSignal.timeout(TGJU_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`${new URL(base).hostname}: HTTP ${response.status}`);
  const body = await response.json();
  const current = body?.current || body?.data?.current || body?.data || body?.rates || body;
  if (!current || typeof current !== 'object' || Array.isArray(current)) throw new Error(`${new URL(base).hostname}: ساختار پاسخ TGJU شناخته نشد.`);
  const probe = getTgjuRecord(current, ['geram18', 'price_dollar_rl', 'sekee']);
  if (!probe || parseNumeric(probe.item?.p ?? probe.item?.price ?? probe.item?.value ?? probe.item?.last) === null) {
    throw new Error(`${new URL(base).hostname}: نمادهای اصلی قیمت در پاسخ پیدا نشدند.`);
  }
  return { current, feed: new URL(base).hostname };
}
async function fetchTgjuFeed() {
  // Race the first two mirrors so a slow/down host cannot hold the TV in a
  // connecting state. The remaining mirrors are only tried if both fail.
  let errors = [];
  for (let i = 0; i < TGJU_FEEDS.length; i += 2) {
    const batch = TGJU_FEEDS.slice(i, i + 2);
    try {
      return await Promise.any(batch.map(base => fetchTgjuFrom(base)));
    } catch (error) {
      errors.push(...(error instanceof AggregateError ? error.errors : [error]));
    }
  }
  const message = errors.map(error => error?.message || String(error)).filter(Boolean).join(' | ');
  throw new Error(message || 'منبع TGJU در دسترس نیست.');
}
function saveTgjuHistory(gram18) {
  if (!gram18 || !Number.isFinite(gram18.price)) return;
  const now = Date.now();
  const last = priceHistory.at(-1);
  // Store one sample per poll, even when the visible quote has not moved.
  if (!last || now - Number(last.timestamp || 0) >= 25_000) {
    priceHistory.push({ timestamp: now, price: gram18.price });
    priceHistory = priceHistory.slice(-1440);
    try { writeJson(HISTORY_FILE, priceHistory); } catch (error) { console.warn('Could not save TGJU chart history:', error.message); }
  }
}
function makeTgjuSnapshot(current, feed) {
  const receivedAt = new Date().toISOString();
  const prices = {};
  const sideRates = {};
  const assets = {};
  const errors = {};
  // Preserve every usable symbol exposed by TGJU's live feed, not only the
  // handful of aliases used by the default Farzin tables. Custom rows can
  // resolve any key in this map through their symbol field.
  for (const [symbol, item] of Object.entries(current)) {
    if (!item || typeof item !== 'object') continue;
    const generic = normalizeTgjuRecord(item, { toman: false, unit: '' }, receivedAt, tgjuSnapshot.assets?.[symbol]?.price);
    if (generic) assets[symbol] = { ...generic, symbol, label: String(item.name || item.title || item.n || item.symbol || symbol), category: String(item.category || item.market || '') };
  }
  const previous = { ...tgjuSnapshot.prices, ...tgjuSnapshot.sideRates };
  for (const [target, config] of Object.entries(TGJU_MAP)) {
    const found = getTgjuRecord(current, config.keys);
    const normalized = found ? normalizeTgjuRecord(found.item, config, receivedAt, previous[target]?.price) : null;
    if (!normalized) { errors[target] = `نماد ${config.keys.join('/')} در پاسخ TGJU موجود نیست یا قیمت معتبری ندارد.`; continue; }
    if (target === 'usd' || target === 'aed' || target === 'eur' || target === 'silver' || target === 'oil') sideRates[target] = normalized;
    else prices[target] = normalized;
  }
  // TGJU does not list a separate 21-karat gram symbol in the public market feed;
  // calculate it transparently from the same 18-karat live quote.
  if (prices.gram18) {
    prices.gram21 = {
      ...prices.gram18, price: prices.gram18.price * (21 / 18),
      source: 'TGJU · محاسبه‌شده از طلای ۱۸ عیار', derived: true,
      note: 'محاسبه از نرخ ۱۸ عیار × ۲۱ ÷ ۱۸'
    };
  } else errors.gram21 = 'برای محاسبه طلای ۲۱ عیار، نرخ ۱۸ عیار TGJU لازم است.';
  if (prices.coin_full) prices.coin_full.quote_note = 'نرخ عمومی سکه امامی TGJU؛ نماد مجزای سال ضرب ۱۳۸۶ در فید عمومی موجود نیست.';
  if (prices.coin_half) prices.coin_half.quote_note = 'نرخ عمومی نیم‌سکه TGJU؛ نماد مجزای سال ضرب ۱۳۸۶ در فید عمومی موجود نیست.';
  if (prices.coin_quarter) prices.coin_quarter.quote_note = 'نرخ عمومی ربع‌سکه TGJU؛ نماد مجزای سال ضرب ۱۳۸۶ در فید عمومی موجود نیست.';
  if (prices.coin_old) prices.coin_old.quote_note = 'سکه بهار آزادی (طرح قدیم) در TGJU.';
  saveTgjuHistory(prices.gram18);
  const timestamps = [...Object.values(prices), ...Object.values(sideRates)].map(x => x?.updated_at).filter(Boolean);
  const latestTimestamp = timestamps.map(value => ({ value, time: Date.parse(value) })).filter(x => Number.isFinite(x.time)).sort((a,b)=>b.time-a.time)[0]?.value || receivedAt;
  const goldStamp = prices.gram18?.updated_at ? Date.parse(prices.gram18.updated_at) : NaN;
  const ageMs = Number.isFinite(goldStamp) && !prices.gram18?.timestamp_is_fallback ? Math.max(0, Date.now() - goldStamp) : Infinity;
  const hasPrices = [...Object.values(prices), ...Object.values(sideRates), ...Object.values(assets)].some(x => x && Number.isFinite(x.price) && x.price > 0);
  const realSymbols = Object.keys(assets).length || (Object.keys(prices).length + Object.keys(sideRates).length);
  const missingRequired = ['mazaneh','gram18','coin_full','coin_old','coin_half','coin_quarter','coin_gerami','gram24','ounce','usd','aed','eur','silver','oil'].filter(k => !(prices[k] || sideRates[k]));
  const points = priceHistory.map(x => ({ timestamp: x.timestamp, price: x.price }));
  return {
    status: hasPrices ? (missingRequired.length ? 'partial' : 'online') : 'offline', source: 'TGJU', source_host: feed,
    updated_at: latestTimestamp, received_at: receivedAt, prices, sideRates, assets,
    history: { points, updated_at: receivedAt, source: 'TGJU · نمونه‌های ذخیره‌شده محلی' },
    errors: { ...errors }, providers: { tgju: hasPrices }, hasPrices, market_open: Number.isFinite(ageMs) ? ageMs < 5 * 60_000 : null,
    market_status_updated_at: prices.gram18?.updated_at || null,
    market_status_note: 'بر اساس تازگی آخرین نرخ گرم طلای ۱۸ عیار در TGJU', fetched_at: receivedAt,
    cache_window_seconds: TGJU_POLL_MS / 1000, symbol_count: realSymbols
  };
}
async function refreshTgjuSnapshot(force = false) {
  if (tgjuRefreshPromise) return tgjuRefreshPromise;
  if (!force && Date.now() - tgjuLastAttemptAt < TGJU_POLL_MS) return tgjuSnapshot;
  tgjuLastAttemptAt = Date.now();
  tgjuSnapshot = { ...tgjuSnapshot, status: tgjuSnapshot.hasPrices ? 'stale' : 'connecting', errors: {} };
  tgjuRefreshPromise = (async () => {
    try {
      const { current, feed } = await fetchTgjuFeed();
      tgjuSnapshot = makeTgjuSnapshot(current, feed);
      tgjuLastSuccessAt = Date.now();
      tgjuLastError = '';
      return tgjuSnapshot;
    } catch (error) {
      tgjuLastError = error.message || 'ارتباط با TGJU ناموفق بود.';
      tgjuSnapshot = {
        ...tgjuSnapshot,
        status: tgjuSnapshot.hasPrices ? 'stale' : 'offline',
        errors: { tgju: tgjuLastError }, last_error: tgjuLastError,
        last_attempt_at: new Date().toISOString(),
        providers: { tgju: Boolean(tgjuSnapshot.hasPrices) }
      };
      return tgjuSnapshot;
    } finally { tgjuRefreshPromise = null; }
  })();
  return tgjuRefreshPromise;
}
function getDashboardSnapshot() {
  const retryWindow = tgjuSnapshot.status === 'offline' || tgjuSnapshot.status === 'connecting' ? TGJU_ERROR_RETRY_MS : TGJU_POLL_MS;
  if (!tgjuLastAttemptAt || Date.now() - tgjuLastAttemptAt >= retryWindow) void refreshTgjuSnapshot(true);
  return { ...tgjuSnapshot, prices: { ...tgjuSnapshot.prices }, sideRates: { ...tgjuSnapshot.sideRates }, assets: { ...(tgjuSnapshot.assets || {}) }, errors: { ...(tgjuSnapshot.errors || {}) }, history: tgjuSnapshot.history || { points: [] }, hasPrices: Boolean(tgjuSnapshot.hasPrices) };
}
function getLocalAddresses() {
  const out = [];
  for (const records of Object.values(os.networkInterfaces())) for (const item of records || []) {
    if (item.family === 'IPv4' && !item.internal) out.push(item.address);
  }
  return [...new Set(out)];
}

function isAdminAuthorized(req) {
  if (!ADMIN_PASSWORD) return true; // Local development only; deployment templates set a password.
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Basic ')) return false;
  let decoded = ''; try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); } catch { return false; }
  const split = decoded.indexOf(':'); if (split < 0) return false;
  const user = decoded.slice(0, split), password = decoded.slice(split + 1);
  const safeEqual = (a, b) => { const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b)); return aa.length === bb.length && crypto.timingSafeEqual(aa, bb); };
  return safeEqual(user, ADMIN_USER) && safeEqual(password, ADMIN_PASSWORD);
}
function requireAdmin(req, res) {
  if (isAdminAuthorized(req)) return true;
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm=\"Farzin Admin\", charset=\"UTF-8\"', 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('ورود مدیر لازم است.');
  return false;
}
function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}
function readBody(req, max = 1_000_000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > max) { reject(new Error('حجم درخواست بیش از حد مجاز است.')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('ساختار JSON معتبر نیست.')); }
    });
    req.on('error', reject);
  });
}
async function routeApi(req, res, pathname) {
  if ((pathname === '/api/config' || (pathname === '/api/logo' && req.method === 'POST')) && !requireAdmin(req, res)) return;
  if (pathname === '/api/logo' && req.method === 'POST') {
    try {
      const body = await readBody(req, 18_000_000);
      const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.dataUrl || ''));
      if (!match) return sendJson(res, 400, { error: 'لوگو باید فایل PNG باشد.' });
      const bytes = Buffer.from(match[1], 'base64');
      if (bytes.length > 12_000_000 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
        return sendJson(res, 400, { error: 'فایل PNG معتبر نیست یا بیش از حد بزرگ است.' });
      }
      fs.writeFileSync(path.join(ROOT, 'farzin-logo.png'), bytes);
      return sendJson(res, 200, { ok: true, url: `/farzin-logo.png?v=${Date.now()}` });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'آپلود لوگو انجام نشد.' });
    }
  }
  if (pathname === '/api/health' && req.method === 'GET') {
    return sendJson(res, 200, {
      ok: true, serverTime: new Date().toISOString(), host: HOST, port: PORT,
      localAddresses: getLocalAddresses(), source: 'TGJU', tgjuStatus: tgjuSnapshot.status,
      tgjuLastSuccessAt: tgjuLastSuccessAt ? new Date(tgjuLastSuccessAt).toISOString() : null,
      tgjuLastAttemptAt: tgjuLastAttemptAt ? new Date(tgjuLastAttemptAt).toISOString() : null,
      tgjuLastError, cachedPrices: Boolean(tgjuSnapshot.hasPrices), uptimeSeconds: Math.round(process.uptime())
    });
  }

  if (pathname === '/api/public-config' && req.method === 'GET') {
    const settings = readJson(SETTINGS_FILE, null);
    if (settings && settings.boardConfig) delete settings.boardConfig.tgjuWidgetCode;
    return sendJson(res, 200, { settings, source: 'TGJU', refreshSeconds: 30 });
  }
  if (pathname === '/api/config' && req.method === 'GET') {
    const settings = readJson(SETTINGS_FILE, null);
    return sendJson(res, 200, { settings, apiKeyConfigured: false, arzhaamKeyConfigured: false, source: 'TGJU', sourceRequiresKey: false, refreshSeconds: 30 });
  }
  if (pathname === '/api/logo-meta' && req.method === 'GET') {
    try {
      const stat = fs.statSync(path.join(ROOT, 'farzin-logo.png'));
      return sendJson(res, 200, { version: stat.mtimeMs, size: stat.size });
    } catch {
      return sendJson(res, 404, { error: 'فایل لوگو پیدا نشد.' });
    }
  }

  if (pathname === '/api/config' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      if (body.settings && typeof body.settings === 'object') writeJson(SETTINGS_FILE, body.settings);
      return sendJson(res, 200, { ok: true, apiKeyConfigured: false, arzhaamKeyConfigured: false, source: 'TGJU' });
    } catch (error) {
      return sendJson(res, 400, { error: error.message || 'ذخیره تنظیمات انجام نشد.' });
    }
  }

  if (pathname === '/api/assets' && req.method === 'GET') {
    const snapshot = getDashboardSnapshot();
    const assets = Object.entries(snapshot.assets || {}).map(([symbol, item]) => ({ symbol, label: item.label || symbol, category: item.category || '', price: item.price, change_pct: item.change_pct, direction: item.direction, updated_at: item.updated_at, unit: item.unit || '' })).sort((a, b) => a.label.localeCompare(b.label, 'fa'));
    return sendJson(res, 200, { source: 'TGJU', updated_at: snapshot.updated_at, status: snapshot.status, assets, count: assets.length });
  }

  if (pathname === '/api/dashboard-data' && req.method === 'GET') {
    // Never make the board wait for TGJU. Return the last local snapshot immediately;
    // upstream polling runs independently in the background.
    return sendJson(res, 200, getDashboardSnapshot());
  }
  if (pathname === '/api/refresh' && (req.method === 'GET' || req.method === 'POST')) {
    void refreshTgjuSnapshot(true);
    return sendJson(res, 202, { ok: true, status: tgjuSnapshot.status, message: 'درخواست دریافت تازه از TGJU ثبت شد.' });
  }

  if (pathname === '/api/news' && req.method === 'GET') {
    try {
      const config = readJson(SETTINGS_FILE, {});
      const configuredFeed = config?.boardConfig?.newsFeedUrl || DEFAULT_NEWS_FEED;
      const feed = configuredFeed === LEGACY_DEFAULT_NEWS_FEED ? DEFAULT_NEWS_FEED : configuredFeed;
      const ttl = Math.max(60, Math.min(900, Number(config?.boardConfig?.newsRefreshSeconds || 300))) * 1000;
      const items = await cached(`news:${feed}`, ttl, () => fetchNewsFeed(feed));
      return sendJson(res, 200, { items, fetched_at: new Date().toISOString(), source: new URL(feed).hostname });
    } catch (error) { return sendJson(res, 502, { items: [], error: error.message || 'دریافت اخبار ناموفق بود.' }); }
  }

  if ((pathname === '/api/prices' || pathname === '/api/stream') && req.method === 'GET') {
    return sendJson(res, 410, { error: 'این نسخه تمام نرخ‌ها را از TGJU دریافت می‌کند؛ از /api/dashboard-data استفاده کنید.', source: 'TGJU' });
  }

  return sendJson(res, 404, { error: 'API route not found' });
}

const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
  catch { return sendJson(res, 400, { error: 'نشانی درخواست معتبر نیست.' }); }
  if (url.pathname.startsWith('/api/')) {
    try { return await routeApi(req, res, url.pathname); }
    catch (error) { if (!res.headersSent) return sendJson(res, 500, { error: error.message || 'خطای داخلی سرور.' }); if (!res.writableEnded) res.end(); return; }
  }
  if ((url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/board-config' || url.pathname === '/board-config/') && req.method === 'GET' && !requireAdmin(req, res)) return;
  if ((url.pathname === '/board' || url.pathname === '/board/' || url.pathname === '/board-config' || url.pathname === '/board-config/' || url.pathname === '/tgju-widget' || url.pathname === '/tgju-widget/') && req.method === 'GET') {
    const page = url.pathname.startsWith('/board-config') ? 'board-config.html' : url.pathname.startsWith('/tgju-widget') ? 'tgju-widget.html' : 'board.html';
    fs.readFile(path.join(ROOT, page), (error, data) => {
      if (error) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Board page not found'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(data);
    });
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname); }
  catch { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Bad request'); }
  const file = path.resolve(ROOT, `.${pathname}`);
  if (!file.startsWith(ROOT + path.sep) && file !== ROOT) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Farzin Story Studio is listening on ${HOST}:${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  for (const address of getLocalAddresses()) console.log(`Shop LAN: http://${address}:${PORT}`);
  console.log('Live market source: TGJU (no API key required). First quote is fetched in the background.');
  console.log(ADMIN_PASSWORD ? 'Admin pages are protected with HTTP Basic authentication.' : 'WARNING: ADMIN_PASSWORD is empty; admin pages are unprotected.');
  console.log(`TGJU polling: every ${TGJU_POLL_MS / 1000}s; failed source retries: every ${TGJU_ERROR_RETRY_MS / 1000}s.`);
  setTimeout(() => { void refreshTgjuSnapshot(true); }, 250).unref();
  setInterval(() => {
    const retryWindow = tgjuSnapshot.status === 'offline' || tgjuSnapshot.status === 'connecting' ? TGJU_ERROR_RETRY_MS : TGJU_POLL_MS;
    if (!tgjuLastAttemptAt || Date.now() - tgjuLastAttemptAt >= retryWindow) void refreshTgjuSnapshot(true);
  }, 1_000).unref();
});
