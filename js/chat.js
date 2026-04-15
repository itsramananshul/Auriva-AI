import { fetchVerseForQuery, generateWisdomResponse } from './api.js';
import { QUICK_PROMPTS } from './config.js';
import { getProfile, sb } from './app.js';

export async function initChat() {
  await loadChatHistory();

  const input  = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');

  if (!input || !sendBtn) return;

  // Auto-resize textarea
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });

  // Send on Enter (no shift)
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendBtn.addEventListener('click', sendMessage);

  renderQuickChips();
}

export function renderQuickChips() {
  const el = document.getElementById('quick-chips');
  if (!el) return;
  el.innerHTML = QUICK_PROMPTS.map(p =>
    `<div class="chip" data-prompt="${p}">${p}</div>`
  ).join('');
  el.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('user-input').value = chip.dataset.prompt;
      sendMessage();
    });
  });
}

export async function sendMessage() {
  const input   = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const chips   = document.getElementById('quick-chips');
  const text    = input?.value.trim();

  if (!text) return;

  input.value = '';
  input.style.height = 'auto';
  sendBtn.disabled = true;
  if (chips) chips.style.display = 'none';

  appendMsg('user', text);
  showTyping();

  try {
    const verse    = await fetchVerseForQuery(text);
    const profile  = getProfile();
    const response = await generateWisdomResponse(text, verse, profile);
    removeTyping();
    appendMsg('ai', response, verse.sanskrit ? verse : null);
  } catch (err) {
    removeTyping();
    appendMsg('ai', `Error: ${err.message}`);
    console.error(err);
  }

  sendBtn.disabled = false;
}

async function loadChatHistory() {
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return;

  const { data: msgs } = await sb
    .from('messages')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: true })
    .limit(100);

  if (!msgs?.length) return;

  // Hide quick chips if there's history
  const chips = document.getElementById('quick-chips');
  if (chips) chips.style.display = 'none';

  msgs.forEach(msg => appendMsg(msg.role, msg.content, msg.verse_data, false));
}

async function saveMessage(role, content, verse = null) {
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return;

  await sb.from('messages').insert({
    user_id:    session.user.id,
    role,
    content,
    verse_data: verse || null
  });
}

export function appendMsg(role, content, verse = null, persist = true) {
  if (persist) saveMessage(role, content, verse);

  const container = document.getElementById('chat-messages');
  if (!container) return;

  const isUser = role === 'user';
  const profile = getProfile();
  const initial = profile?.full_name?.[0]?.toUpperCase() || 'U';

  const verseHTML = verse ? `
    <div class="inline-verse">
      <div class="iv-ref">Bhagavad Gita · Ch. ${verse.chapter} · V. ${verse.verse}</div>
      <div class="iv-text">${verse.sanskrit}</div>
      <div class="iv-trans">${verse.translation}</div>
    </div>` : '';

  const div = document.createElement('div');
  div.className = `msg ${isUser ? 'user' : 'ai'}`;
  div.innerHTML = `
    <div class="msg-av">${isUser ? initial : '॥'}</div>
    <div class="msg-bubble">${content}${verseHTML}</div>`;

  container.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function showTyping() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.id = 'typing-msg';
  div.innerHTML = `
    <div class="msg-av">॥</div>
    <div class="msg-bubble">
      <div class="typing-indicator"><span></span><span></span><span></span></div>
    </div>`;
  container.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function removeTyping() {
  document.getElementById('typing-msg')?.remove();
}
