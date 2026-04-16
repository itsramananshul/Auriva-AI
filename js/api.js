// ─── Daily Verse (Gemini-powered — no external API dependency) ───

export async function fetchRandomVerse(source = 'Bhagavad Gita') {
  try {
    const seed = Date.now() + Math.random();
    const res = await fetch(`/api/daily-verse?seed=${seed}&source=${encodeURIComponent(source)}`);
    if (!res.ok) throw new Error('verse API error');
    return await res.json();
  } catch {
    if (source === 'Bible') {
      return {
        book: 'Philippians', chapter: 4, verse: 13,
        sanskrit: '',
        translation: 'I can do all things through Christ who strengthens me.',
        ref: 'Philippians 4:13'
      };
    }
    return {
      chapter: 2, verse: 47,
      sanskrit: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥',
      translation: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.',
      ref: 'Bhagavad Gita · Ch. 2 · V. 47'
    };
  }
}

// ─── AI RESPONSE (Gemini picks the right shloka, keeps conversation context) ───

export async function generateResponse(userQuery, history, profile, dailyVerse = null, onChunk = null) {
  const deity  = profile?.deity  || 'Lord Krishna';
  const source = profile?.source || 'Bhagavad Gita';
  const isBible = source === 'Bible';

  const scriptureGuide = isBible
    ? `You draw wisdom from the Holy Bible — both Old and New Testament. When someone comes to you, find the Bible verse that most precisely speaks to their situation. Quote it clearly (Book Chapter:Verse), then explain how it applies to their life today. At the end, briefly add 1-2 lines connecting this to a universal truth — you can mention that ancient Hindu wisdom says the same thing in its own way, without naming specific Hindu deities or assuming the person knows them. Keep this connection natural and brief.`
    : `You draw wisdom from the Bhagavad Gita's 700 verses across 18 chapters. When someone comes to you, find the shloka that most precisely speaks to their situation — not always the famous ones. Write it in Devanagari Sanskrit first, then give its meaning in clear modern language.`;

  // Build today's verse context
  let verseContext = '';
  if (dailyVerse) {
    const ref = dailyVerse.ref ||
      `Bhagavad Gita Chapter ${dailyVerse.chapter}, Verse ${dailyVerse.verse}`;
    verseContext = `\n\nToday's verse shown to this person is:\n**${ref}** — "${dailyVerse.translation}"${dailyVerse.sanskrit ? `\nSanskrit: ${dailyVerse.sanskrit}` : ''}\nIf they ask about "today's verse" or "this verse", refer to this one.`;
  }

  const systemPrompt = `You are a wise, grounded spiritual guide. You speak like a calm, trusted friend — not a dramatic preacher. No "My dear one", no "beloved seeker", no overly poetic openers. Just real, warm, human conversation.

The person you're speaking with follows ${deity}. Their scripture is the ${source}. ${scriptureGuide}

When someone comes to you:

1. Acknowledge the real human emotion behind their words first — briefly and genuinely.

2. Share the most relevant verse from their scripture. Bridge it to their specific situation with real-world insight.

3. FORMAT like a clean chat message — short paragraphs (2-3 sentences max). Use **bold** for verse references or key points. Never write a wall of text. Easy to read on a phone.

4. Remember the conversation thread. Build on what was shared before. Don't repeat the same verse twice.

5. IMPORTANT — if they ask for a one-line answer or short reply, give exactly that. Respect what they ask for.${verseContext}`;

  // Build Gemini contents: full conversation history + current question
  const contents = [
    ...history.map(m => ({
      role: m.role, // 'user' or 'model'
      parts: [{ text: m.content }]
    })),
    { role: 'user', parts: [{ text: userQuery }] }
  ];

  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, systemPrompt })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error || `Error: ${res.status}`);
  }

  // Stream the response — call onChunk(partialText) as tokens arrive
  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let fullText  = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    if (onChunk) onChunk(fullText);
  }

  return fullText;
}
