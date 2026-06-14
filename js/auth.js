import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ─── Standalone Supabase client for auth page ───
// Does NOT import app.js — avoids circular deps + top-level await on older Safari
let sb = null;

async function getSb() {
  if (sb) return sb;
  try {
    const cfg = await fetch('/api/app-config').then(r => r.json());
    if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
      sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    }
  } catch {
    // no-op — will show error to user on action
  }
  return sb;
}

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
  document.getElementById('btn-atlas')?.addEventListener('click', handleAtlasLogin);

  // Eagerly warm up the connection so first click is instant
  getSb();
  // If already signed in (or just back from an ATLAS/OAuth redirect), go to app.
  redirectIfAuthed();
}

// Owner sign-in via ATLAS (ARIA SSO) through Supabase Custom OIDC. Additive —
// email/password unchanged. max_age=10 forces a password prompt on every
// sign-in (per authentik authorize.py); prompt=login is best-effort.
export async function handleAtlasLogin() {
  setAuthErr('');
  const client = await getSb();
  if (!client) return setAuthErr('Not connected. Run via `vercel dev` locally.');
  const { error } = await client.auth.signInWithOAuth({
    provider: 'custom:atlas',
    options: {
      scopes: 'openid email profile',
      redirectTo: window.location.origin + '/index.html',
      queryParams: { prompt: 'login', max_age: '10' },
    },
  });
  if (error) setAuthErr(error.message);
}

// Send authenticated users (incl. those returning from the OAuth redirect, whose
// session can land a beat after load) straight to the app.
export async function redirectIfAuthed() {
  const client = await getSb();
  if (!client) return;
  let went = false;
  const go = () => { if (!went) { went = true; window.location.href = 'app.html'; } };
  client.auth.onAuthStateChange((_e, session) => { if (session?.user) go(); });
  const { data: { session } } = await client.auth.getSession();
  if (session?.user) go();
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

  try {
    const client = await getSb();
    if (!client) throw new Error('Not connected. Run via `vercel dev` locally.');
    const { error } = await client.auth.signInWithPassword({ email, password: pass });
    if (error) {
      setAuthErr(error.message);
    } else {
      window.location.href = 'app.html';
    }
  } catch (err) {
    setAuthErr(err.message);
  } finally {
    setLoading(btn, 'Enter the Wisdom', false);
  }
}

export async function handleSignup() {
  const name  = document.getElementById('signup-name')?.value.trim();
  const email = document.getElementById('signup-email')?.value.trim();
  const pass  = document.getElementById('signup-pass')?.value;

  if (!name || !email || !pass) return setAuthErr('Please fill in all fields.');
  if (pass.length < 6) return setAuthErr('Password must be at least 6 characters.');

  const btn = document.getElementById('btn-signup');
  setLoading(btn, 'Creating...', true);

  try {
    const client = await getSb();
    if (!client) throw new Error('Not connected. Run via `vercel dev` locally.');
    const { error } = await client.auth.signUp({
      email, password: pass,
      options: { data: { full_name: name } }
    });
    if (error) setAuthErr(error.message);
    else setAuthErr('Check your email to confirm your account.');
  } catch (err) {
    setAuthErr(err.message);
  } finally {
    setLoading(btn, 'Begin the Journey', false);
  }
}

export async function handleSignout() {
  const client = await getSb();
  let viaAtlas = false;
  if (client) {
    try {
      const { data: { session } } = await client.auth.getSession();
      const md = session?.user?.app_metadata || {};
      viaAtlas = [md.provider, ...(md.providers || [])].some((p) => String(p || '').includes('atlas'));
    } catch {}
    await client.auth.signOut();
  }
  // ATLAS owner sessions end the ATLAS SSO session (so next login needs the
  // password); regular users just return to the login page.
  if (viaAtlas) window.location.href = 'https://atlas.anshullabs.tech/application/o/auriva/end-session/';
  else window.location.href = 'index.html';
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
