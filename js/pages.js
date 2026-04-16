import { fetchRandomVerse } from './api.js';
import { CHAPTER_NAMES, VERSE_COUNTS, BIBLE_BOOKS } from './config.js';
import { getProfile } from './app.js';

let dailyVerse = null;
let _verseLoading = false;

export const getDailyVerse = () => dailyVerse;

function isBibleUser() {
  return getProfile()?.source === 'Bible';
}

function verseRef(v) {
  if (v.ref) return v.ref;
  return `Bhagavad Gita · Ch. ${v.chapter} · V. ${v.verse}`;
}

// ─── Load verse (called on app init) ───
export async function loadDailyVerseCard() {
  const source = getProfile()?.source || 'Bhagavad Gita';
  _verseLoading = true;
  try {
    dailyVerse = await fetchRandomVerse(source);
  } finally {
    _verseLoading = false;
  }

  // Mini card on seek page
  const ref   = document.getElementById('mini-ref');
  const tag   = document.getElementById('mini-tag');
  const sans  = document.getElementById('mini-sanskrit');
  const trans = document.getElementById('mini-trans');
  if (ref)  ref.textContent  = verseRef(dailyVerse);
  if (tag)  tag.textContent  = "Today's Verse";
  if (sans) { sans.textContent = dailyVerse.sanskrit || ''; sans.style.display = dailyVerse.sanskrit ? '' : 'none'; }
  if (trans) trans.textContent = dailyVerse.translation;

  renderDailyPage();
}

export function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.mob-nav-item').forEach(n => n.classList.remove('active'));

  const page   = document.getElementById(`page-${name}`);
  const nav    = document.querySelector(`.nav-item[data-page="${name}"]`);
  const mobNav = document.querySelector(`.mob-nav-item[data-page="${name}"]`);
  if (page)   page.classList.add('active');
  if (nav)    nav.classList.add('active');
  if (mobNav) mobNav.classList.add('active');

  // Update page title based on scripture
  const bible = isBibleUser();
  const titles = {
    seek:        `Seek <span>Wisdom</span>`,
    daily:       `Daily <span>${bible ? 'Verse' : 'Verse'}</span>`,
    scriptures:  `The <span>${bible ? 'Bible' : 'Scriptures'}</span>`,
    saved:       `Saved <span>Verses</span>`
  };
  const ttl = document.getElementById('page-title');
  if (ttl) ttl.innerHTML = titles[name] || name;

  if (name === 'daily') {
    if (dailyVerse) {
      renderDailyPage();
    } else if (!_verseLoading) {
      refreshDailyVerse();
    }
  }
  if (name === 'scriptures') renderScriptures();
}

function renderDailyPage() {
  const v = dailyVerse;
  if (!v) return;
  const ref   = document.getElementById('dv-ref');
  const sans  = document.getElementById('dv-sanskrit');
  const trans = document.getElementById('dv-trans');
  if (ref)   ref.textContent  = v.ref || `Bhagavad Gita · Chapter ${v.chapter} · Verse ${v.verse}`;
  if (sans)  { sans.textContent = v.sanskrit || ''; sans.style.display = v.sanskrit ? '' : 'none'; }
  if (trans) trans.textContent = v.translation;
}

export async function refreshDailyVerse() {
  const btn = document.getElementById('btn-new-verse');
  if (btn) { btn.disabled = true; btn.textContent = 'Loading...'; }

  const source = getProfile()?.source || 'Bhagavad Gita';
  try {
    dailyVerse = await fetchRandomVerse(source);
    renderDailyPage();
    const ref   = document.getElementById('mini-ref');
    const sans  = document.getElementById('mini-sanskrit');
    const trans = document.getElementById('mini-trans');
    if (ref)   ref.textContent  = verseRef(dailyVerse);
    if (sans)  { sans.textContent = dailyVerse.sanskrit || ''; sans.style.display = dailyVerse.sanskrit ? '' : 'none'; }
    if (trans) trans.textContent = dailyVerse.translation;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Show another verse'; }
  }
}

// ─── Scriptures page — Gita chapters or Bible books ───
function renderScriptures() {
  const grid = document.getElementById('sc-grid');
  if (!grid) return;

  // Re-render every time so switching profile works
  grid.innerHTML = '';

  if (isBibleUser()) {
    // Group by testament
    const oldBooks = BIBLE_BOOKS.filter(b => b.testament === 'Old');
    const newBooks = BIBLE_BOOKS.filter(b => b.testament === 'New');

    const makeSection = (label, books) => `
      <div class="sc-testament-label">${label} Testament</div>
      ${books.map(b => `
        <div class="sc-card" data-book="${b.name}">
          <div class="sc-ch">Book</div>
          <div class="sc-title">${b.name}</div>
          <div class="sc-count">${b.testament} Testament</div>
        </div>`).join('')}`;

    grid.innerHTML = makeSection('Old', oldBooks) + makeSection('New', newBooks);
  } else {
    grid.innerHTML = CHAPTER_NAMES.map((name, i) => `
      <div class="sc-card" data-chapter="${i+1}">
        <div class="sc-num">${String(i+1).padStart(2,'0')}</div>
        <div class="sc-ch">Chapter ${i+1}</div>
        <div class="sc-title">${name}</div>
        <div class="sc-count">${VERSE_COUNTS[i]} verses</div>
      </div>`).join('');
  }

  grid.querySelectorAll('.sc-card').forEach(card => {
    card.addEventListener('click', () => {
      showPage('seek');
      const input = document.getElementById('user-input');
      if (!input) return;
      if (card.dataset.book) {
        input.value = `Tell me about the Book of ${card.dataset.book} and its key teachings`;
      } else {
        const ch = card.dataset.chapter;
        input.value = `Tell me about Chapter ${ch}: ${CHAPTER_NAMES[ch-1]}`;
      }
      document.getElementById('send-btn')?.click();
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
