const GITA_VERSE_COUNTS = [47,72,43,42,29,47,30,28,34,42,55,20,35,27,20,24,28,78];

const QURAN_SURAH_COUNTS = [
  7,286,200,176,120,165,206,75,129,109,
  123,111,43,52,99,128,111,110,98,135,
  112,78,118,64,77,227,93,88,69,60,
  34,30,73,54,45,83,182,88,75,85,
  54,53,89,59,37,35,38,29,18,45,
  60,49,62,55,78,96,29,22,24,13,
  14,11,11,18,12,12,30,52,52,44,
  28,28,20,56,40,31,50,22,31,13,
  28,14,27,18,17,24,20,22,23,17,
  22,13,4,31,9,11,13,11,10,11,
  19,12,4,4,6,7,5,4,5,4,6,7,3,6,3,4,4,3,6,3
];

// API.Bible IDs for added translations
const BIBLE_IDS = {
  NIV: '78a9f6124f344018-01',
  KJV: 'de4e12af7f28f599-02',
  AMP: '7142879509583d59-01'
};

export default async function handler(req, res) {
  const seed   = req.query.seed   || Math.random();
  const source = req.query.source || 'Bhagavad Gita';

  // Tier 1: Real scripture API (where available)
  try {
    let verse;
    if (source === 'Guru Granth Sahib') verse = await getSikhVerse();
    else if (source === 'Quran')        verse = await getQuranVerse();
    else if (source === 'Bible')        verse = await getBibleVerse(seed);
    else if (source === 'Bhagavad Gita')verse = await getGitaVerse();
    else                                throw new Error('No Tier 1 API for this source');
    return res.status(200).json(verse);
  } catch (err) {
    console.error('[daily-verse] Tier 1 failed:', err.message);
  }

  // Tier 2: Gemini AI generation (handles all sources including new religions)
  try {
    const verse = await getGeminiVerse(source, seed);
    return res.status(200).json(verse);
  } catch (err) {
    console.error('[daily-verse] Gemini fallback failed:', err.message);
  }

  // Tier 3: Hardcoded fallback — always works
  return res.status(200).json(getHardcodedFallback(source));
}

// ─── Guru Granth Sahib — api.gurbaninow.com (free, no API key) ───
async function getSikhVerse() {
  const res = await fetch('https://api.gurbaninow.com/v2/shabad/random');
  if (!res.ok) throw new Error(`GurbaniNow API ${res.status}`);
  const data = await res.json();

  const lines = data.shabad;
  if (!lines?.length) throw new Error('No lines in shabad');

  const valid = lines.filter(l =>
    l.line?.gurmukhi?.unicode?.trim() &&
    l.line?.translation?.english?.default?.trim()
  );
  if (!valid.length) throw new Error('No valid lines found');

  const line = valid[Math.floor(Math.random() * valid.length)].line;
  const page = data.shabadinfo?.pageno || '';

  return {
    ref:         `Guru Granth Sahib${page ? `, Ang ${page}` : ''}`,
    chapter:     page || 1,
    verse:       1,
    sanskrit:    line.gurmukhi.unicode,
    translation: line.translation.english.default
  };
}

// ─── Quran — alquran.cloud (free, no API key) ───
async function getQuranVerse() {
  const surah = Math.floor(Math.random() * 114) + 1;
  const maxV  = QURAN_SURAH_COUNTS[surah - 1];
  const ayah  = Math.floor(Math.random() * maxV) + 1;

  const res = await fetch(
    `https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/editions/quran-uthmani,en.sahih`
  );
  if (!res.ok) throw new Error(`Quran API ${res.status}`);
  const data = await res.json();

  if (data.code !== 200 || !data.data?.length) throw new Error('Invalid Quran API response');

  const arabic  = data.data[0];
  const english = data.data[1];

  return {
    ref:         `Surah ${arabic.surah.englishName} ${surah}:${ayah}`,
    chapter:     surah,
    verse:       ayah,
    sanskrit:    arabic.text,
    translation: english.text
  };
}

// ─── Bhagavad Gita — vedicscriptures.github.io ───
async function getGitaVerse() {
  const chapter = Math.floor(Math.random() * 18) + 1;
  const maxV    = GITA_VERSE_COUNTS[chapter - 1];
  const verse   = Math.floor(Math.random() * maxV) + 1;

  const res = await fetch(`https://vedicscriptures.github.io/slok/${chapter}/${verse}/`);
  if (!res.ok) throw new Error(`Gita API ${res.status}`);
  const data = await res.json();

  const isValid = t => t && !t.toLowerCase().includes('did not comment') && t.trim().length > 10;
  const translation =
    (isValid(data.purohit?.et) ? data.purohit.et : null) ||
    (isValid(data.siva?.et)    ? data.siva.et    : null) ||
    (isValid(data.raman?.et)   ? data.raman.et   : null) ||
    (isValid(data.san?.et)     ? data.san.et     : null) ||
    (isValid(data.tej?.ht)     ? data.tej.ht     : null) ||
    '';

  if (!translation.trim()) throw new Error('No valid translation for this verse — retry');

  return {
    chapter,
    verse,
    sanskrit:    data.slok || '',
    translation: translation.trim()
  };
}

// ─── Bible — API.Bible ───
async function getBibleVerse(seed) {
  const API_KEY = process.env.BIBLE_API_KEY;
  if (!API_KEY) throw new Error('BIBLE_API_KEY not set');

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

  const verseId = `${ref.bookId}.${ref.chapter}.${ref.verse}`;
  const params  = new URLSearchParams({
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

// ─── Tier 2: Gemini AI generation (handles ALL sources) ───
async function getGeminiVerse(source, seed) {
  const prompts = {
    'Shiva Purana':
      `Return a meaningful verse or teaching from the Shiva Purana as JSON. Seed: ${seed}. ONLY JSON, no markdown:\n{"ref":"Shiva Purana, <section/chapter>","chapter":1,"verse":1,"sanskrit":"<Sanskrit Devanagari verse if applicable, else empty string>","translation":"<English meaning>"}`,
    'Devi Mahatmya':
      `Return a meaningful verse from the Devi Mahatmya (Durga Saptashati) as JSON. Seed: ${seed}. ONLY JSON, no markdown:\n{"ref":"Devi Mahatmya, Chapter <n>:<verse>","chapter":<n>,"verse":<n>,"sanskrit":"<Sanskrit Devanagari>","translation":"<English meaning>"}`,
    'Ramayana':
      `Return a meaningful verse or teaching from the Ramayana (Valmiki or Tulsidas) as JSON. Seed: ${seed}. ONLY JSON, no markdown:\n{"ref":"Ramayana, <Kanda> <chapter>:<verse>","chapter":1,"verse":1,"sanskrit":"<Sanskrit or Awadhi verse>","translation":"<English meaning>"}`,
    'Dhammapada':
      `Return a random verse from the Dhammapada (Buddhist scripture) as JSON. Seed: ${seed}. Spread across all 26 chapters. ONLY JSON, no markdown:\n{"ref":"Dhammapada <chapter>:<verse>","chapter":<n>,"verse":<n>,"sanskrit":"<Pali original>","translation":"<English meaning>"}`,
    'Tao Te Ching':
      `Return a passage from the Tao Te Ching by Laozi as JSON. Seed: ${seed}. Spread across all 81 chapters. ONLY JSON, no markdown:\n{"ref":"Tao Te Ching, Chapter <n>","chapter":<n>,"verse":1,"sanskrit":"<Classical Chinese text>","translation":"<English rendering>"}`,
    'Torah':
      `Return a meaningful verse from the Hebrew Bible / Torah (include Psalms, Proverbs, Isaiah, Job, etc.) as JSON. Seed: ${seed}. ONLY JSON, no markdown:\n{"ref":"<Book Chapter:Verse>","chapter":<n>,"verse":<n>,"sanskrit":"","translation":"<English verse text>"}`,
    'Agamas':
      `Return a meaningful teaching or verse from the Jain Agamas (Acaranga Sutra, Uttaradhyayana Sutra, Tattvartha Sutra, etc.) as JSON. Seed: ${seed}. ONLY JSON, no markdown:\n{"ref":"<Text name>, <chapter if applicable>","chapter":1,"verse":1,"sanskrit":"<Prakrit or Sanskrit original if available, else empty string>","translation":"<English meaning>"}`,
    'Analects':
      `Return a meaningful passage from the Analects of Confucius as JSON. Seed: ${seed}. Spread across all 20 books. ONLY JSON, no markdown:\n{"ref":"Analects <book>:<chapter>","chapter":<book>,"verse":<chapter>,"sanskrit":"<Classical Chinese>","translation":"<English rendering>"}`,
    'Kitab-i-Aqdas':
      `Return a meaningful verse or passage from the writings of Bahá'u'lláh (Kitáb-i-Aqdas, Hidden Words, Gleanings, etc.) as JSON. Seed: ${seed}. ONLY JSON, no markdown:\n{"ref":"<Text name>, verse/paragraph <n>","chapter":1,"verse":1,"sanskrit":"","translation":"<English text>"}`
  };

  // Default Gemini prompt (covers Quran, Bible, Sikh, Gita if somehow they reach here)
  const prompt = prompts[source] ||
    (source === 'Guru Granth Sahib'
      ? `Return a random line from the Guru Granth Sahib as JSON. Seed: ${seed}. ONLY JSON, no markdown:\n{"ref":"Guru Granth Sahib, Ang <pageNumber>","chapter":<pageNumber>,"verse":1,"sanskrit":"<Gurmukhi unicode text>","translation":"<English meaning>"}`
      : source === 'Quran'
      ? `Return a random Quran ayah as JSON. Seed: ${seed}. ONLY JSON, no markdown:\n{"ref":"Surah <EnglishName> <surahNumber>:<ayahNumber>","chapter":<surahNum>,"verse":<ayahNum>,"sanskrit":"<Arabic text>","translation":"<English meaning>"}`
      : source === 'Bible'
      ? `Return a random Bible verse as JSON. Seed: ${seed}. ONLY JSON, no markdown:\n{"ref":"<Book Chapter:Verse>","chapter":<n>,"verse":<n>,"sanskrit":"","translation":"<exact verse text>"}`
      : `Return a random Bhagavad Gita verse as JSON. Seed: ${seed}. ONLY JSON, no markdown:\n{"chapter":<n>,"verse":<n>,"sanskrit":"<Devanagari>","translation":"<English meaning>"}`
    );

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

// ─── Tier 3: Hardcoded fallbacks (always work, no network) ───
function getHardcodedFallback(source) {
  const fallbacks = {
    'Guru Granth Sahib': [
      { ref: 'Guru Granth Sahib, Ang 1',   chapter: 1,   verse: 1, sanskrit: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ', translation: 'One Universal Creator God. The Name Is Truth. Creative Being Personified. No Fear. No Hatred.' },
      { ref: 'Guru Granth Sahib, Ang 2',   chapter: 2,   verse: 1, sanskrit: 'ਸੋਚੈ ਸੋਚਿ ਨ ਹੋਵਈ ਜੇ ਸੋਚੀ ਲਖ ਵਾਰ', translation: 'By thinking, He cannot be reduced to thought, even by thinking hundreds of thousands of times.' },
      { ref: 'Guru Granth Sahib, Ang 349', chapter: 349, verse: 1, sanskrit: 'ਭੈ ਕਾਹੂ ਕਉ ਦੇਤ ਨਹਿ ਨਹਿ ਭੈ ਮਾਨਤ ਆਨ', translation: 'One who does not frighten anyone, and who is not afraid of anyone — that person is called a true devotee of God.' },
    ],
    'Quran': [
      { ref: 'Surah Al-Baqarah 2:286', chapter: 2,  verse: 286, sanskrit: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا', translation: 'Allah does not burden a soul beyond that it can bear.' },
      { ref: 'Surah Ash-Sharh 94:5',   chapter: 94, verse: 5,   sanskrit: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا',                translation: 'For indeed, with hardship will be ease.' },
      { ref: 'Surah Az-Zumar 39:53',   chapter: 39, verse: 53,  sanskrit: 'إِنَّ اللَّهَ يَغْفِرُ الذُّنُوبَ جَمِيعًا',    translation: 'Indeed, Allah forgives all sins. Indeed, it is He who is the Forgiving, the Merciful.' },
    ],
    'Bible': [
      { ref: 'Philippians 4:13', chapter: 4,  verse: 13, sanskrit: '', translation: 'I can do all things through Christ who strengthens me.' },
      { ref: 'Jeremiah 29:11',   chapter: 29, verse: 11, sanskrit: '', translation: 'For I know the plans I have for you, declares the Lord — plans to prosper you and not to harm you, plans to give you hope and a future.' },
      { ref: 'Isaiah 40:31',     chapter: 40, verse: 31, sanskrit: '', translation: 'But those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary.' },
    ],
    'Dhammapada': [
      { ref: 'Dhammapada 1:1', chapter: 1, verse: 1, sanskrit: 'Mano pubbaṅgamā dhammā, manoseṭṭhā manomayā.', translation: 'Mind is the forerunner of all actions. All deeds are led by mind, created by mind.' },
      { ref: 'Dhammapada 1:2', chapter: 1, verse: 2, sanskrit: 'Manasā ce paduṭṭhena bhāsati vā karoti vā, tato naṃ dukkhamanveti.', translation: 'If one speaks or acts with a corrupt mind, suffering follows, as the wheel follows the hoof of an ox.' },
      { ref: 'Dhammapada 5:1', chapter: 5, verse: 60, sanskrit: 'Dīghā jāgarato ratti, dīghaṃ santassa yojanaṃ.', translation: 'Long is the night to the wakeful; long is the road to the weary; long is the round of rebirth to the foolish who know not the true teaching.' },
      { ref: 'Dhammapada 20:4', chapter: 20, verse: 276, sanskrit: 'Tumhehi kiccamātappaṃ, akkhātāro Tathāgatā.', translation: 'You yourself must make the effort. The Buddhas only show the way.' },
    ],
    'Tao Te Ching': [
      { ref: 'Tao Te Ching, Chapter 1',  chapter: 1,  verse: 1, sanskrit: '道可道，非常道。名可名，非常名。', translation: 'The Tao that can be told is not the eternal Tao. The name that can be named is not the eternal name.' },
      { ref: 'Tao Te Ching, Chapter 8',  chapter: 8,  verse: 1, sanskrit: '上善若水。水善利萬物而不爭。', translation: 'The highest good is like water. Water benefits all things and does not compete.' },
      { ref: 'Tao Te Ching, Chapter 16', chapter: 16, verse: 1, sanskrit: '致虛極，守靜篤。萬物並作，吾以觀復。', translation: 'Achieve emptiness to the utmost. Hold stillness with full sincerity. The ten thousand things rise and fall — I watch their return.' },
      { ref: 'Tao Te Ching, Chapter 33', chapter: 33, verse: 1, sanskrit: '知人者智，自知者明。勝人者有力，自勝者強。', translation: 'Knowing others is wisdom. Knowing yourself is enlightenment. Overcoming others takes force. Overcoming yourself takes true strength.' },
    ],
    'Torah': [
      { ref: 'Psalms 23:1',      chapter: 23, verse: 1,  sanskrit: '', translation: 'The Lord is my shepherd; I shall not want.' },
      { ref: 'Proverbs 3:5-6',   chapter: 3,  verse: 5,  sanskrit: '', translation: 'Trust in the Lord with all your heart and lean not on your own understanding. In all your ways acknowledge Him, and He will make your paths straight.' },
      { ref: 'Isaiah 40:31',     chapter: 40, verse: 31, sanskrit: '', translation: 'Those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary.' },
      { ref: 'Deuteronomy 31:6', chapter: 31, verse: 6,  sanskrit: '', translation: 'Be strong and courageous. Do not be afraid or terrified, for the Lord your God goes with you; He will never leave you nor forsake you.' },
    ],
    'Agamas': [
      { ref: 'Uttaradhyayana Sutra 1:13', chapter: 1, verse: 13, sanskrit: '', translation: 'A man is not noble who injures living beings; he is called noble who is kind to all living beings.' },
      { ref: 'Acaranga Sutra 1.4.1',      chapter: 1, verse: 1,  sanskrit: '', translation: 'All living beings desire to live. No one wants to die. Therefore, do not take any life out of cruelty.' },
      { ref: 'Tattvartha Sutra 5.21',     chapter: 5, verse: 21, sanskrit: '', translation: 'Parasparopagraho jīvānām — souls render service to one another.' },
      { ref: 'Uttaradhyayana Sutra 28',   chapter: 28, verse: 1, sanskrit: '', translation: 'The soul is the maker and the non-maker, and itself makes happiness and misery.' },
    ],
    'Analects': [
      { ref: 'Analects 1:1',  chapter: 1, verse: 1,  sanskrit: '學而時習之，不亦說乎？', translation: 'Is it not pleasant to learn with a constant perseverance and application? Is it not delightful to have friends coming from distant quarters?' },
      { ref: 'Analects 4:5',  chapter: 4, verse: 5,  sanskrit: '富與貴，是人之所欲也；不以其道得之，不處也。', translation: 'Riches and honours are what people desire. But if they cannot be obtained in the right way, they should not be held.' },
      { ref: 'Analects 15:24',chapter: 15, verse: 24, sanskrit: '己所不欲，勿施於人。', translation: 'What you do not want done to yourself, do not do to others.' },
      { ref: 'Analects 2:4',  chapter: 2, verse: 4,  sanskrit: '吾日三省吾身。', translation: 'I daily examine myself on three points: whether I have been faithful in doing for others; whether I have been sincere with friends; whether I have mastered and practised what I was taught.' },
    ],
    'Kitab-i-Aqdas': [
      { ref: 'Hidden Words, Arabic 2',   chapter: 1, verse: 1, sanskrit: '', translation: 'O Son of Spirit! The best beloved of all things in My sight is Justice. Turn not away therefrom if thou desirest Me, and neglect it not that I may confide in thee.' },
      { ref: 'Hidden Words, Persian 32', chapter: 1, verse: 2, sanskrit: '', translation: 'O Son of the Supreme! I have made death a messenger of joy to thee. Wherefore dost thou grieve? I made the light to shed on thee its splendour. Why dost thou veil thyself therefrom?' },
      { ref: 'Gleanings, CLIII',         chapter: 2, verse: 1, sanskrit: '', translation: 'Be generous in prosperity, and thankful in adversity. Be worthy of the trust of thy neighbor, and look upon him with a bright and friendly face.' },
      { ref: 'Kitáb-i-Aqdas, verse 2',  chapter: 1, verse: 3, sanskrit: '', translation: 'The first duty prescribed by God for His servants is the recognition of Him Who is the Dayspring of His Revelation and the Fountain of His laws.' },
    ],
  };

  // Hindu sources that don't have specific Tier 1 APIs — use Gita fallbacks
  const gitaFallbacks = [
    { chapter: 2, verse: 47, sanskrit: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥', translation: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.' },
    { chapter: 6, verse: 5,  sanskrit: 'उद्धरेदात्मनात्मानं नात्मानमवसादयेत्।', translation: 'Elevate yourself through the power of your mind, and do not degrade yourself. The mind is your best friend and your worst enemy.' },
    { chapter: 9, verse: 22, sanskrit: 'अनन्याश्चिन्तयन्तो मां ये जनाः पर्युपासते।', translation: 'For those who worship Me with devotion, meditating on My form, I carry what they lack and preserve what they have.' },
  ];

  const options = fallbacks[source] || gitaFallbacks;
  return options[Math.floor(Math.random() * options.length)];
}
