'use strict';

(() => {
  let modalRoot = null;
  let lastActiveElement = null;

  function ensureModal() {
    if (modalRoot) return modalRoot;
    const backdrop = document.createElement('div');
    backdrop.className = 'fz-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'fzModalTitle');
    backdrop.setAttribute('aria-describedby', 'fzModalMessage');
    backdrop.innerHTML = `
      <div class="fz-modal">
        <h3 class="fz-modal-title" id="fzModalTitle"></h3>
        <p class="fz-modal-message" id="fzModalMessage"></p>
        <div class="fz-modal-actions">
          <button type="button" class="fz-btn fz-btn-secondary" data-modal-cancel>انصراف</button>
          <button type="button" class="fz-btn fz-btn-primary" data-modal-confirm>تایید</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    modalRoot = backdrop;
    return modalRoot;
  }

  function confirmDialog(options) {
    const config = typeof options === 'string'
      ? { title: 'تایید عملیات', message: options }
      : (options || {});
    const root = ensureModal();
    const titleEl = root.querySelector('#fzModalTitle');
    const msgEl = root.querySelector('#fzModalMessage');
    const cancelBtn = root.querySelector('[data-modal-cancel]');
    const confirmBtn = root.querySelector('[data-modal-confirm]');

    titleEl.textContent = config.title || 'تایید عملیات';
    msgEl.textContent = config.message || '';
    cancelBtn.textContent = config.cancelLabel || 'انصراف';
    confirmBtn.textContent = config.confirmLabel || 'تایید';
    confirmBtn.className = config.danger ? 'fz-btn fz-btn-danger' : 'fz-btn fz-btn-primary';

    lastActiveElement = document.activeElement;
    root.classList.add('is-open');
    confirmBtn.focus();

    return new Promise(resolve => {
      const cleanup = result => {
        root.classList.remove('is-open');
        cancelBtn.removeEventListener('click', onCancel);
        confirmBtn.removeEventListener('click', onConfirm);
        root.removeEventListener('click', onBackdrop);
        document.removeEventListener('keydown', onKeyDown);
        if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
          lastActiveElement.focus();
        }
        resolve(result);
      };
      const onCancel = () => cleanup(false);
      const onConfirm = () => cleanup(true);
      const onBackdrop = event => {
        if (event.target === root) cleanup(false);
      };
      const onKeyDown = event => {
        if (event.key === 'Escape') {
          event.preventDefault();
          cleanup(false);
        }
      };
      cancelBtn.addEventListener('click', onCancel);
      confirmBtn.addEventListener('click', onConfirm);
      root.addEventListener('click', onBackdrop);
      document.addEventListener('keydown', onKeyDown);
    });
  }

  function initMobileNav() {
    const toggle = document.getElementById('fzMenuToggle');
    const drawer = document.getElementById('fzMobileDrawer');
    if (!toggle || !drawer) return;
    toggle.addEventListener('click', () => {
      const open = !drawer.classList.contains('is-open');
      drawer.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && drawer.classList.contains('is-open')) {
        drawer.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  function initSectionTabs() {
    const tabList = document.querySelector('[data-fz-tabs]');
    if (!tabList) return;
    const tabs = [...tabList.querySelectorAll('[data-tab-target]')];
    const panels = [...document.querySelectorAll('[data-tab-panel]')];
    if (!tabs.length || !panels.length) return;

    const activate = target => {
      tabs.forEach(tab => {
        const active = tab.dataset.tabTarget === target;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-selected', String(active));
      });
      panels.forEach(panel => {
        if (target === 'all') {
          panel.hidden = false;
        } else {
          panel.hidden = panel.dataset.tabPanel !== target;
        }
      });
    };

    tabs.forEach(tab => {
      tab.addEventListener('click', () => activate(tab.dataset.tabTarget));
    });
  }

  const faNumFmt = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 2 });
  function formatFaNum(value) {
    if (value === null || value === undefined || value === '') return '—';
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return faNumFmt
      .formatToParts(n)
      .map(p => (p.type === 'group' ? ',' : p.type === 'decimal' ? '.' : p.value))
      .join('');
  }

  const previousTablePrices = new Map();
  const activeTableTicks = new Map();
  let lastTablePayloadRef = null;
  let lastRenderedPayloadRef = undefined;
  let lastRenderedQuery = null;
  let tableTickClearTimer = null;

  function resolveItemDirection(item) {
    const hasPct = item.change !== null && item.change !== undefined && item.change !== '' && Number.isFinite(Number(item.change));
    const pct = hasPct ? Number(item.change) : null;
    const dir = item.direction === 'up' || item.direction === 'down' || item.direction === 'flat'
      ? item.direction
      : (hasPct ? (pct > 0.0001 ? 'up' : pct < -0.0001 ? 'down' : 'flat') : 'flat');
    return { hasPct, pct, dir };
  }

  function renderMarketBreadth(items, hasPayload, esc, trendArrowSvg) {
    const host = document.getElementById('marketBreadthStrip');
    if (!host) return;
    if (!hasPayload || !items.length) {
      host.innerHTML = `
        <div class="fz-breadth-cell">
          <span class="fz-breadth-kicker">نبض بازار</span>
          <span class="fz-breadth-sub">در انتظار دریافت داده‌های زنده برای محاسبه برآیند بازار...</span>
        </div>`;
      return;
    }

    let upCount = 0;
    let downCount = 0;
    let flatCount = 0;
    let topGainer = null;
    let topLoser = null;
    let pctSum = 0;
    let pctCount = 0;

    for (const item of items) {
      const { hasPct, pct, dir } = resolveItemDirection(item);
      if (dir === 'up') upCount += 1;
      else if (dir === 'down') downCount += 1;
      else flatCount += 1;

      if (hasPct) {
        pctSum += pct;
        pctCount += 1;
        if (pct > 0.0001 && (!topGainer || pct > topGainer.pct)) {
          topGainer = { name: item.name, pct };
        }
        if (pct < -0.0001 && (!topLoser || pct < topLoser.pct)) {
          topLoser = { name: item.name, pct };
        }
      }
    }

    const totalMoved = upCount + downCount;
    const upRatio = totalMoved > 0 ? Math.round((upCount / totalMoved) * 100) : 50;
    const avgPct = pctCount > 0 ? pctSum / pctCount : null;
    const avgDir = avgPct === null ? 'flat' : avgPct > 0.01 ? 'up' : avgPct < -0.01 ? 'down' : 'flat';
    const avgLabel = avgDir === 'up' ? 'برآیند صعودی' : avgDir === 'down' ? 'برآیند نزولی' : 'بازار متعادل';
    const avgFormatted = avgPct !== null
      ? `${avgPct > 0.0001 ? '+' : avgPct < -0.0001 ? '-' : ''}${formatFaNum(Math.abs(avgPct))}٪`
      : '—';

    host.innerHTML = `
      <div class="fz-breadth-cell">
        <span class="fz-breadth-kicker">نبض بازار</span>
        <div class="fz-breadth-counts fz-tabular">
          <span class="is-up">${formatFaNum(upCount)} صعودی</span>
          <span class="fz-breadth-sep" aria-hidden="true">·</span>
          <span class="is-down">${formatFaNum(downCount)} نزولی</span>
          ${flatCount ? `<span class="fz-breadth-sep" aria-hidden="true">·</span><span class="is-flat">${formatFaNum(flatCount)} ثابت</span>` : ''}
        </div>
        <div class="fz-breadth-meter" role="img" aria-label="نسبت ${formatFaNum(upCount)} صعودی به ${formatFaNum(downCount)} نزولی">
          <span class="fz-breadth-meter-up" style="width:${upRatio}%"></span>
        </div>
      </div>

      <div class="fz-breadth-cell">
        <span class="fz-breadth-kicker">بیشترین رشد ۲۴ ساعته</span>
        ${topGainer
          ? `<div class="fz-breadth-mover is-up">
              <span class="fz-breadth-name">${esc(topGainer.name)}</span>
              <span class="fz-breadth-pct fz-tabular" dir="ltr">${trendArrowSvg('up')}+${formatFaNum(Math.abs(topGainer.pct))}٪</span>
            </div>`
          : '<span class="fz-breadth-sub">رشد مثبتی ثبت نشده</span>'}
      </div>

      <div class="fz-breadth-cell">
        <span class="fz-breadth-kicker">بیشترین افت ۲۴ ساعته</span>
        ${topLoser
          ? `<div class="fz-breadth-mover is-down">
              <span class="fz-breadth-name">${esc(topLoser.name)}</span>
              <span class="fz-breadth-pct fz-tabular" dir="ltr">${trendArrowSvg('down')}-${formatFaNum(Math.abs(topLoser.pct))}٪</span>
            </div>`
          : '<span class="fz-breadth-sub">افت منفی ثبت نشده</span>'}
      </div>

      <div class="fz-breadth-cell">
        <span class="fz-breadth-kicker">${avgLabel}</span>
        <div class="fz-breadth-avg fz-tabular ${avgDir === 'up' ? 'is-up' : avgDir === 'down' ? 'is-down' : 'is-flat'}" dir="ltr">
          ${avgPct !== null ? trendArrowSvg(avgDir) : ''}
          <span>${avgFormatted}</span>
        </div>
      </div>
    `;
  }

  function renderMarketTable(payload, query = '') {
    const q = String(query || '').trim().toLowerCase();
    if (payload === lastRenderedPayloadRef && q === lastRenderedQuery) return;
    lastRenderedPayloadRef = payload;
    lastRenderedQuery = q;

    const tbody = document.getElementById('marketTableBody');
    const items = [];
    const labels = {
      gram18: 'طلای ۱۸ عیار',
      gram21: 'طلای ۲۱ عیار',
      gram24: 'طلای ۲۴ عیار',
      mazaneh: 'مظنه طلا',
      coin_full: 'سکه امامی',
      coin_old: 'سکه بهار آزادی (قدیم)',
      coin_half: 'نیم‌سکه',
      coin_quarter: 'ربع‌سکه',
      coin_gerami: 'سکه یک گرمی',
      ounce: 'انس جهانی طلا',
      usd: 'دلار آزاد',
      aed: 'درهم امارات',
      eur: 'یورو',
      silver: 'نقره ۹۹۹',
      oil: 'نفت برنت'
    };

    const pushMap = (groupName, map) => {
      if (!map || typeof map !== 'object') return;
      for (const [key, item] of Object.entries(map)) {
        if (!item || !Number.isFinite(Number(item.price))) continue;
        items.push({
          key,
          name: labels[key] || item.label || key,
          category: groupName,
          price: Number(item.price),
          unit: item.unit || 'تومان',
          change: item.change_pct,
          direction: item.direction,
          low: item.low !== null && item.low !== undefined && item.low !== '' && Number.isFinite(Number(item.low)) ? Number(item.low) : null,
          high: item.high !== null && item.high !== undefined && item.high !== '' && Number.isFinite(Number(item.high)) ? Number(item.high) : null
        });
      }
    };

    pushMap('طلا و سکه', payload?.prices);
    pushMap('ارز و کالا', payload?.sideRates);

    const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const trendArrowSvg = dir => {
      if (dir === 'up') {
        return '<svg class="fz-trend-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 12.5V3.5M8 3.5L3.75 7.75M8 3.5L12.25 7.75" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      }
      if (dir === 'down') {
        return '<svg class="fz-trend-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 3.5V12.5M8 12.5L3.75 8.25M8 12.5L12.25 8.25" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      }
      return '<svg class="fz-trend-icon" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8H12.5" stroke="currentColor" stroke-width="1.85" stroke-linecap="round"/></svg>';
    };

    const now = Date.now();
    if (payload && payload !== lastTablePayloadRef && items.length) {
      lastTablePayloadRef = payload;
      let anyTick = false;
      for (const item of items) {
        const prev = previousTablePrices.get(item.key);
        if (prev !== undefined && Math.abs(item.price - prev) > 1e-6) {
          activeTableTicks.set(item.key, {
            dir: item.price > prev ? 'up' : 'down',
            delta: item.price - prev,
            expiresAt: now + 1750
          });
          anyTick = true;
        }
        previousTablePrices.set(item.key, item.price);
      }
      if (anyTick) {
        clearTimeout(tableTickClearTimer);
        tableTickClearTimer = setTimeout(() => {
          const ts = Date.now();
          for (const [k, info] of activeTableTicks) {
            if (info.expiresAt <= ts) activeTableTicks.delete(k);
          }
          document.querySelectorAll('#marketTableBody tr[data-tick-key]').forEach(tr => {
            tr.classList.remove('is-tick-up', 'is-tick-down');
          });
        }, 1800);
      }
    }

    renderMarketBreadth(items, Boolean(payload), esc, trendArrowSvg);
    if (!tbody) return;

    const filtered = q
      ? items.filter(item => item.name.toLowerCase().includes(q) || item.key.toLowerCase().includes(q) || item.category.includes(q))
      : items;

    if (!payload) {
      tbody.innerHTML = '<tr><td colspan="6" class="fz-empty-state">در حال دریافت نرخ‌های زنده از TGJU...</td></tr>';
      return;
    }

    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="fz-empty-state">${items.length ? 'موردی با این جستجو یافت نشد.' : 'هنوز نرخی از TGJU دریافت نشده است.'}</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(item => {
      const { hasPct, pct, dir } = resolveItemDirection(item);
      const dirClass = dir === 'up' ? 'fz-trend-up' : dir === 'down' ? 'fz-trend-down' : 'fz-trend-flat';

      let trendHtml = '<span class="fz-trend-indicator fz-trend-flat is-empty" aria-label="تغییر نامشخص">—</span>';
      if (hasPct) {
        const absVal = Math.abs(pct);
        const sign = dir === 'up' && absVal > 0.0001 ? '+' : dir === 'down' && absVal > 0.0001 ? '-' : '';
        const formattedPct = `${sign}${formatFaNum(absVal)}٪`;
        const ariaText = dir === 'up'
          ? `افزایش ${formatFaNum(absVal)} درصد`
          : dir === 'down'
            ? `کاهش ${formatFaNum(absVal)} درصد`
            : 'بدون تغییر';
        trendHtml = `
          <span class="fz-trend-indicator ${dirClass}" aria-label="${esc(ariaText)}" title="${esc(ariaText)}">
            ${trendArrowSvg(dir)}
            <span class="fz-trend-val fz-tabular" dir="ltr">${formattedPct}</span>
          </span>
        `;
      } else if (dir === 'up' || dir === 'down') {
        const ariaText = dir === 'up' ? 'روند صعودی' : 'روند نزولی';
        trendHtml = `
          <span class="fz-trend-indicator ${dirClass}" aria-label="${ariaText}" title="${ariaText}">
            ${trendArrowSvg(dir)}
          </span>
        `;
      }

      let rangeHtml = '<span class="fz-range-empty" aria-label="بازه روزانه ناموجود">—</span>';
      if (item.low !== null && item.high !== null && item.high > item.low) {
        const pos = Math.max(0, Math.min(100, ((item.price - item.low) / (item.high - item.low)) * 100));
        const posText = `${formatFaNum(Math.round(pos))}٪`;
        const rangeLabel = `کف روز ${formatFaNum(item.low)}، سقف روز ${formatFaNum(item.high)}، جایگاه فعلی ${posText}`;
        rangeHtml = `
          <div class="fz-range-cell" dir="ltr" aria-label="${esc(rangeLabel)}" title="${esc(rangeLabel)}">
            <div class="fz-range-labels fz-tabular">
              <span>${formatFaNum(item.low)}</span>
              <span>${formatFaNum(item.high)}</span>
            </div>
            <div class="fz-range-track">
              <span class="fz-range-fill" style="width:${pos.toFixed(1)}%"></span>
              <span class="fz-range-dot" style="left:${pos.toFixed(1)}%"></span>
            </div>
          </div>
        `;
      }

      const tick = activeTableTicks.get(item.key);
      const isActiveTick = tick && tick.expiresAt > now;
      const tickRowClass = isActiveTick ? (tick.dir === 'up' ? 'is-tick-up' : 'is-tick-down') : '';
      const deltaHtml = isActiveTick
        ? `<span class="fz-price-delta ${tick.dir === 'up' ? 'is-up' : 'is-down'} fz-tabular" dir="ltr">${tick.dir === 'up' ? '+' : '-'}${formatFaNum(Math.abs(tick.delta))}</span>`
        : '';

      return `
        <tr data-tick-key="${esc(item.key)}" class="${tickRowClass}">
          <td><strong>${esc(item.name)}</strong></td>
          <td>${esc(item.category)}</td>
          <td class="is-num"><div class="fz-price-stack">${formatFaNum(item.price)}${deltaHtml}</div></td>
          <td>${esc(item.unit)}</td>
          <td>${rangeHtml}</td>
          <td class="is-num">${trendHtml}</td>
        </tr>
      `;
    }).join('');
  }

  function initTiltEffects() {
    if (window.__farzinLowPower || document.documentElement?.classList?.contains('fz-low-power')) return;
    if (typeof window.matchMedia !== 'function') return;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!finePointer || reducedMotion) return;

    const tiltTargets = [
      { selector: '.fz-preview-card', maxDeg: 3.5, zLift: 8 },
      { selector: '.config-summary-preview', maxDeg: 4.5, zLift: 10 },
      { selector: '.fz-stat-strip', maxDeg: 1.6, zLift: 4 }
    ];

    const attachInteractive = (el, { maxDeg = 0, zLift = 0 }) => {
      let rafId = 0;
      let latest = null;
      const apply = () => {
        rafId = 0;
        if (!latest) return;
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const px = Math.max(0, Math.min(1, (latest.x - rect.left) / rect.width));
        const py = Math.max(0, Math.min(1, (latest.y - rect.top) / rect.height));
        el.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
        el.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
        if (maxDeg > 0) {
          const rx = ((0.5 - py) * 2 * maxDeg).toFixed(2);
          const ry = ((px - 0.5) * 2 * maxDeg).toFixed(2);
          el.style.setProperty('--rx', `${rx}deg`);
          el.style.setProperty('--ry', `${ry}deg`);
          el.style.setProperty('--tz', `${zLift}px`);
        }
      };
      el.addEventListener('pointermove', event => {
        if (window.__farzinLowPower) return;
        latest = { x: event.clientX, y: event.clientY };
        if (!rafId) rafId = window.requestAnimationFrame(apply);
      }, { passive: true });
      el.addEventListener('pointerleave', () => {
        latest = null;
        if (rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = 0;
        }
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
        el.style.setProperty('--tz', '0px');
      });
    };

    for (const cfg of tiltTargets) {
      document.querySelectorAll(cfg.selector).forEach(el => attachInteractive(el, cfg));
    }

    document.querySelectorAll('.fz-card').forEach(el => {
      attachInteractive(el, { maxDeg: 0, zLift: 0 });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
    initSectionTabs();
    initTiltEffects();
  });

  window.FarzinUI = {
    confirm: confirmDialog,
    renderMarketTable
  };
})();
