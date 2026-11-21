'use strict';
const form = document.getElementById('loginForm');
const password = document.getElementById('password');
const error = document.getElementById('loginError');
const submit = document.getElementById('loginSubmit');
const next = new URLSearchParams(location.search).get('next');

document.getElementById('togglePassword').addEventListener('click', event => {
  const reveal = password.type === 'password';
  password.type = reveal ? 'text' : 'password';
  event.currentTarget.textContent = reveal ? 'پنهان' : 'نمایش';
  event.currentTarget.setAttribute('aria-label', reveal ? 'پنهان‌کردن گذرواژه' : 'نمایش گذرواژه');
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  error.textContent = '';
  submit.disabled = true;
  submit.querySelector('span').textContent = 'در حال بررسی…';
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username: form.username.value, password: password.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'ورود انجام نشد.');
    if (result.token) {
      try { sessionStorage.setItem('farzin_token', result.token); } catch {}
    }
    let destination = '/';
    if (next && next.startsWith('/') && !next.startsWith('//') && !next.includes('\\')) {
      try {
        const parsedNext = new URL(next, location.origin);
        parsedNext.searchParams.delete('_auth');
        if (parsedNext.pathname !== '/login' && parsedNext.pathname !== '/login/') {
          destination = parsedNext.pathname + parsedNext.search + parsedNext.hash;
        }
      } catch {}
    }
    let cookieActive = false;
    try {
      const check = await fetch('/api/session', { cache: 'no-store', credentials: 'same-origin' });
      const checkJson = await check.json();
      cookieActive = Boolean(checkJson && checkJson.authenticated);
    } catch {}
    if (!cookieActive && result.handoff) {
      const targetUrl = new URL(destination, location.origin);
      targetUrl.searchParams.set('_auth', result.handoff);
      destination = targetUrl.pathname + targetUrl.search + targetUrl.hash;
    }
    location.assign(destination);
  } catch (reason) {
    error.textContent = reason.message || 'ارتباط با سرور برقرار نشد.';
    submit.disabled = false;
    submit.querySelector('span').textContent = 'ورود امن';
  }
});

(() => {
  if (typeof window.matchMedia !== 'function') return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const shell = document.querySelector('.fz-login-shell');
  const showcase = document.querySelector('.fz-login-showcase');
  if (!shell || !showcase) return;
  let rafId = 0;
  let pt = null;
  showcase.addEventListener('pointermove', event => {
    pt = { x: event.clientX, y: event.clientY };
    if (rafId) return;
    rafId = window.requestAnimationFrame(() => {
      rafId = 0;
      if (!pt) return;
      const rect = showcase.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const px = Math.max(0, Math.min(1, (pt.x - rect.left) / rect.width));
      const py = Math.max(0, Math.min(1, (pt.y - rect.top) / rect.height));
      showcase.style.setProperty('--mx', `${(px * 100).toFixed(1)}%`);
      showcase.style.setProperty('--my', `${(py * 100).toFixed(1)}%`);
      shell.style.setProperty('--rx', `${((0.5 - py) * 2.4).toFixed(2)}deg`);
      shell.style.setProperty('--ry', `${((px - 0.5) * 2.4).toFixed(2)}deg`);
      shell.style.setProperty('--tz', '6px');
    });
  }, { passive: true });
  showcase.addEventListener('pointerleave', () => {
    pt = null;
    if (rafId) {
      window.cancelAnimationFrame(rafId);
      rafId = 0;
    }
    shell.style.setProperty('--rx', '0deg');
    shell.style.setProperty('--ry', '0deg');
    shell.style.setProperty('--tz', '0px');
  });
})();
