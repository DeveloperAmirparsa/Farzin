'use strict';
(() => {
  const detectDisplayAndPower = () => {
    try {
      const ua = String(navigator?.userAgent || '');
      const uaIsTv = /Tizen|Web0S|webOS|SMART-TV|SmartTV|NetCast|Maple|HbbTV|BRAVIA|AFT|Android TV|GoogleTV|CrKey|Hisense|TCL|Roku|Viera|PhilipsTV|AQUOS|PHILIPS|SAMSUNG.*Browser|LG Browser|MiBox|Mi Box|SHIELD|TVBOX|Leanback/i.test(ua);
      const search = String(location?.search || '');
      const displayMatch = /[?&]display=(auto|tv|monitor)\b/i.exec(search);
      let displayMode = displayMatch ? displayMatch[1].toLowerCase() : '';
      if (!displayMode && /[?&]tv=1\b/i.test(search)) displayMode = 'tv';
      if (!displayMode) {
        const storedMode = window.localStorage?.getItem('farzin_display_mode');
        displayMode = (storedMode === 'tv' || storedMode === 'monitor' || storedMode === 'auto') ? storedMode : 'auto';
      }

      const w = Math.max(0, Number(window.innerWidth) || 0);
      const h = Math.max(0, Number(window.innerHeight) || 0);
      const portrait = h > w;
      const isAndroidWv = /Android/i.test(ua) && (/;\s*wv\)|Android.*Version\/[\d.]+.*Chrome\//i.test(ua)) && !Number(navigator?.maxTouchPoints);
      const isTv = displayMode === 'tv' || (displayMode === 'auto' && (uaIsTv || isAndroidWv));

      let lowPower;
      if (/[?&](?:lite=0|perf=high)\b/i.test(search)) lowPower = false;
      else if (/[?&](?:lite=1|tv=1|perf=low)\b/i.test(search)) lowPower = true;
      else {
        const storedPerf = window.localStorage?.getItem('farzin_perf_mode');
        if (storedPerf === 'high') lowPower = false;
        else if (storedPerf === 'low') lowPower = true;
        else {
          const cores = Number(navigator?.hardwareConcurrency);
          const mem = Number(navigator?.deviceMemory);
          const saveData = Boolean(navigator?.connection?.saveData);
          const reducedMotion = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
          const noBackdrop = typeof CSS !== 'undefined' && typeof CSS.supports === 'function'
            ? (!CSS.supports('backdrop-filter', 'blur(4px)') && !CSS.supports('-webkit-backdrop-filter', 'blur(4px)'))
            : false;
          const weakCpu = Number.isFinite(cores) && cores > 0 && cores <= 4;
          const weakRam = Number.isFinite(mem) && mem > 0 && mem <= 2;
          lowPower = isTv || weakCpu || weakRam || saveData || reducedMotion || noBackdrop;
        }
      }

      const mainMotionOff = window.localStorage?.getItem('farzin_main_motion') === 'off';
      const rotateOn = /[?&]rotate=1\b/i.test(search) || (!/[?&]rotate=0\b/i.test(search) && window.localStorage?.getItem('farzin_kiosk_rotate') === 'on');

      return {
        lowPower,
        isTv,
        displayMode,
        displayProfile: isTv ? 'tv' : 'monitor',
        mainMotionOff,
        rotateLandscape: portrait && rotateOn
      };
    } catch {
      return { lowPower: false, isTv: false, displayMode: 'auto', displayProfile: 'monitor', mainMotionOff: false, rotateLandscape: false };
    }
  };
  const hwProfile = detectDisplayAndPower();
  window.__farzinLowPower = hwProfile.lowPower;
  window.__farzinIsTv = hwProfile.isTv;
  window.__farzinDisplayMode = hwProfile.displayMode;
  window.__farzinDisplayProfile = hwProfile.displayProfile;
  window.__farzinMainMotion = hwProfile.mainMotionOff ? 'off' : 'on';
  if (document?.documentElement?.classList) {
    const rootCls = document.documentElement.classList;
    rootCls.toggle('fz-low-power', hwProfile.lowPower);
    rootCls.toggle('fz-tv', hwProfile.isTv);
    rootCls.toggle('fz-display-tv', hwProfile.displayProfile === 'tv');
    rootCls.toggle('fz-display-monitor', hwProfile.displayProfile === 'monitor');
    rootCls.toggle('fz-main-static', hwProfile.mainMotionOff);
    rootCls.toggle('fz-rotate-landscape', hwProfile.rotateLandscape);
    document.documentElement.setAttribute?.('data-perf-mode', hwProfile.lowPower ? 'low' : 'high');
    document.documentElement.setAttribute?.('data-display-mode', hwProfile.displayMode);
    document.documentElement.setAttribute?.('data-display-profile', hwProfile.displayProfile);
  }

  const TOKEN_KEY = 'farzin_token';
  const STATIC_EXT_RE = /\.(css|js|png|svg|ico|webmanifest|json)$/i;
  const getToken = () => {
    try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  };
  const clearToken = () => {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
  };

  if (location.search.includes('_auth=')) {
    try {
      const current = new URL(location.href);
      current.searchParams.delete('_auth');
      history.replaceState(null, '', current.pathname + current.search + current.hash);
    } catch {}
  }

  let cookieActive = null;
  const nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  if (nativeFetch) {
    if (location.pathname !== '/login' && location.pathname !== '/login/') {
      nativeFetch('/api/session', { cache: 'no-store', credentials: 'same-origin' })
        .then(r => r.json())
        .then(data => { cookieActive = Boolean(data && data.authenticated); })
        .catch(() => { cookieActive = false; });
    }

    window.fetch = (input, init = {}) => {
      const token = getToken();
      let urlStr = typeof input === 'string' ? input : (input && input.url) || '';
      let isApi = false;
      try {
        const resolved = new URL(urlStr, location.href);
        isApi = resolved.origin === location.origin && resolved.pathname.startsWith('/api/');
      } catch {}
      if (isApi && token) {
        const headers = new Headers(init.headers || (typeof input !== 'string' && input && input.headers) || undefined);
        const hadBearer = headers.has('Authorization');
        if (!hadBearer) headers.set('Authorization', `Bearer ${token}`);
        return nativeFetch(input, { ...init, headers, credentials: init.credentials || 'same-origin' })
          .then(res => {
            if (res.status === 401 && !hadBearer) clearToken();
            return res;
          });
      }
      return nativeFetch(input, init);
    };
  }

  document.addEventListener('click', event => {
    const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = link.getAttribute('href') || '';
    if (!href.startsWith('/') || href.startsWith('//') || href.startsWith('/api/') || href.startsWith('/#')) return;
    if (href === '/login' || href.startsWith('/login?') || href.startsWith('/login/')) return;
    let parsed;
    try { parsed = new URL(href, location.origin); } catch { return; }
    if (parsed.origin !== location.origin || STATIC_EXT_RE.test(parsed.pathname)) return;

    const token = getToken();
    if (!token || cookieActive === true) return;

    event.preventDefault();
    const isNewTab = link.target === '_blank';
    const win = isNewTab ? window.open('about:blank', '_blank', 'noopener,noreferrer') : null;
    fetch('/api/handoff', { method: 'POST' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && data.handoff) parsed.searchParams.set('_auth', data.handoff);
        const nextUrl = parsed.pathname + parsed.search + parsed.hash;
        if (win) win.location.replace(parsed.toString());
        else location.assign(nextUrl);
      })
      .catch(() => {
        if (win) win.location.replace(href);
        else location.assign(href);
      });
  });

  function initBootUi() {
    const overlay = document.getElementById('farzinBoot');
    const logout = document.getElementById('farzinLogout');
    if (logout) logout.addEventListener('click', async () => {
      logout.disabled = true;
      logout.textContent = 'در حال خروج…';
      try { await fetch('/api/logout', { method: 'POST' }); }
      finally {
        clearToken();
        location.assign('/login');
      }
    });
    if (!overlay) return;
    const dismiss = () => {
      overlay.classList.add('is-gone');
      setTimeout(() => overlay.remove(), 550);
    };
    if (document.readyState === 'complete') requestAnimationFrame(dismiss);
    else window.addEventListener('load', dismiss, { once: true });
    setTimeout(dismiss, 6000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBootUi, { once: true });
  } else {
    initBootUi();
  }
})();
