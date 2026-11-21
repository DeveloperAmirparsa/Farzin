'use strict';
(() => {
  let installPrompt = null;
  const buttons = [...document.querySelectorAll('[data-pwa-install]')];
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const message = text => {
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = text;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3500);
    } else {
      const status = document.getElementById('boardStatus');
      if (status) status.textContent = text;
    }
  };

  buttons.forEach(button => { button.hidden = standalone; });
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    buttons.forEach(button => { button.hidden = false; });
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    buttons.forEach(button => { button.hidden = true; });
    message('وب‌اپ فرزین نصب شد.');
  });
  buttons.forEach(button => button.addEventListener('click', async () => {
    if (!installPrompt) {
      message('برای نصب، از منوی مرورگر گزینه Install app یا Add to Home Screen را انتخاب کنید.');
      return;
    }
    const prompt = installPrompt;
    installPrompt = null;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch (error) {
      console.warn('[Farzin install prompt]', error);
    }
  }));

})();
