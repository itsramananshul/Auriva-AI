import { fetchRandomVerse, generateResponse } from './api.js';
import { QUICK_PROMPTS_GITA, QUICK_PROMPTS_BIBLE } from './config.js';
import { getProfile, sb } from './app.js';
import { getDailyVerse } from './pages.js';
// Simple markdown renderer — no external dependency
function renderMarkdown(text) {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic (only if not a bullet line)
    .replace(/(?<!\n)\*(?!\s)(.+?)\*/g, '<em>$1</em>')
    // Headings
    .replace(/^### (.+)$/gm, '<strong>$1</strong>')
    .replace(/^## (.+)$/gm, '<strong>$1</strong>')
    .replace(/^# (.+)$/gm, '<strong>$1</strong>')
    // Bullet points: lines starting with - or *
    .replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul>${m}</ul>`)
    // Blank lines → paragraph break
    .replace(/\n{2,}/g, '<br><br>')
    // Single newlines → line break
    .replace(/\n/g, '<br>');
}

// ─── State ───
let _currentChatId = null;
let _history = []; // { role: 'user'|'model', content: string } for Gemini context

// ─── Init ───
export async function initChat() {
  const input   = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  if (!input || !sendBtn) return;

  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
  });
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  sendBtn.addEventListener('click', sendMessage);

  document.getElementById('btn-new-chat')?.addEventListener('click', startNewChat);

  await loadRecents();
  await loadMostRecentChat();
}

// ─── New / switch chats ───
export async function startNewChat() {
  _currentChatId = null;
  _history = [];
  document.getElementById('chat-messages').innerHTML = '';
  const chips = document.getElementById('quick-chips');
  if (chips) chips.style.display = 'flex';
  document.querySelectorAll('.recents-item').forEach(i => i.classList.remove('active'));
  renderQuickChips();

  // Scroll seek page into view
  const { showPage } = await import('./pages.js');
  showPage('seek');
}

async function loadMostRecentChat() {
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return;

  const { data: chats } = await sb
    .from('chats')
    .select('id')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false })
    .limit(1);

  if (chats?.length) {
    await loadChat(chats[0].id);
  } else {
    renderQuickChips();
  }
}

export async function loadChat(chatId) {
  if (!sb) return;
  _currentChatId = chatId;
  _history = [];

  const container = document.getElementById('chat-messages');
  if (container) container.innerHTML = '';

  const { data: msgs } = await sb
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: true });

  const chips = document.getElementById('quick-chips');

  if (!msgs?.length) {
    if (chips) chips.style.display = 'flex';
    renderQuickChips();
  } else {
    if (chips) chips.style.display = 'none';
    msgs.forEach(m => {
      // Rebuild in-memory history for Gemini context
      _history.push({
        role:    m.role === 'ai' ? 'model' : 'user',
        content: m.content
      });
      appendMsg(m.role, m.content, m.verse_data, false);
    });
  }

  // Mark active in sidebar
  document.querySelectorAll('.recents-item').forEach(i => {
    i.classList.toggle('active', i.dataset.chatId === chatId);
  });

  const { showPage } = await import('./pages.js');
  showPage('seek');
}

// ─── Create chat lazily on first message ───
async function createChat() {
  if (!sb) return null;
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return null;

  const { data: chat } = await sb
    .from('chats')
    .insert({ user_id: session.user.id, title: 'New Chat' })
    .select()
    .single();

  if (!chat) return null;
  _currentChatId = chat.id;

  // Add to sidebar immediately
  const list = document.getElementById('recents-list');
  if (list) {
    const empty = list.querySelector('.recents-empty');
    if (empty) empty.remove();
    const item = makeRecentEl(chat.id, 'New Chat');
    list.prepend(item);
  }

  return chat.id;
}

async function titleChat(text) {
  if (!_currentChatId || !sb) return;
  const title = text.slice(0, 35).trimEnd() + (text.length > 35 ? '…' : '');
  await sb.from('chats').update({ title }).eq('id', _currentChatId);

  // Update sidebar
  const el = document.querySelector(`.recents-item[data-chat-id="${_currentChatId}"]`);
  if (el) el.textContent = title;
}

// ─── Recents ───
export async function loadRecents() {
  if (!sb) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return;

  const { data: chats } = await sb
    .from('chats')
    .select('id, title')
    .eq('user_id', session.user.id)
    .order('updated_at', { ascending: false })
    .limit(30);

  const list = document.getElementById('recents-list');
  if (!list) return;

  if (!chats?.length) {
    list.innerHTML = '<div class="recents-empty">No conversations yet</div>';
    return;
  }

  list.innerHTML = '';
  chats.forEach(c => list.appendChild(makeRecentEl(c.id, c.title)));
}

function makeRecentEl(chatId, title) {
  const el = document.createElement('div');
  el.className = 'recents-item';
  el.dataset.chatId = chatId;

  const titleEl = document.createElement('span');
  titleEl.className = 'recents-item-title';
  titleEl.textContent = title;
  titleEl.addEventListener('click', () => loadChat(chatId));

  const delBtn = document.createElement('button');
  delBtn.className = 'recents-delete';
  delBtn.innerHTML = '×';
  delBtn.title = 'Delete chat';
  delBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    await deleteChat(chatId, el);
  });

  el.appendChild(titleEl);
  el.appendChild(delBtn);
  return el;
}

async function deleteChat(chatId, el) {
  if (!sb) return;
  // Delete messages first, then the chat
  await sb.from('messages').delete().eq('chat_id', chatId);
  await sb.from('chats').delete().eq('id', chatId);

  el.remove();

  // If deleted chat was active, start a new one
  if (_currentChatId === chatId) {
    _currentChatId = null;
    _history = [];
    const container = document.getElementById('chat-messages');
    if (container) container.innerHTML = '';
    const chips = document.getElementById('quick-chips');
    if (chips) chips.style.display = 'flex';
    renderQuickChips();
  }

  // Show empty state if no chats left
  const list = document.getElementById('recents-list');
  if (list && !list.querySelector('.recents-item')) {
    list.innerHTML = '<div class="recents-empty">No conversations yet</div>';
  }
}

// ─── Send ───
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

  // Lazy chat creation
  const isFirstMsg = !_currentChatId;
  if (!_currentChatId) {
    const id = await createChat();
    if (!id) { sendBtn.disabled = false; return; }
  }

  appendMsg('user', text);
  showTyping();

  try {
    const profile    = getProfile();
    const dailyVerse = getDailyVerse();
    const response   = await generateResponse(text, _history, profile, dailyVerse);
    removeTyping();
    appendMsg('ai', response);

    // Update in-memory history
    _history.push({ role: 'user',  content: text });
    _history.push({ role: 'model', content: response });

    // Title the chat from the first user message
    if (isFirstMsg) await titleChat(text);
  } catch (err) {
    removeTyping();
    appendMsg('ai', `Error: ${err.message}`);
    console.error(err);
  }

  sendBtn.disabled = false;
}

// ─── Render message ───
export function appendMsg(role, content, verse = null, persist = true) {
  if (persist) saveMessage(role, content, verse);

  const container = document.getElementById('chat-messages');
  if (!container) return;

  const isUser  = role === 'user';
  const profile = getProfile();
  const initial = profile?.full_name?.[0]?.toUpperCase() || 'U';

  const verseHTML = verse ? `
    <div class="inline-verse">
      <div class="iv-ref">Bhagavad Gita · Ch. ${verse.chapter} · V. ${verse.verse}</div>
      <div class="iv-text">${verse.sanskrit}</div>
      <div class="iv-trans">${verse.translation}</div>
    </div>` : '';

  const bubbleContent = isUser
    ? content.replace(/\n/g, '<br>')
    : renderMarkdown(content);

  const div = document.createElement('div');
  div.className = `msg ${isUser ? 'user' : 'ai'}`;
  div.innerHTML = `
    <div class="msg-av">${isUser ? initial : '॥'}</div>
    <div class="msg-bubble">${bubbleContent}${verseHTML}</div>`;

  container.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

// ─── Quick chips ───
export function renderQuickChips() {
  const el = document.getElementById('quick-chips');
  if (!el) return;
  const isBible = getProfile()?.source === 'Bible';
  const prompts = isBible ? QUICK_PROMPTS_BIBLE : QUICK_PROMPTS_GITA;
  el.innerHTML = prompts.map(p =>
    `<div class="chip" data-prompt="${p}">${p}</div>`
  ).join('');
  el.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('user-input').value = chip.dataset.prompt;
      sendMessage();
    });
  });
}

// ─── Persist ───
async function saveMessage(role, content, verse = null) {
  if (!sb || !_currentChatId) return;
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return;

  await sb.from('messages').insert({
    user_id:    session.user.id,
    chat_id:    _currentChatId,
    role,
    content,
    verse_data: verse || null
  });
}

// ─── Typing indicator ───
function showTyping() {
  const container = document.getElementById('chat-messages');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'msg ai'; div.id = 'typing-msg';
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
