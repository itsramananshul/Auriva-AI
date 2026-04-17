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

// ─── Voice conversation mode ───
let _vmActive    = false;
let _vmState     = 'idle'; // 'listening' | 'processing' | 'speaking'
let _vmRec       = null;
let _vmSendTimer = null;
let _vmText      = '';
let _vmKeepAlive = null;
// VAD (Voice Activity Detection) — used to detect interruption while AI speaks
let _vadStream   = null;
let _vadCtx      = null;
let _vadInterval = null;

// ─── Voice state ───
let _recognition = null;
let _voiceState  = 'idle'; // 'idle' | 'recording' | 'confirm'
let _voiceBase   = '';     // text accumulated from previous recognition sessions (restarts)

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
  initVoiceMode();

  await loadRecents();
  await loadMostRecentChat();
}

// ─── Voice Conversation Mode ───
function initVoiceMode() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const toggleBtn = document.getElementById('btn-voice-mode');
  const endBtn    = document.getElementById('vm-end-btn');

  if (!SpeechRec || !window.speechSynthesis) {
    if (toggleBtn) toggleBtn.style.display = 'none';
    return;
  }

  // Preload voices (async on some browsers)
  window.speechSynthesis.getVoices();
  if ('onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  toggleBtn?.addEventListener('click', () => {
    if (_vmActive) exitVoiceMode();
    else enterVoiceMode();
  });
  endBtn?.addEventListener('click', exitVoiceMode);
}

function enterVoiceMode() {
  _vmActive = true;

  document.getElementById('vm-panel')?.classList.add('active');
  document.querySelector('#page-seek .input-area').style.display = 'none';
  document.getElementById('btn-voice-mode')?.classList.add('active');

  // Make sure we're on the seek page
  import('./pages.js').then(({ showPage }) => showPage('seek'));

  startVMListening();
}

function exitVoiceMode() {
  _vmActive = false;

  stopVMListening();
  stopVAD();
  window.speechSynthesis.cancel();
  clearInterval(_vmKeepAlive);

  document.getElementById('vm-panel')?.classList.remove('active');
  document.querySelector('#page-seek .input-area').style.display = '';
  document.getElementById('btn-voice-mode')?.classList.remove('active');

  setVMState('idle');
}

function startVMListening() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRec || !_vmActive || _vmRec) return; // already running

  _vmText = '';
  setVMTranscript('');

  try {
    const rec = new SpeechRec();
    rec.continuous     = true;
    rec.interimResults = true;
    rec.lang           = 'en-US';

    rec.onresult = (e) => {
      // While AI is speaking: any speech = interrupt (works on Android/desktop)
      if (_vmState === 'speaking') {
        window.speechSynthesis.cancel();
        clearInterval(_vmKeepAlive);
        stopVAD();
        _vmText = '';
        setVMTranscript('');
        setVMState('listening');
        return; // don't treat this as a message — wait for next utterance
      }

      if (_vmState !== 'listening') return; // ignore during processing

      let text = '';
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      _vmText = text;
      setVMTranscript(text);

      if (e.results[e.results.length - 1].isFinal) {
        clearTimeout(_vmSendTimer);
        _vmSendTimer = setTimeout(() => {
          const toSend = _vmText.trim();
          if (toSend) sendVoiceMessage(toSend);
        }, 1500);
      }
    };

    rec.onend = () => {
      _vmRec = null;
      if (!_vmActive || _vmState === 'processing') return;
      // Auto-restart — browser may kill recognition during TTS on iOS
      setTimeout(() => {
        if (_vmActive && _vmState !== 'processing') startVMListening();
      }, 300);
    };

    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      _vmRec = null;
      setTimeout(() => {
        if (_vmActive && _vmState !== 'processing') startVMListening();
      }, 500);
    };

    rec.start();
    _vmRec = rec;
    if (_vmState !== 'speaking') setVMState('listening');
  } catch {
    setVMState('idle');
  }
}

function stopVMListening() {
  clearTimeout(_vmSendTimer);
  if (_vmRec) {
    const rec = _vmRec;
    _vmRec = null;
    rec.onend = null;
    rec.stop();
  }
}

async function sendVoiceMessage(text) {
  stopVMListening();
  setVMState('processing');
  setVMTranscript('');

  if (!_currentChatId) {
    const id = await createChat();
    if (!id) { if (_vmActive) startVMListening(); return; }
  }

  const isFirstMsg = _history.length === 0;

  appendMsg('user', text, null, false);
  saveMessage('user', text);

  const bubble = createStreamBubble();

  try {
    const response = await generateResponse(
      text, _history, getProfile(), getDailyVerse(),
      (partial) => updateStreamBubble(bubble, partial)
    );

    finalizeStreamBubble(bubble, response);
    _history.push({ role: 'user',  content: text });
    _history.push({ role: 'model', content: response });
    saveMessage('ai', response);
    if (isFirstMsg) await titleChat(text);

    speakVMResponse(response);
  } catch (err) {
    finalizeStreamBubble(bubble, `Something went wrong: ${err.message}`);
    if (_vmActive) startVMListening();
  }
}

function speakVMResponse(text) {
  if (!_vmActive) return;

  // Stop recognition while TTS plays — mobile browsers block mic during TTS anyway
  stopVMListening();

  // Strip markdown so it reads naturally
  const clean = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/#{1,3}\s/g, '')
    .replace(/<br\s*\/?>/gi, '. ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const utterance = new SpeechSynthesisUtterance(clean);
  utterance.rate  = 1.0;   // natural speed — slower sounds more robotic
  utterance.pitch = 1.0;

  // Best available English voice — prioritise neural/enhanced/natural
  const voices = window.speechSynthesis.getVoices();
  const voice  = voices.find(v => v.name.includes('Samantha') && v.name.includes('Enhanced'))
              || voices.find(v => v.name.includes('Aria'))            // Edge neural
              || voices.find(v => v.name.includes('Jenny'))           // Edge neural
              || voices.find(v => /Natural|Enhanced|Premium/.test(v.name) && v.lang.startsWith('en'))
              || voices.find(v => v.name.includes('Samantha'))        // iOS
              || voices.find(v => v.name.includes('Karen'))
              || voices.find(v => v.name.includes('Google UK English Female'))
              || voices.find(v => v.name.includes('Google US English'))
              || voices.find(v => v.lang.startsWith('en') && v.localService)
              || voices.find(v => v.lang.startsWith('en'))
              || null;
  if (voice) utterance.voice = voice;

  // Chrome bug: TTS silently stops after ~15s — keep it alive
  _vmKeepAlive = setInterval(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
    } else {
      clearInterval(_vmKeepAlive);
    }
  }, 10000);

  const onDone = () => {
    clearInterval(_vmKeepAlive);
    stopVAD();
    if (_vmActive) { _vmText = ''; startVMListening(); }
  };
  utterance.onend   = onDone;
  utterance.onerror = onDone;

  setVMState('speaking');
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);

  // Start VAD AFTER a short delay (so TTS startup noise doesn't self-trigger)
  setTimeout(() => {
    if (_vmState === 'speaking') startVAD();
  }, 600);
}

// ─── VAD: raw mic monitoring to detect interruption while AI speaks ───
async function startVAD() {
  if (_vadStream) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    // Voice mode may have been exited while waiting for mic permission
    if (!_vmActive) { stream.getTracks().forEach(t => t.stop()); return; }

    _vadStream = stream;
    _vadCtx    = new (window.AudioContext || window.webkitAudioContext)();
    const source   = _vadCtx.createMediaStreamSource(stream);
    const analyser = _vadCtx.createAnalyser();
    analyser.fftSize               = 512;
    analyser.smoothingTimeConstant = 0.4;
    source.connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);

    // ── Calibrate noise floor (500ms) ──
    const samples = [];
    await new Promise(resolve => {
      const cal = setInterval(() => {
        analyser.getByteFrequencyData(data);
        samples.push(Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length));
      }, 80);
      setTimeout(() => { clearInterval(cal); resolve(); }, 500);
    });

    // Voice mode may have been exited during calibration — bail out cleanly
    if (!_vmActive || !_vadStream) { stopVAD(); return; }

    const noiseFloor = samples.reduce((a, b) => a + b, 0) / samples.length;
    const threshold  = Math.max(noiseFloor * 2.0, 20);

    let ticks = 0;
    _vadInterval = setInterval(() => {
      if (!_vmActive || !_vadStream) { clearInterval(_vadInterval); return; }
      analyser.getByteFrequencyData(data);
      const rms = Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);

      if (rms > threshold) {
        ticks++;
        if (ticks >= 3 && _vmState === 'speaking') {
          window.speechSynthesis.cancel();
          clearInterval(_vmKeepAlive);
          stopVAD(); // release mic FIRST
          _vmText = '';
          setVMState('listening');
          // Small delay so the mic is fully released before SpeechRecognition grabs it
          setTimeout(() => { if (_vmActive) startVMListening(); }, 250);
        }
      } else {
        ticks = 0;
      }
    }, 80);
  } catch {
    // Mic permission denied — VAD won't work, that's ok
  }
}

function stopVAD() {
  clearInterval(_vadInterval);
  _vadInterval = null;
  if (_vadStream) { _vadStream.getTracks().forEach(t => t.stop()); _vadStream = null; }
  if (_vadCtx)   { _vadCtx.close().catch(() => {}); _vadCtx = null; }
}

function setVMState(state) {
  _vmState = state;
  const orb   = document.getElementById('vm-orb');
  const label = document.getElementById('vm-label');
  if (!orb) return;
  orb.className    = `vm-orb ${state}`;
  label.textContent =
    state === 'listening'  ? 'Listening...' :
    state === 'processing' ? 'Thinking...'  :
    state === 'speaking'   ? 'Speaking...'  : '';
}

function setVMTranscript(text) {
  const el = document.getElementById('vm-transcript');
  if (el) el.textContent = text;
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
    if (_voiceState === 'recording') {
      stopRecording();
    } else {
      // Fresh start — clear any previous transcript base
      _voiceBase = '';
      const input = document.getElementById('user-input');
      if (input) { input.value = ''; input.style.height = 'auto'; }
      startRecording();
    }
  });

  document.getElementById('voice-tick')?.addEventListener('click', () => {
    _voiceBase = '';
    setVoiceState('idle');
    sendMessage();
  });

  document.getElementById('voice-cross')?.addEventListener('click', () => {
    _voiceBase = '';
    const input = document.getElementById('user-input');
    if (input) { input.value = ''; input.style.height = 'auto'; }
    setVoiceState('idle');
  });
}

function startRecording() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const input     = document.getElementById('user-input');
  if (!SpeechRec || !input) return;

  try {
    const rec = new SpeechRec();
    rec.continuous     = true;   // don't stop on natural pauses
    rec.interimResults = true;
    rec.lang           = 'en-US';

    rec.onresult = (e) => {
      // e.results accumulates for this session; prepend _voiceBase from prior sessions
      let sessionText = '';
      for (let i = 0; i < e.results.length; i++) {
        sessionText += e.results[i][0].transcript;
      }
      input.value = _voiceBase + sessionText;
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 100) + 'px';
    };

    rec.onend = () => {
      _recognition = null;
      if (_voiceState === 'recording') {
        // Browser killed the session — save what we have and restart seamlessly
        _voiceBase = input.value;
        startRecording();
      }
    };

    rec.onerror = (e) => {
      // 'aborted' = manual stop (we handle via stopRecording), 'no-speech' = normal pause — ignore both
      if (e.error === 'aborted' || e.error === 'no-speech') return;
      _recognition = null;
      setVoiceState(input.value.trim() ? 'confirm' : 'idle');
    };

    rec.start();
    _recognition = rec;
    setVoiceState('recording');
  } catch {
    setVoiceState('idle');
  }
}

function stopRecording() {
  if (_recognition) {
    const rec = _recognition;
    _recognition = null;
    rec.onend = null; // prevent auto-restart loop
    rec.stop();
  }
  _voiceBase = '';
  const input = document.getElementById('user-input');
  setVoiceState(input?.value.trim() ? 'confirm' : 'idle');
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
