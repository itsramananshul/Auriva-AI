import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { initAuth, handleSignout } from './auth.js';
import { initChat, appendMsg } from './chat.js';
import { initNavigation, loadDailyVerseCard, showPage } from './pages.js';

// ─── Supabase client (shared) ───
// Keys are loaded from the server — run via `vercel dev` locally
let _sb = null;
try {
  const cfg = await fetch('/api/app-config').then(r => r.json());
  if (cfg.supabaseUrl && cfg.supabaseAnonKey) {
    _sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  }
} catch {
  console.error('[Auriva] Could not load config. Run the app via `vercel dev`.');
}
export const sb = _sb;

// ─── Profile state ───
let _profile = null;
export const getProfile = () => _profile;

// ─── Boot ───
async function boot() {
  const { data: { session } } = await sb.auth.getSession();

  if (session?.user) {
    await handleSession(session.user);
  } else {
    // Not logged in — show auth if on app page
    if (window.location.pathname.includes('app.html')) {
      window.location.href = 'index.html';
    }
  }

  // Listen for auth changes
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      await handleSession(session.user);
    }
    if (event === 'SIGNED_OUT') {
      window.location.href = 'index.html';
    }
  });
}

async function handleSession(user) {
  const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single();

  if (!profile?.onboarded) {
    // Redirect to onboarding
    if (!window.location.pathname.includes('onboard.html')) {
      window.location.href = 'onboard.html';
    }
    return;
  }

  _profile = profile;

  // If on auth page, redirect to app
  if (!window.location.pathname.includes('app.html')) {
    window.location.href = 'app.html';
    return;
  }

  // Initialize app
  initApp(user, profile);
}

function initApp(user, profile) {
  // Sidebar
  const name = profile.full_name || user.user_metadata?.full_name || 'Seeker';
  setEl('sidebar-name', name);
  setEl('sidebar-avatar', name[0]?.toUpperCase() || 'S');
  setEl('sidebar-religion', profile.deity || '—');
  setEl('sidebar-deity', profile.deity || '—');
  setEl('sidebar-source', `${profile.source || 'Bhagavad Gita'} · ${profile.language || 'English'}`);
  setEl('streak-txt', 'Day 1 streak');

  // Init modules
  initNavigation();
  initChat();
  loadDailyVerseCard();

  // Welcome message
  const firstName = name.split(' ')[0];
  const deity = profile.deity || 'Lord Krishna';
  const welcomes = [
    `Namaste, ${firstName}. ${deity} awaits your questions. What weighs on your heart today?`,
    `Welcome back, ${firstName}. The Gita holds answers for every struggle. What would you like to explore?`,
    `${firstName}, the wisdom of the ages is ready for you. Ask freely — no question is too small or too large.`
  ];
  setTimeout(() => {
    appendMsg('ai', welcomes[Math.floor(Math.random() * welcomes.length)]);
  }, 400);

  // Signout
  document.getElementById('btn-signout')?.addEventListener('click', handleSignout);

  // Default page
  showPage('seek');
}

// ─── Onboarding (onboard.html only) ───
export async function initOnboarding() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) { window.location.href = 'index.html'; return; }

  let selectedDeity = null;

  document.querySelectorAll('.deity-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.deity-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedDeity = { name: opt.dataset.deity, source: opt.dataset.source };
    });
  });

  document.getElementById('btn-onboard')?.addEventListener('click', async () => {
    if (!selectedDeity) {
      document.getElementById('onboard-err').textContent = 'Please select a deity.';
      return;
    }
    const lang = document.getElementById('pref-lang')?.value || 'English';
    const btn  = document.getElementById('btn-onboard');
    btn.disabled = true; btn.textContent = 'Saving...';

    const { error } = await sb.from('profiles').upsert({
      id: session.user.id,
      full_name: session.user.user_metadata?.full_name || '',
      deity: selectedDeity.name,
      source: selectedDeity.source,
      language: lang,
      onboarded: true
    });

    btn.disabled = false; btn.textContent = 'Enter Auriva AI';
    if (error) {
      document.getElementById('onboard-err').textContent = error.message;
    } else {
      window.location.href = 'app.html';
    }
  });
}

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ─── Run ───
boot();
