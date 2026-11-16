'use strict';
(() => {
  const SCRIPT_URL = 'https://api.tgju.org/v1/widget/v2';
  const ALLOWED_TYPES = new Set(['market-overview', 'ticker-single', 'ticker-tap', 'ticker', 'market-data']);
  const ALLOWED_COLUMNS = new Set(['dot', 'diff', 'low', 'high', 'time']);

  function readAttributes(source) {
    const attrs = {};
    const pattern = /([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
    let match;
    while ((match = pattern.exec(source))) attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? '';
    return attrs;
  }

  function escapeAttr(value) {
    return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function parse(code) {
    const input = String(code || '');
    const matches = [...input.matchAll(/<tgju\b([^>]*)>/gi)];
    if (!matches.length) throw new Error('در کد واردشده، تگ رسمی <tgju> پیدا نشد. کد خروجی را از بخش «کد خروجی برای استفاده در سایت» کپی کن.');
    if (matches.length > 5) throw new Error('حداکثر ۵ ویجت رسمی را می‌توان هم‌زمان نمایش داد.');
    return matches.map((match, index) => {
      const attrs = readAttributes(match[1]);
      const type = String(attrs.type || '').trim().toLowerCase();
      if (!ALLOWED_TYPES.has(type)) throw new Error(`نوع ویجت شماره ${index + 1} پشتیبانی نمی‌شود.`);
      const rawItems = String(attrs.items || '').trim();
      if (!/^\d+(?:\s*,\s*\d+)*$/.test(rawItems)) throw new Error(`شناسه آیتم‌های ویجت شماره ${index + 1} باید عددی باشد؛ از کد خروجی واقعی TGJU استفاده کن، نه MARKET_ITEMS.`);
      const items = rawItems.split(',').map(x => x.trim()).filter(Boolean);
      const limit = type === 'ticker-single' ? 1 : (type === 'market-overview' || type === 'ticker') ? 5 : 20;
      if (!items.length || items.length > limit) throw new Error(`تعداد آیتم‌های ویجت شماره ${index + 1} برای این نوع ویجت نباید بیشتر از ${limit} باشد.`);
      const columns = String(attrs.columns || 'dot').split(',').map(x => x.trim()).filter(Boolean);
      if (columns.some(x => !ALLOWED_COLUMNS.has(x))) throw new Error(`ستون‌های ویجت شماره ${index + 1} شامل گزینه ناشناخته است.`);
      const safeAttrs = {};
      for (const [key, value] of Object.entries(attrs)) {
        if (!/^[a-z][a-z0-9_-]*$/.test(key) || ['src', 'onload', 'onerror', 'style'].includes(key)) continue;
        if (value.length <= 180 && /^[\p{L}\p{N} #%,._:+/()-]*$/u.test(value)) safeAttrs[key] = value;
      }
      safeAttrs.type = type;
      safeAttrs.items = items.join(',');
      safeAttrs.columns = columns.join(',') || 'dot';
      safeAttrs.token = 'webservice';
      if (attrs.speed && /^\d{1,3}$/.test(attrs.speed)) safeAttrs.speed = String(Math.max(10, Math.min(180, Number(attrs.speed))));
      return safeAttrs;
    });
  }

  function buildIframeDocument(widgets) {
    const tags = widgets.map(attrs => {
      const serialized = Object.entries(attrs).map(([key, value]) => `${key}="${escapeAttr(value)}"`).join(' ');
      return `<tgju ${serialized}></tgju>`;
    }).join('\n<div class="separator"></div>\n');
    return `<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:transparent;color:#eee;font-family:Tahoma,sans-serif}.root{width:100%;display:grid;gap:12px}.separator{height:1px;background:#a98b4b55;margin:4px 0}tgju{display:block;width:100%;min-height:150px}</style>
</head><body><div class="root">${tags}</div>
<script src="${SCRIPT_URL}" defer onload="parent.postMessage({type:'farzin-tgju-loaded'},'*')" onerror="parent.postMessage({type:'farzin-tgju-error'},'*')"></script>
</body></html>`;
  }

  async function mount(host, code, options = {}) {
    if (!host) throw new Error('محل نمایش ویجت پیدا نشد.');
    const widgets = parse(code);
    host.replaceChildren();
    const status = document.createElement('p');
    status.className = 'tgju-mount-status';
    status.textContent = 'در حال بارگذاری ویجت رسمی TGJU…';
    host.appendChild(status);
    const frame = document.createElement('iframe');
    frame.title = 'ابزارک رسمی قیمت‌های شبکه اطلاع‌رسانی طلا و ارز';
    frame.loading = options.eager ? 'eager' : 'lazy';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.style.cssText = `display:block;width:100%;height:${Math.max(360, Math.min(820, Number(options.height) || 640))}px;border:0;border-radius:12px;background:transparent`;
    host.appendChild(frame);
    const result = await new Promise((resolve, reject) => {
      let finished = false;
      const finish = (error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        if (error) reject(error); else resolve({ ok: true, count: widgets.length });
      };
      const onMessage = event => {
        if (event.source !== frame.contentWindow) return;
        if (event.data?.type === 'farzin-tgju-loaded') {
          status.textContent = 'اسکریپت رسمی TGJU بارگذاری شد؛ بروزرسانی داده طبق چرخه خود سرویس انجام می‌شود.';
          finish();
        } else if (event.data?.type === 'farzin-tgju-error') {
          const error = new Error('اسکریپت رسمی TGJU بارگذاری نشد. اینترنت و دسترسی به api.tgju.org را بررسی کن.');
          status.textContent = error.message;
          finish(error);
        }
      };
      window.addEventListener('message', onMessage);
      const timer = setTimeout(() => {
        const error = new Error('بارگذاری ویجت TGJU بیش از ۱۲ ثانیه طول کشید. اتصال اینترنت یا دسترسی به سرویس را بررسی کن.');
        status.textContent = error.message;
        finish(error);
      }, 12000);
      frame.addEventListener('error', () => finish(new Error('صفحه ایزوله ویجت TGJU بارگذاری نشد.')), { once: true });
      frame.srcdoc = buildIframeDocument(widgets);
    });
    return result;
  }

  window.FarzinTGJUWidget = { parse, mount, scriptUrl: SCRIPT_URL };
})();
