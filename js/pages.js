import { fetchRandomVerse } from './api.js';
import {
  CHAPTER_NAMES, VERSE_COUNTS, BIBLE_BOOKS,
  DHAMMAPADA_CHAPTERS, DHAMMAPADA_VERSE_COUNTS,
  TAO_CHAPTERS, TORAH_BOOKS, JAIN_TEXTS,
  ANALECTS_BOOKS, BAHAI_TEXTS,
  AVESTA_TEXTS, SHINTO_TEXTS, NORSE_TEXTS,
  STOIC_TEXTS, EGYPT_TEXTS, GREEK_TEXTS
} from './config.js';
import { getProfile, setDailyVerse } from './app.js';

let dailyVerse = null;
let _verseLoading = false;

function isBibleUser()  { return getProfile()?.source === 'Bible'; }
function isTorahUser()  { return getProfile()?.source === 'Torah'; }

function verseRef(v) {
  if (v.ref) return v.ref;
  return `Bhagavad Gita · Ch. ${v.chapter} · V. ${v.verse}`;
}

// ─── Load verse (called on app init) ───
export async function loadDailyVerseCard() {
  const source = getProfile()?.source || 'Bhagavad Gita';
  _verseLoading = true;

  // Show a "loading" label while fetching
  const ref  = document.getElementById('mini-ref');
  const tag  = document.getElementById('mini-tag');
  const sans = document.getElementById('mini-sanskrit');
  const tran = document.getElementById('mini-trans');
  if (ref) ref.textContent = 'Loading verse…';

  try {
    dailyVerse = await fetchRandomVerse(source);
    setDailyVerse(dailyVerse);
  } catch {
    // fetchRandomVerse always returns a fallback, so this is extra insurance
    dailyVerse = { translation: 'Peace comes from within. Do not seek it without.', ref: '—' };
  } finally {
    _verseLoading = false;
  }

  if (ref)  ref.textContent  = verseRef(dailyVerse);
  if (tag)  tag.textContent  = "Today's Verse";
  if (sans) { sans.textContent = dailyVerse.sanskrit || ''; sans.style.display = dailyVerse.sanskrit ? '' : 'none'; }
  if (tran) tran.textContent  = dailyVerse.translation || '';

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
  const source = getProfile()?.source || 'Bhagavad Gita';
  const scriptureLabel =
    source === 'Bible'             ? 'Bible'
    : source === 'Quran'           ? 'Quran'
    : source === 'Guru Granth Sahib'? 'Guru Granth Sahib'
    : source === 'Dhammapada'      ? 'Dhammapada'
    : source === 'Tao Te Ching'    ? 'Tao Te Ching'
    : source === 'Torah'           ? 'Torah'
    : source === 'Agamas'          ? 'Jain Agamas'
    : source === 'Analects'        ? 'Analects'
    : source === 'Kitab-i-Aqdas'   ? 'Bahá\'í Texts'
    : source === 'Avesta'          ? 'Avesta'
    : source === 'Kojiki'          ? 'Kojiki'
    : source === 'Poetic Edda'     ? 'Poetic Edda'
    : source === 'Meditations'     ? 'Stoic Texts'
    : source === 'Book of the Dead'? 'Egyptian Texts'
    : source === 'Theogony'        ? 'Greek Texts'
    : 'Scriptures';
  const titles = {
    seek:       `Seek <span>Wisdom</span>`,
    daily:      `Daily <span>Verse</span>`,
    scriptures: `The <span>${scriptureLabel}</span>`,
    saved:      `Saved <span>Verses</span>`
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
    setDailyVerse(dailyVerse);
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

// ─── Scriptures page ───
function renderScriptures() {
  const grid = document.getElementById('sc-grid');
  if (!grid) return;
  grid.innerHTML = ''; // re-render every time so switching profile works

  const source = getProfile()?.source || 'Bhagavad Gita';

  if (source === 'Bible') {
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

  } else if (source === 'Torah') {
    grid.innerHTML = `<div class="sc-testament-label">Hebrew Bible</div>` +
      TORAH_BOOKS.map(b => `
        <div class="sc-card" data-book="${b.name}">
          <div class="sc-ch">Book</div>
          <div class="sc-title">${b.name}</div>
          <div class="sc-count">${b.desc}</div>
        </div>`).join('');

  } else if (source === 'Dhammapada') {
    grid.innerHTML = DHAMMAPADA_CHAPTERS.map((name, i) => `
      <div class="sc-card" data-chapter="${i+1}">
        <div class="sc-num">${String(i+1).padStart(2,'0')}</div>
        <div class="sc-ch">Chapter ${i+1}</div>
        <div class="sc-title">${name}</div>
        <div class="sc-count">${DHAMMAPADA_VERSE_COUNTS[i]} verses</div>
      </div>`).join('');

  } else if (source === 'Tao Te Ching') {
    grid.innerHTML = TAO_CHAPTERS.map((name, i) => `
      <div class="sc-card" data-tao="${i+1}">
        <div class="sc-num">${String(i+1).padStart(2,'0')}</div>
        <div class="sc-ch">Chapter ${i+1}</div>
        <div class="sc-title">${name}</div>
        <div class="sc-count">Tao Te Ching</div>
      </div>`).join('');

  } else if (source === 'Agamas') {
    grid.innerHTML = `<div class="sc-testament-label">Sacred Jain Texts</div>` +
      JAIN_TEXTS.map(t => `
        <div class="sc-card" data-jain="${t.name}">
          <div class="sc-ch">Text</div>
          <div class="sc-title">${t.name}</div>
          <div class="sc-count">${t.desc}</div>
        </div>`).join('');

  } else if (source === 'Analects') {
    grid.innerHTML = ANALECTS_BOOKS.map((name, i) => `
      <div class="sc-card" data-analects="${i+1}">
        <div class="sc-num">${String(i+1).padStart(2,'0')}</div>
        <div class="sc-ch">Book ${i+1}</div>
        <div class="sc-title">${name}</div>
        <div class="sc-count">Analects of Confucius</div>
      </div>`).join('');

  } else if (source === 'Kitab-i-Aqdas') {
    grid.innerHTML = `<div class="sc-testament-label">Sacred Bahá\'í Writings</div>` +
      BAHAI_TEXTS.map(t => `
        <div class="sc-card" data-bahai="${t.name}">
          <div class="sc-ch">Text</div>
          <div class="sc-title">${t.name}</div>
          <div class="sc-count">${t.desc}</div>
        </div>`).join('');

  } else if (source === 'Avesta') {
    grid.innerHTML = `<div class="sc-testament-label">Sacred Zoroastrian Texts</div>` +
      AVESTA_TEXTS.map(t => `
        <div class="sc-card" data-generic="${t.name}">
          <div class="sc-ch">Text</div>
          <div class="sc-title">${t.name}</div>
          <div class="sc-count">${t.desc}</div>
        </div>`).join('');

  } else if (source === 'Kojiki') {
    grid.innerHTML = `<div class="sc-testament-label">Sacred Shinto Texts</div>` +
      SHINTO_TEXTS.map(t => `
        <div class="sc-card" data-generic="${t.name}">
          <div class="sc-ch">Text</div>
          <div class="sc-title">${t.name}</div>
          <div class="sc-count">${t.desc}</div>
        </div>`).join('');

  } else if (source === 'Poetic Edda') {
    grid.innerHTML = `<div class="sc-testament-label">The Poetic Edda</div>` +
      NORSE_TEXTS.map(t => `
        <div class="sc-card" data-generic="${t.name}">
          <div class="sc-ch">Poem</div>
          <div class="sc-title">${t.name}</div>
          <div class="sc-count">${t.desc}</div>
        </div>`).join('');

  } else if (source === 'Meditations') {
    grid.innerHTML = `<div class="sc-testament-label">Stoic Texts</div>` +
      STOIC_TEXTS.map(t => `
        <div class="sc-card" data-generic="${t.name}">
          <div class="sc-ch">Text</div>
          <div class="sc-title">${t.name}</div>
          <div class="sc-count">${t.desc}</div>
        </div>`).join('');

  } else if (source === 'Book of the Dead') {
    grid.innerHTML = `<div class="sc-testament-label">Ancient Egyptian Texts</div>` +
      EGYPT_TEXTS.map(t => `
        <div class="sc-card" data-generic="${t.name}">
          <div class="sc-ch">Text</div>
          <div class="sc-title">${t.name}</div>
          <div class="sc-count">${t.desc}</div>
        </div>`).join('');

  } else if (source === 'Theogony') {
    grid.innerHTML = `<div class="sc-testament-label">Greek Sacred Texts</div>` +
      GREEK_TEXTS.map(t => `
        <div class="sc-card" data-generic="${t.name}">
          <div class="sc-ch">Text</div>
          <div class="sc-title">${t.name}</div>
          <div class="sc-count">${t.desc}</div>
        </div>`).join('');

  } else {
    // Default: Bhagavad Gita (also for Shiva Purana, Devi Mahatmya, Ramayana — show Gita chapters as the core Hindu framework)
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
      } else if (card.dataset.chapter) {
        const ch = card.dataset.chapter;
        input.value = `Tell me about Chapter ${ch}: ${CHAPTER_NAMES[ch-1]}`;
      } else if (card.dataset.tao) {
        const ch = card.dataset.tao;
        input.value = `Tell me about Chapter ${ch} of the Tao Te Ching: ${TAO_CHAPTERS[ch-1]}`;
      } else if (card.dataset.jain) {
        input.value = `Tell me about the ${card.dataset.jain} and its key teachings`;
      } else if (card.dataset.analects) {
        const b = card.dataset.analects;
        input.value = `Tell me about Book ${b} of the Analects: ${ANALECTS_BOOKS[b-1]}`;
      } else if (card.dataset.bahai) {
        input.value = `Tell me about the ${card.dataset.bahai} and its key teachings`;
      } else if (card.dataset.generic) {
        input.value = `Tell me about the ${card.dataset.generic} and its key teachings`;
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
