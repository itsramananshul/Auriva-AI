import { GITA_BASE, TOPIC_MAP, VERSE_COUNTS } from './config.js';

// ─── GITA API ───

export async function fetchVerseByRef(chapter, verse) {
  try {
    const res = await fetch(`${GITA_BASE}/chapters/${chapter}/verses/${verse}/`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) throw new Error('API error');
    const data = await res.json();
    return {
      chapter,
      verse,
      sanskrit:    data.text || '',
      translation: data.translations?.[0]?.description || data.meaning?.en || '',
    };
  } catch {
    return getFallbackVerse(chapter, verse);
  }
}

export async function fetchRandomVerse() {
  const ch = Math.floor(Math.random() * 18) + 1;
  const maxV = VERSE_COUNTS[ch - 1] || 20;
  const v = Math.floor(Math.random() * maxV) + 1;
  return await fetchVerseByRef(ch, v);
}

export async function fetchVerseForQuery(userQuery) {
  const q = userQuery.toLowerCase();
  let refs = TOPIC_MAP.default;

  for (const [keyword, verses] of Object.entries(TOPIC_MAP)) {
    if (keyword !== 'default' && q.includes(keyword)) {
      refs = verses;
      break;
    }
  }

  const ref = refs[Math.floor(Math.random() * refs.length)];
  return await fetchVerseByRef(ref.ch, ref.v);
}

function getFallbackVerse(ch, v) {
  const fallbacks = {
    '2-47': {
      sanskrit: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥',
      translation: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.'
    },
    '2-14': {
      sanskrit: 'मात्रास्पर्शास्तु कौन्तेय शीतोष्णसुखदु:खदा:।\nआगमापायिनोऽनित्यास्तांस्तितिक्षस्व भारत॥',
      translation: 'O son of Kunti, the contact between the senses and the sense objects gives rise to fleeting perceptions of happiness and distress. These are non-permanent; they come and go. Bear them patiently, O Bharata.'
    },
    '18-66': {
      sanskrit: 'सर्वधर्मान्परित्यज्य मामेकं शरणं व्रज।\nअहं त्वां सर्वपापेभ्यो मोक्षयिष्यामि मा शुच:॥',
      translation: 'Abandon all varieties of dharma and simply surrender unto Me alone. I shall liberate you from all sinful reactions; do not fear.'
    }
  };
  const key = `${ch}-${v}`;
  const fb = fallbacks[key] || fallbacks['2-47'];
  return { chapter: ch, verse: v, ...fb };
}

// ─── GEMINI FLASH ───

export async function callGemini(prompt) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || `Chat error: ${res.status}`);
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

export async function generateWisdomResponse(userQuery, verse, profile) {
  const deity = profile?.deity || 'Lord Krishna';
  const prompt = `You are Auriva AI, a wisdom guide rooted in the Bhagavad Gita and Hindu scriptures.
The user's preferred deity is ${deity}.

You retrieved this verse for the user's situation:
Reference: Bhagavad Gita, Chapter ${verse.chapter}, Verse ${verse.verse}
Sanskrit: ${verse.sanskrit}
Translation: ${verse.translation}

User's message: "${userQuery}"

Your response should:
1. Acknowledge what the user is going through with genuine empathy
2. Naturally introduce this verse, referencing ${deity} where appropriate
3. Explain the verse's meaning in simple, modern language
4. Apply it directly and specifically to the user's situation
5. End with a grounding insight or practical reflection

Tone: warm, wise, and grounded — never preachy.
Always note that your interpretation is one perspective, not absolute truth.`;

  return await callGemini(prompt);
}
