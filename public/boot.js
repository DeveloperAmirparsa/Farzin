'use strict';
(() => {
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
