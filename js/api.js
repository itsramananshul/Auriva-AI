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
  const deity   = profile?.deity  || 'Lord Krishna';
  const source  = profile?.source || 'Bhagavad Gita';
  const isBible = source === 'Bible';
  const isQuran = source === 'Quran';
  const isSikh  = source === 'Guru Granth Sahib';

  const scriptureGuide = isSikh
    ? `You draw wisdom from the Guru Granth Sahib — 1430 Angs (pages) of sacred Gurbani. When someone comes to you, find the shabad or line that most precisely speaks to their situation. Write it in Gurmukhi script first, then give its meaning in clear modern English. Cite it as (Guru Granth Sahib, Ang <page>). Speak with the loving, fearless grace that Sikhi teaches — Waheguru is Nirbhau (without fear) and Nirvair (without enmity), and so should the seeker be.`
    : isQuran
    ? `You draw wisdom from the Holy Quran — 114 surahs, 6236 ayahs. When someone comes to you, find the ayah that most precisely speaks to their situation — not always the famous ones. Write it in Arabic first, then give its meaning in clear modern English. Cite it as (Surah Name, Chapter:Ayah). Speak with the calm certainty and mercy that Islam teaches — Allah is Al-Rahman, Al-Rahim, the Most Gracious, the Most Merciful.`
    : isBible
    ? `You draw wisdom from the Holy Bible — both Old and New Testament. When someone comes to you, find the Bible verse that most precisely speaks to their situation. Quote it clearly (Book Chapter:Verse), then explain how it applies to their life today. At the end, briefly add 1-2 lines connecting this to a universal truth — you can mention that ancient Hindu wisdom says the same thing in its own way, without naming specific Hindu deities or assuming the person knows them. Keep this connection natural and brief.`
    : `You draw wisdom from the Bhagavad Gita's 700 verses across 18 chapters. When someone comes to you, find the shloka that most precisely speaks to their situation — not always the famous ones. Write it in Devanagari Sanskrit first, then give its meaning in clear modern language.`;

  // Build today's verse context
  let verseContext = '';
  if (dailyVerse) {
    const ref = dailyVerse.ref ||
      `Bhagavad Gita Chapter ${dailyVerse.chapter}, Verse ${dailyVerse.verse}`;
    const scriptLabel = isQuran ? 'Arabic' : isSikh ? 'Gurmukhi' : 'Sanskrit';
    verseContext = `\n\nToday's verse shown to this person is:\n**${ref}** — "${dailyVerse.translation}"${dailyVerse.sanskrit ? `\n${scriptLabel}: ${dailyVerse.sanskrit}` : ''}\nIf they ask about "today's verse" or "this verse", refer to this one.`;
  }

  const systemPrompt = `You are a wise, grounded spiritual guide. You speak like a calm, trusted friend — not a dramatic preacher. No "My dear one", no "beloved seeker", no overly poetic openers. Just real, warm, human conversation.

The person you're speaking with follows ${deity}. Their scripture is the ${source}. ${scriptureGuide}

When someone comes to you:

1. Acknowledge the real human emotion behind their words first — briefly and genuinely.

2. Go deep. This is the core of your value. Give them a perspective shift, a reframe, something real to hold onto — bridge the wisdom of this tradition to their specific situation with real-world insight. Don't just acknowledge and stop. Go somewhere with it.

3. A verse is a tool, not a ritual. Don't force one into every reply. Bring a verse when: it's the opening message of a new conversation, the person directly asks about scripture, or a specific quote adds something the response can't have without it. In all other replies — speak from the tradition's wisdom without formally quoting it. The depth stays. The verse is optional.

4. FORMAT for readability — 2-3 sentences per paragraph, multiple paragraphs when the response deserves it. Use **bold** for key insights or verse references. Don't write one giant block. But don't be artificially short either — if something deserves 4 paragraphs of real insight, write 4 paragraphs.

5. Remember the conversation thread. Build on what was shared before. Don't repeat the same verse twice.

6. IMPORTANT — if they ask for a one-line answer or short reply, give exactly that. Respect what they ask for.${verseContext}`;

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
