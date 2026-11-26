'use strict';
const $ = id => document.getElementById(id);
const cloneConfig = value => {
  if (typeof window.structuredClone === 'function') return window.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
};

const DEFAULT_FEED = 'https://feeds.bbci.co.uk/persian/rss.xml';
const LEGACY_PALETTE = {
  bgColor: '#1b120e',
  goldColor: '#c5a875',
  textColor: '#f8f2e7',
  mutedColor: '#9f9082'
};

const tehranClockFormatter = new Intl.DateTimeFormat('fa-IR', {
  timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
});
const sourceTimeFormatter = new Intl.DateTimeFormat('fa-IR', {
  timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
});
const gregorianDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit'
});
const jalaliDateFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit'
});
const jalaliWeekdayFormatter = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: 'Asia/Tehran', weekday: 'long'
});
const faNumberFormatter = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
const faPadYearFormatter = new Intl.NumberFormat('fa-IR', { useGrouping: false, minimumIntegerDigits: 4 });
const faPadTwoFormatter = new Intl.NumberFormat('fa-IR', { useGrouping: false, minimumIntegerDigits: 2 });

function detectLowPowerFallback() {
  if (typeof window.__farzinLowPower === 'boolean') return window.__farzinLowPower;
  try {
    const search = String(window.location?.search || '');
    if (/[?&]lite=0\b/i.test(search)) return false;
    if (/[?&](?:lite=1|tv=1)\b/i.test(search)) return true;
    const ua = String(typeof navigator !== 'undefined' ? navigator?.userAgent || '' : '');
    const isTv = /Tizen|Web0S|webOS|SMART-TV|SmartTV|NetCast|Maple|HbbTV|BRAVIA|AFT|Android TV|GoogleTV|CrKey|Hisense|TCL|Roku|Viera|PhilipsTV|AQUOS|PHILIPS|SAMSUNG.*Browser|LG Browser/i.test(ua);
    const cores = Number(typeof navigator !== 'undefined' ? navigator?.hardwareConcurrency : NaN);
    const mem = Number(typeof navigator !== 'undefined' ? navigator?.deviceMemory : NaN);
    const saveData = Boolean(typeof navigator !== 'undefined' && navigator?.connection?.saveData);
    const reducedMotion = Boolean(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)')?.matches);
    const noBackdrop = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
      ? (!CSS.supports('backdrop-filter', 'blur(4px)') && !CSS.supports('-webkit-backdrop-filter', 'blur(4px)'))
      : false;
    const lowPower = isTv || (Number.isFinite(cores) && cores > 0 && cores <= 4) || (Number.isFinite(mem) && mem > 0 && mem <= 2) || saveData || reducedMotion || noBackdrop;
    if (document?.documentElement?.classList) {
      if (lowPower) document.documentElement.classList.add('fz-low-power');
      if (isTv) document.documentElement.classList.add('fz-tv');
    }
    window.__farzinLowPower = lowPower;
    window.__farzinIsTv = isTv;
    return lowPower;
  } catch {
    return false;
  }
}
let isLowPowerMode = detectLowPowerFallback();
let cachedReducedMotion = Boolean(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)')?.matches);

window.addEventListener?.('farzin:perfmodechange', event => {
  if (event?.detail && typeof event.detail.isLowPower === 'boolean') {
    isLowPowerMode = event.detail.isLowPower;
  }
});

const DEFAULTS = {
  brand: 'گالری طلا و سکه فرزین',
  subtitle: 'نرخ لحظه‌ای بازار طلا و سکه',
  mainTitle: 'نرخ لحظه‌ای طلا و سکه',
  sideTitle: 'ارز و بازارهای جهانی',
  bgColor: '#1b120e',
  goldColor: '#c5a875',
  textColor: '#f8f2e7',
  mutedColor: '#9f9082',
  watermarkOpacity: 0,
  showFrame: true,
  showLogo: true,
  showAttribution: true,
  contactCards: [],
  footerLines: [],
  sections: [],
  sideRates: [],
  boardConfig: {
    refreshSeconds: 1,
    showMainRates: true,
    showSideRates: true,
    showMarketStatus: true,
    showClock: true,
    showJalaliDate: true,
    showGregorianDate: true,
    showFooter: true,
    showNewsTicker: true,
    tickerLabel: 'تازه‌ترین اخبار جهان',
    newsFeedUrl: DEFAULT_FEED,
    newsRefreshSeconds: 180,
    tickerSpeed: 65,
    tickerFontSize: 16,
    mainColumns: 2,
    sidePanelPercent: 27,
    mainCardGap: 18,
    mainFontScale: 1.05,
    sideFontScale: 1.05,
    cardScrollSpeed: 32,
    tgjuWidgetCode: '',
    footerLines: [{ id: 'board-footer-quote', text: 'زر، جلوه‌ای از زیبایی‌ست؛ اعتماد، ماندگارترین دارایی‌ست.', visible: true }]
  }
};

let settings = cloneConfig(DEFAULTS);
let livePrices = {};
let sideRates = {};
let assetPrices = {};
let latestPayload = null;
let latestError = '';
let newsItems = [];
let newsError = '';
let logoVersion = null;
let pollInProgress = false;
let lastNewsFetch = 0;
let nextRefreshAt = Date.now() + 1000;
let tickerOffset = 0;
let tickerLastFrameAt = 0;
let cardScrollOffset = 0;
let sideHeadIndex = 0;
let sideVisibleCapacity = null;
let sideStepPx = 64;
let sideCycleTimer = null;
let sideTransitionTimer = null;
let sideSettleTimer = null;
let isSideAnimating = false;
let boardResizeObserver = null;
let controlHideTimer = null;
let refreshTimer = null;
let newsTimer = null;
let connectionState = 'connecting';
let serverOffline = false;
let lastMainSignature = '';
let lastMainStructSig = '';
let lastSideSignature = '';
let lastSideStructSig = '';
let lastNewsText = '';
let currentTheme = 'dark';
let lastDashboardEtag = '';
let lastConfigVersion = null;
let lastConfigFetchedAt = 0;
let lastDataSnapshotSeq = null;
let lastLogoCheckedAt = 0;
let cachedHasMainClone = false;
let cachedMainCyclePx = 0;
let cachedTickerLoopWidth = 0;
let motionRafId = 0;
let lastMotionPaintAt = 0;
const fittedNodeCache = typeof WeakMap === 'function' ? new WeakMap() : null;
const previousBoardPrices = new Map();
const activeBoardTicks = new Map();
let boardTickTimer = null;

try {
  const storedTheme = window.localStorage?.getItem('farzin_board_theme');
  if (storedTheme === 'light' || storedTheme === 'dark') currentTheme = storedTheme;
} catch {}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function faNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? '—');
  return faNumberFormatter.formatToParts(n)
    .map(part => part.type === 'group' ? ',' : part.type === 'decimal' ? '.' : part.value)
    .join('');
}

let cachedDateKey = '';
let cachedDateInfo = null;
function dateInfo() {
  const now = new Date();
  const key = gregorianDateFormatter.format(now);
  if (key === cachedDateKey && cachedDateInfo) return cachedDateInfo;
  const greg = key;
  try {
    const p = jalaliDateFormatter.formatToParts(now);
    const get = t => p.find(x => x.type === t)?.value || '00';
    const faPad = t => (t === 'year' ? faPadYearFormatter : faPadTwoFormatter).format(Number(get(t)));
    cachedDateInfo = {
      jalali: `${faPad('year')}/${faPad('month')}/${faPad('day')}`,
      weekday: jalaliWeekdayFormatter.format(now),
      greg
    };
  } catch {
    cachedDateInfo = { jalali: '—', weekday: jalaliWeekdayFormatter.format(now), greg };
  }
  cachedDateKey = key;
  return cachedDateInfo;
}

let cachedClockSecond = -1;
let cachedClock = '';
function tehranClock() {
  const second = Math.floor(Date.now() / 1000);
  if (second !== cachedClockSecond) {
    cachedClockSecond = second;
    cachedClock = tehranClockFormatter.format(new Date(second * 1000));
  }
  return cachedClock;
}

function sourceTime(v) {
  if (v === null || v === undefined || v === '') return 'در انتظار نرخ';
  const numeric = typeof v === 'number' || /^\d{10,13}$/.test(String(v));
  const n = Number(v);
  const d = new Date(numeric ? (n < 1e12 ? n * 1000 : n) : v);
  if (Number.isNaN(d.getTime())) return 'در انتظار نرخ';
  return sourceTimeFormatter.format(d);
}

function normalize(raw) {
  const s = { ...cloneConfig(DEFAULTS), ...(raw || {}) };
  s.boardConfig = { ...cloneConfig(DEFAULTS.boardConfig), ...(s.boardConfig || {}) };
  if ((!raw?.schemaVersion || Number(raw.schemaVersion) < 7) && (Number(s.boardConfig.refreshSeconds) === 30 || Number(s.boardConfig.refreshSeconds) === 10)) {
    s.boardConfig.refreshSeconds = 1;
  }
  if (!Array.isArray(s.boardConfig.footerLines)) s.boardConfig.footerLines = cloneConfig(DEFAULTS.boardConfig.footerLines);
  if (!raw?.schemaVersion || Number(raw.schemaVersion) < 4) {
    s.sections = [{
      id: 'main-prices',
      title: 'نرخ طلا و سکه',
      visible: true,
      rows: [
        { id: 'mazaneh-main', label: 'مظنه', source: 'mazaneh', unit: 'تومان', visible: true, featured: true },
        { id: 'gram18-main', label: 'گرم طلای ۱۸ عیار', source: 'gram18', unit: 'تومان', visible: true, featured: true },
        { id: 'emami86-main', label: 'سکه امامی ۸۶', source: 'coin_full', unit: 'تومان', visible: true, featured: true },
        { id: 'oldcoin-main', label: 'سکه قدیم', source: 'coin_old', unit: 'تومان', visible: true },
        { id: 'half86-main', label: 'نیم سکه', source: 'coin_half', unit: 'تومان', visible: true },
        { id: 'quarter86-main', label: 'ربع سکه', source: 'coin_quarter', unit: 'تومان', visible: true },
        { id: 'gramcoin-main', label: 'سکه یک گرمی', source: 'coin_gerami', unit: 'تومان', visible: true },
        { id: 'gram24-main', label: 'طلای ۲۴ عیار', source: 'gram24', unit: 'تومان', visible: true },
        { id: 'gram21-main', label: 'طلای ۲۱ عیار', source: 'gram21', unit: 'تومان', visible: true },
        { id: 'ounce-main', label: 'انس طلا', source: 'ounce', unit: 'دلار', visible: true }
      ]
    }];
    s.sideRates = [
      { id: 'usd-side', label: 'دلار', source: 'usd', unit: 'تومان', visible: true },
      { id: 'aed-side', label: 'درهم', source: 'aed', unit: 'تومان', visible: true },
      { id: 'eur-side', label: 'یورو', source: 'eur', unit: 'تومان', visible: true },
      { id: 'silver-side', label: 'نقره ۹۹۹', source: 'silver', unit: 'تومان / گرم', visible: true },
      { id: 'oil-side', label: 'نفت برنت', source: 'oil', unit: 'دلار / بشکه', visible: true }
    ];
  }
  s.sections = Array.isArray(s.sections) ? s.sections : [];
  s.sideRates = Array.isArray(s.sideRates) ? s.sideRates : [];
  s.contactCards = Array.isArray(s.contactCards) ? s.contactCards : [];
  s.footerLines = Array.isArray(s.footerLines) ? s.footerLines : [];
  for (const card of [...s.sections.flatMap(section => section.rows || []), ...s.sideRates]) {
    card.showTwoPrices = card.showTwoPrices ?? s.boardConfig.showTwoPrices;
    card.buySpreadPercent = card.buySpreadPercent ?? s.boardConfig.buySpreadPercent;
    card.sellSpreadPercent = card.sellSpreadPercent ?? s.boardConfig.sellSpreadPercent;
  }
  return s;
}

function mainRows() {
  return settings.sections
    .filter(s => s.visible !== false)
    .flatMap(s => (s.rows || []).filter(r => r.visible !== false));
}

function sideRows() {
  return (settings.sideRates || []).filter(r => r.visible !== false);
}

function rateFor(rowOrSource, manualValue = '') {
  const row = typeof rowOrSource === 'object' && rowOrSource ? rowOrSource : { source: rowOrSource, manualValue };
  const source = String(row.source || '');
  if (source === 'manual') {
    return { price: row.manualValue || manualValue || '', change_pct: null, direction: null, updated_at: null, unit: '' };
  }
  const key = String(row.symbol || source);
  const item = ['usd', 'aed', 'eur', 'silver', 'oil'].includes(source)
    ? sideRates[source]
    : (livePrices[source] || assetPrices[key]);
  if (!item) return { price: '', change_pct: null, direction: null, updated_at: null, unit: '' };
  const divisor = Math.max(0.0000001, Number(row.divisor) || 1);
  return divisor === 1 ? item : {
    ...item,
    price: Number(item.price) / divisor,
    low: item.low === null ? null : Number(item.low) / divisor,
    high: item.high === null ? null : Number(item.high) / divisor
  };
}

function assetIcon(item) {
  return window.FarzinAssetIcons ? window.FarzinAssetIcons.infer(item) : 'generic';
}

function assetIconSvg(item) {
  if (window.FarzinAssetIcons && typeof window.FarzinAssetIcons.svg === 'function') {
    return window.FarzinAssetIcons.svg(assetIcon(item));
  }
  return '';
}

function assetIconBackdropSvg(item) {
  if (window.FarzinAssetIcons && typeof window.FarzinAssetIcons.svgSide3D === 'function') {
    return window.FarzinAssetIcons.svgSide3D(assetIcon(item));
  }
  return '';
}

function quotePrices(rate, card = {}) {
  const quotes = typeof window.FarzinQuotePrices === 'function' ? window.FarzinQuotePrices(rate?.price, card) : null;
  return quotes ? { buy: faNum(quotes.buy), sell: faNum(quotes.sell), missing: false } : { buy: 'در انتظار نرخ', sell: 'در انتظار نرخ', missing: true };
}

function trendMeta(rate) {
  const hasPct = rate?.change_pct !== null && rate?.change_pct !== undefined && rate?.change_pct !== '' && Number.isFinite(Number(rate.change_pct));
  if (hasPct) {
    const val = Number(rate.change_pct);
    const dir = val > 0.0001 ? 'up' : val < -0.0001 ? 'down' : 'flat';
    const arrow = dir === 'up' ? '▲' : dir === 'down' ? '▼' : '—';
    const sign = dir === 'up' ? '+' : dir === 'down' ? '-' : '';
    const value = `${sign}${faNum(Math.abs(val))}٪`;
    return { dir, arrow, value, label: `${arrow} ${value}` };
  }
  if (rate?.direction === 'up' || rate?.direction === 'down') {
    const dir = rate.direction;
    const arrow = dir === 'up' ? '▲' : '▼';
    const value = dir === 'up' ? 'صعودی' : 'نزولی';
    return { dir, arrow, value, label: `${arrow} ${value}` };
  }
  return null;
}

function renderTrendGlowCardHtml(rate) {
  const trend = trendMeta(rate);
  if (!trend) return '';
  return `<span class="rate-trend rate-trend-glow fz-tabular ${trend.dir}" title="میزان تغییر نرخ" aria-label="میزان تغییر نرخ ${esc(trend.label)}"><span class="rate-trend-arrow" aria-hidden="true">${trend.arrow}</span><span class="rate-trend-value" dir="ltr">${esc(trend.value)}</span></span>`;
}

function rangeMeta(rate) {
  const price = Number(rate?.price);
  const low = rate?.low !== null && rate?.low !== undefined && rate?.low !== '' ? Number(rate.low) : NaN;
  const high = rate?.high !== null && rate?.high !== undefined && rate?.high !== '' ? Number(rate.high) : NaN;
  if (!Number.isFinite(price) || !Number.isFinite(low) || !Number.isFinite(high) || high <= low) return null;
  const pct = Math.max(0, Math.min(100, ((price - low) / (high - low)) * 100));
  return {
    lowLabel: faNum(low),
    highLabel: faNum(high),
    pct: pct.toFixed(1)
  };
}

function cardTickKey(item) {
  return String(item?.id || `${item?.source || ''}:${item?.symbol || ''}:${item?.label || ''}`);
}

function cardTickClass(item) {
  const tick = activeBoardTicks.get(cardTickKey(item));
  if (!tick || tick.expiresAt <= Date.now()) return '';
  return tick.dir === 'up' ? ' is-tick-up' : ' is-tick-down';
}

function renderRangeHtml(rate) {
  const range = rangeMeta(rate);
  if (!range) return '';
  return `
    <div class="card-range" dir="ltr" aria-label="بازه روز از ${esc(range.lowLabel)} تا ${esc(range.highLabel)}">
      <span class="card-range-bound fz-tabular">${esc(range.lowLabel)}</span>
      <div class="card-range-track">
        <span class="card-range-fill" style="width:${range.pct}%"></span>
        <span class="card-range-dot" style="left:${range.pct}%"></span>
      </div>
      <span class="card-range-bound fz-tabular">${esc(range.highLabel)}</span>
    </div>`;
}

function renderMainCardHtml(row) {
  const rate = rateFor(row);
  const unit = String(row.unit || rate.unit || '').trim();
  const featuredClass = row.featured ? ' is-featured' : '';
  const tickClass = cardTickClass(row);
  const keyAttr = esc(cardTickKey(row));
  const iconSvg = assetIconSvg(row);
  const backdropSvg = assetIconBackdropSvg(row);
  const trendGlowHtml = renderTrendGlowCardHtml(rate);

  let bodyHtml = '';
  if (row.showTwoPrices === false) {
    const missing = rate?.price === '' || rate?.price === undefined || rate?.price === null;
    const price = missing ? 'در انتظار نرخ' : faNum(rate.price);
    bodyHtml = `
      <div class="rate-single">
        <span class="rate-single-price fz-tabular${missing ? ' is-missing' : ''}">${esc(price)}</span>
      </div>`;
  } else {
    const prices = quotePrices(rate, row);
    const missingClass = prices.missing ? ' is-missing' : '';
    bodyHtml = `
      <div class="rate-quotes">
        <div class="rate-quote-col">
          <span class="quote-kind is-buy">خرید ما</span>
          <span class="quote-price is-buy fz-tabular${missingClass}">${esc(prices.buy)}</span>
        </div>
        <div class="rate-quote-col">
          <span class="quote-kind is-sell">فروش ما</span>
          <span class="quote-price is-sell fz-tabular${missingClass}">${esc(prices.sell)}</span>
        </div>
      </div>`;
  }

  return `
    <article class="rate-card${featuredClass}${tickClass}" data-card-id="${keyAttr}">
      ${backdropSvg ? `<div class="card-bg-emblem" aria-hidden="true">${backdropSvg}</div>` : ''}
      <div class="rate-card-head">
        <div class="rate-card-identity">
          ${iconSvg ? `<span class="rate-icon">${iconSvg}</span>` : ''}
          <h3 class="rate-label">${esc(row.label || '')}</h3>
        </div>
        <div class="rate-card-meta">
          ${trendGlowHtml}
          ${unit ? `<span class="rate-meta-unit">${esc(unit)}</span>` : ''}
        </div>
      </div>
      ${bodyHtml}
      ${renderRangeHtml(rate)}
    </article>`;
}

function renderSideCardHtml(item, extraClass = '') {
  const rate = rateFor(item);
  const unit = String(rate?.unit || item.unit || '').trim();
  const tickClass = cardTickClass(item);
  const animClass = extraClass ? ` ${extraClass}` : '';
  const keyAttr = esc(cardTickKey(item));
  const iconSvg = assetIconSvg(item);
  const backdropSvg = assetIconBackdropSvg(item);
  const trendGlowHtml = renderTrendGlowCardHtml(rate);

  let bodyHtml = '';
  if (item.showTwoPrices === false) {
    const missing = rate?.price === '' || rate?.price === undefined || rate?.price === null;
    const price = missing ? 'در انتظار نرخ' : faNum(rate.price);
    bodyHtml = `
      <div class="side-single">
        <span class="side-single-price fz-tabular${missing ? ' is-missing' : ''}">${esc(price)}</span>
      </div>`;
  } else {
    const prices = quotePrices(rate, item);
    const missingClass = prices.missing ? ' is-missing' : '';
    bodyHtml = `
      <div class="side-card-quotes">
        <div class="side-quote-item">
          <span class="side-quote-label is-buy">خرید</span>
          <span class="side-quote-value is-buy fz-tabular${missingClass}">${esc(prices.buy)}</span>
        </div>
        <div class="side-quote-item">
          <span class="side-quote-label is-sell">فروش</span>
          <span class="side-quote-value is-sell fz-tabular${missingClass}">${esc(prices.sell)}</span>
        </div>
      </div>`;
  }

  return `
    <article class="side-card${tickClass}${animClass}" data-card-id="${keyAttr}">
      ${backdropSvg ? `<div class="card-bg-emblem" aria-hidden="true">${backdropSvg}</div>` : ''}
      <div class="side-card-top">
        <div class="side-card-title">
          ${iconSvg ? `<span class="rate-icon">${iconSvg}</span>` : ''}
          <span class="side-card-name">${esc(item.label || '')}</span>
        </div>
        <div class="side-card-meta">
          ${trendGlowHtml}
          ${unit ? `<span class="side-card-unit">${esc(unit)}</span>` : ''}
        </div>
      </div>
      ${bodyHtml}
      ${renderRangeHtml(rate)}
    </article>`;
}

function applyThemeAndDesignTokens() {
  const rootEl = document.documentElement;
  if (!rootEl || !rootEl.style) return;
  if (rootEl.setAttribute) rootEl.setAttribute('data-theme', currentTheme);

  const themeBtn = $('themeToggleBtn');
  if (themeBtn) themeBtn.textContent = currentTheme === 'dark' ? 'نمای روشن' : 'نمای تیره';

  const bc = settings.boardConfig || {};
  const cols = Math.min(3, Math.max(1, Number(bc.mainColumns) || 2));
  const sidePercent = Math.max(20, Math.min(40, Number(bc.sidePanelPercent) || 27));
  const gap = Math.max(12, Math.min(28, Number(bc.mainCardGap) || 18));
  const mainScale = Math.max(0.85, Math.min(1.5, Number(bc.mainFontScale) || 1.05));
  const sideScale = Math.max(0.85, Math.min(1.5, Number(bc.sideFontScale) || 1.05));
  const tickerSize = Math.max(12, Math.min(25, Number(bc.tickerFontSize) || 16));
  const watermarkOpacity = Number(settings.watermarkOpacity) > 0
    ? Math.min(0.12, Number(settings.watermarkOpacity) / 100)
    : 0;

  rootEl.style.setProperty('--board-cols', String(cols));
  rootEl.style.setProperty('--board-side-width', `${sidePercent}%`);
  rootEl.style.setProperty('--board-gap-px', `${gap}px`);
  rootEl.style.setProperty('--board-gap-u', (gap / 19.2).toFixed(4));
  rootEl.style.setProperty('--board-main-scale', String(mainScale));
  rootEl.style.setProperty('--board-side-scale', String(sideScale));
  rootEl.style.setProperty('--board-ticker-px', `${tickerSize}px`);
  rootEl.style.setProperty('--board-ticker-u', (tickerSize / 19.2).toFixed(4));
  rootEl.style.setProperty('--board-watermark-opacity', String(watermarkOpacity));

  const customProps = ['--board-bg', '--board-gold', '--board-ink', '--board-muted'];
  if (currentTheme === 'dark') {
    const setIfCustom = (cssVar, value, legacyDefault) => {
      const clean = String(value || '').trim().toLowerCase();
      if (clean && clean !== legacyDefault) rootEl.style.setProperty(cssVar, value);
      else rootEl.style.removeProperty(cssVar);
    };
    setIfCustom('--board-bg', settings.bgColor, LEGACY_PALETTE.bgColor);
    setIfCustom('--board-gold', settings.goldColor, LEGACY_PALETTE.goldColor);
    setIfCustom('--board-ink', settings.textColor, LEGACY_PALETTE.textColor);
    setIfCustom('--board-muted', settings.mutedColor, LEGACY_PALETTE.mutedColor);
  } else {
    customProps.forEach(prop => rootEl.style.removeProperty(prop));
  }

  const shell = $('boardShell');
  if (shell && shell.classList) shell.classList.toggle('has-frame', settings.showFrame !== false);
  const wm = $('boardWatermark');
  if (wm) wm.hidden = !(watermarkOpacity > 0);
}

function getTickerMessage() {
  const stories = newsItems
    .map(n => `${n.title}${n.source ? ` · ${n.source}` : ''}`)
    .filter(Boolean);
  if (stories.length) return `${stories.join('   ✦   ')}   ✦   `;
  return newsError
    ? 'دریافت خبرهای فارسی موقتاً ممکن نیست؛ اتصال خبرخوان را بررسی کنید.   ✦   '
    : 'در حال دریافت تازه‌ترین خبرهای فارسی جهان…   ✦   ';
}

function updateChronosAndStatus() {
  const bc = settings.boardConfig || {};
  const clockEl = $('tehranClock');
  if (clockEl) clockEl.textContent = tehranClock();
  const clockWrap = $('clockWrap');
  if (clockWrap) clockWrap.hidden = bc.showClock === false;

  const date = dateInfo();
  const jalaliEl = $('jalaliDateText');
  const gregEl = $('gregorianDateText');
  const datesWrap = $('datesWrap');
  if (jalaliEl) {
    jalaliEl.textContent = `${date.weekday} · ${date.jalali}`;
    jalaliEl.hidden = bc.showJalaliDate === false;
  }
  if (gregEl) {
    gregEl.textContent = date.greg;
    gregEl.hidden = bc.showGregorianDate === false;
  }
  if (datesWrap) {
    datesWrap.hidden = bc.showJalaliDate === false && bc.showGregorianDate === false;
  }

  updateConnectionStatus();
}

function fitBoardNumbers() {
  if (typeof document.querySelectorAll !== 'function' || typeof window.getComputedStyle !== 'function') return;
  const nodes = document.querySelectorAll(
    '.quote-price:not(.is-missing), .rate-single-price:not(.is-missing), .side-quote-value:not(.is-missing), .side-single-price:not(.is-missing)'
  );
  const vw = Number(window.innerWidth) || 0;
  const toCheck = [];
  for (const el of nodes) {
    if (!el || !el.style) continue;
    const txt = el.textContent || '';
    const cached = fittedNodeCache?.get(el);
    if (cached && cached.text === txt && cached.vw === vw) {
      const desired = cached.fontSize || '';
      if (el.style.fontSize !== desired) el.style.fontSize = desired;
      continue;
    }
    el.style.fontSize = '';
    toCheck.push({ el, txt });
  }
  if (!toCheck.length) return;
  const updates = [];
  for (const item of toCheck) {
    const el = item.el;
    const available = el.clientWidth;
    const needed = el.scrollWidth;
    let fittedStr = '';
    if (available > 0 && needed > available + 1) {
      const baseSize = parseFloat(window.getComputedStyle(el).fontSize);
      if (Number.isFinite(baseSize) && baseSize > 10) {
        const fitted = Math.max(10, Math.floor((baseSize * available / needed) * 10) / 10);
        fittedStr = `${fitted}px`;
      }
    }
    updates.push({ el, txt: item.txt, fittedStr });
  }
  for (const item of updates) {
    if (item.fittedStr) item.el.style.fontSize = item.fittedStr;
    fittedNodeCache?.set(item.el, { text: item.txt, vw, fontSize: item.fittedStr });
  }
}

function measureMotionGeometry() {
  const gap = Math.max(12, Math.min(28, Number(settings?.boardConfig?.mainCardGap) || 18));
  const mainTrack = $('mainTrack');
  const mainGrid = $('mainGrid');
  cachedHasMainClone = Boolean(mainTrack && mainTrack.querySelector?.('[data-loop-clone="true"]'));
  cachedMainCyclePx = (cachedHasMainClone && mainGrid && mainGrid.offsetHeight) ? (mainGrid.offsetHeight + gap) : 0;
  const copyA = $('tickerCopyA');
  cachedTickerLoopWidth = Number(copyA?.offsetWidth) || 0;
}

function syncOverflowClones(trackId, viewportId) {
  const track = $(trackId);
  const viewport = $(viewportId);
  if (!track || !viewport || !track.children) return;
  const primary = track.children[0];
  if (!primary) return;

  const cloneEl = track.querySelector?.('[data-loop-clone="true"]');
  const canScrollViewport = (Number(window.innerWidth) || 0) >= 1024 && (Number(window.innerHeight) || 0) >= 620;
  const overflows = canScrollViewport && primary.scrollHeight > viewport.clientHeight + 8;

  if (overflows) {
    if (!cloneEl && primary.cloneNode) {
      const clone = primary.cloneNode(true);
      clone.setAttribute('data-loop-clone', 'true');
      clone.setAttribute('aria-hidden', 'true');
      track.appendChild(clone);
    } else if (cloneEl) {
      cloneEl.innerHTML = primary.innerHTML;
    }
  } else {
    if (cloneEl && cloneEl.remove) cloneEl.remove();
    if (track.style) track.style.transform = '';
    cardScrollOffset = 0;
  }
  measureMotionGeometry();
  ensureMotionLoop();
}

function isDesktopLockedViewport() {
  return (Number(window.innerWidth) || 0) >= 1024 && (Number(window.innerHeight) || 0) >= 620;
}

function visibleSideSlice(side, startIdx, cap) {
  if (!Array.isArray(side) || !side.length) return [];
  const count = Math.min(side.length, Math.max(1, Number(cap) || side.length));
  if (count >= side.length) return side.slice();
  const offset = ((Number(startIdx) || 0) % side.length + side.length) % side.length;
  const slice = [];
  for (let i = 0; i < count; i++) slice.push(side[(offset + i) % side.length]);
  return slice;
}

function measureSideCapacity(totalCount) {
  if (!totalCount) return 0;
  if (!isDesktopLockedViewport()) return totalCount;
  const viewport = $('sideViewport');
  const list = $('sideList');
  if (!viewport || !list) return totalCount;
  const vpH = Number(viewport.clientHeight) || 0;
  if (vpH <= 40) return totalCount;
  const firstCard = list.children?.[0];
  if (!firstCard || !firstCard.offsetHeight) return totalCount;
  const cs = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(list) : null;
  const gap = cs ? (parseFloat(cs.rowGap || cs.gap) || 10) : 10;
  const cardH = Number(firstCard.offsetHeight) || 0;
  if (cardH <= 0) return totalCount;
  sideStepPx = Math.round(cardH + gap);
  const fit = Math.max(1, Math.floor((vpH + gap - 2) / sideStepPx));
  return Math.min(totalCount, fit);
}

function stopSideRotation() {
  clearTimeout(sideCycleTimer);
  sideCycleTimer = null;
  clearTimeout(sideTransitionTimer);
  sideTransitionTimer = null;
  clearTimeout(sideSettleTimer);
  sideSettleTimer = null;
  isSideAnimating = false;
}

function sideCycleDelayMs() {
  const speed = Math.max(5, Math.min(120, Number(settings?.boardConfig?.cardScrollSpeed) || 32));
  return Math.max(1800, Math.min(6000, Math.round(4800 - speed * 26)));
}

function syncSideRotation(totalCount, cap) {
  const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  const canCycle = isDesktopLockedViewport()
    && settings?.boardConfig?.showSideRates !== false
    && !reducedMotion
    && !document.hidden
    && totalCount > cap
    && cap >= 1;
  if (!canCycle) {
    stopSideRotation();
    return;
  }
  if (!sideCycleTimer && !isSideAnimating) {
    clearTimeout(sideCycleTimer);
    sideCycleTimer = setTimeout(stepSideQueue, sideCycleDelayMs());
  }
}

function stepSideQueue() {
  sideCycleTimer = null;
  const side = sideRows();
  const cap = Math.min(side.length, Number(sideVisibleCapacity) || side.length);
  const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  if (!isDesktopLockedViewport() || settings?.boardConfig?.showSideRates === false || reducedMotion || document.hidden || side.length <= cap || cap < 1) {
    stopSideRotation();
    return;
  }
  const list = $('sideList');
  if (!list) return;
  const firstCard = list.firstElementChild;
  if (!firstCard || !firstCard.classList) {
    sideHeadIndex = (sideHeadIndex + 1) % side.length;
    renderSideQueueList(side, false);
    return;
  }

  const cs = typeof window.getComputedStyle === 'function' ? window.getComputedStyle(list) : null;
  const gap = cs ? (parseFloat(cs.rowGap || cs.gap) || 10) : 10;
  const measuredStep = firstCard.offsetHeight ? Math.round(firstCard.offsetHeight + gap) : sideStepPx;
  if (measuredStep > 0) sideStepPx = measuredStep;

  isSideAnimating = true;
  firstCard.classList.add('is-fading-out');

  clearTimeout(sideTransitionTimer);
  sideTransitionTimer = setTimeout(() => {
    sideTransitionTimer = null;
    const currentSide = sideRows();
    const currentCap = Math.min(currentSide.length, Number(sideVisibleCapacity) || currentSide.length);
    if (!currentSide.length || currentSide.length <= currentCap || !isDesktopLockedViewport()) {
      isSideAnimating = false;
      renderSideQueueList(currentSide, true);
      return;
    }
    sideHeadIndex = (sideHeadIndex + 1) % currentSide.length;
    const nextSlice = visibleSideSlice(currentSide, sideHeadIndex, currentCap);
    if (list.style) list.style.setProperty('--side-step', `${sideStepPx}px`);
    list.innerHTML = nextSlice.map((item, idx) => {
      const animClass = idx === nextSlice.length - 1 ? 'is-fading-in' : 'is-rising';
      return renderSideCardHtml(item, animClass);
    }).join('');
    fitBoardNumbers();
    isSideAnimating = false;

    clearTimeout(sideSettleTimer);
    sideSettleTimer = setTimeout(() => {
      sideSettleTimer = null;
      if (list.children) {
        for (const card of list.children) card.classList?.remove('is-rising', 'is-fading-in');
      }
    }, 550);

    syncSideRotation(currentSide.length, currentCap);
  }, 380);
}

function renderSideQueueList(side, forceMeasure = false) {
  const list = $('sideList');
  if (!list) return;
  if (!side.length) {
    sideVisibleCapacity = 0;
    list.innerHTML = '<div class="stage-empty">دارایی جانبی تعریف نشده است.</div>';
    stopSideRotation();
    return;
  }
  if (!isDesktopLockedViewport()) {
    sideHeadIndex = 0;
    sideVisibleCapacity = side.length;
    list.innerHTML = side.map(item => renderSideCardHtml(item)).join('');
    fitBoardNumbers();
    stopSideRotation();
    return;
  }

  let cap = (!forceMeasure && Number.isInteger(sideVisibleCapacity) && sideVisibleCapacity > 0)
    ? Math.min(side.length, sideVisibleCapacity)
    : side.length;
  let slice = visibleSideSlice(side, sideHeadIndex, cap);
  list.innerHTML = slice.map(item => renderSideCardHtml(item)).join('');
  fitBoardNumbers();

  const measured = measureSideCapacity(side.length);
  if (measured > 0 && measured < cap) {
    cap = measured;
    slice = visibleSideSlice(side, sideHeadIndex, cap);
    list.innerHTML = slice.map(item => renderSideCardHtml(item)).join('');
    fitBoardNumbers();
  }
  const viewport = $('sideViewport');
  while (cap > 1 && viewport && viewport.clientHeight > 40 && list.scrollHeight > viewport.clientHeight + 2) {
    cap -= 1;
    slice = visibleSideSlice(side, sideHeadIndex, cap);
    list.innerHTML = slice.map(item => renderSideCardHtml(item)).join('');
    fitBoardNumbers();
  }
  sideVisibleCapacity = cap;
  syncSideRotation(side.length, cap);
}

function cardStructureSig(list) {
  return (list || []).map(item => [
    cardTickKey(item),
    item.label || '',
    item.source || '',
    item.symbol || '',
    item.unit || '',
    item.icon || '',
    item.divisor || 1,
    item.showTwoPrices === false ? '1' : '2',
    item.featured ? 'f' : ''
  ].join('|')).join('~');
}

function updateCardElement(el, item, isSide) {
  if (!el || !el.querySelector) return false;
  const rate = rateFor(item);
  let changed = false;

  const tick = activeBoardTicks.get(cardTickKey(item));
  const activeTick = tick && tick.expiresAt > Date.now() ? tick.dir : '';
  el.classList?.toggle('is-tick-up', activeTick === 'up');
  el.classList?.toggle('is-tick-down', activeTick === 'down');

  const setText = (node, text, missing) => {
    if (!node) return;
    if (node.textContent !== text) {
      node.textContent = text;
      changed = true;
    }
    node.classList?.toggle('is-missing', Boolean(missing));
  };

  if (item.showTwoPrices === false) {
    const missing = rate?.price === '' || rate?.price === undefined || rate?.price === null;
    const price = missing ? 'در انتظار نرخ' : faNum(rate.price);
    setText(el.querySelector(isSide ? '.side-single-price' : '.rate-single-price'), price, missing);
  } else {
    const prices = quotePrices(rate, item);
    setText(el.querySelector(isSide ? '.side-quote-value.is-buy' : '.quote-price.is-buy'), prices.buy, prices.missing);
    setText(el.querySelector(isSide ? '.side-quote-value.is-sell' : '.quote-price.is-sell'), prices.sell, prices.missing);
  }

  const metaEl = el.querySelector(isSide ? '.side-card-meta' : '.rate-card-meta');
  if (metaEl) {
    const trend = trendMeta(rate);
    const existingTrend = metaEl.querySelector('.rate-trend');
    if (!trend) {
      if (existingTrend) {
        existingTrend.remove();
        changed = true;
      }
    } else if (existingTrend) {
      const targetClass = `rate-trend rate-trend-glow fz-tabular ${trend.dir}`;
      if (existingTrend.className !== targetClass) {
        existingTrend.className = targetClass;
        changed = true;
      }
      const arrowEl = existingTrend.querySelector('.rate-trend-arrow');
      const valEl = existingTrend.querySelector('.rate-trend-value');
      if (arrowEl && arrowEl.textContent !== trend.arrow) {
        arrowEl.textContent = trend.arrow;
        changed = true;
      }
      if (valEl && valEl.textContent !== trend.value) {
        valEl.textContent = trend.value;
        changed = true;
      }
      const nextAria = `میزان تغییر نرخ ${trend.label}`;
      if (existingTrend.getAttribute('aria-label') !== nextAria) existingTrend.setAttribute('aria-label', nextAria);
    } else {
      metaEl.insertAdjacentHTML('afterbegin', renderTrendGlowCardHtml(rate));
      changed = true;
    }
  }

  const range = rangeMeta(rate);
  const existingRange = el.querySelector('.card-range');
  if (!range) {
    if (existingRange) {
      existingRange.remove();
      changed = true;
    }
  } else if (existingRange) {
    const bounds = existingRange.querySelectorAll('.card-range-bound');
    const fill = existingRange.querySelector('.card-range-fill');
    const dot = existingRange.querySelector('.card-range-dot');
    const pctStr = `${range.pct}%`;
    if (bounds[0] && bounds[0].textContent !== range.lowLabel) { bounds[0].textContent = range.lowLabel; changed = true; }
    if (bounds[1] && bounds[1].textContent !== range.highLabel) { bounds[1].textContent = range.highLabel; changed = true; }
    if (fill && fill.style.width !== pctStr) { fill.style.width = pctStr; changed = true; }
    if (dot && dot.style.left !== pctStr) { dot.style.left = pctStr; changed = true; }
  } else {
    el.insertAdjacentHTML('beforeend', renderRangeHtml(rate));
    changed = true;
  }
  return changed;
}

function updateCardsInPlace(container, items, isSide) {
  if (!container || !container.children || container.children.length !== items.length) return null;
  let anyChanged = false;
  for (let i = 0; i < items.length; i++) {
    const card = container.children[i];
    if (!card || card.getAttribute?.('data-card-id') !== cardTickKey(items[i])) return null;
    if (updateCardElement(card, items[i], isSide)) anyChanged = true;
  }
  return anyChanged;
}

function render() {
  applyThemeAndDesignTokens();
  const bc = settings.boardConfig || {};

  if ($('boardBrand')) $('boardBrand').textContent = settings.brand || DEFAULTS.brand;
  if ($('boardSubtitle')) $('boardSubtitle').textContent = settings.subtitle || DEFAULTS.subtitle;
  if ($('logoWrap')) $('logoWrap').hidden = settings.showLogo === false;

  if ($('marketStatusWrap')) $('marketStatusWrap').hidden = bc.showMarketStatus === false;
  const marketEl = $('marketStateText');
  if (marketEl) {
    const open = latestPayload?.market_open;
    const label = open === true ? 'بازار باز است' : open === false ? 'بازار بسته است' : 'در حال بررسی بازار';
    const nextCls = `telemetry-val ${open === true ? 'is-open' : open === false ? 'is-closed' : 'is-unknown'}`;
    if (marketEl.className !== nextCls) marketEl.className = nextCls;
    const textSpan = marketEl.querySelector?.('span:last-child');
    if (textSpan) {
      if (textSpan.textContent !== label) textSpan.textContent = label;
    } else {
      marketEl.innerHTML = `<span class="market-indicator" aria-hidden="true"></span><span>${esc(label)}</span>`;
    }
  }
  if ($('lastQuoteTime')) {
    const quoteText = latestPayload?.updated_at ? sourceTime(latestPayload.updated_at) : 'در انتظار نرخ';
    if ($('lastQuoteTime').textContent !== quoteText) $('lastQuoteTime').textContent = quoteText;
  }

  const showMain = bc.showMainRates !== false;
  const showSide = bc.showSideRates !== false;
  const stage = $('boardStage');
  if (stage && stage.classList) {
    stage.classList.toggle('no-side', !showSide);
    stage.classList.toggle('no-main', !showMain);
  }
  if ($('mainPanel')) $('mainPanel').hidden = !showMain;
  if ($('sidePanel')) $('sidePanel').hidden = !showSide;
  if ($('mainSectionTitle')) $('mainSectionTitle').textContent = settings.mainTitle || DEFAULTS.mainTitle;
  if ($('sideSectionTitle')) $('sideSectionTitle').textContent = settings.sideTitle || DEFAULTS.sideTitle;

  const rows = mainRows();
  const side = sideRows();
  if ($('mainCountLabel')) $('mainCountLabel').textContent = `${faNum(rows.length)} نماد فعال`;
  if ($('sideCountLabel')) $('sideCountLabel').textContent = `${faNum(side.length)} نماد`;

  const footerItems = (bc.footerLines || [])
    .filter(x => x.visible !== false && String(x.text || '').trim())
    .slice(0, 5);
  const footerEl = $('boardFooter');
  if (footerEl) footerEl.hidden = bc.showFooter === false && settings.showAttribution === false;
  const footerLinesEl = $('footerLines');
  if (footerLinesEl) {
    const nextFooterHtml = bc.showFooter !== false
      ? footerItems.map((line, i) => `${i > 0 ? '<span class="footer-sep" aria-hidden="true">·</span>' : ''}<span>${esc(line.text)}</span>`).join('')
      : '';
    if (footerLinesEl.innerHTML !== nextFooterHtml) footerLinesEl.innerHTML = nextFooterHtml;
  }

  const mainGrid = $('mainGrid');
  const mainStructSig = `${currentTheme}::${cardStructureSig(rows)}::${bc.mainColumns}::${bc.sidePanelPercent}::${bc.mainFontScale}`;
  if (mainGrid) {
    let patchedInPlace = false;
    if (mainStructSig === lastMainStructSig && rows.length && typeof mainGrid.querySelectorAll === 'function') {
      const res = updateCardsInPlace(mainGrid, rows, false);
      if (res !== null) {
        patchedInPlace = true;
        if (res) {
          fitBoardNumbers();
          const cloneEl = $('mainTrack')?.querySelector?.('[data-loop-clone="true"]');
          if (cloneEl) cloneEl.innerHTML = mainGrid.innerHTML;
          measureMotionGeometry();
        }
      }
    }
    if (!patchedInPlace) {
      const mainHtml = rows.length
        ? rows.map(renderMainCardHtml).join('')
        : '<div class="stage-empty">برای نمایش نرخ، از بخش کانفیگ تابلو ردیف اضافه کنید.</div>';
      const mainSig = `${mainStructSig}::${mainHtml}`;
      if (mainSig !== lastMainSignature) {
        lastMainSignature = mainSig;
        lastMainStructSig = mainStructSig;
        mainGrid.innerHTML = mainHtml;
        fitBoardNumbers();
        syncOverflowClones('mainTrack', 'mainViewport');
      }
    }
  }

  const sideList = $('sideList');
  const sideStructSig = `${currentTheme}::${cardStructureSig(side)}::${bc.sidePanelPercent}::${bc.sideFontScale}::${bc.cardScrollSpeed}`;
  if (sideList && !isSideAnimating) {
    let patchedSideInPlace = false;
    if (sideStructSig === lastSideStructSig && side.length && typeof sideList.querySelectorAll === 'function') {
      const cap = Number.isInteger(sideVisibleCapacity) && sideVisibleCapacity > 0
        ? Math.min(side.length, sideVisibleCapacity)
        : side.length;
      const visibleSlice = visibleSideSlice(side, sideHeadIndex, cap);
      const res = updateCardsInPlace(sideList, visibleSlice, true);
      if (res !== null) {
        patchedSideInPlace = true;
        if (res) fitBoardNumbers();
      }
    }
    if (!patchedSideInPlace) {
      const sideSig = `${sideStructSig}::${sideHeadIndex}`;
      if (sideSig !== lastSideSignature) {
        lastSideSignature = sideSig;
        lastSideStructSig = sideStructSig;
        renderSideQueueList(side, sideVisibleCapacity === null);
      }
    }
  }

  const tickerEl = $('boardTicker');
  if (tickerEl) tickerEl.hidden = bc.showNewsTicker === false;
  if ($('tickerLabel')) $('tickerLabel').textContent = bc.tickerLabel || 'تازه‌ترین اخبار جهان';
  const msg = getTickerMessage();
  if (msg !== lastNewsText) {
    lastNewsText = msg;
    if ($('tickerCopyA')) $('tickerCopyA').textContent = msg;
    if ($('tickerCopyB')) $('tickerCopyB').textContent = msg;
    cachedTickerLoopWidth = Number($('tickerCopyA')?.offsetWidth) || cachedTickerLoopWidth;
  }

  updateChronosAndStatus();
  ensureMotionLoop();
  window.FarzinSpatialNav?.refreshFocusables?.();
}

function shouldRunMotionLoop() {
  if (document.hidden || cachedReducedMotion) return false;
  const mainActive = isDesktopLockedViewport() && cachedHasMainClone && cachedMainCyclePx > 0;
  const tickerActive = settings?.boardConfig?.showNewsTicker !== false && cachedTickerLoopWidth > 0;
  return mainActive || tickerActive;
}

function ensureMotionLoop() {
  if (motionRafId || !shouldRunMotionLoop()) return;
  if (typeof window.requestAnimationFrame === 'function') {
    motionRafId = window.requestAnimationFrame(animateBoardMotion);
  }
}

function animateBoardMotion(timestamp) {
  motionRafId = 0;
  const now = Number(timestamp) || Date.now();
  if (document.hidden || cachedReducedMotion) {
    tickerLastFrameAt = now;
    return;
  }
  if (!shouldRunMotionLoop()) {
    tickerLastFrameAt = 0;
    return;
  }
  if (isLowPowerMode && lastMotionPaintAt && (now - lastMotionPaintAt) < 32) {
    if (typeof window.requestAnimationFrame === 'function') {
      motionRafId = window.requestAnimationFrame(animateBoardMotion);
    }
    return;
  }
  if (!tickerLastFrameAt) tickerLastFrameAt = now;
  const dt = Math.max(0, Math.min(0.05, (now - tickerLastFrameAt) / 1000));
  tickerLastFrameAt = now;
  lastMotionPaintAt = now;

  const canScrollViewport = isDesktopLockedViewport();
  if (canScrollViewport && cachedHasMainClone && cachedMainCyclePx > 0) {
    const mainTrack = $('mainTrack');
    if (mainTrack && mainTrack.style) {
      const scrollSpeed = Math.max(5, Math.min(120, Number(settings?.boardConfig?.cardScrollSpeed) || 32));
      cardScrollOffset = (cardScrollOffset + scrollSpeed * dt) % cachedMainCyclePx;
      mainTrack.style.transform = `translate3d(0, ${-cardScrollOffset.toFixed(1)}px, 0)`;
    }
  }

  if (settings?.boardConfig?.showNewsTicker !== false && cachedTickerLoopWidth > 0) {
    const track = $('tickerTrack');
    if (track && track.style) {
      const tickerSpeed = Math.max(5, Math.min(180, Number(settings?.boardConfig?.tickerSpeed) || 65));
      tickerOffset = (tickerOffset + tickerSpeed * dt) % cachedTickerLoopWidth;
      track.style.transform = `translate3d(${(-tickerOffset).toFixed(1)}px, 0, 0)`;
    }
  }

  if (typeof window.requestAnimationFrame === 'function') {
    motionRafId = window.requestAnimationFrame(animateBoardMotion);
  }
}

function isValidRate(item) {
  return Boolean(item && item.price !== undefined && item.price !== null && item.price !== '' && Number.isFinite(Number(item.price)) && Number(item.price) >= 0);
}

function hasUsableRates(data) {
  const all = [
    ...Object.values(data?.prices || {}),
    ...Object.values(data?.sideRates || {}),
    ...Object.values(data?.assets || {})
  ];
  return all.some(isValidRate);
}

function mergeValidRates(previous, incoming) {
  const merged = { ...(previous || {}) };
  for (const [key, item] of Object.entries(incoming || {})) {
    if (isValidRate(item)) merged[key] = item;
  }
  return merged;
}

function updateConnectionStatus() {
  const s = $('boardStatus');
  const dot = $('liveDot');
  if (!s) return;
  const wait = Math.max(0, Math.ceil((nextRefreshAt - Date.now()) / 1000));
  const state = connectionState;
  let label = 'در حال اتصال به سرور محلی…';
  if (state === 'connecting') label = 'در حال دریافت قیمت از TGJU…';
  else if (state === 'online') label = `متصل به TGJU · بروزرسانی بعدی ${faNum(wait)} ثانیه`;
  else if (state === 'partial') label = `اتصال TGJU برقرار؛ برخی نمادها ناموجود · ${faNum(wait)} ثانیه`;
  else if (state === 'missing') label = `نرخ معتبر در دسترس نیست · ${faNum(wait)} ثانیه`;
  else if (state === 'offline') label = serverOffline
    ? `ارتباط با سرور محلی برقرار نشد · تلاش مجدد ${faNum(wait)} ثانیه`
    : `دریافت نرخ از TGJU ناموفق بود · تلاش مجدد ${faNum(wait)} ثانیه`;
  else if (state === 'stale') label = `نمایش آخرین نرخ معتبر · تلاش مجدد ${faNum(wait)} ثانیه`;

  s.textContent = label;
  s.title = latestError || 'وضعیت اتصال بازار';
  if (dot && dot.classList) {
    dot.classList.toggle('error', ['offline', 'missing', 'stale'].includes(state));
    dot.classList.toggle('partial', state === 'partial');
    dot.classList.toggle('online', ['online', 'partial'].includes(state));
  }
}

window.addEventListener('error', event => {
  latestError = event.message || 'خطای اجرای تابلو';
  const status = $('boardStatus');
  if (status) status.textContent = 'خطای اجرای تابلو: ' + latestError;
  const dot = $('liveDot');
  if (dot && dot.classList) dot.classList.add('error');
  console.error('[Farzin Board error]', event.error || event.message);
}, true);

window.addEventListener('unhandledrejection', event => {
  latestError = event.reason?.message || String(event.reason || 'خطای درخواست پس‌زمینه');
  if (connectionState === 'connecting') connectionState = 'offline';
  updateConnectionStatus();
  console.error('[Farzin Board rejection]', event.reason);
});

async function fetchJson(url, timeoutMs = 7000, extraHeaders = null) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const headers = { 'Accept': 'application/json', ...(extraHeaders || {}) };
    const options = { cache: 'no-store', headers };
    if (controller) options.signal = controller.signal;
    const response = await fetch(url, options);
    if (response.status === 304) {
      return { __unchanged: true, __etag: response.headers?.get?.('ETag') || '' };
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    if (data && typeof data === 'object' && response.headers?.get) {
      const etag = response.headers.get('ETag');
      if (etag) data.__etag = etag;
    }
    return data;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function applyLogoVersion(nextVersion) {
  if (!nextVersion || logoVersion === nextVersion) return;
  logoVersion = nextVersion;
  const src = `/farzin-logo.png?v=${encodeURIComponent(nextVersion)}`;
  if ($('boardLogo')) $('boardLogo').src = src;
  if ($('watermarkImg')) $('watermarkImg').src = src;
}

async function refreshLogo() {
  const now = Date.now();
  if (logoVersion !== null && now - lastLogoCheckedAt < 30_000) return;
  lastLogoCheckedAt = now;
  try {
    const data = await fetchJson('/api/logo-meta', 3000);
    if (data && data.version) applyLogoVersion(data.version);
  } catch {}
}

async function refreshNews(force = false) {
  if (document.hidden && !force) return;
  const interval = Math.max(60, Math.min(900, Number(settings.boardConfig?.newsRefreshSeconds || 180))) * 1000;
  if (!force && Date.now() - lastNewsFetch < interval) return;
  lastNewsFetch = Date.now();
  try {
    const data = await fetchJson('/api/news', 5500);
    const nextItems = Array.isArray(data.items) ? data.items : [];
    if (JSON.stringify(nextItems) !== JSON.stringify(newsItems)) tickerOffset = 0;
    newsItems = nextItems;
    newsError = nextItems.length ? '' : 'در حال حاضر تیتر فارسی تازه‌ای در خبرخوان پیدا نشد.';
  } catch (error) {
    newsError = error.message || 'خطای خبرخوان';
  }
  render();
}

function scheduleNews() {
  clearTimeout(newsTimer);
  const seconds = Math.max(60, Math.min(900, Number(settings.boardConfig?.newsRefreshSeconds) || 180));
  newsTimer = setTimeout(() => { refreshNews(true).finally(scheduleNews); }, seconds * 1000);
}

async function refreshAll() {
  if (pollInProgress || document.hidden) return;
  pollInProgress = true;
  if (!hasUsableRates(latestPayload)) {
    connectionState = 'connecting';
    latestError = 'در حال دریافت نرخ‌ها از TGJU…';
    render();
  }
  const nowMs = Date.now();
  nextRefreshAt = nowMs + 1000;
  let retrySoon = false;
  try {
    const settle = promise => promise.then(value => ({ status: 'fulfilled', value }), reason => ({ status: 'rejected', reason }));
    const dataHeaders = { 'X-Farzin-View': 'board' };
    if (lastDashboardEtag) dataHeaders['If-None-Match'] = lastDashboardEtag;

    const shouldFetchConfig = lastConfigFetchedAt === 0 || (lastConfigVersion === null && nowMs - lastConfigFetchedAt > 60_000);
    const [configResult, dataResult] = await Promise.all([
      shouldFetchConfig ? settle(fetchJson('/api/public-config', 2500)) : Promise.resolve(null),
      settle(fetchJson('/api/dashboard-data', 3500, dataHeaders))
    ]);

    let configError = '';
    let configChanged = false;
    if (configResult) {
      if (configResult.status === 'fulfilled') {
        const config = configResult.value;
        lastConfigFetchedAt = Date.now();
        if (config.configVersion !== undefined) lastConfigVersion = config.configVersion;
        if (config.settings) {
          settings = normalize(config.settings);
          configChanged = true;
        }
      } else {
        configError = `تنظیمات محلی: ${configResult.reason?.message || 'دریافت نشد'}`;
      }
    }

    if (dataResult.status === 'rejected') {
      serverOffline = true;
      throw dataResult.reason || new Error('سرور محلی پاسخ نداد.');
    }
    serverOffline = false;
    const data = dataResult.value || {};
    if (data.__etag) lastDashboardEtag = data.__etag;

    if (data.__unchanged) {
      if (configChanged) render();
      return;
    }

    if (data.logoVersion !== undefined && data.logoVersion !== null) {
      applyLogoVersion(data.logoVersion);
    } else if (logoVersion === null) {
      void refreshLogo();
    }

    if (data.configVersion !== undefined && data.configVersion !== lastConfigVersion) {
      lastConfigVersion = data.configVersion;
      try {
        const cfg = await fetchJson('/api/public-config', 2500);
        lastConfigFetchedAt = Date.now();
        if (cfg.settings) {
          settings = normalize(cfg.settings);
          configChanged = true;
        }
      } catch {}
    }

    if (data.snapshotSeq !== undefined && data.snapshotSeq === lastDataSnapshotSeq && !configChanged) {
      return;
    }
    if (data.snapshotSeq !== undefined) lastDataSnapshotSeq = data.snapshotSeq;

    const receivedRates = hasUsableRates(data);
    if (receivedRates) {
      livePrices = mergeValidRates(livePrices, data.prices);
      sideRates = mergeValidRates(sideRates, data.sideRates);
      assetPrices = mergeValidRates(assetPrices, data.assets);
      const previousPayload = latestPayload || {};
      latestPayload = {
        ...previousPayload,
        ...data,
        updated_at: data.updated_at || previousPayload.updated_at || null,
        market_open: data.market_open ?? previousPayload.market_open ?? null,
        prices: livePrices,
        sideRates,
        assets: assetPrices
      };
      const tickNow = Date.now();
      let anyBoardTick = false;
      for (const item of [...mainRows(), ...sideRows()]) {
        const rate = rateFor(item);
        const curr = rate?.price !== '' && rate?.price !== null && rate?.price !== undefined ? Number(rate.price) : NaN;
        if (!Number.isFinite(curr) || curr <= 0) continue;
        const key = cardTickKey(item);
        const prev = previousBoardPrices.get(key);
        if (prev !== undefined && Math.abs(curr - prev) > 1e-6) {
          activeBoardTicks.set(key, { dir: curr > prev ? 'up' : 'down', expiresAt: tickNow + 1800 });
          anyBoardTick = true;
        }
        previousBoardPrices.set(key, curr);
      }
      if (anyBoardTick) {
        clearTimeout(boardTickTimer);
        boardTickTimer = setTimeout(() => {
          const nowTs = Date.now();
          for (const [k, info] of activeBoardTicks) {
            if (info.expiresAt <= nowTs) activeBoardTicks.delete(k);
          }
          if (typeof document.querySelectorAll === 'function') {
            document.querySelectorAll('.rate-card.is-tick-up, .rate-card.is-tick-down, .side-card.is-tick-up, .side-card.is-tick-down').forEach(el => {
              el.classList?.remove('is-tick-up', 'is-tick-down');
            });
          }
        }, 1850);
      }
      const failures = Object.entries(data.errors || {}).filter(([key]) => !['gram21'].includes(key));
      latestError = [data.last_error || '', failures.map(([key, value]) => `${key}: ${value}`).join(' · '), configError].filter(Boolean).join(' · ');
      connectionState = data.status === 'stale' ? 'stale' : (failures.length || configError || data.status === 'partial' ? 'partial' : 'online');
    } else if (data.status === 'connecting') {
      latestPayload = { ...(latestPayload || {}), ...data };
      latestError = 'سرور محلی آماده است؛ منتظر اولین پاسخ قیمت از TGJU هستیم.';
      connectionState = 'connecting';
      retrySoon = true;
    } else if (hasUsableRates(latestPayload)) {
      latestError = [data.last_error || '', Object.values(data.errors || {}).join(' · '), 'آخرین نرخ معتبر حفظ شده است.'].filter(Boolean).join(' · ');
      connectionState = 'stale';
    } else {
      latestPayload = { ...(latestPayload || {}), ...data };
      latestError = data.last_error || Object.values(data.errors || {}).join(' · ') || 'از TGJU هنوز قیمت معتبری دریافت نشده است.';
      connectionState = 'offline';
      retrySoon = true;
    }
    render();
  } catch (error) {
    latestError = error.message || 'ارتباط با سرور محلی برقرار نشد.';
    serverOffline = true;
    connectionState = hasUsableRates(latestPayload) ? 'stale' : 'offline';
    render();
    retrySoon = true;
  } finally {
    pollInProgress = false;
    const interval = Math.max(1, Math.min(300, Number(settings.boardConfig?.refreshSeconds) || 1)) * 1000;
    const retryDelay = retrySoon ? 2000 : interval;
    nextRefreshAt = Date.now() + retryDelay;
    updateChronosAndStatus();
    if (!document.hidden) scheduleRefresh(retryDelay);
  }
}

$('fullscreenBtn')?.addEventListener('click', async () => {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch (error) {
    console.warn(error);
  }
});

$('themeToggleBtn')?.addEventListener('click', () => {
  currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
  try { window.localStorage?.setItem('farzin_board_theme', currentTheme); } catch {}
  render();
});

$('refreshBtn')?.addEventListener('click', async () => {
  clearTimeout(refreshTimer);
  try { await fetch('/api/refresh', { method: 'POST', cache: 'no-store' }); } catch {}
  refreshAll();
});

function revealBoardControls() {
  const controls = $('boardControls');
  if (!controls || !controls.classList) return;
  controls.classList.remove('hidden');
  clearTimeout(controlHideTimer);
  controlHideTimer = setTimeout(() => controls.classList.add('hidden'), 5000);
}

function handleResize() {
  stopSideRotation();
  sideVisibleCapacity = null;
  lastSideSignature = '';
  fitBoardNumbers();
  syncOverflowClones('mainTrack', 'mainViewport');
  renderSideQueueList(sideRows(), true);
  measureMotionGeometry();
  ensureMotionLoop();
}

if (window.FarzinSpatialNav) {
  window.FarzinSpatialNav.onRevealControls = revealBoardControls;
  window.FarzinSpatialNav.onHideControls = () => {
    const controls = $('boardControls');
    if (controls && controls.classList) controls.classList.add('hidden');
  };
}

function handleBoardKeyDown(event) {
  const key = event?.key || '';
  if (!key) return;
  const tag = event.target?.tagName || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  if (!window.FarzinSpatialNav && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Enter', 'Escape', 'Backspace', 'XF86Back', 'BrowserBack'].includes(key)) {
    revealBoardControls();
    const controls = $('boardControls');
    if (controls && typeof controls.querySelectorAll === 'function' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
      const focusables = [...controls.querySelectorAll('button:not([disabled]), a[href]')].filter(el => !el.hidden);
      if (focusables.length) {
        const idx = focusables.indexOf(document.activeElement);
        const step = key === 'ArrowLeft' ? 1 : -1;
        const nextIdx = idx === -1 ? 0 : (idx + step + focusables.length) % focusables.length;
        focusables[nextIdx]?.focus?.();
        event.preventDefault?.();
      }
    }
  } else if (key === 'r' || key === 'R') {
    $('refreshBtn')?.click?.();
  } else if (key === 't' || key === 'T') {
    $('themeToggleBtn')?.click?.();
  } else if (key === 'f' || key === 'F') {
    $('fullscreenBtn')?.click?.();
  } else if (key === 'p' || key === 'P') {
    window.FarzinPerformanceManager?.toggle?.();
  }
}

document.addEventListener('mousemove', revealBoardControls);
document.addEventListener('touchstart', revealBoardControls, { passive: true });
document.addEventListener('keydown', handleBoardKeyDown);
window.addEventListener('resize', handleResize);
document.fonts?.ready?.then(handleResize);
if (typeof window.ResizeObserver === 'function') {
  let resizeRaf = 0;
  boardResizeObserver = new window.ResizeObserver(() => {
    if (resizeRaf) return;
    const schedule = typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame
      : fn => setTimeout(fn, 16);
    resizeRaf = schedule(() => {
      resizeRaf = 0;
      handleResize();
    });
  });
  if ($('mainViewport')) boardResizeObserver.observe($('mainViewport'));
  if ($('sideViewport')) boardResizeObserver.observe($('sideViewport'));
}

render();
window.__farzinBoardBooted = true;
if (window.__farzinBoardBootTimer) clearTimeout(window.__farzinBoardBootTimer);

setInterval(() => {
  if (!document.hidden) updateChronosAndStatus();
}, 1000);
refreshNews(true).finally(scheduleNews);
refreshAll();
ensureMotionLoop();

window.addEventListener('online', () => { clearTimeout(refreshTimer); refreshAll(); });
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    tickerLastFrameAt = 0;
    lastMotionPaintAt = 0;
    updateChronosAndStatus();
    ensureMotionLoop();
    syncSideRotation(sideRows().length, Number(sideVisibleCapacity) || sideRows().length);
    clearTimeout(refreshTimer);
    refreshAll();
  } else {
    stopSideRotation();
    clearTimeout(refreshTimer);
    if (motionRafId && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(motionRafId);
      motionRafId = 0;
    }
  }
});

controlHideTimer = setTimeout(() => {
  const controls = $('boardControls');
  if (controls && controls.classList) controls.classList.add('hidden');
}, 5000);

function scheduleRefresh(delayMs) {
  clearTimeout(refreshTimer);
  const seconds = Math.max(1, Math.min(300, Number(settings.boardConfig?.refreshSeconds) || 1));
  refreshTimer = setTimeout(() => refreshAll(), Number.isFinite(delayMs) ? delayMs : seconds * 1000);
}

(() => {
  if (isLowPowerMode) return;
  if (typeof window.matchMedia !== 'function') return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (cachedReducedMotion) return;
  const stage = $('boardStage');
  if (!stage || typeof stage.addEventListener !== 'function') return;

  let activeCard = null;
  let rafId = 0;
  let latestPoint = null;

  const resetCard = card => {
    if (!card || !card.style) return;
    card.style.setProperty('--rx', '0deg');
    card.style.setProperty('--ry', '0deg');
    card.style.setProperty('--tz', '0px');
  };

  const updateTilt = () => {
    rafId = 0;
    if (!activeCard || !latestPoint || !activeCard.getBoundingClientRect) return;
    const rect = activeCard.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = Math.max(0, Math.min(1, (latestPoint.x - rect.left) / rect.width));
    const py = Math.max(0, Math.min(1, (latestPoint.y - rect.top) / rect.height));
    const maxDeg = activeCard.classList?.contains('side-card') ? 3.5 : 4.5;
    const rx = ((0.5 - py) * 2 * maxDeg).toFixed(2);
    const ry = ((px - 0.5) * 2 * maxDeg).toFixed(2);
    activeCard.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
    activeCard.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
    activeCard.style.setProperty('--rx', `${rx}deg`);
    activeCard.style.setProperty('--ry', `${ry}deg`);
    activeCard.style.setProperty('--tz', '12px');
  };

  stage.addEventListener('pointermove', event => {
    if (isLowPowerMode) return;
    const card = event.target?.closest?.('.rate-card, .side-card');
    if (activeCard && activeCard !== card) resetCard(activeCard);
    activeCard = card || null;
    if (!activeCard) {
      latestPoint = null;
      return;
    }
    latestPoint = { x: event.clientX, y: event.clientY };
    if (!rafId && typeof window.requestAnimationFrame === 'function') {
      rafId = window.requestAnimationFrame(updateTilt);
    }
  }, { passive: true });

  stage.addEventListener('pointerleave', () => {
    latestPoint = null;
    if (rafId && typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (activeCard) {
      resetCard(activeCard);
      activeCard = null;
    }
  });
})();
