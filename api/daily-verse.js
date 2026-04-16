const GITA_VERSE_COUNTS = [47,72,43,42,29,47,30,28,34,42,55,20,35,27,20,24,28,78];

// API.Bible IDs for added translations
const BIBLE_IDS = {
  NIV: '78a9f6124f344018-01',
  KJV: 'de4e12af7f28f599-02',
  AMP: '7142879509583d59-01'
};

export default async function handler(req, res) {
  const seed    = req.query.seed   || Math.random();
  const source  = req.query.source || 'Bhagavad Gita';
  const isBible = source === 'Bible';

  // Tier 1: Real API
  try {
    const verse = isBible ? await getBibleVerse(seed) : await getGitaVerse();
    return res.status(200).json(verse);
  } catch (err) {
    console.error('[daily-verse] Real API failed:', err.message);
  }

  // Tier 2: Gemini AI generation
  try {
    const verse = isBible ? await getGeminiVerse('Bible', seed) : await getGeminiVerse('Bhagavad Gita', seed);
    return res.status(200).json(verse);
  } catch (err) {
    console.error('[daily-verse] Gemini fallback failed:', err.message);
  }

  // Tier 3: Hardcoded fallback — always works
  return res.status(200).json(isBible ? bibleFallback() : gitaFallback());
}

// ─── Bhagavad Gita — vedicscriptures.github.io ───
async function getGitaVerse() {
  const chapter = Math.floor(Math.random() * 18) + 1;
  const maxV    = GITA_VERSE_COUNTS[chapter - 1];
  const verse   = Math.floor(Math.random() * maxV) + 1;

  const res = await fetch(`https://vedicscriptures.github.io/slok/${chapter}/${verse}/`);
  if (!res.ok) throw new Error(`Gita API ${res.status}`);
  const data = await res.json();

  // Pick best available English translation
  const translation =
    data.purohit?.et ||
    data.siva?.et    ||
    data.raman?.et   ||
    data.san?.et     ||
    data.tej?.ht     ||
    '';

  return {
    chapter,
    verse,
    sanskrit:    data.slok || '',
    translation: translation.trim()
  };
}

// ─── Bible — API.Bible (NIV) ───
async function getBibleVerse(seed) {
  const API_KEY = process.env.BIBLE_API_KEY;
  if (!API_KEY) throw new Error('BIBLE_API_KEY not set');

  // Step 1: Ask Gemini to pick a random verse reference
  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const prompt = `Pick a random Bible verse. Seed for randomness: ${seed}.
Spread across all 66 books — Old and New Testament. Not always the famous ones.
Respond with ONLY valid JSON, no markdown:
{"bookId":"<API.Bible 3-letter code e.g. JHN MAT PSA ROM GEN ISA PRV>","bookName":"<full name>","chapter":<number>,"verse":<number>}`;

  const geminiRes = await fetch(geminiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 80, temperature: 1.3 }
    })
  });
  const geminiData = await geminiRes.json();
  let refText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
  refText = refText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const ref = JSON.parse(refText);

  // Step 2: Fetch exact verse text from API.Bible (try NIV first, fallback to KJV)
  const verseId  = `${ref.bookId}.${ref.chapter}.${ref.verse}`;
  const params   = new URLSearchParams({
    'content-type': 'text',
    'include-notes': 'false',
    'include-titles': 'false',
    'include-chapter-numbers': 'false',
    'include-verse-numbers': 'false'
  });

  let verseText = '';
  for (const bibleId of [BIBLE_IDS.NIV, BIBLE_IDS.KJV, BIBLE_IDS.AMP]) {
    try {
      const bibleRes = await fetch(
        `https://api.scripture.api.bible/v1/bibles/${bibleId}/verses/${verseId}?${params}`,
        { headers: { 'api-key': API_KEY } }
      );
      const bibleData = await bibleRes.json();
      verseText = bibleData.data?.content?.trim();
      if (verseText) break;
    } catch { continue; }
  }

  if (!verseText) throw new Error('Could not fetch verse text from API.Bible');

  return {
    ref:         `${ref.bookName} ${ref.chapter}:${ref.verse}`,
    chapter:     ref.chapter,
    verse:       ref.verse,
    sanskrit:    '',
    translation: verseText
  };
}

// ─── Tier 2: Gemini AI fallback (when real APIs fail) ───
async function getGeminiVerse(source, seed) {
  const isBible = source === 'Bible';
  const prompt = isBible
    ? `Return a random Bible verse as JSON. Seed: ${seed}. ONLY JSON, no markdown:
{"ref":"<Book Chapter:Verse>","chapter":<n>,"verse":<n>,"sanskrit":"","translation":"<exact verse text>"}`
    : `Return a random Bhagavad Gita verse as JSON. Seed: ${seed}. ONLY JSON, no markdown:
{"chapter":<n>,"verse":<n>,"sanskrit":"<Devanagari>","translation":"<English meaning>"}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 300, temperature: 1.2 }
    })
  });
  const data = await res.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const verse = JSON.parse(text);
  if (!verse.translation) throw new Error('Invalid Gemini response');
  return verse;
}

// ─── Tier 3: Hardcoded fallbacks (always works, no network needed) ───
function gitaFallback() {
  const options = [
    { chapter: 2, verse: 47, sanskrit: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥', translation: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.' },
    { chapter: 6, verse: 5,  sanskrit: 'उद्धरेदात्मनात्मानं नात्मानमवसादयेत्।\nआत्मैव ह्यात्मनो बन्धुरात्मैव रिपुरात्मनः॥', translation: 'Elevate yourself through your own mind, not degrade yourself. The mind is your best friend and your worst enemy.' },
    { chapter: 9, verse: 22, sanskrit: 'अनन्याश्चिन्तयन्तो मां ये जनाः पर्युपासते।\nतेषां नित्याभियुक्तानां योगक्षेमं वहाम्यहम्॥', translation: 'For those who worship Me with devotion, meditating on My form, I carry what they lack and preserve what they have.' },
  ];
  return options[Math.floor(Math.random() * options.length)];
}

function bibleFallback() {
  const options = [
    { ref: 'Philippians 4:13', chapter: 4, verse: 13, sanskrit: '', translation: 'I can do all things through Christ who strengthens me.' },
    { ref: 'Jeremiah 29:11',   chapter: 29, verse: 11, sanskrit: '', translation: 'For I know the plans I have for you, declares the Lord — plans to prosper you and not to harm you, plans to give you hope and a future.' },
    { ref: 'Romans 8:28',      chapter: 8,  verse: 28, sanskrit: '', translation: 'And we know that in all things God works for the good of those who love Him, who have been called according to His purpose.' },
    { ref: 'Isaiah 40:31',     chapter: 40, verse: 31, sanskrit: '', translation: 'But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary.' },
    { ref: 'Psalm 23:1',       chapter: 23, verse: 1,  sanskrit: '', translation: 'The Lord is my shepherd; I shall not want.' },
  ];
  return options[Math.floor(Math.random() * options.length)];
}
