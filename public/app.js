'use strict';

const $ = id => document.getElementById(id);
const API_SYMBOLS = [
  ['gram18', 'طلای ۱۸ عیار'], ['gram24', 'طلای ۲۴ عیار'], ['gram21', 'طلای ۲۱ عیار'],
  ['mazaneh', 'مظنه'], ['coin_full', 'سکه تمام / امامی'], ['coin_half', 'نیم سکه'],
  ['coin_quarter', 'ربع سکه'], ['coin_old', 'سکه قدیم · TGJU'], ['coin_gerami', 'سکه گرمی · TGJU'], ['usd', 'دلار تهران'], ['ounce', 'اونس جهانی'],
  ...(window.FARZIN_ASSET_CATALOG?.items||[]).map(item=>[item.symbol,`${item.label} · ${item.categoryLabel}`]),
  ['custom','نماد سفارشی TGJU'],['manual', 'ورود دستی']
];

const DEFAULT_SETTINGS = {
  brand: 'گالری طلا و سکه فرزین',
  subtitle: 'نرخ لحظه‌ای بازار طلا و سکه',
  mainTitle: 'نرخ لحظه‌ای طلا و سکه', sideTitle: 'ارز و بازارهای جهانی', chartTitle: 'نمودار تغییرات طلای ۱۸ عیار',
  phone: '', whatsapp: '', address: '',
  contactCards: [
    { id: 'contact-phone', title: 'تلفن', value: '', visible: true },
    { id: 'contact-whatsapp', title: 'واتساپ', value: '', visible: true },
    { id: 'contact-address', title: 'آدرس', value: '', visible: true }
  ],
  footer: 'نرخ‌ها ممکن است در طول روز تغییر کنند',
  footerLines: [
    { id: 'footer-main', text: 'نرخ‌ها ممکن است در طول روز تغییر کنند', visible: true }
  ],
  showDate: true, showUpdate: true, showLogo: true,
  bgColor: '#1b120e', goldColor: '#c5a875', textColor: '#f8f2e7', mutedColor: '#9f9082',
  watermarkOpacity: 8, exportScale: 1, showFrame: true, showAttribution: true, liveEnabled: true,
  schemaVersion: 7,
  // Approximate 2026-11-18 market snapshot; paired quotes assume lower=buy, higher=sell.
  sideRates: [
    { id:'usd-side', label:'دلار', source:'usd', unit:'تومان', manualValue:'', visible:true, showTwoPrices:true, buySpreadPercent:0.8935, sellSpreadPercent:-0.8935 },
    { id:'aed-side', label:'درهم', source:'aed', unit:'تومان', manualValue:'', visible:true, showTwoPrices:true, buySpreadPercent:0.9493, sellSpreadPercent:-0.9493 },
    { id:'eur-side', label:'یورو', source:'eur', unit:'تومان', manualValue:'', visible:true, showTwoPrices:true, buySpreadPercent:0, sellSpreadPercent:0 },
    { id:'silver-side', label:'نقره ۹۹۹', source:'silver', unit:'تومان / گرم', manualValue:'', visible:true, showTwoPrices:true, buySpreadPercent:0, sellSpreadPercent:0 },
    { id:'oil-side', label:'نفت برنت', source:'oil', unit:'دلار / بشکه', manualValue:'', visible:true, showTwoPrices:true, buySpreadPercent:0, sellSpreadPercent:0 }
  ],
  boardConfig: {
    refreshSeconds:1, showMainRates:true, showSideRates:true, showMarketStatus:true, showClock:true,
    showJalaliDate:true, showGregorianDate:true, showGoldChart:true, showContacts:true, showFooter:true,
    showNewsTicker:true, tickerLabel:'آخرین اخبار اقتصادی',
    newsFeedUrl:'https://news.google.com/rss/search?q=%D8%A7%D9%82%D8%AA%D8%B5%D8%A7%D8%AF+%D8%A7%DB%8C%D8%B1%D8%A7%D9%86+OR+%D8%B7%D9%84%D8%A7+OR+%D8%A7%D8%B1%D8%B2+OR+%D9%86%D9%81%D8%AA&hl=fa&gl=IR&ceid=IR:fa',
    newsRefreshSeconds:180, tickerSpeed:65, tickerFontSize:17, chartRange:'1d', mainColumns:2, sidePanelPercent:27, mainCardGap:18, mainFontScale:1.1, sideFontScale:1.1, showTwoPrices:true, buySpreadPercent:0, sellSpreadPercent:0, cardScrollSpeed:32
  },
  storyConfig: { showMainRates:true, showSideRates:true, showMarketStatus:true, showGoldChart:true, showTrends:true, showBothDates:true, showContacts:true, showFooter:true },
  sections: [
    { id:'main-prices', title:'نرخ طلا و سکه', visible:true, rows: [
      { id:'mazaneh-main', label:'مظنه', source:'mazaneh', unit:'تومان', manualValue:'', visible:true, featured:true, showTwoPrices:true, buySpreadPercent:0.1272, sellSpreadPercent:-0.1272 },
      { id:'gram18-main', label:'گرم طلای ۱۸ عیار', source:'gram18', unit:'تومان', manualValue:'', visible:true, featured:true, showTwoPrices:true, buySpreadPercent:0.1335, sellSpreadPercent:-0.1131 },
      { id:'emami86-main', label:'سکه امامی ۸۶', source:'coin_full', unit:'تومان', manualValue:'', visible:true, featured:true, showTwoPrices:true, buySpreadPercent:-0.0239, sellSpreadPercent:0.3829 },
      { id:'oldcoin-main', label:'سکه قدیم', source:'coin_old', unit:'تومان', manualValue:'', visible:true, featured:false, showTwoPrices:true, buySpreadPercent:0.0124, sellSpreadPercent:-0.0124 },
      { id:'half86-main', label:'نیم سکه ۸۶', source:'coin_half', unit:'تومان', manualValue:'', visible:true, featured:false, showTwoPrices:true, buySpreadPercent:0.1294, sellSpreadPercent:-0.4796 },
      { id:'quarter86-main', label:'ربع سکه ۸۶', source:'coin_quarter', unit:'تومان', manualValue:'', visible:true, featured:false, showTwoPrices:true, buySpreadPercent:-0.252, sellSpreadPercent:-1.3722 },
      { id:'gramcoin-main', label:'سکه یک گرمی', source:'coin_gerami', unit:'تومان', manualValue:'', visible:true, featured:false, showTwoPrices:true, buySpreadPercent:0, sellSpreadPercent:0 },
      { id:'gram24-main', label:'طلای ۲۴ عیار', source:'gram24', unit:'تومان', manualValue:'', visible:true, featured:false, showTwoPrices:true, buySpreadPercent:0, sellSpreadPercent:0 },
      { id:'gram21-main', label:'طلای ۲۱ عیار', source:'gram21', unit:'تومان', manualValue:'', visible:true, featured:false, showTwoPrices:true, buySpreadPercent:0, sellSpreadPercent:0 },
      { id:'ounce-main', label:'انس طلا', source:'ounce', unit:'دلار', manualValue:'', visible:true, featured:false, showTwoPrices:true, buySpreadPercent:0.0271, sellSpreadPercent:-0.0271 }
    ]}
  ]};

let settings = clone(DEFAULT_SETTINGS);
let livePrices = {};
let globalUpdatedAt = null;
let sideRates = {};
let assetPrices = {};
let historyPayload = null;
let apiKeyConfigured = false;
let eventSource = null;
let latestPayload = null;
let toastTimer = null;
let logoImage = new Image();
logoImage.src = '/farzin-logo.png';
logoImage.onload = renderStory;

let storyBaseCanvas = null;
let storyBaseKey = '';
let lastAppliedPayloadKey = '';
let lastDashboardEtag = '';

const storyPersianDateFmt = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit'
});
const storyPersianWeekdayFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: 'Asia/Tehran', weekday: 'long'
});
const storyPadYearFmt = new Intl.NumberFormat('fa-IR', { useGrouping: false, minimumIntegerDigits: 4 });
const storyPadTwoFmt = new Intl.NumberFormat('fa-IR', { useGrouping: false, minimumIntegerDigits: 2 });
const storyTehranTimeFmt = new Intl.DateTimeFormat('fa-IR', {
  timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
});

function fetchWithTimeout(url, options = {}, timeoutMs = 3500) {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  const opts = controller ? { ...options, signal: controller.signal } : options;
  return fetch(url, opts).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function faNumber(value) {
  if (value === null || value === undefined || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const fmt = faNumber._fmt || (faNumber._fmt = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 }));
  return fmt.formatToParts(n).map(part => part.type === 'group' ? ',' : part.type === 'decimal' ? '.' : part.value).join('');
}
let cachedStoryDateKey = '';
let cachedStoryDate = null;
function tehranDateParts() {
  const date = new Date();
  const second = Math.floor(date.getTime() / 60000);
  if (second === cachedStoryDateKey && cachedStoryDate) return cachedStoryDate;
  const dateParts = storyPersianDateFmt.formatToParts(date);
  const part = type => dateParts.find(item => item.type === type)?.value || '00';
  const weekday = storyPersianWeekdayFmt.format(date);
  const padded = type => (type === 'year' ? storyPadYearFmt : storyPadTwoFmt).format(Number(part(type)));
  cachedStoryDate = { date: `${padded('year')}/${padded('month')}/${padded('day')}`, weekday };
  cachedStoryDateKey = second;
  return cachedStoryDate;
}
function normalizeSettings(raw = {}) {
  const merged = { ...clone(DEFAULT_SETTINGS), ...(raw && typeof raw === 'object' ? raw : {}) };
  if (!Array.isArray(raw.contactCards)) {
    merged.contactCards = [
      { id: 'contact-phone', title: 'تلفن', value: raw.phone || '', visible: true },
      { id: 'contact-whatsapp', title: 'واتساپ', value: raw.whatsapp || '', visible: true },
      { id: 'contact-address', title: 'آدرس', value: raw.address || '', visible: true }
    ];
  }
  if (!Array.isArray(raw.footerLines)) {
    merged.footerLines = [{ id: 'footer-main', text: raw.footer || DEFAULT_SETTINGS.footer, visible: true }];
  }
  merged.contactCards = merged.contactCards.map((item, i) => ({ id: item.id || makeId('contact'), title: item.title || `اطلاعات ${i+1}`, value: item.value || '', visible: item.visible !== false }));
  merged.footerLines = merged.footerLines.map((item, i) => ({ id: item.id || makeId('footer'), text: item.text || '', visible: item.visible !== false }));
  if (!Array.isArray(merged.sections)) merged.sections = clone(DEFAULT_SETTINGS.sections);
  if (!raw.schemaVersion || Number(raw.schemaVersion) < 4) {
    const oldRows = merged.sections.flatMap(section => section.rows || []);
    const oldBySource = new Map(oldRows.map(row => [row.source, row]));
    merged.sections = clone(DEFAULT_SETTINGS.sections);
    merged.sections[0].rows = merged.sections[0].rows.map(row => {
      const old = oldBySource.get(row.source);
      return old ? { ...row, manualValue: old.manualValue || '', visible: old.visible !== false, featured: old.featured ?? row.featured } : row;
    });
    merged.sideRates = clone(DEFAULT_SETTINGS.sideRates);
    merged.boardConfig = clone(DEFAULT_SETTINGS.boardConfig);
    merged.storyConfig = clone(DEFAULT_SETTINGS.storyConfig);
    merged.schemaVersion = 4;
  }
  if (!Array.isArray(merged.sideRates)) merged.sideRates = clone(DEFAULT_SETTINGS.sideRates);
  for (const row of [...merged.sections.flatMap(section => section.rows || []), ...merged.sideRates]) {
    row.showTwoPrices = row.showTwoPrices !== false;
    row.buySpreadPercent = Number(row.buySpreadPercent) || 0;
    row.sellSpreadPercent = Number(row.sellSpreadPercent) || 0;
  }
  merged.boardConfig = { ...clone(DEFAULT_SETTINGS.boardConfig), ...(merged.boardConfig || {}) };
  if ((!raw.schemaVersion || Number(raw.schemaVersion) < 7) && (Number(merged.boardConfig.refreshSeconds) === 30 || Number(merged.boardConfig.refreshSeconds) === 10)) {
    merged.boardConfig.refreshSeconds = 1;
  }
  merged.storyConfig = { ...clone(DEFAULT_SETTINGS.storyConfig), ...(merged.storyConfig || {}) };
  return merged;
}
function formatTehranTime(iso) {
  if (!iso) return 'زمان منبع نامشخص';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'زمان منبع نامشخص';
  return storyTehranTimeFmt.format(date);
}
function showToast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
function setConnection(state, label, market) {
  $('statusDot').className = `fz-status-dot ${state}`;
  $('connectionLabel').textContent = label;
  if (market) $('marketStatus').textContent = market;
}
function timeForPrice(price) {
  return price && price.updated_at ? price.updated_at : globalUpdatedAt;
}
function getRowData(row) {
  if (row.source === 'manual') {
    return { value: row.manualValue || '', updatedAt: null, isManual: true };
  }
  const item = livePrices && (livePrices[row.source] || assetPrices[row.symbol || row.source]);
  const divisor = Math.max(0.0000001, Number(row.divisor) || 1);
  return {
    value: item && item.price !== undefined ? Number(item.price) / divisor : '',
    updatedAt: timeForPrice(item),
    isManual: false
  };
}
function loadSettingsIntoForm() {
  document.querySelectorAll('[data-config]').forEach(el => {
    const key = el.dataset.config;
    if (!(key in settings)) return;
    if (el.type === 'checkbox') el.checked = Boolean(settings[key]);
    else el.value = settings[key];
  });
  document.querySelectorAll('[data-story]').forEach(el => {
    const key = el.dataset.story;
    if (settings.storyConfig && key in settings.storyConfig) el.checked = Boolean(settings.storyConfig[key]);
  });
  $('liveEnabled').checked = settings.liveEnabled !== false;
  $('watermarkValue').textContent = `${faNumber(settings.watermarkOpacity)}٪`;
  renderSectionEditors();
  renderCustomEditors();
  renderStory();
}
function renderCustomEditors() {
  const contactsHost = $('contactCardsEditor');
  const footersHost = $('footerLinesEditor');
  if (contactsHost) {
    contactsHost.innerHTML = settings.contactCards.map((card, index) => `
      <div class="custom-item-editor">
        <input class="row-input" data-contact-field="title" data-contact-id="${esc(card.id)}" value="${esc(card.title)}" placeholder="عنوان کادر" aria-label="عنوان کادر">
        <input class="row-input" data-contact-field="value" data-contact-id="${esc(card.id)}" value="${esc(card.value)}" placeholder="متن یا شماره" aria-label="متن کادر">
        <label class="mini-check"><input type="checkbox" data-contact-field="visible" data-contact-id="${esc(card.id)}" ${card.visible ? 'checked' : ''}> نمایش</label>
        <div class="row-actions">
          <button class="icon-btn" data-custom-action="contact-up" data-custom-id="${esc(card.id)}" title="انتقال به بالا">↑</button>
          <button class="icon-btn" data-custom-action="contact-down" data-custom-id="${esc(card.id)}" title="انتقال به پایین">↓</button>
          <button class="icon-btn danger" data-custom-action="contact-delete" data-custom-id="${esc(card.id)}" title="حذف کادر">×</button>
        </div>
      </div>`).join('') || '<p class="empty-custom-list">هنوز کادری نساخته‌ای.</p>';
  }
  if (footersHost) {
    footersHost.innerHTML = settings.footerLines.map(line => `
      <div class="custom-item-editor footer-item-editor">
        <input class="row-input" data-footer-field="text" data-footer-id="${esc(line.id)}" value="${esc(line.text)}" placeholder="متن فوتر" aria-label="متن فوتر">
        <label class="mini-check"><input type="checkbox" data-footer-field="visible" data-footer-id="${esc(line.id)}" ${line.visible ? 'checked' : ''}> نمایش</label>
        <div class="row-actions">
          <button class="icon-btn" data-custom-action="footer-up" data-custom-id="${esc(line.id)}" title="انتقال به بالا">↑</button>
          <button class="icon-btn" data-custom-action="footer-down" data-custom-id="${esc(line.id)}" title="انتقال به پایین">↓</button>
          <button class="icon-btn danger" data-custom-action="footer-delete" data-custom-id="${esc(line.id)}" title="حذف متن">×</button>
        </div>
      </div>`).join('') || '<p class="empty-custom-list">هنوز متنی برای فوتر اضافه نشده.</p>';
  }
  contactsHost?.querySelectorAll('[data-contact-field]').forEach(el => {
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
      const item = settings.contactCards.find(card => card.id === el.dataset.contactId);
      if (!item) return;
      item[el.dataset.contactField] = el.type === 'checkbox' ? el.checked : el.value;
      renderStory();
    });
  });
  footersHost?.querySelectorAll('[data-footer-field]').forEach(el => {
    el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', () => {
      const item = settings.footerLines.find(line => line.id === el.dataset.footerId);
      if (!item) return;
      item[el.dataset.footerField] = el.type === 'checkbox' ? el.checked : el.value;
      renderStory();
    });
  });
  document.querySelectorAll('[data-custom-action]').forEach(btn => btn.addEventListener('click', () => handleCustomAction(btn.dataset.customAction, btn.dataset.customId)));
}
function moveListItem(list, id, direction) {
  const index = list.findIndex(item => item.id === id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= list.length) return;
  [list[index], list[next]] = [list[next], list[index]];
}
function handleCustomAction(action, id) {
  if (action.startsWith('contact-')) {
    if (action === 'contact-delete') settings.contactCards = settings.contactCards.filter(item => item.id !== id);
    else moveListItem(settings.contactCards, id, action === 'contact-up' ? -1 : 1);
  } else {
    if (action === 'footer-delete') settings.footerLines = settings.footerLines.filter(item => item.id !== id);
    else moveListItem(settings.footerLines, id, action === 'footer-up' ? -1 : 1);
  }
  renderCustomEditors(); renderStory();
}
$('addContactCard')?.addEventListener('click', () => {
  settings.contactCards.push({ id: makeId('contact'), title: 'عنوان جدید', value: 'متن دلخواه', visible: true });
  renderCustomEditors(); renderStory();
});
$('addFooterLine')?.addEventListener('click', () => {
  settings.footerLines.push({ id: makeId('footer'), text: 'متن جدید فوتر', visible: true });
  renderCustomEditors(); renderStory();
});

function bindBasics() {
  document.querySelectorAll('[data-config]').forEach(el => {
    el.addEventListener('input', () => {
      const key = el.dataset.config;
      settings[key] = el.type === 'checkbox' ? el.checked : (el.type === 'range' || el.tagName === 'SELECT' && key === 'exportScale' ? Number(el.value) : el.value);
      if (key === 'watermarkOpacity') $('watermarkValue').textContent = `${faNumber(settings.watermarkOpacity)}٪`;
      renderStory();
    });
  });
  document.querySelectorAll('[data-story]').forEach(el => {
    el.addEventListener('change', () => {
      settings.storyConfig = settings.storyConfig || {};
      settings.storyConfig[el.dataset.story] = el.checked;
      renderStory();
    });
  });
  $('liveEnabled').addEventListener('change', () => {
    settings.liveEnabled = $('liveEnabled').checked;
    if (settings.liveEnabled) startLive(); else stopLive('استریم زنده خاموش است.');
  });
}
function renderSectionEditors() {
  const host = $('sectionsEditor');
  host.innerHTML = settings.sections.map((section, sectionIndex) => `
    <div class="section-editor" data-section="${esc(section.id)}">
      <div class="section-editor-top">
        <input class="section-title-input" data-section-title="${esc(section.id)}" value="${esc(section.title)}" maxlength="32" aria-label="عنوان بخش">
        <button class="icon-btn" data-action="section-up" data-section-id="${esc(section.id)}" title="انتقال به بالا">↑</button>
        <button class="icon-btn" data-action="section-down" data-section-id="${esc(section.id)}" title="انتقال به پایین">↓</button>
        <button class="icon-btn danger" data-action="section-delete" data-section-id="${esc(section.id)}" title="حذف بخش">×</button>
      </div>
      <div class="section-editor-options">
        <label class="mini-check"><input type="checkbox" data-section-visible="${esc(section.id)}" ${section.visible ? 'checked' : ''}> نمایش این بخش در استوری</label>
        <span class="mini-check">${faNumber(section.rows.length)} ردیف</span>
        <button class="fz-btn fz-btn-secondary fz-btn-sm" data-action="row-add" data-section-id="${esc(section.id)}">＋ افزودن نرخ</button>
      </div>
      ${section.rows.map((row, rowIndex) => `
        <div class="row-editor" data-row="${esc(row.id)}">
          <input class="row-input" data-row-field="label" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}" value="${esc(row.label)}" placeholder="عنوان قیمت" aria-label="عنوان قیمت">
          <select class="source-select" data-row-field="source" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}" aria-label="منبع قیمت">
            ${API_SYMBOLS.map(([key,label]) => `<option value="${key}" ${row.source === key ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
          <input class="row-input" data-row-field="unit" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}" value="${esc(row.unit)}" placeholder="واحد" aria-label="واحد">
          <input class="row-input" data-row-field="symbol" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}" value="${esc(row.symbol || '')}" placeholder="شناسه نماد سفارشی TGJU" aria-label="شناسه نماد TGJU">
          <input class="row-input" type="number" min="0.000001" step="any" data-row-field="divisor" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}" value="${esc(row.divisor || 1)}" placeholder="تقسیم بر" aria-label="ضریب تبدیل">
          <select class="source-select" data-row-field="icon" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}">${(window.FARZIN_ASSET_CATALOG?.iconTypes||['auto','gold','coin','silver','currency','crypto','oil','metal','commodity','forex','stock','fund','bond','generic']).map(icon=>`<option value="${icon}" ${row.icon===icon?'selected':''}>${icon}</option>`).join('')}</select>
          <input class="row-input" data-row-field="manualValue" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}" value="${esc(row.manualValue || '')}" placeholder="مقدار دستی" aria-label="مقدار دستی">
          <div class="row-actions">
            <button class="icon-btn" data-action="row-up" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}" title="انتقال به بالا">↑</button>
            <button class="icon-btn" data-action="row-down" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}" title="انتقال به پایین">↓</button>
            <button class="icon-btn danger" data-action="row-delete" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}" title="حذف نرخ">×</button>
          </div>
          <div class="row-actions row-options">
            <label class="mini-check"><input type="checkbox" data-row-field="visible" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}" ${row.visible ? 'checked' : ''}> نمایش</label>
            <label class="mini-check"><input type="checkbox" data-row-field="featured" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}" ${row.featured ? 'checked' : ''}> طلایی</label>
          </div>
          <div class="row-quote-options">
            <label class="mini-check"><input type="checkbox" data-row-field="showTwoPrices" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}" ${row.showTwoPrices !== false ? 'checked' : ''}> نمایش خرید و فروش</label>
            <label class="field"><span>حاشیه خرید (%)</span><input class="row-input" type="number" min="-20" max="20" step="0.01" data-row-field="buySpreadPercent" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}" value="${esc(row.buySpreadPercent ?? 0)}"></label>
            <label class="field"><span>حاشیه فروش (%)</span><input class="row-input" type="number" min="-20" max="20" step="0.01" data-row-field="sellSpreadPercent" data-section-id="${esc(section.id)}" data-row-id="${esc(row.id)}" value="${esc(row.sellSpreadPercent ?? 0)}"></label>
          </div>
        </div>`).join('')}
    </div>`).join('');

  host.querySelectorAll('[data-section-title]').forEach(el => el.addEventListener('input', () => {
    const section = findSection(el.dataset.sectionTitle); if (section) section.title = el.value; renderStory();
  }));
  host.querySelectorAll('[data-section-visible]').forEach(el => el.addEventListener('change', () => {
    const section = findSection(el.dataset.sectionVisible); if (section) section.visible = el.checked; renderStory();
  }));
  host.querySelectorAll('[data-row-field]').forEach(el => {
    const eventName = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventName, () => {
      const row = findRow(el.dataset.sectionId, el.dataset.rowId); if (!row) return;
      row[el.dataset.rowField] = el.type === 'checkbox' ? el.checked : (el.type === 'number' ? Number(el.value) : el.value);
      if (el.dataset.rowField === 'source') {
        const asset = (window.FARZIN_ASSET_CATALOG?.items || []).find(item => item.symbol === el.value);
        if (asset) { row.symbol = ''; row.unit = asset.unit; row.divisor = asset.divisor; row.icon = asset.icon; } else if (el.value !== 'custom') row.symbol = '';
        renderSectionEditors();
      }
      renderStory();
    });
  });
  host.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => handleEditorAction(btn.dataset.action, btn.dataset.sectionId, btn.dataset.rowId)));
}
function findSection(id) { return settings.sections.find(s => s.id === id); }
function findRow(sectionId, rowId) { const section = findSection(sectionId); return section && section.rows.find(r => r.id === rowId); }
function makeId(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; }
async function handleEditorAction(action, sectionId, rowId) {
  const si = settings.sections.findIndex(s => s.id === sectionId);
  if (action === 'section-delete') {
    const confirmed = window.FarzinUI
      ? await window.FarzinUI.confirm({ title: 'حذف بخش نرخ‌ها', message: 'این بخش و تمام نرخ‌های داخل آن حذف شوند؟', confirmLabel: 'حذف بخش', danger: true })
      : confirm('این بخش و تمام نرخ‌های داخل آن حذف شود؟');
    if (!confirmed) return;
    if (si >= 0) settings.sections.splice(si, 1);
  } else if (action === 'section-up' && si > 0) {
    [settings.sections[si - 1], settings.sections[si]] = [settings.sections[si], settings.sections[si - 1]];
  } else if (action === 'section-down' && si >= 0 && si < settings.sections.length - 1) {
    [settings.sections[si + 1], settings.sections[si]] = [settings.sections[si], settings.sections[si + 1]];
  } else if (action === 'row-add' && si >= 0) {
    settings.sections[si].rows.push({ id: makeId('row'), label: 'قیمت جدید', source: 'manual', symbol: '', divisor: 1, icon: 'auto', unit: 'تومان', manualValue: '', visible: true, featured: false, showTwoPrices:true, buySpreadPercent:0, sellSpreadPercent:0 });
  } else if (action.startsWith('row-') && si >= 0) {
    const ri = settings.sections[si].rows.findIndex(r => r.id === rowId);
    if (action === 'row-delete' && ri >= 0) settings.sections[si].rows.splice(ri, 1);
    if (action === 'row-up' && ri > 0) [settings.sections[si].rows[ri - 1], settings.sections[si].rows[ri]] = [settings.sections[si].rows[ri], settings.sections[si].rows[ri - 1]];
    if (action === 'row-down' && ri >= 0 && ri < settings.sections[si].rows.length - 1) [settings.sections[si].rows[ri + 1], settings.sections[si].rows[ri]] = [settings.sections[si].rows[ri], settings.sections[si].rows[ri + 1]];
  }
  renderSectionEditors(); renderStory();
}
$('addSection').addEventListener('click', () => {
  settings.sections.push({ id: makeId('section'), title: 'بخش جدید', visible: true, rows: [
    { id: makeId('row'), label: 'قیمت جدید', source: 'manual', symbol: '', divisor: 1, icon: 'auto', unit: 'تومان', manualValue: '', visible: true, featured: false, showTwoPrices:true, buySpreadPercent:0, sellSpreadPercent:0 }
  ] });
  renderSectionEditors(); renderStory();
});

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'string' && !/^\d+(\.\d+)?$/.test(value.replace(/,/g,''))) return value;
  return faNumber(String(value).replace(/,/g,''));
}
function roundRect(ctx, x, y, w, h, r) {
  // Match the board renderer and avoid arcTo argument inconsistencies.
  const width = Math.max(0, Number(w) || 0);
  const height = Math.max(0, Number(h) || 0);
  const radius = Math.max(0, Math.min(Number(r) || 0, width / 2, height / 2));
  const right = x + width;
  const bottom = y + height;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(right - radius, y);
  ctx.quadraticCurveTo(right, y, right, y + radius);
  ctx.lineTo(right, bottom - radius);
  ctx.quadraticCurveTo(right, bottom, right - radius, bottom);
  ctx.lineTo(x + radius, bottom);
  ctx.quadraticCurveTo(x, bottom, x, bottom - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
function drawText(ctx, text, x, y, size, color, align = 'right', weight = 500, maxWidth) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px Vazirmatn, Tahoma, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.direction = align === 'center' ? 'rtl' : 'rtl';
  ctx.fillText(String(text ?? ''), x, y, maxWidth);
}
function drawFitText(ctx, text, x, y, size, color, align = 'center', weight = 500, maxWidth = 500, minSize = 10) {
  let current = Math.max(minSize, size);
  const content = String(text ?? '');
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.direction = 'rtl'; ctx.fillStyle = color;
  while (true) {
    ctx.font = `${weight} ${current}px Vazirmatn, Tahoma, sans-serif`;
    if (ctx.measureText(content).width <= maxWidth || current <= minSize) break;
    current = Math.max(minSize, current - 1);
  }
  ctx.font = `${weight} ${current}px Vazirmatn, Tahoma, sans-serif`;
  ctx.fillText(content, x, y, maxWidth);
}
function drawStoryPrice(ctx, value, unit, centerX, y, size, color, maxWidth, minSize = 12) {
  const number = String(value ?? '—'), label = String(unit || '').trim();
  let current = Math.max(minSize, size), numberWidth = 0, unitWidth = 0, unitSize = 0, gap = 0;
  while (true) {
    ctx.font = `800 ${current}px Vazirmatn, Tahoma, sans-serif`;
    numberWidth = ctx.measureText(number).width;
    unitSize = label ? Math.max(9, Math.round(current * .42)) : 0;
    ctx.font = `500 ${unitSize || current}px Vazirmatn, Tahoma, sans-serif`;
    unitWidth = label ? ctx.measureText(label).width : 0;
    gap = label ? Math.max(6, Math.round(current * .2)) : 0;
    if (numberWidth + unitWidth + gap <= maxWidth || current <= minSize) break;
    current = Math.max(minSize, current - 1);
  }
  const numberX = centerX + (unitWidth + gap) / 2;
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.direction = 'rtl';
  ctx.font = `800 ${current}px Vazirmatn, Tahoma, sans-serif`;
  ctx.fillText(number, numberX, y);
  if (label) {
    ctx.fillStyle = settings.mutedColor || '#9f9082'; ctx.font = `500 ${unitSize}px Vazirmatn, Tahoma, sans-serif`;
    ctx.fillText(label, centerX - (numberWidth + gap) / 2 - unitWidth / 2, y);
  }
}
function mixWithBlack(hex, factor) {
  const value = hex.replace('#','');
  const r = parseInt(value.slice(0,2),16), g = parseInt(value.slice(2,4),16), b = parseInt(value.slice(4,6),16);
  const f = Math.max(0, Math.min(1, factor));
  return `rgb(${Math.round(r*f)},${Math.round(g*f)},${Math.round(b*f)})`;
}
function activeSections() {
  return settings.sections.filter(s => s.visible && s.rows.some(r => r.visible));
}
let cachedStoryClockSecond = -1;
let cachedStoryClock = '';
function tehranClock() {
  const sec = Math.floor(Date.now() / 1000);
  if (sec !== cachedStoryClockSecond) {
    cachedStoryClockSecond = sec;
    cachedStoryClock = storyTehranTimeFmt.format(new Date(sec * 1000));
  }
  return cachedStoryClock;
}
function rateDataFor(rowOrSource, manualValue = '') {
  const row = typeof rowOrSource === 'object' && rowOrSource ? rowOrSource : { source:rowOrSource, manualValue };
  const source = String(row.source || '');
  if (source === 'manual') return { value:row.manualValue || manualValue || '', updatedAt:null, isManual:true, change_pct:null, direction:null };
  const key = String(row.symbol || source);
  const item = ['usd','aed','eur','silver','oil'].includes(source) ? sideRates[source] : (livePrices[source] || assetPrices[key]);
  if (!item) return { value:'', updatedAt:null, isManual:false, change_pct:null, direction:null };
  const divisor = Math.max(0.0000001, Number(row.divisor) || 1);
  return { value:Number(item.price) / divisor, updatedAt:item.source_timestamp ?? item.updated_at ?? item.updatedAt ?? null, isManual:false, change_pct:item.change_pct ?? item.changePercent24h ?? null, direction:item.direction || null, unit:item.unit || '', source:item.source || null, receivedAt:item.received_at || null };
}
function storyQuotePrices(value, row = {}) {
  const quotes = window.FarzinQuotePrices(value, row);
  return quotes ? { buy:faNumber(quotes.buy), sell:faNumber(quotes.sell) } : { buy:'-', sell:'-' };
}
function rgbaHex(hex, alpha) {
  const clean = String(hex || '#c5a875').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
  const r = parseInt(full.slice(0, 2), 16), g = parseInt(full.slice(2, 4), 16), b = parseInt(full.slice(4, 6), 16);
  return `rgba(${Number.isFinite(r) ? r : 197},${Number.isFinite(g) ? g : 168},${Number.isFinite(b) ? b : 117},${alpha})`;
}
function drawAssetIcon(ctx,type,x,y,size=18){
  const primary=settings.goldColor||'#c5a875',secondary=settings.mutedColor||'#9f9082',iconSize=Math.round(size*1.32);
  ctx.save();
  ctx.fillStyle='rgba(27,18,14,0.9)';
  ctx.beginPath();ctx.arc(x,y,iconSize*0.64,0,Math.PI*2);ctx.fill();
  ctx.lineWidth=1;
  ctx.strokeStyle=rgbaHex(secondary,0.42);
  ctx.stroke();
  ctx.restore();
  if(window.FarzinAssetIcons)window.FarzinAssetIcons.draw(ctx,type,x,y,iconSize,primary);
}
function assetIcon(item){return window.FarzinAssetIcons?window.FarzinAssetIcons.infer(item):'generic';}
function drawStoryCardBackdropIcon(ctx,row,x,y,w,h,featured=false){
  if(!window.FarzinAssetIcons||typeof window.FarzinAssetIcons.drawSide3D!=='function')return;
  const primary=settings.goldColor||'#c5a875';
  const iconSize=Math.max(50,Math.min(w*0.28,h*1.24));
  const cx=x+Math.max(iconSize*0.44,w*0.12);
  const cy=y+h*0.54;
  ctx.save();
  roundRect(ctx,x+1.5,y+1.5,Math.max(0,w-3),Math.max(0,h-3),20.5);
  ctx.clip();
  window.FarzinAssetIcons.drawSide3D(ctx,assetIcon(row),cx,cy,iconSize,primary,{opacity:featured?0.3:0.24});
  ctx.restore();
}
function historySeries() {
  const raw = historyPayload?.points || historyPayload?.history || historyPayload?.data || [];
  const range = ({'1d':86400000,'30d':30*86400000,'90d':90*86400000,'1y':365*86400000})[settings.boardConfig?.chartRange || '1d'] || 86400000;
  const cutoff = Date.now() - range;
  const unique = new Map();
  raw.forEach(point => {
    let time, value;
    if (Array.isArray(point)) [time,value] = point;
    else { time = point.timestamp || point.time || point.date; value = point.price ?? point.value; }
    const t = typeof time === 'number' ? new Date(time < 1e12 ? time * 1000 : time).getTime() : Date.parse(time);
    const numeric = Number(value);
    if (Number.isFinite(t) && t <= Date.now() && t >= cutoff && Number.isFinite(numeric) && numeric > 0) unique.set(t, { time:t, value:numeric });
  });
  return [...unique.values()].sort((a,b)=>a.time-b.time);
}
function drawStoryArrow(ctx, x, y, direction) {
  const color = direction === 'up' ? '#a4c690' : direction === 'down' ? '#d47786' : '#9f9082';
  ctx.save();ctx.fillStyle=color;ctx.beginPath();
  if(direction==='up'){ctx.moveTo(x,y-9);ctx.lineTo(x-8,y+5);ctx.lineTo(x+8,y+5);}
  else if(direction==='down'){ctx.moveTo(x,y+9);ctx.lineTo(x-8,y-5);ctx.lineTo(x+8,y-5);}
  else {ctx.rect(x-7,y-2,14,4);}
  ctx.closePath();ctx.fill();ctx.restore();
}
function drawStoryTrendBadge(ctx, anchorX, by, badgeH, maxBadgeW, pct, direction, align = 'right') {
  const hasPct = pct !== null && pct !== undefined && pct !== '' && Number.isFinite(Number(pct));
  const num = hasPct ? Number(pct) : null;
  const dir = direction === 'up' || direction === 'down' || direction === 'flat'
    ? direction
    : (hasPct ? (num > 0.0001 ? 'up' : num < -0.0001 ? 'down' : 'flat') : null);
  if (!dir) return 0;
  const absVal = hasPct ? Math.abs(num) : 0;
  const sign = dir === 'up' && absVal > 0.0001 ? '+' : dir === 'down' && absVal > 0.0001 ? '-' : '';
  const text = hasPct ? `${sign}${faNumber(absVal)}٪` : (dir === 'up' ? 'صعودی' : dir === 'down' ? 'نزولی' : '');
  if (!text) return 0;
  const textColor = dir === 'up' ? '#cfe3c1' : dir === 'down' ? '#ecc0c7' : '#9f9082';
  const accentColor = dir === 'up' ? '#a4c690' : dir === 'down' ? '#d47786' : '#9f9082';
  const fillColor = dir === 'up' ? 'rgba(164,198,144,0.16)' : dir === 'down' ? 'rgba(212,119,134,0.18)' : 'rgba(159,144,130,0.14)';
  const strokeColor = dir === 'up' ? 'rgba(164,198,144,0.46)' : dir === 'down' ? 'rgba(212,119,134,0.48)' : 'rgba(159,144,130,0.32)';
  ctx.save();
  ctx.direction = 'ltr';
  let fontSize = Math.max(9.5, Math.min(12, Math.round(badgeH * 0.6)));
  const arrowW = Math.max(6, Math.round(badgeH * 0.38));
  const padX = Math.max(5, Math.round(badgeH * 0.34));
  const gap = 4;
  let textW = 0;
  while (true) {
    ctx.font = `700 ${fontSize}px Vazirmatn, Tahoma, sans-serif`;
    textW = ctx.measureText(text).width;
    if (padX * 2 + arrowW + gap + textW <= maxBadgeW || fontSize <= 8.5) break;
    fontSize = Math.max(8.5, fontSize - 0.5);
  }
  const badgeW = Math.min(maxBadgeW, Math.ceil(padX * 2 + arrowW + gap + textW));
  const bx = align === 'left' ? anchorX : anchorX - badgeW;
  const centerY = by + badgeH / 2;
  ctx.fillStyle = fillColor;
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1;
  roundRect(ctx, bx, by, badgeW, badgeH, 5);
  ctx.fill();
  ctx.stroke();
  const halfA = arrowW / 2;
  const ax = bx + padX + halfA;
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  if (dir === 'up') {
    ctx.moveTo(ax, centerY - halfA * 0.9); ctx.lineTo(ax - halfA, centerY + halfA * 0.8); ctx.lineTo(ax + halfA, centerY + halfA * 0.8);
  } else if (dir === 'down') {
    ctx.moveTo(ax, centerY + halfA * 0.9); ctx.lineTo(ax - halfA, centerY - halfA * 0.8); ctx.lineTo(ax + halfA, centerY - halfA * 0.8);
  } else {
    ctx.rect(ax - halfA, centerY - 1, arrowW, 2);
  }
  ctx.closePath();
  ctx.fill();
  const maxTextW = Math.max(12, badgeW - (padX * 2 + arrowW + gap));
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, bx + padX + arrowW + gap, centerY + 0.5, maxTextW);
  ctx.restore();
  return badgeW;
}
function drawStoryBackdropPattern(ctx, width, height, primary, secondary) {
  ctx.save();
  ctx.lineWidth = 1;
  // Subtle Persian 8-point Girih geometric lattice
  const step = 120;
  for (let gx = -step / 2; gx <= width + step; gx += step) {
    for (let gy = -step / 2; gy <= height + step; gy += step) {
      ctx.strokeStyle = rgbaHex(secondary, 0.042);
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const r = i % 2 === 0 ? 36 : 16;
        const px = gx + Math.cos(a) * r;
        const py = gy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.strokeStyle = rgbaHex(primary, 0.032);
      ctx.beginPath();
      ctx.moveTo(gx - 42, gy); ctx.lineTo(gx, gy - 42);
      ctx.lineTo(gx + 42, gy); ctx.lineTo(gx, gy + 42);
      ctx.closePath();
      ctx.stroke();
    }
  }
  // Royal Shamseh architectural halo behind header masthead
  const cx = width / 2, cy = 126;
  [185, 240, 295].forEach((rad, idx) => {
    ctx.strokeStyle = idx === 1 ? rgbaHex(primary, 0.14) : rgbaHex(secondary, 0.08);
    ctx.lineWidth = idx === 1 ? 1.4 : 1;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.restore();
}
function drawGlassPanel(ctx, x, y, w, h, radius, primary, secondary, featured = false) {
  ctx.save();
  // 1. 3D floating elevation shadow
  ctx.shadowColor = featured ? rgbaHex(primary, 0.38) : 'rgba(0, 0, 0, 0.72)';
  ctx.shadowBlur = featured ? 28 : 20;
  ctx.shadowOffsetY = featured ? 10 : 7;

  // 2. Frosted Mocha & Deep Chocolate glass body
  const glassGrad = ctx.createLinearGradient(x, y, x + w * 0.65, y + h);
  if (featured) {
    glassGrad.addColorStop(0, 'rgba(56, 38, 29, 0.92)');
    glassGrad.addColorStop(0.55, 'rgba(43, 29, 22, 0.94)');
    glassGrad.addColorStop(1, 'rgba(27, 18, 14, 0.96)');
  } else {
    glassGrad.addColorStop(0, 'rgba(43, 29, 22, 0.88)');
    glassGrad.addColorStop(0.6, 'rgba(34, 23, 17, 0.92)');
    glassGrad.addColorStop(1, 'rgba(27, 18, 14, 0.95)');
  }
  ctx.fillStyle = glassGrad;
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.restore();

  // 3. Diagonal glass sheen highlight clipped to panel
  ctx.save();
  roundRect(ctx, x, y, w, h, radius);
  ctx.clip();
  const sheen = ctx.createLinearGradient(x, y, x + w, y + h);
  sheen.addColorStop(0, featured ? rgbaHex(primary, 0.16) : 'rgba(248, 242, 231, 0.055)');
  sheen.addColorStop(0.42, 'rgba(248, 242, 231, 0.012)');
  sheen.addColorStop(1, 'rgba(19, 12, 9, 0.24)');
  ctx.fillStyle = sheen;
  ctx.fillRect(x, y, w, h);
  // Subtle top specular highlight hairline inside glass
  const topHighlight = ctx.createLinearGradient(x, y, x + w, y);
  topHighlight.addColorStop(0, 'rgba(248,242,231,0)');
  topHighlight.addColorStop(0.35, featured ? rgbaHex(secondary, 0.52) : 'rgba(248,242,231,0.22)');
  topHighlight.addColorStop(0.75, featured ? rgbaHex(primary, 0.62) : rgbaHex(secondary, 0.26));
  topHighlight.addColorStop(1, 'rgba(248,242,231,0)');
  ctx.fillStyle = topHighlight;
  ctx.fillRect(x + 12, y + 1, w - 24, 1.5);
  ctx.restore();

  // 4. Perimeter gradient border light (Muted Gold + Muted Taupe)
  ctx.save();
  const borderGrad = ctx.createLinearGradient(x, y, x + w, y + h);
  if (featured) {
    borderGrad.addColorStop(0, rgbaHex(secondary, 0.82));
    borderGrad.addColorStop(0.38, rgbaHex(primary, 0.95));
    borderGrad.addColorStop(0.72, rgbaHex(secondary, 0.42));
    borderGrad.addColorStop(1, rgbaHex(primary, 0.78));
  } else {
    borderGrad.addColorStop(0, rgbaHex(secondary, 0.44));
    borderGrad.addColorStop(0.5, rgbaHex(primary, 0.34));
    borderGrad.addColorStop(1, rgbaHex(secondary, 0.22));
  }
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = featured ? 1.8 : 1.25;
  roundRect(ctx, x, y, w, h, radius);
  ctx.stroke();

  // Inner subtle depth bevel
  ctx.strokeStyle = 'rgba(248, 242, 231, 0.05)';
  ctx.lineWidth = 1;
  roundRect(ctx, x + 2.5, y + 2.5, Math.max(0, w - 5), Math.max(0, h - 5), Math.max(2, radius - 2.5));
  ctx.stroke();
  ctx.restore();

  if (featured) {
    ctx.save();
    const spine = ctx.createLinearGradient(x, y + h * 0.22, x, y + h * 0.78);
    spine.addColorStop(0, secondary);
    spine.addColorStop(0.5, primary);
    spine.addColorStop(1, secondary);
    ctx.fillStyle = spine;
    roundRect(ctx, x + 2, y + h * 0.24, 4, h * 0.52, 2);
    ctx.fill();
    ctx.restore();
  }
}
function drawStoryChart(ctx, x, y, w, h) {
  const primary=settings.goldColor||'#c5a875', secondary=settings.mutedColor||'#9f9082';
  drawGlassPanel(ctx, x, y, w, h, 20, primary, secondary, false);
  drawText(ctx,settings.chartTitle||'نمودار تغییرات طلای ۱۸ عیار',x+w-24,y+37,22,'#e8d8be','right',700,w-48);
  const points=historySeries(),gx=x+26,gy=y+62,gw=w-52,gh=h-102;
  ctx.save();ctx.strokeStyle=rgbaHex(secondary,0.14);ctx.lineWidth=1;
  for(let i=1;i<=3;i++){const yy=gy+gh*i/4;ctx.beginPath();ctx.moveTo(gx,yy);ctx.lineTo(gx+gw,yy);ctx.stroke();}
  if(points.length>1){
    const vals=points.map(p=>p.value),min=Math.min(...vals),max=Math.max(...vals),span=max-min||1;
    const coords=points.map((p,i)=>({x:gx+i/(points.length-1)*gw,y:gy+gh-(p.value-min)/span*gh}));
    const fill=ctx.createLinearGradient(0,gy,0,gy+gh);fill.addColorStop(0,rgbaHex(primary,0.34));fill.addColorStop(0.7,rgbaHex('#6e503e',0.12));fill.addColorStop(1,'rgba(27,18,14,0)');
    ctx.beginPath();coords.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.lineTo(gx+gw,gy+gh);ctx.lineTo(gx,gy+gh);ctx.closePath();ctx.fillStyle=fill;ctx.fill();
    const lineGrad=ctx.createLinearGradient(gx,0,gx+gw,0);lineGrad.addColorStop(0,secondary);lineGrad.addColorStop(0.55,primary);lineGrad.addColorStop(1,'#e8d8be');
    ctx.save();ctx.shadowColor=rgbaHex(primary,0.52);ctx.shadowBlur=12;
    ctx.beginPath();coords.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.strokeStyle=lineGrad;ctx.lineWidth=3.2;ctx.lineJoin='round';ctx.stroke();ctx.restore();
    const last=coords.at(-1);
    ctx.fillStyle=rgbaHex(primary,0.28);ctx.beginPath();ctx.arc(last.x,last.y,11,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=primary;ctx.beginPath();ctx.arc(last.x,last.y,5.5,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f8f2e7';ctx.beginPath();ctx.arc(last.x,last.y,2.4,0,Math.PI*2);ctx.fill();
    drawText(ctx,faNumber(max),gx+gw-2,gy+18,14,secondary,'right',500,180,10);drawText(ctx,faNumber(min),gx+gw-2,gy+gh-4,14,secondary,'right',500,180,10);
  } else drawText(ctx,'اطلاعات تاریخی کافی نیست',x+w/2,gy+gh/2,17,secondary,'center',500,w-50,12);
  const date=tehranDateParts();
  drawText(ctx,`${date.weekday} · ${date.date}`,x+w-24,y+h-15,15,primary,'right',700,w*.48,11);
  ctx.restore();
}
function drawCardSurface(ctx,x,y,w,h,featured=false){
  const primary=settings.goldColor||'#c5a875',secondary=settings.mutedColor||'#9f9082';
  drawGlassPanel(ctx,x,y,w,h,22,primary,secondary,featured);
}
function renderStoryBaseLayer(width, height, scale, gold, main, muted, bg) {
  const hasLogo = Boolean(logoImage.complete && logoImage.naturalWidth);
  const logoKey = hasLogo ? `${logoImage.src}:${logoImage.naturalWidth}` : 'no-logo';
  const key = `${scale}:${width}:${height}:${bg}:${gold}:${main}:${muted}:${settings.watermarkOpacity || 0}:${Boolean(settings.showFrame)}:${Boolean(settings.showLogo)}:${settings.brand || ''}:${settings.subtitle || ''}:${logoKey}`;
  if (storyBaseCanvas && storyBaseKey === key) return storyBaseCanvas;
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;

  const base = storyBaseCanvas || document.createElement('canvas');
  base.width = width * scale;
  base.height = height * scale;
  const bctx = base.getContext('2d');
  if (!bctx) return null;
  bctx.setTransform(scale, 0, 0, scale, 0, 0);

  // Deep Chocolate base + layered Mocha, Muted Gold & Champagne radial luxury light
  bctx.fillStyle = bg; bctx.fillRect(0, 0, width, height);
  const topGlow = bctx.createRadialGradient(540, 210, 20, 540, 290, 780);
  topGlow.addColorStop(0, rgbaHex(gold, 0.22)); topGlow.addColorStop(0.45, rgbaHex('#6e503e', 0.14)); topGlow.addColorStop(1, 'rgba(27,18,14,0)');
  bctx.fillStyle = topGlow; bctx.fillRect(0, 0, width, height);
  const sideGlow = bctx.createRadialGradient(140, 1480, 10, 140, 1480, 760);
  sideGlow.addColorStop(0, rgbaHex(muted, 0.12)); sideGlow.addColorStop(0.5, rgbaHex(gold, 0.06)); sideGlow.addColorStop(1, 'rgba(27,18,14,0)');
  bctx.fillStyle = sideGlow; bctx.fillRect(0, 0, width, height);
  drawStoryBackdropPattern(bctx, width, height, gold, muted);

  if (hasLogo) {
    const size = 810;
    bctx.save();
    bctx.globalAlpha = Math.max(0, Math.min(.3, Number(settings.watermarkOpacity || 0) / 100));
    bctx.globalCompositeOperation = 'screen';
    bctx.drawImage(logoImage, (width - size) / 2, 615, size, size);
    bctx.restore();
  }

  if (settings.showFrame) {
    bctx.save();
    const frameGrad = bctx.createLinearGradient(30, 30, 1050, 1890);
    frameGrad.addColorStop(0, rgbaHex(muted, 0.75));
    frameGrad.addColorStop(0.32, rgbaHex(gold, 0.88));
    frameGrad.addColorStop(0.68, rgbaHex(muted, 0.4));
    frameGrad.addColorStop(1, rgbaHex(gold, 0.78));
    bctx.strokeStyle = frameGrad; bctx.lineWidth = 2; roundRect(bctx, 30, 30, 1020, 1860, 24); bctx.stroke();
    bctx.strokeStyle = rgbaHex(muted, 0.22); bctx.lineWidth = 1; roundRect(bctx, 43, 43, 994, 1834, 18); bctx.stroke();
    bctx.fillStyle = '#e8d8be';
    [[43, 43], [1037, 43], [43, 1877], [1037, 1877]].forEach(([cx, cy]) => {
      bctx.beginPath(); bctx.moveTo(cx, cy - 5); bctx.lineTo(cx + 5, cy); bctx.lineTo(cx, cy + 5); bctx.lineTo(cx - 5, cy); bctx.closePath(); bctx.fill();
    });
    bctx.restore();
  }

  if (settings.showLogo && hasLogo) {
    const size = 68, gap = 20, brand = String(settings.brand || ''); bctx.font = '800 44px Vazirmatn, Tahoma, sans-serif';
    const brandW = Math.min(790, bctx.measureText(brand).width), groupW = brandW + gap + size, left = (width - groupW) / 2;
    bctx.save(); bctx.shadowColor = rgbaHex(gold, 0.6); bctx.shadowBlur = 22; bctx.drawImage(logoImage, left + brandW + gap, 54, size, size); bctx.restore();
    drawFitText(bctx, brand, left + brandW / 2, 101, 44, main, 'center', 800, brandW, 24);
  } else drawText(bctx, settings.brand || '', 540, 128, 44, main, 'center', 800, 900, 24);
  drawText(bctx, settings.subtitle || '', 540, settings.showLogo ? 154 : 169, 21, muted, 'center', 500, 920, 15);

  storyBaseCanvas = base;
  storyBaseKey = key;
  return base;
}

function drawStory(canvas, scale) {
  const width=1080,height=1920;canvas.width=width*scale;canvas.height=height*scale;
  const ctx=canvas.getContext('2d');ctx.setTransform(scale,0,0,scale,0,0);
  const gold=settings.goldColor||'#c5a875',main=settings.textColor||'#f8f2e7',muted=settings.mutedColor||'#9f9082',bg=settings.bgColor||'#1b120e';
  const cachedBase = renderStoryBaseLayer(width, height, scale, gold, main, muted, bg);
  if (cachedBase) {
    ctx.drawImage(cachedBase, 0, 0, width, height);
  } else {
    ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);
    const topGlow=ctx.createRadialGradient(540,210,20,540,290,780);
    topGlow.addColorStop(0,rgbaHex(gold,0.22));topGlow.addColorStop(0.45,rgbaHex('#6e503e',0.14));topGlow.addColorStop(1,'rgba(27,18,14,0)');
    ctx.fillStyle=topGlow;ctx.fillRect(0,0,width,height);
    const sideGlow=ctx.createRadialGradient(140,1480,10,140,1480,760);
    sideGlow.addColorStop(0,rgbaHex(muted,0.12));sideGlow.addColorStop(0.5,rgbaHex(gold,0.06));sideGlow.addColorStop(1,'rgba(27,18,14,0)');
    ctx.fillStyle=sideGlow;ctx.fillRect(0,0,width,height);
    drawStoryBackdropPattern(ctx,width,height,gold,muted);
    if(logoImage.complete&&logoImage.naturalWidth){const size=810;ctx.save();ctx.globalAlpha=Math.max(0,Math.min(.3,Number(settings.watermarkOpacity||0)/100));ctx.globalCompositeOperation='screen';ctx.drawImage(logoImage,(width-size)/2,615,size,size);ctx.restore();}
    if(settings.showFrame){
      ctx.save();
      const frameGrad=ctx.createLinearGradient(30,30,1050,1890);
      frameGrad.addColorStop(0,rgbaHex(muted,0.75));frameGrad.addColorStop(0.32,rgbaHex(gold,0.88));frameGrad.addColorStop(0.68,rgbaHex(muted,0.4));frameGrad.addColorStop(1,rgbaHex(gold,0.78));
      ctx.strokeStyle=frameGrad;ctx.lineWidth=2;roundRect(ctx,30,30,1020,1860,24);ctx.stroke();
      ctx.strokeStyle=rgbaHex(muted,0.22);ctx.lineWidth=1;roundRect(ctx,43,43,994,1834,18);ctx.stroke();
      ctx.fillStyle='#e8d8be';
      [[43,43],[1037,43],[43,1877],[1037,1877]].forEach(([cx,cy])=>{ctx.beginPath();ctx.moveTo(cx,cy-5);ctx.lineTo(cx+5,cy);ctx.lineTo(cx,cy+5);ctx.lineTo(cx-5,cy);ctx.closePath();ctx.fill();});
      ctx.restore();
    }
    if(settings.showLogo&&logoImage.complete&&logoImage.naturalWidth){
      const size=68,gap=20,brand=String(settings.brand||'');ctx.font='800 44px Vazirmatn, Tahoma, sans-serif';
      const brandW=Math.min(790,ctx.measureText(brand).width),groupW=brandW+gap+size,left=(width-groupW)/2;
      ctx.save();ctx.shadowColor=rgbaHex(gold,0.6);ctx.shadowBlur=22;ctx.drawImage(logoImage,left+brandW+gap,54,size,size);ctx.restore();
      drawFitText(ctx,brand,left+brandW/2,101,44,main,'center',800,brandW,24);
    } else drawText(ctx,settings.brand||'',540,128,44,main,'center',800,900,24);
    drawText(ctx,settings.subtitle||'',540,settings.showLogo?154:169,21,muted,'center',500,920,15);
  }

  const cfg=settings.storyConfig||{};
  const headerY=settings.showLogo?246:196,headerCellW=455,headerCellH=58,headerGapX=30,headerGapY=10,headerX=70;
  const dp=tehranDateParts(),isOpen=latestPayload?.market_open,headerCards=[];
   if(cfg.showBothDates!==false)headerCards.push({primary:`${dp.weekday} · ${dp.date}`,color:'#e8d8be',highlight:true});
  if(cfg.showMarketStatus!==false)headerCards.push({primary:isOpen===true?'بازار باز است':isOpen===false?'بازار بسته است':'وضعیت بازار نامشخص',color:isOpen===true?'#a4c690':isOpen===false?'#d47786':muted,highlight:isOpen===true});
  headerCards.push({primary:`ساعت تهران ${tehranClock()}`,color:main},{primary:globalUpdatedAt?`آخرین نرخ ${formatTehranTime(globalUpdatedAt)}`:'در انتظار دریافت نرخ',color:muted});
  headerCards.forEach((card,i)=>{
    const col=i%2,row=Math.floor(i/2),x=headerX+col*(headerCellW+headerGapX),y=headerY+row*(headerCellH+headerGapY);
    drawGlassPanel(ctx,x,y,headerCellW,headerCellH,16,gold,muted,Boolean(card.highlight));
    drawFitText(ctx,card.primary,x+headerCellW/2,y+37,20,card.color,'center',700,headerCellW-30,13);
  });
  let cursorY=headerY+Math.ceil(headerCards.length/2)*(headerCellH+headerGapY)-headerGapY+18;

  const drawRateCard=(row,x,y,w,h)=>{
    const data=rateDataFor(row),featured=Boolean(row.featured),unit=data.unit||row.unit||'',single=row.showTwoPrices===false;
    const showTrend=cfg.showTrends!==false;
    const hasTrendData=showTrend&&((data.change_pct!==null&&data.change_pct!==undefined&&data.change_pct!==''&&Number.isFinite(Number(data.change_pct)))||data.direction==='up'||data.direction==='down');
    const badgeH=Math.max(15,Math.min(19,Math.round(h*0.24)));
    const badgeY=y+Math.max(6,Math.min(10,Math.round(h*0.10)));
    const maxBadgeW=Math.max(54,Math.min(92,Math.floor(w*0.23)));
    drawCardSurface(ctx,x,y,w,h,featured);
    drawStoryCardBackdropIcon(ctx,row,x,y,w,h,featured);
    if(single){
      const badgeW=hasTrendData?drawStoryTrendBadge(ctx,x+18,badgeY,badgeH,maxBadgeW,data.change_pct,data.direction,'left'):0;
      drawFitText(ctx,row.label||'',x+w-20,y+Math.min(21,h*.29),Math.min(19,h*.24),main,'right',700,Math.max(80,w-(badgeW?46+badgeW:40)),12);
    } else {
      const badgeW=hasTrendData?drawStoryTrendBadge(ctx,x+w-20,badgeY,badgeH,maxBadgeW,data.change_pct,data.direction,'right'):0;
      const maxLabelW=badgeW?Math.max(96,w-2*Math.max(36,badgeW+28)):w-44;
      drawFitText(ctx,row.label||'',x+w/2,y+Math.min(21,h*.29),Math.min(19,h*.24),main,'center',700,maxLabelW,11);
    }
    if(single){
       const value=data.value===''?'-':formatValue(data.value);
       drawStoryPrice(ctx,value,unit,x+w/2,y+h*.73,Math.min(56,h*.55,w*.18),featured?'#e8d8be':main,w-36,12);
      return;
    }
     const quotes=storyQuotePrices(data.value,row),valueSize=Math.min(44,h*.32,w*.095),labelSize=Math.min(14,h*.17),columnW=(w-34)/2,labelY=y+Math.max(h*.48,27),valueY=y+h*.84;
     drawFitText(ctx,'خرید ما',x+w-columnW/2-14,labelY,labelSize,'#d47786','center',700,columnW-12,10);
     drawStoryPrice(ctx,quotes.buy,unit,x+w-columnW/2-14,valueY,valueSize,'#ecc0c7',columnW-12,10);
     drawFitText(ctx,'فروش ما',x+columnW/2+14,labelY,labelSize,'#a4c690','center',700,columnW-12,10);
     drawStoryPrice(ctx,quotes.sell,unit,x+columnW/2+14,valueY,valueSize,'#cfe3c1',columnW-12,10);
  };
  if(cfg.showMainRates!==false){
    const rows=activeSections().flatMap(sec=>sec.rows.filter(row=>row.visible!==false));
    drawText(ctx,settings.mainTitle||'قیمت لحظه‌ای طلا و سکه',1010,cursorY+27,28,'#e8d8be','right',800,930,18);
    ctx.save();const ruleG=ctx.createLinearGradient(70,0,580,0);ruleG.addColorStop(0,'rgba(159,144,130,0)');ruleG.addColorStop(0.65,rgbaHex(muted,0.35));ruleG.addColorStop(1,rgbaHex(gold,0.75));ctx.fillStyle=ruleG;ctx.fillRect(70,cursorY+18,520,1.5);ctx.restore();
    cursorY+=43;
    const x0=70,areaW=940,gapX=14,gapY=10,cols=rows.length>1?2:1,rowCount=Math.max(1,Math.ceil(rows.length/cols)),cardW=(areaW-gapX*(cols-1))/cols;
    const cardH=Math.max(58,Math.min(112,Math.floor((430-gapY*(rowCount-1))/rowCount)));
    rows.forEach((row,i)=>drawRateCard(row,x0+(i%cols)*(cardW+gapX),cursorY+Math.floor(i/cols)*(cardH+gapY),cardW,cardH));
    cursorY+=rows.length?rowCount*(cardH+gapY)-gapY+22:18;
  }
  if(cfg.showSideRates!==false){
    const visible=(settings.sideRates||[]).filter(item=>item.visible!==false);
    drawText(ctx,settings.sideTitle||'ارز و بازارهای جهانی',1010,cursorY+25,25,'#e8d8be','right',800,930,17);
    ctx.save();const ruleG=ctx.createLinearGradient(70,0,580,0);ruleG.addColorStop(0,'rgba(159,144,130,0)');ruleG.addColorStop(0.65,rgbaHex(gold,0.38));ruleG.addColorStop(1,rgbaHex(muted,0.75));ctx.fillStyle=ruleG;ctx.fillRect(70,cursorY+17,520,1.5);ctx.restore();
    cursorY+=39;
    const x0=70,areaW=940,gapX=14,gapY=8,cols=visible.length>1?2:1,rowCount=Math.max(1,Math.ceil(visible.length/cols)),cardW=(areaW-gapX*(cols-1))/cols;
    const cardH=Math.max(52,Math.min(72,Math.floor((190-gapY*(rowCount-1))/rowCount)));
    visible.forEach((item,i)=>drawRateCard(item,x0+(i%cols)*(cardW+gapX),cursorY+Math.floor(i/cols)*(cardH+gapY),cardW,cardH));
    cursorY+=visible.length?rowCount*(cardH+gapY)-gapY+24:18;
  }
  let chartBottom=cursorY;
   if(cfg.showGoldChart!==false){const chartY=Math.max(cursorY,1120),chartH=210;drawStoryChart(ctx,70,chartY,940,chartH);chartBottom=chartY+chartH;}
  const contactCards=(settings.contactCards||[]).filter(card=>card.visible!==false&&String(card.value||'').trim());
  let contentBottom=chartBottom;
   if(cfg.showContacts!==false&&contactCards.length){const y=Math.max(chartBottom+22,1330),x0=70,w=940,gap=12,cols=Math.min(3,contactCards.length),cw=(w-gap*(cols-1))/cols,availableH=Math.max(0,1585-y),maxRows=Math.floor((availableH+gap)/56),shown=contactCards.slice(0,cols*maxRows),rows=Math.ceil(shown.length/cols),ch=rows?Math.min(100,Math.floor((availableH-gap*(rows-1))/rows)):0;shown.forEach((card,i)=>{const x=x0+(i%cols)*(cw+gap),cy=y+Math.floor(i/cols)*(ch+gap),mid=cy+ch/2;drawGlassPanel(ctx,x,cy,cw,ch,16,gold,muted,false);drawFitText(ctx,card.title||'',x+cw/2,mid-7,15,muted,'center',600,cw-28,10);drawFitText(ctx,card.value||'',x+cw/2,mid+17,20,main,'center',700,cw-28,11);});if(rows)contentBottom=y+rows*ch+(rows-1)*gap;}
  const footers=(settings.footerLines||[]).filter(line=>line.visible!==false&&String(line.text||'').trim());const footerStart=Math.max(1620,contentBottom+32),footerLineH=30,footerBottom=1858,footerCount=Math.max(0,Math.min(5,Math.floor((footerBottom-footerStart)/footerLineH)+1));
  if(cfg.showFooter!==false&&footers.length&&footerCount>0){
    const shownFooters=footers.slice(0,footerCount);
    const renderY0=Math.max(footerStart,footerBottom-(shownFooters.length-1)*footerLineH);
    ctx.save();
    const fRule=ctx.createLinearGradient(160,0,920,0);fRule.addColorStop(0,'rgba(159,144,130,0)');fRule.addColorStop(0.5,rgbaHex(gold,0.38));fRule.addColorStop(1,'rgba(159,144,130,0)');
    ctx.fillStyle=fRule;ctx.fillRect(160,renderY0-28,760,1);
    ctx.restore();
    shownFooters.forEach((line,i)=>drawFitText(ctx,line.text,540,renderY0+i*footerLineH,i===0?19:17,i===0?gold:muted,'center',i===0?700:500,920,12));
  }
}

function renderStory() {
  const canvas = $('storyPreview');
  if (!canvas) return;
  try { drawStory(canvas, .5); } catch (error) { console.error('Story render failed', error); }
  $('previewState').textContent = latestPayload ? 'نرخ منبع دریافت شده' : 'در انتظار داده زنده';
}

function applyPricePayload(payload) {
  if (!payload || typeof payload !== 'object') return;
  const payloadKey = payload.snapshotSeq !== undefined
    ? `${payload.snapshotSeq}:${payload.updated_at || ''}:${payload.status || ''}`
    : '';
  if (payloadKey && payloadKey === lastAppliedPayloadKey) return;
  if (payloadKey) lastAppliedPayloadKey = payloadKey;
  if (payload.prices && Object.keys(payload.prices).length) livePrices = payload.prices;
  if (payload.sideRates && Object.keys(payload.sideRates).length) sideRates = payload.sideRates;
  if (payload.assets && Object.keys(payload.assets).length) assetPrices = payload.assets;
  if (payload.history) historyPayload = payload.history;
  latestPayload = payload;
  globalUpdatedAt = payload.updated_at || null;
  const latestTime = formatTehranTime(globalUpdatedAt);
  $('lastUpdateText').textContent = globalUpdatedAt ? latestTime : 'در انتظار زمان منبع TGJU';
  if (payload.hasPrices) {
    setConnection(payload.status === 'partial' || payload.status === 'stale' ? 'warning' : 'online',
      payload.status === 'stale' ? 'نمایش آخرین نرخ معتبر' : 'اتصال به TGJU برقرار است',
      payload.status === 'partial' ? 'برخی نمادها در پاسخ فعلی TGJU موجود نیستند.' : 'بروزرسانی خودکار نرخ‌ها فعال است.');
  } else if (payload.status === 'connecting') {
    setConnection('', 'در حال دریافت نرخ از TGJU', 'سرور محلی آماده است؛ منتظر پاسخ منبع قیمت هستیم.');
  } else {
    setConnection('error', 'دریافت نرخ از TGJU ناموفق بود', payload.last_error || Object.values(payload.errors || {}).join(' · ') || 'ارتباط با منبع قیمت برقرار نشد.');
  }
  window.FarzinUI?.renderMarketTable?.(payload, $('marketSearch')?.value || '');
  renderStory();
}
async function loadInitialPrices() {
  try {
    const response = await fetchWithTimeout('/api/dashboard-data', { cache: 'no-store' }, 3500);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'دریافت نرخ انجام نشد.');
    const etag = response.headers?.get?.('ETag');
    if (etag) lastDashboardEtag = etag;
    applyPricePayload(data);
  } catch (error) {
    setConnection('error', 'سرور محلی در دسترس نیست', error.message || 'پاسخی از سرور دریافت نشد.');
    console.warn(error);
  }
}
function stopLive(message = 'بروزرسانی خودکار متوقف شد.') {
  if (eventSource) { eventSource.close(); eventSource = null; }
  setConnection('', 'بروزرسانی خودکار خاموش است', message);
}
function startLive() {
  if (!settings.liveEnabled) { stopLive('برای فعال‌سازی، دریافت خودکار را در تنظیمات روشن کن.'); return; }
  setConnection(latestPayload?.hasPrices ? 'online' : '', latestPayload?.hasPrices ? 'دریافت خودکار TGJU فعال است' : 'در انتظار اولین نرخ TGJU', 'قیمت‌ها بدون کلید API از TGJU دریافت می‌شوند.');
}
let dashboardPollTimer = null;
let dashboardPollBusy = false;
async function pollDashboard() {
  if (!settings.liveEnabled || dashboardPollBusy || document.hidden) return;
  dashboardPollBusy = true;
  try {
    const headers = lastDashboardEtag ? { 'If-None-Match': lastDashboardEtag } : {};
    const response = await fetchWithTimeout('/api/dashboard-data', { cache: 'no-store', headers }, 3500);
    if (response.status === 304) return;
    const etag = response.headers?.get?.('ETag');
    if (etag) lastDashboardEtag = etag;
    const data = await response.json();
    if (response.ok) applyPricePayload(data);
    else throw new Error(data.error || `HTTP ${response.status}`);
  } catch (error) {
    if (!latestPayload?.hasPrices) setConnection('error', 'ارتباط با سرور محلی ناموفق', error.message || 'خطای دریافت داده');
    else setConnection('warning', 'آخرین نرخ معتبر نمایش داده می‌شود', 'ارتباط با سرور موقتاً قطع شده است.');
  } finally {
    dashboardPollBusy = false;
    clearTimeout(dashboardPollTimer);
    if (!document.hidden) {
      const seconds = Math.max(1, Number(settings.boardConfig?.refreshSeconds || 1));
      const delay = latestPayload?.hasPrices ? seconds * 1000 : 1000;
      dashboardPollTimer = setTimeout(pollDashboard, delay);
    }
  }
}
async function refreshNow() {
  $('refreshNow').disabled = true; $('refreshNow').textContent = 'در حال دریافت...';
  try {
    await fetchWithTimeout('/api/refresh', { method:'POST', cache:'no-store' }, 2500);
    let data = null;
    for (let i=0;i<8;i++) {
      await new Promise(resolve=>setTimeout(resolve,700));
      const response = await fetchWithTimeout('/api/dashboard-data', { cache:'no-store' }, 3500);
      const etag = response.headers?.get?.('ETag');
      if (etag) lastDashboardEtag = etag;
      data = await response.json();
      if (data.hasPrices || data.status === 'offline') break;
    }
    if (!data) throw new Error('از TGJU پاسخی دریافت نشد.');
    lastAppliedPayloadKey = '';
    applyPricePayload(data);
    showToast(data.hasPrices ? 'آخرین نرخ از TGJU دریافت شد.' : (data.last_error || 'TGJU هنوز نرخ معتبری ارسال نکرده است.'));
  } catch (error) { showToast(error.message); }
  finally { $('refreshNow').disabled = false; $('refreshNow').textContent = 'دریافت نرخ همین حالا'; }
}
$('refreshNow').addEventListener('click', refreshNow);

function collectSettings() { settings.schemaVersion = 7; return clone(settings); }
async function saveAll() {
  $('saveAll').disabled = true; $('saveAll').textContent = 'در حال ذخیره...';
  try {
    const response = await fetch('/api/config', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ settings: collectSettings() })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'ذخیره تنظیمات ناموفق بود.');
    $('keyState').textContent = 'منبع نرخ‌ها TGJU است؛ کلید API لازم نیست.';
    $('saveMessage').textContent = 'تنظیمات ذخیره شد';
    showToast('تنظیمات با موفقیت ذخیره شدند.');
    await loadInitialPrices();
  } catch (error) { showToast(error.message); $('saveMessage').textContent = 'ذخیره انجام نشد'; }
  finally { $('saveAll').disabled = false; $('saveAll').textContent = 'ذخیره تنظیمات'; }
}
async function saveSettingsOnly() {
  try {
    const response = await fetch('/api/config', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({settings:collectSettings()}) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'ذخیره ناموفق');
    $('saveMessage').textContent = 'ذخیره شد'; showToast('تنظیمات روی همین کامپیوتر ذخیره شد.');
  } catch (error) { showToast(error.message); }
}
$('saveAll').addEventListener('click', saveAll);
$('saveSettings').addEventListener('click', saveSettingsOnly);
$('clearKey')?.addEventListener('click', () => showToast('برای دریافت نرخ TGJU هیچ کلیدی ذخیره نمی‌شود.'));

$('logoUpload').addEventListener('change', async event => {
  const file = event.target.files && event.target.files[0]; if (!file) return;
  if (file.type !== 'image/png') { showToast('برای حفظ شفافیت، فقط فایل PNG انتخاب کن.'); event.target.value = ''; return; }
  if (file.size > 12*1024*1024) { showToast('حجم لوگو باید کمتر از ۱۲ مگابایت باشد.'); event.target.value = ''; return; }
  const dataUrl = await new Promise((resolve,reject) => { const reader = new FileReader(); reader.onload=()=>resolve(reader.result); reader.onerror=reject; reader.readAsDataURL(file); });
  try {
    const response = await fetch('/api/logo',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({dataUrl})});
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'آپلود لوگو ناموفق بود.');
    logoImage = new Image(); logoImage.onload = renderStory; logoImage.src = data.url;
    $('adminLogo').src = data.url; $('logoThumb').src = data.url;
    showToast('لوگوی جدید ذخیره شد.');
  } catch(error) { showToast(error.message); }
  event.target.value = '';
});

$('exportPng').addEventListener('click', async () => {
  const button = $('exportPng'); const oldText = button.textContent;
  button.disabled = true; button.textContent = 'در حال آماده‌سازی PNG...';
  try {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
    if (logoImage && !logoImage.complete) await new Promise(resolve => { logoImage.onload=resolve; logoImage.onerror=resolve; });
    const scale = Math.max(1, Math.min(3, Number(settings.exportScale) || 1));
    const canvas = document.createElement('canvas'); drawStory(canvas, scale);
    const blob = await new Promise((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('ساخت PNG ناموفق بود.')), 'image/png'));
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    const stamp = new Date().toISOString().replace(/[:.]/g,'-');
    a.href = url; a.download = `farzin-story-${scale}x-${stamp}.png`; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000); showToast(`تصویر PNG با وضوح ${1080*scale}×${1920*scale} آماده شد.`);
  } catch(error) { showToast(error.message || 'خطا در ساخت تصویر.'); }
  finally { button.disabled=false; button.textContent=oldText; }
});

$('exportConfig').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(collectSettings(), null, 2)],{type:'application/json'});
  const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='farzin-story-settings.json'; a.click(); URL.revokeObjectURL(url);
});
$('importConfig').addEventListener('change', async event => {
  const file=event.target.files && event.target.files[0]; if(!file)return;
  try {
    const parsed=JSON.parse(await file.text());
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.sections)) throw new Error('فایل تنظیمات معتبر نیست.');
    settings=normalizeSettings(parsed);
    renderSectionEditors(); loadSettingsIntoForm(); await saveSettingsOnly(); showToast('تنظیمات بازیابی شد.');
  } catch(error) { showToast(error.message); }
  event.target.value='';
});
$('resetConfig').addEventListener('click', async () => {
  const confirmed = window.FarzinUI
    ? await window.FarzinUI.confirm({ title: 'بازگردانی تنظیمات پیش‌فرض', message: 'تمام تنظیمات ظاهری و محتوایی به حالت اولیه برگردند؟', confirmLabel: 'بازگردانی پیش‌فرض', danger: true })
    : confirm('تمام تنظیمات ظاهری و محتوایی به حالت اولیه برگردند؟');
  if (!confirmed) return;
  settings=normalizeSettings(clone(DEFAULT_SETTINGS)); loadSettingsIntoForm(); await saveSettingsOnly();
});

$('marketSearch')?.addEventListener('input', event => {
  window.FarzinUI?.renderMarketTable?.(latestPayload, event.target.value);
});

async function init() {
  bindBasics();
  try {
    const response = await fetchWithTimeout('/api/config', { cache:'no-store' }, 3500);
    const data = await response.json();
    if (data.settings) settings=normalizeSettings(data.settings);
  } catch(error) { console.warn('Could not load local settings',error); }
  $('keyState').textContent='منبع نرخ‌ها: TGJU · بدون نیاز به کلید API';
  const apiKeyInput=$('apiKey'); if(apiKeyInput){apiKeyInput.disabled=true;apiKeyInput.placeholder='برای دریافت نرخ از TGJU نیازی به کلید نیست؛ این بخش غیرفعال است.';}
  const clearKey=$('clearKey'); if(clearKey)clearKey.hidden=true;
  $('saveAll').textContent='ذخیره تنظیمات';
  loadSettingsIntoForm();
  await loadInitialPrices();
  startLive();
  dashboardPollTimer=setTimeout(pollDashboard, latestPayload?.hasPrices ? Math.max(1,Number(settings.boardConfig?.refreshSeconds||1))*1000 : 1000);
  setInterval(() => {
    if (!document.hidden) renderStory();
  }, 1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      renderStory();
      clearTimeout(dashboardPollTimer);
      pollDashboard();
    } else {
      clearTimeout(dashboardPollTimer);
    }
  });
}
init();
