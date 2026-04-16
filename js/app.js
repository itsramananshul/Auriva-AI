import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { initAuth, handleSignout } from './auth.js';
import { initChat, appendMsg, loadRecents } from './chat.js';
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
let _appReady = false;
let _dailyVerse = null;
export const getProfile = () => _profile;
export const getDailyVerse = () => _dailyVerse;
export const setDailyVerse = (v) => { _dailyVerse = v; };

// ─── Boot ───
async function boot() {
  if (!sb) return;

  // Check session once on page load
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    await handleSession(session.user);
  } else if (window.location.pathname.includes('app.html')) {
    window.location.href = 'index.html';
  }

  // Then listen only for live login / logout events
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

async function initApp(user, profile) {
  if (_appReady) return;
  _appReady = true;
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
  await initChat();
  loadDailyVerseCard();

  // Signout
  document.getElementById('btn-signout')?.addEventListener('click', handleSignout);

  // Profile edit
  initProfileEdit(user);

  // Mobile drawer
  const sidebar  = document.querySelector('.sidebar');
  const overlay  = document.getElementById('mob-overlay');
  const openDrawer  = () => { sidebar.classList.add('open');    overlay.classList.add('visible'); };
  const closeDrawer = () => { sidebar.classList.remove('open'); overlay.classList.remove('visible'); };
  document.getElementById('mob-menu-btn')?.addEventListener('click', openDrawer);
  overlay?.addEventListener('click', closeDrawer);
  // Close drawer when a nav item or recent chat is tapped
  document.querySelectorAll('.nav-item, .new-chat-btn').forEach(el =>
    el.addEventListener('click', closeDrawer)
  );
  document.getElementById('recents-list')?.addEventListener('click', closeDrawer);

  // Default page
  showPage('seek');
}

// ─── Onboarding (onboard.html only) ───
export function initOnboarding() {
  let selectedDeity = null;

  // Deity selection — works immediately, no auth needed
  document.querySelectorAll('.deity-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.deity-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      selectedDeity = { name: opt.dataset.deity, source: opt.dataset.source };
    });
  });

  // Save — auth check happens here
  document.getElementById('btn-onboard')?.addEventListener('click', async () => {
    if (!selectedDeity) {
      document.getElementById('onboard-err').textContent = 'Please select a deity.';
      return;
    }
    const lang = document.getElementById('pref-lang')?.value || 'English';
    const btn  = document.getElementById('btn-onboard');
    btn.disabled = true; btn.textContent = 'Saving...';

    try {
      if (!sb) throw new Error('Not connected — check environment variables in Vercel.');
      const { data: { session } } = await sb.auth.getSession();
      if (!session?.user) throw new Error('Not logged in.');

      const { error } = await sb.from('profiles').upsert({
        id: session.user.id,
        full_name: session.user.user_metadata?.full_name || '',
        deity: selectedDeity.name,
        source: selectedDeity.source,
        language: lang,
        onboarded: true
      }, { onConflict: 'id' });

      console.log('upsert error:', error);
      if (error) throw new Error(error.message);
      window.location.href = 'app.html';
    } catch (err) {
      document.getElementById('onboard-err').textContent = err.message;
    } finally {
      btn.disabled = false; btn.textContent = 'Enter Auriva AI';
    }
  });
}

// ─── Profile Edit Modal ───
function initProfileEdit(user) {
  const overlay   = document.getElementById('modal-overlay');
  const editBtn   = document.getElementById('btn-edit-profile');
  const cancelBtn = document.getElementById('btn-modal-cancel');
  const saveBtn   = document.getElementById('btn-modal-save');
  const nameInput = document.getElementById('edit-name');
  const deitySelect = document.getElementById('edit-deity');
  const langSelect  = document.getElementById('edit-lang');
  const errEl     = document.getElementById('modal-err');

  const openModal = () => {
    // Pre-fill with current profile values
    nameInput.value = _profile?.full_name || '';
    const currentVal = `${_profile?.deity}|${_profile?.source}`;
    const opt = deitySelect.querySelector(`option[value="${currentVal}"]`);
    if (opt) deitySelect.value = currentVal;
    langSelect.value = _profile?.language || 'English';
    errEl.textContent = '';
    overlay.classList.add('open');
  };

  editBtn?.addEventListener('click', openModal);
  cancelBtn?.addEventListener('click', () => overlay.classList.remove('open'));
  overlay?.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });

  saveBtn?.addEventListener('click', async () => {
    if (!sb) return;
    const [deity, source] = (deitySelect.value || '').split('|');
    const name = nameInput.value.trim();
    const lang = langSelect.value;

    if (!name) { errEl.textContent = 'Please enter your name.'; return; }
    if (!deity || !source) { errEl.textContent = 'Please select a path.'; return; }

    saveBtn.disabled = true; saveBtn.textContent = 'Saving...';
    errEl.textContent = '';

    try {
      const { error } = await sb.from('profiles').update({
        full_name: name, deity, source, language: lang
      }).eq('id', user.id);

      if (error) throw new Error(error.message);

      // Update local profile state
      _profile = { ..._profile, full_name: name, deity, source, language: lang };

      // Update sidebar display
      setEl('sidebar-name', name);
      setEl('sidebar-avatar', name[0]?.toUpperCase() || 'S');
      setEl('sidebar-deity', deity);
      setEl('sidebar-source', `${source} · ${lang}`);

      overlay.classList.remove('open');
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      saveBtn.disabled = false; saveBtn.textContent = 'Save Changes';
    }
  });
}

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ─── Run ───
boot();
