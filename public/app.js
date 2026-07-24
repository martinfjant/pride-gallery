// Shared admin-page glue for the upload and manage pages.
//
// 1. Persists the upload password in localStorage and restores it on load.
// 2. Injects the password as a Bearer token on every htmx request, so htmx
//    forms/buttons authenticate without any per-request JavaScript.
// 3. Surfaces server errors, which htmx otherwise swallows for non-2xx
//    responses.

const passwordInput = document.querySelector('#settings [name="password"]');

if (passwordInput) {
  const saved = localStorage.getItem('upload:password');
  if (saved) passwordInput.value = saved;
  passwordInput.addEventListener('input', () => {
    localStorage.setItem('upload:password', passwordInput.value);
  });
}

function currentPassword() {
  return passwordInput?.value || localStorage.getItem('upload:password') || '';
}

document.body.addEventListener('htmx:configRequest', (e) => {
  const password = currentPassword();
  if (password) e.detail.headers['Authorization'] = `Bearer ${password}`;
});

document.body.addEventListener('htmx:responseError', (e) => {
  const { xhr } = e.detail;
  let message = `${xhr.status}: ${xhr.responseText.slice(0, 300)}`;
  try {
    const parsed = JSON.parse(xhr.responseText);
    if (parsed.error) message = `${xhr.status}: ${parsed.error}`;
  } catch { /* not JSON; use raw text */ }
  alert(message);
});
