import { sb } from './app.js';

export function initAuth() {
  // Tab switching
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Enter key on inputs
  document.getElementById('login-pass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('signup-pass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleSignup();
  });

  document.getElementById('btn-login')?.addEventListener('click', handleLogin);
  document.getElementById('btn-signup')?.addEventListener('click', handleSignup);
}

export function switchTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === tab)
  );
  document.getElementById('login-form')?.classList.toggle('hidden', tab !== 'login');
  document.getElementById('signup-form')?.classList.toggle('hidden', tab !== 'signup');
  setAuthErr('');
}

export async function handleLogin() {
  const email = document.getElementById('login-email')?.value.trim();
  const pass  = document.getElementById('login-pass')?.value;
  if (!email || !pass) return setAuthErr('Please fill in all fields.');

  const btn = document.getElementById('btn-login');
  setLoading(btn, 'Entering...', true);

  const { error } = await sb.auth.signInWithPassword({ email, password: pass });

  setLoading(btn, 'Enter the Wisdom', false);
  if (error) setAuthErr(error.message);
}

export async function handleSignup() {
  const name  = document.getElementById('signup-name')?.value.trim();
  const email = document.getElementById('signup-email')?.value.trim();
  const pass  = document.getElementById('signup-pass')?.value;

  if (!name || !email || !pass) return setAuthErr('Please fill in all fields.');
  if (pass.length < 6) return setAuthErr('Password must be at least 6 characters.');

  const btn = document.getElementById('btn-signup');
  setLoading(btn, 'Creating...', true);

  const { error } = await sb.auth.signUp({
    email, password: pass,
    options: { data: { full_name: name } }
  });

  setLoading(btn, 'Begin the Journey', false);
  if (error) setAuthErr(error.message);
  else setAuthErr('Check your email to confirm your account.');
}

export async function handleSignout() {
  await sb.auth.signOut();
  window.location.href = 'index.html';
}

function setAuthErr(msg) {
  const el = document.getElementById('auth-err');
  if (el) el.textContent = msg;
}

function setLoading(btn, text, disabled) {
  if (!btn) return;
  btn.textContent = text;
  btn.disabled = disabled;
}
