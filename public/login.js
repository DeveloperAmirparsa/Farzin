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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: form.username.value, password: password.value })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'ورود انجام نشد.');
    const destination = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
    location.assign(destination);
  } catch (reason) {
    error.textContent = reason.message || 'ارتباط با سرور برقرار نشد.';
    submit.disabled = false;
    submit.querySelector('span').textContent = 'ورود امن';
  }
});
