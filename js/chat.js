import { fetchRandomVerse, generateResponse } from './api.js';
import { QUICK_PROMPTS_GITA, QUICK_PROMPTS_BIBLE } from './config.js';
import { getProfile, getDailyVerse, showConfirm, sb } from './app.js';

// ─── Markdown renderer ───
function renderMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(?<!\n)\*(?!\s)(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<strong>$1</strong>')
    .replace(/^## (.+)$/gm, '<strong>$1</strong>')
    .replace(/^# (.+)$/gm, '<strong>$1</strong>')
    .replace(/^[\*\-] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>(\n|$))+/g, m => `<ul>${m}</ul>`)
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

// ─── State ───
let _currentChatId = null;
let _history = []; // { role: 'user'|'model', content: string }

// ─── Voice state ───
let _recognition = null;
let _voiceState  = 'idle'; // 'idle' | 'recording' | 'confirm'

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

  initVoiceInput();

  await loadRecents();
  await loadMostRecentChat();
}

// ─── Voice Input ───
function initVoiceInput() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn    = document.getElementById('mic-btn');

  if (!SpeechRec) {
    // Browser doesn't support voice — hide the button
    if (micBtn) micBtn.style.display = 'none';
    return;
  }

  micBtn?.addEventListener('click', () => {
    if (_voiceState === 'recording') stopRecording();
    else startRecording(); // idle or confirm → start fresh
  });

  document.getElementById('voice-tick')?.addEventListener('click', () => {
    setVoiceState('idle');
    sendMessage();
  });

  document.getElementById('voice-cross')?.addEventListener('click', () => {
    const input = document.getElementById('user-input');
    if (input) { input.value = ''; input.style.height = 'auto'; }
    setVoiceState('idle');
  });
}

function startRecording() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const input     = document.getElementById('user-input');
  if (!SpeechRec || !input) return;

  input.value = '';

  try {
    _recognition = new SpeechRec();
    _recognition.continuous      = false; // stops after natural pause → triggers onend
    _recognition.interimResults  = true;
    _recognition.lang            = 'en-US';

    _recognition.onresult = (e) => {
      let final = '', interim = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) final  += e.results[i][0].transcript;
        else                       interim += e.results[i][0].transcript;
      }
      input.value = final + interim;
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    };

    _recognition.onend = () => {
      _recognition = null;
      // If still in recording state (not manually overridden), move to confirm or idle
      if (_voiceState === 'recording') {
        setVoiceState(input.value.trim() ? 'confirm' : 'idle');
      }
    };

    _recognition.onerror = () => {
      _recognition = null;
      setVoiceState('idle');
    };

    _recognition.start();
    setVoiceState('recording');
  } catch {
    setVoiceState('idle');
  }
}

function stopRecording() {
  if (_recognition) {
    _recognition.stop(); // will trigger onend → moves to confirm
  }
}

function setVoiceState(state) {
  _voiceState = state;

  const micBtn    = document.getElementById('mic-btn');
  const voiceActs = document.getElementById('voice-actions');
  const sendBtn   = document.getElementById('send-btn');
  const inputWrap = document.querySelector('.input-wrap');
  const input     = document.getElementById('user-input');
  if (!micBtn || !voiceActs || !sendBtn) return;

  // Clear any existing classes
  micBtn.classList.remove('recording');
  inputWrap?.classList.remove('recording');

  if (state === 'idle') {
    micBtn.style.display    = '';
    voiceActs.style.display = 'none';
    sendBtn.style.display   = '';
    if (input) input.placeholder = 'Ask anything — a struggle, a question, a doubt...';

  } else if (state === 'recording') {
    micBtn.classList.add('recording');
    inputWrap?.classList.add('recording');
    micBtn.style.display    = '';
    voiceActs.style.display = 'none';
    sendBtn.style.display   = 'none';
    if (input) input.placeholder = 'Listening...';

  } else if (state === 'confirm') {
    micBtn.style.display    = 'none';
    voiceActs.style.display = 'flex';
    sendBtn.style.display   = 'none';
    if (input) input.placeholder = 'Ask anything — a struggle, a question, a doubt...';
  }
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
      _history.push({
        role:    m.role === 'ai' ? 'model' : 'user',
        content: m.content
      });
      appendMsg(m.role, m.content, m.verse_data, false);
    });
  }

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

  const el = document.querySelector(`.recents-item[data-chat-id="${_currentChatId}"]`);
  if (el) {
    const titleSpan = el.querySelector('.recents-item-title');
    if (titleSpan) titleSpan.textContent = title;
  }
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

  const confirmed = await showConfirm('This cannot be undone.', 'Delete this chat?');
  if (!confirmed) return;

  await sb.from('messages').delete().eq('chat_id', chatId);
  await sb.from('chats').delete().eq('id', chatId);

  el.remove();

  if (_currentChatId === chatId) {
    _currentChatId = null;
    _history = [];
    const container = document.getElementById('chat-messages');
    if (container) container.innerHTML = '';
    const chips = document.getElementById('quick-chips');
    if (chips) chips.style.display = 'flex';
    renderQuickChips();
  }

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

  const isFirstMsg = !_currentChatId;
  if (!_currentChatId) {
    const id = await createChat();
    if (!id) { sendBtn.disabled = false; return; }
  }

  appendMsg('user', text, null, false);
  saveMessage('user', text); // fire-and-forget (no need to await here)

  const bubble = createStreamBubble();

  try {
    const profile    = getProfile();
    const dailyVerse = getDailyVerse();

    const response = await generateResponse(
      text, _history, profile, dailyVerse,
      (partial) => updateStreamBubble(bubble, partial)
    );

    finalizeStreamBubble(bubble, response);

    _history.push({ role: 'user',  content: text });
    _history.push({ role: 'model', content: response });

    saveMessage('ai', response);
    if (isFirstMsg) await titleChat(text);
  } catch (err) {
    const msg = `Something went wrong: ${err.message}`;
    updateStreamBubble(bubble, msg);
    finalizeStreamBubble(bubble, msg);
    console.error(err);
  } finally {
    sendBtn.disabled = false;
  }
}

// ─── Streaming bubble helpers ───
function createStreamBubble() {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = 'msg ai';
  div.innerHTML = `<div class="msg-av">॥</div><div class="msg-bubble"><span class="stream-cursor">▍</span></div>`;
  container.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return div.querySelector('.msg-bubble');
}

function updateStreamBubble(bubble, partialText) {
  bubble.innerHTML = renderMarkdown(partialText) + '<span class="stream-cursor">▍</span>';
  bubble.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function finalizeStreamBubble(bubble, fullText) {
  bubble.innerHTML = renderMarkdown(fullText);
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

  // Avatar
  const avDiv = document.createElement('div');
  avDiv.className = 'msg-av';
  avDiv.textContent = isUser ? initial : '॥';

  // Bubble
  const bubbleDiv = document.createElement('div');
  bubbleDiv.className = 'msg-bubble';
  bubbleDiv.innerHTML = bubbleContent + verseHTML;

  // Edit button for user messages only
  if (isUser) {
    const editBtn = document.createElement('button');
    editBtn.className = 'msg-edit-btn';
    editBtn.title = 'Edit message';
    editBtn.innerHTML = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M11 2l3 3-9 9H2v-3L11 2z"/></svg>`;
    editBtn.addEventListener('click', () => handleEditMessage(div));
    bubbleDiv.appendChild(editBtn);
  }

  div.appendChild(avDiv);
  div.appendChild(bubbleDiv);

  container.appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return div;
}

// ─── Edit message ───
async function handleEditMessage(msgEl) {
  const container = document.getElementById('chat-messages');
  const allMsgs   = Array.from(container.children);
  const idx       = allMsgs.indexOf(msgEl);
  if (idx === -1) return;

  // Get original text before removing anything
  const originalText = _history[idx]?.content || '';

  // Remove this message and everything after it from the DOM
  allMsgs.slice(idx).forEach(el => el.remove());

  // Truncate in-memory history to just before this message
  const keptHistory = _history.slice(0, idx);
  _history = keptHistory;

  // Sync DB: wipe all messages in this chat, re-insert only what's kept
  if (sb && _currentChatId) {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session?.user) {
        await sb.from('messages').delete().eq('chat_id', _currentChatId);

        if (keptHistory.length) {
          await sb.from('messages').insert(
            keptHistory.map(m => ({
              user_id:    session.user.id,
              chat_id:    _currentChatId,
              role:       m.role === 'model' ? 'ai' : 'user',
              content:    m.content,
              verse_data: null
            }))
          );
        }
      }
    } catch (err) {
      console.error('Edit sync error:', err);
    }
  }

  // Show chips again if chat is now empty
  const chips = document.getElementById('quick-chips');
  if (chips && !container.children.length) chips.style.display = 'flex';

  // Drop the original text into the input so the user can edit + resend
  const input = document.getElementById('user-input');
  if (input) {
    input.value = originalText;
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    input.focus();
    input.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
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

// ─── Typing indicator (kept for potential future use) ───
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
