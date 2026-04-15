import { fetchRandomVerse } from './api.js';
import { CHAPTER_NAMES, VERSE_COUNTS } from './config.js';

let dailyVerse = null;
let _verseLoading = false;

// ─── Load verse (called on app init) ───
export async function loadDailyVerseCard() {
  _verseLoading = true;
  try {
    dailyVerse = await fetchRandomVerse();
  } finally {
    _verseLoading = false;
  }

  // Mini card on seek page
  const ref   = document.getElementById('mini-ref');
  const tag   = document.getElementById('mini-tag');
  const sans  = document.getElementById('mini-sanskrit');
  const trans = document.getElementById('mini-trans');
  if (ref)  ref.textContent  = `Bhagavad Gita · Ch. ${dailyVerse.chapter} · V. ${dailyVerse.verse}`;
  if (tag)  tag.textContent  = "Today's Verse";
  if (sans) sans.textContent = dailyVerse.sanskrit;
  if (trans) trans.textContent = dailyVerse.translation;

  // If user is already on daily page, render it now
  renderDailyPage();
}

export function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mob-nav-item').forEach(n => n.classList.remove('active'));

  const page    = document.getElementById(`page-${name}`);
  const nav     = document.querySelector(`.nav-item[data-page="${name}"]`);
  const mobNav  = document.querySelector(`.mob-nav-item[data-page="${name}"]`);
  if (page)   page.classList.add('active');
  if (nav)    nav.classList.add('active');
  if (mobNav) mobNav.classList.add('active');

  const titles = {
    seek:        'Seek <span>Wisdom</span>',
    daily:       'Daily <span>Verse</span>',
    scriptures:  'The <span>Scriptures</span>',
    saved:       'Saved <span>Verses</span>'
  };
  const ttl = document.getElementById('page-title');
  if (ttl) ttl.innerHTML = titles[name] || name;

  if (name === 'daily') {
    if (dailyVerse) {
      renderDailyPage();
    } else if (!_verseLoading) {
      // Verse never loaded — trigger a fresh fetch
      refreshDailyVerse();
    }
    // If _verseLoading is true, loadDailyVerseCard() will call renderDailyPage() when done
  }
  if (name === 'scriptures') renderScriptures();
}

function renderDailyPage() {
  const v = dailyVerse;
  if (!v) return;
  const ref   = document.getElementById('dv-ref');
  const sans  = document.getElementById('dv-sanskrit');
  const trans = document.getElementById('dv-trans');
  if (ref)   ref.textContent  = `Bhagavad Gita · Chapter ${v.chapter} · Verse ${v.verse}`;
  if (sans)  sans.textContent = v.sanskrit;
  if (trans) trans.textContent = v.translation;
}

export async function refreshDailyVerse() {
  const btn = document.getElementById('btn-new-verse');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }

  try {
    dailyVerse = await fetchRandomVerse();
    renderDailyPage();
    // Also refresh mini card
    const ref   = document.getElementById('mini-ref');
    const sans  = document.getElementById('mini-sanskrit');
    const trans = document.getElementById('mini-trans');
    if (ref)   ref.textContent  = `Bhagavad Gita · Ch. ${dailyVerse.chapter} · V. ${dailyVerse.verse}`;
    if (sans)  sans.textContent = dailyVerse.sanskrit;
    if (trans) trans.textContent = dailyVerse.translation;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Show another verse'; }
  }
}

function renderScriptures() {
  const grid = document.getElementById('sc-grid');
  if (!grid || grid.children.length > 0) return;
  grid.innerHTML = CHAPTER_NAMES.map((name, i) => `
    <div class="sc-card" data-chapter="${i+1}">
      <div class="sc-num">${String(i+1).padStart(2,'0')}</div>
      <div class="sc-ch">Chapter ${i+1}</div>
      <div class="sc-title">${name}</div>
      <div class="sc-count">${VERSE_COUNTS[i]} verses</div>
    </div>`).join('');

  grid.querySelectorAll('.sc-card').forEach(card => {
    card.addEventListener('click', () => {
      const ch = card.dataset.chapter;
      showPage('seek');
      const input = document.getElementById('user-input');
      if (input) {
        input.value = `Tell me about Chapter ${ch}: ${CHAPTER_NAMES[ch-1]}`;
        document.getElementById('send-btn')?.click();
      }
    });
  });
}

export function initNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => showPage(item.dataset.page));
  });

  document.querySelectorAll('.mob-nav-item').forEach(item => {
    item.addEventListener('click', () => showPage(item.dataset.page));
  });

  document.getElementById('btn-new-verse')?.addEventListener('click', refreshDailyVerse);
}
