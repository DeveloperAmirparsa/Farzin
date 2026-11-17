'use strict';
(() => {
  const overlay = document.getElementById('farzinBoot');
  const logout = document.getElementById('farzinLogout');
  if (logout) logout.addEventListener('click', async () => {
    logout.disabled = true;
    logout.textContent = 'در حال خروج…';
    try { await fetch('/api/logout', { method: 'POST' }); }
    finally { location.assign('/login'); }
  });
  if (!overlay) return;
  const dismiss = () => {
    overlay.classList.add('is-gone');
    setTimeout(() => overlay.remove(), 550);
  };
  if (document.readyState === 'complete') requestAnimationFrame(dismiss);
  else window.addEventListener('load', dismiss, { once: true });
  setTimeout(dismiss, 6000);
})();
