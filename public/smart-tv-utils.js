'use strict';

(() => {
  const PERF_STORAGE_KEY = 'farzin_perf_mode';
  const TV_UA_RE = /Tizen|Web0S|webOS|SMART-TV|SmartTV|NetCast|Maple|HbbTV|BRAVIA|AFT|Android TV|GoogleTV|CrKey|Hisense|TCL|Roku|Viera|PhilipsTV|AQUOS|PHILIPS|SAMSUNG.*Browser|LG Browser|MiBox|SHIELD/i;
  const DEFAULT_FOCUS_SELECTOR = [
    'a[href]',
    'button:not([disabled])',
    'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'summary',
    '[tabindex]:not([tabindex="-1"])',
    '.rate-card',
    '.side-card'
  ].join(', ');

  class PerformanceModeManager {
    constructor(options = {}) {
      this.storageKey = options.storageKey || PERF_STORAGE_KEY;
      this.autoDowngradeFpsThreshold = Number(options.fpsThreshold) || 36;
      this.state = {
        mode: 'high',
        override: 'auto',
        isLowPower: false,
        isTv: false,
        reasons: [],
        capabilities: {}
      };
      this._fpsStarted = false;
      this._rafId = 0;
      this._mediaQuery = null;
      this._onMotionChange = () => this.refresh();
    }

    _readOverride() {
      try {
        const search = String(window.location?.search || '');
        if (/[?&](?:lite=0|perf=high)\b/i.test(search)) return 'high';
        if (/[?&](?:lite=1|tv=1|perf=low)\b/i.test(search)) return 'low';
        const stored = window.localStorage?.getItem(this.storageKey);
        if (stored === 'low' || stored === 'high') return stored;
      } catch {}
      return 'auto';
    }

    detect() {
      const reasons = [];
      const ua = String(typeof navigator !== 'undefined' ? navigator?.userAgent || '' : '');
      const isTv = TV_UA_RE.test(ua);
      if (isTv) reasons.push('smart-tv-ua');

      const cores = Number(typeof navigator !== 'undefined' ? navigator?.hardwareConcurrency : NaN);
      const weakCpu = Number.isFinite(cores) && cores > 0 && cores <= 4;
      if (weakCpu) reasons.push(`low-cpu:${cores}`);

      const mem = Number(typeof navigator !== 'undefined' ? navigator?.deviceMemory : NaN);
      const weakRam = Number.isFinite(mem) && mem > 0 && mem <= 2;
      if (weakRam) reasons.push(`low-ram:${mem}`);

      const conn = typeof navigator !== 'undefined' ? navigator?.connection : null;
      const saveData = Boolean(conn?.saveData);
      const slowNet = typeof conn?.effectiveType === 'string' && /^(?:slow-2g|2g)$/i.test(conn.effectiveType);
      if (saveData) reasons.push('save-data');
      if (slowNet) reasons.push(`slow-network:${conn.effectiveType}`);

      const reducedMotion = Boolean(
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)')?.matches
      );
      if (reducedMotion) reasons.push('reduced-motion');

      const hasCssSupports = typeof CSS !== 'undefined' && typeof CSS.supports === 'function';
      const supportsBackdrop = hasCssSupports
        ? (CSS.supports('backdrop-filter', 'blur(4px)') || CSS.supports('-webkit-backdrop-filter', 'blur(4px)'))
        : true;
      if (!supportsBackdrop) reasons.push('no-backdrop-filter');

      const supportsMaskComposite = hasCssSupports
        ? (CSS.supports('mask-composite', 'exclude') || CSS.supports('-webkit-mask-composite', 'xor'))
        : true;
      if (!supportsMaskComposite) reasons.push('no-mask-composite');

      const supportsContainment = hasCssSupports ? CSS.supports('contain', 'layout style paint') : true;

      const override = this._readOverride();
      let isLowPower = isTv || weakCpu || weakRam || saveData || slowNet || reducedMotion || !supportsBackdrop;
      if (override === 'low') {
        isLowPower = true;
        reasons.push('forced-low');
      } else if (override === 'high') {
        isLowPower = false;
      }

      return {
        mode: isLowPower ? 'low' : 'high',
        override,
        isLowPower,
        isTv,
        reasons,
        capabilities: {
          cores: Number.isFinite(cores) ? cores : null,
          memoryGb: Number.isFinite(mem) ? mem : null,
          saveData,
          reducedMotion,
          supportsBackdrop,
          supportsMaskComposite,
          supportsContainment
        }
      };
    }

    apply(nextState) {
      const prevLowPower = this.state.isLowPower;
      this.state = nextState;
      const root = document?.documentElement;
      if (root?.classList) {
        root.classList.toggle('fz-low-power', nextState.isLowPower);
        root.classList.toggle('fz-tv', nextState.isTv);
        root.setAttribute?.('data-perf-mode', nextState.mode);
      }
      window.__farzinLowPower = nextState.isLowPower;
      window.__farzinIsTv = nextState.isTv;

      if (prevLowPower !== nextState.isLowPower && typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
        try {
          window.dispatchEvent(new window.CustomEvent('farzin:perfmodechange', { detail: this.getStatus() }));
        } catch {}
      }
      return this.state;
    }

    refresh() {
      return this.apply(this.detect());
    }

    setOverride(override) {
      const next = override === 'low' || override === 'high' ? override : 'auto';
      try {
        if (next === 'auto') window.localStorage?.removeItem(this.storageKey);
        else window.localStorage?.setItem(this.storageKey, next);
      } catch {}
      return this.refresh();
    }

    toggle() {
      return this.setOverride(this.state.isLowPower ? 'high' : 'low');
    }

    isLowPower() {
      return Boolean(this.state.isLowPower);
    }

    getStatus() {
      return {
        ...this.state,
        reasons: this.state.reasons.slice(),
        capabilities: { ...this.state.capabilities }
      };
    }

    startFpsWatchdog() {
      if (this._fpsStarted || this.state.override !== 'auto' || this.state.isLowPower) return;
      if (typeof window.requestAnimationFrame !== 'function' || document?.hidden) return;
      this._fpsStarted = true;

      let sampleCount = 0;
      let startTs = 0;
      let lastTs = 0;
      let slowFrames = 0;
      const maxSamples = 40;

      const step = ts => {
        if (document?.hidden || this.state.isLowPower || this.state.override !== 'auto') {
          this._rafId = 0;
          return;
        }
        if (!startTs) {
          startTs = ts;
          lastTs = ts;
        } else {
          const dt = ts - lastTs;
          lastTs = ts;
          if (dt > 0 && dt < 250) {
            sampleCount += 1;
            if (dt > 28) slowFrames += 1;
          }
        }

        if (sampleCount >= maxSamples) {
          this._rafId = 0;
          const totalMs = lastTs - startTs;
          const avgFps = totalMs > 0 ? (sampleCount * 1000) / totalMs : 60;
          if (avgFps < this.autoDowngradeFpsThreshold && slowFrames >= 12) {
            const degraded = {
              ...this.state,
              mode: 'low',
              isLowPower: true,
              reasons: [...this.state.reasons, `fps-watchdog:${avgFps.toFixed(1)}fps`]
            };
            this.apply(degraded);
          }
          return;
        }
        this._rafId = window.requestAnimationFrame(step);
      };

      this._rafId = window.requestAnimationFrame(step);
    }

    init() {
      this.refresh();
      if (typeof window.matchMedia === 'function' && !this._mediaQuery) {
        try {
          this._mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
          if (typeof this._mediaQuery.addEventListener === 'function') {
            this._mediaQuery.addEventListener('change', this._onMotionChange);
          } else if (typeof this._mediaQuery.addListener === 'function') {
            this._mediaQuery.addListener(this._onMotionChange);
          }
        } catch {}
      }
      if (document?.readyState === 'complete') {
        this.startFpsWatchdog();
      } else {
        window.addEventListener?.('load', () => setTimeout(() => this.startFpsWatchdog(), 600), { once: true });
      }
      return this;
    }
  }

  class SpatialNavigationController {
    constructor(options = {}) {
      this.selector = options.selector || DEFAULT_FOCUS_SELECTOR;
      this.onRevealControls = typeof options.onRevealControls === 'function' ? options.onRevealControls : null;
      this.onHideControls = typeof options.onHideControls === 'function' ? options.onHideControls : null;
      this.activeClass = 'fz-spatial-focused';
      this.modeClass = 'fz-spatial-nav';
      this._currentEl = null;
      this._observer = null;
      this._syncScheduled = false;
      this._boundKeyDown = e => this.handleKeyDown(e);
      this._boundPointer = () => this._disableSpatialRing();
      this._boundFocusIn = e => this._syncFocusedClass(e.target);
    }

    _enableSpatialRing() {
      document?.documentElement?.classList?.add(this.modeClass);
    }

    _disableSpatialRing() {
      document?.documentElement?.classList?.remove(this.modeClass);
    }

    _syncFocusedClass(target) {
      if (this._currentEl && this._currentEl !== target) {
        this._currentEl.classList?.remove(this.activeClass);
      }
      if (target && target !== document.body && target !== document.documentElement) {
        this._currentEl = target;
        if (document?.documentElement?.classList?.contains(this.modeClass)) {
          target.classList?.add(this.activeClass);
        }
      } else {
        this._currentEl = null;
      }
    }

    _isVisibleElement(el) {
      if (!el || !el.getBoundingClientRect) return false;
      if (el.hidden || el.disabled) return false;
      if (el.closest?.('[hidden], [aria-hidden="true"]')) return false;
      if (el.closest?.('.board-controls.hidden')) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width <= 1 || rect.height <= 1) return false;
      if (typeof window.getComputedStyle === 'function') {
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.pointerEvents === 'none') return false;
      }
      return true;
    }

    _activeScopeRoot() {
      const openModal = document.querySelector?.('.fz-modal-backdrop.is-open');
      if (openModal) return openModal;
      const openDrawer = document.querySelector?.('.fz-mobile-drawer.is-open');
      if (openDrawer && document.activeElement && openDrawer.contains(document.activeElement)) return openDrawer;
      return document.body || document.documentElement;
    }

    refreshFocusables() {
      if (typeof document.querySelectorAll !== 'function') return;
      const cards = document.querySelectorAll('.rate-card, .side-card');
      for (const card of cards) {
        if (card.closest?.('[aria-hidden="true"], [data-loop-clone="true"]')) {
          if (card.hasAttribute('tabindex')) card.removeAttribute('tabindex');
          continue;
        }
        if (!card.hasAttribute('tabindex')) card.setAttribute('tabindex', '0');
      }
    }

    _scheduleRefreshFocusables() {
      if (this._syncScheduled) return;
      this._syncScheduled = true;
      const run = () => {
        this._syncScheduled = false;
        this.refreshFocusables();
      };
      if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(run);
      else setTimeout(run, 32);
    }

    getFocusables() {
      this.refreshFocusables();
      const root = this._activeScopeRoot();
      if (!root || typeof root.querySelectorAll !== 'function') return [];
      const candidates = root.querySelectorAll(this.selector);
      const visible = [];
      for (const el of candidates) {
        if (el.closest?.('[data-loop-clone="true"]')) continue;
        if (this._isVisibleElement(el)) visible.push(el);
      }
      return visible;
    }

    _directionFromEvent(event) {
      const key = event?.key || '';
      const code = Number(event?.keyCode || event?.which) || 0;
      if (key === 'ArrowUp' || key === 'Up' || code === 38) return 'up';
      if (key === 'ArrowDown' || key === 'Down' || code === 40) return 'down';
      if (key === 'ArrowLeft' || key === 'Left' || code === 37) return 'left';
      if (key === 'ArrowRight' || key === 'Right' || code === 39) return 'right';
      return '';
    }

    _actionFromEvent(event) {
      const key = event?.key || '';
      const code = Number(event?.keyCode || event?.which) || 0;
      if (key === 'Enter' || key === 'Select' || code === 13 || code === 23) return 'enter';
      if (key === 'Escape' || key === 'Esc' || key === 'XF86Back' || key === 'BrowserBack' || key === 'GoBack' || code === 27 || code === 461 || code === 10009) {
        return 'back';
      }
      return '';
    }

    _shouldIgnoreArrowForTarget(target, dir) {
      if (!target || !target.tagName) return false;
      const tag = target.tagName.toUpperCase();
      if (tag === 'TEXTAREA') return true;
      if (tag === 'SELECT') return dir === 'up' || dir === 'down';
      if (tag === 'INPUT') {
        const type = String(target.type || 'text').toLowerCase();
        if (type === 'range') return dir === 'left' || dir === 'right';
        if (['text', 'search', 'url', 'email', 'password', 'tel', 'number'].includes(type)) {
          return dir === 'left' || dir === 'right';
        }
      }
      return false;
    }

    _findBestCandidate(current, candidates, dir) {
      if (!candidates.length) return null;
      if (!current || current === document.body || current === document.documentElement || !this._isVisibleElement(current)) {
        // Default initial focus: first main rate card, tab, or primary button
        return candidates.find(el => el.classList?.contains('rate-card')) || candidates[0];
      }

      const cr = current.getBoundingClientRect();
      const cx = cr.left + cr.width / 2;
      const cy = cr.top + cr.height / 2;

      let best = null;
      let bestScore = Infinity;

      for (const el of candidates) {
        if (el === current) continue;
        const r = el.getBoundingClientRect();
        const ex = r.left + r.width / 2;
        const ey = r.top + r.height / 2;

        let primary = 0;
        let cross = 0;
        let inDir = false;

        if (dir === 'right') {
          inDir = ex > cx + 4 && r.right > cr.left + 4;
          primary = Math.max(0, r.left - cr.right);
          if (primary === 0) primary = Math.max(1, ex - cx);
          cross = Math.abs(ey - cy);
        } else if (dir === 'left') {
          inDir = ex < cx - 4 && r.left < cr.right - 4;
          primary = Math.max(0, cr.left - r.right);
          if (primary === 0) primary = Math.max(1, cx - ex);
          cross = Math.abs(ey - cy);
        } else if (dir === 'down') {
          inDir = ey > cy + 4 && r.bottom > cr.top + 4;
          primary = Math.max(0, r.top - cr.bottom);
          if (primary === 0) primary = Math.max(1, ey - cy);
          cross = Math.abs(ex - cx);
        } else if (dir === 'up') {
          inDir = ey < cy - 4 && r.top < cr.bottom - 4;
          primary = Math.max(0, cr.top - r.bottom);
          if (primary === 0) primary = Math.max(1, cy - ey);
          cross = Math.abs(ex - cx);
        }

        if (!inDir) continue;
        // Strongly reward candidates aligned along the movement corridor
        const overlapCross = (dir === 'left' || dir === 'right')
          ? Math.max(0, Math.min(cr.bottom, r.bottom) - Math.max(cr.top, r.top))
          : Math.max(0, Math.min(cr.right, r.right) - Math.max(cr.left, r.left));
        const alignPenalty = overlapCross > 0 ? cross * 0.45 : cross * 2.8 + 180;
        const score = primary + alignPenalty;

        if (score < bestScore) {
          bestScore = score;
          best = el;
        }
      }
      return best;
    }

    focusElement(el) {
      if (!el || typeof el.focus !== 'function') return false;
      this._enableSpatialRing();
      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }
      this._syncFocusedClass(el);
      if (typeof el.scrollIntoView === 'function') {
        try {
          el.scrollIntoView({
            block: 'nearest',
            inline: 'nearest',
            behavior: window.__farzinLowPower ? 'auto' : 'smooth'
          });
        } catch {
          el.scrollIntoView(false);
        }
      }
      return true;
    }

    move(dir) {
      const active = document.activeElement;
      let candidates = this.getFocusables();
      let next = this._findBestCandidate(active, candidates, dir);

      // On the live board, pressing Up from the top row reveals the hidden controls dock and focuses into it
      if (!next && dir === 'up') {
        const controls = document.getElementById('boardControls');
        if (controls && controls.classList?.contains('hidden')) {
          if (this.onRevealControls) this.onRevealControls();
          else controls.classList.remove('hidden');
          candidates = this.getFocusables();
          const dockItems = candidates.filter(el => controls.contains(el));
          if (dockItems.length) next = dockItems[0];
        }
      }

      if (next) {
        const controls = document.getElementById('boardControls');
        if (controls && controls.contains(next)) {
          if (this.onRevealControls) this.onRevealControls();
        }
        return this.focusElement(next);
      }
      return false;
    }

    handleKeyDown(event) {
      if (!event || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const dir = this._directionFromEvent(event);
      const action = this._actionFromEvent(event);
      if (!dir && !action) return;

      const active = document.activeElement;
      if (dir) {
        if (this._shouldIgnoreArrowForTarget(active, dir)) return;
        this._enableSpatialRing();
        if (this.onRevealControls && document.getElementById('boardControls')?.contains(active)) {
          this.onRevealControls();
        }
        const moved = this.move(dir);
        if (moved || (active && (active.classList?.contains('rate-card') || active.classList?.contains('side-card')))) {
          event.preventDefault();
        }
        return;
      }

      if (action === 'enter') {
        this._enableSpatialRing();
        if (!active || active === document.body || active === document.documentElement) {
          const first = this.getFocusables()[0];
          if (first) {
            this.focusElement(first);
            event.preventDefault();
          }
          return;
        }
        const tag = active.tagName?.toUpperCase() || '';
        if (active.classList?.contains('rate-card') || active.classList?.contains('side-card')) {
          if (this.onRevealControls) this.onRevealControls();
          const refreshBtn = document.getElementById('refreshBtn');
          if (refreshBtn) this.focusElement(refreshBtn);
          event.preventDefault();
          return;
        }
        if (!['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY'].includes(tag)) {
          active.click?.();
          event.preventDefault();
        }
        return;
      }

      if (action === 'back') {
        const controls = document.getElementById('boardControls');
        if (controls && !controls.classList?.contains('hidden')) {
          if (this.onHideControls) this.onHideControls();
          else controls.classList.add('hidden');
          if (controls.contains(active)) active?.blur?.();
          event.preventDefault();
          return;
        }
        if (active && active !== document.body && active !== document.documentElement) {
          active.blur?.();
          this._syncFocusedClass(null);
        }
      }
    }

    init() {
      this.refreshFocusables();
      document.addEventListener('keydown', this._boundKeyDown);
      document.addEventListener('pointerdown', this._boundPointer, { passive: true });
      document.addEventListener('focusin', this._boundFocusIn);

      if (typeof window.MutationObserver === 'function' && document.body) {
        this._observer = new window.MutationObserver(() => this._scheduleRefreshFocusables());
        this._observer.observe(document.body, { childList: true, subtree: true });
      }
      return this;
    }

    destroy() {
      document.removeEventListener('keydown', this._boundKeyDown);
      document.removeEventListener('pointerdown', this._boundPointer);
      document.removeEventListener('focusin', this._boundFocusIn);
      this._observer?.disconnect?.();
      this._observer = null;
    }
  }

  const perfManager = new PerformanceModeManager().init();
  const spatialNav = new SpatialNavigationController();

  const bootNav = () => spatialNav.init();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootNav, { once: true });
  } else {
    bootNav();
  }

  window.PerformanceModeManager = PerformanceModeManager;
  window.SpatialNavigationController = SpatialNavigationController;
  window.FarzinPerformanceManager = perfManager;
  window.FarzinSpatialNav = spatialNav;
})();
