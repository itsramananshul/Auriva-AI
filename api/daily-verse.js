export default async function handler(req, res) {
  const seed   = req.query.seed   || Math.random();
  const source = req.query.source || 'Bhagavad Gita';
  const isBible = source === 'Bible';

  const prompt = isBible
    ? `Return a random Bible verse as a JSON object. Seed: ${seed}.
Rules:
- Pick a genuinely varied verse from across both Old and New Testament
- Do NOT always pick the same famous ones. Explore all books.
- Respond with ONLY valid JSON — no markdown, no code fences, no explanation
- JSON must have exactly these fields:
  {
    "ref": "<Book Chapter:Verse e.g. John 3:16>",
    "chapter": <chapter number>,
    "verse": <verse number>,
    "sanskrit": "",
    "translation": "<The verse text in full, then 1 sentence of context>"
  }`
    : `Return a random verse from the Bhagavad Gita as a JSON object. Seed: ${seed}.
Rules:
- Pick a genuinely random verse spread across all 18 chapters
- Do NOT always pick the famous ones (like 2.47 or 4.7). Explore all chapters.
- Respond with ONLY valid JSON — no markdown, no code fences, no explanation
- JSON must have exactly these fields:
  {
    "chapter": <number>,
    "verse": <number>,
    "sanskrit": "<Devanagari text of the shloka>",
    "translation": "<Clear English translation, 1-3 sentences>"
  }`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 512, temperature: 1.2 }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data?.error?.message || 'Gemini error');

    let text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip markdown code fences if present
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    const verse = JSON.parse(text);

    // Validate shape
    if (!verse.chapter || !verse.verse || !verse.sanskrit || !verse.translation) {
      throw new Error('Invalid verse shape');
    }

    return res.status(200).json(verse);
  } catch (err) {
    if (isBible) {
      const fallbacks = [
        { ref: 'Philippians 4:13', chapter: 4, verse: 13, sanskrit: '', translation: 'I can do all things through Christ who strengthens me.' },
        { ref: 'Jeremiah 29:11',   chapter: 29, verse: 11, sanskrit: '', translation: 'For I know the plans I have for you, declares the Lord — plans to prosper you and not to harm you, plans to give you hope and a future.' },
        { ref: 'Psalm 23:1',       chapter: 23, verse: 1,  sanskrit: '', translation: 'The Lord is my shepherd; I shall not want.' },
        { ref: 'Romans 8:28',      chapter: 8,  verse: 28, sanskrit: '', translation: 'And we know that in all things God works for the good of those who love Him.' },
        { ref: 'Isaiah 40:31',     chapter: 40, verse: 31, sanskrit: '', translation: 'Those who hope in the Lord will renew their strength. They will soar on wings like eagles; they will run and not grow weary.' },
      ];
      return res.status(200).json(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
    }
    const fallbacks = [
      { chapter: 2, verse: 47, sanskrit: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥', translation: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.' },
      { chapter: 4, verse: 7,  sanskrit: 'यदा यदा हि धर्मस्य ग्लानिर्भवति भारत।\nअभ्युत्थानमधर्मस्य तदात्मानं सृजाम्यहम्॥', translation: 'Whenever there is a decline in righteousness, O Arjuna, I manifest Myself on earth.' },
      { chapter: 6, verse: 5,  sanskrit: 'उद्धरेदात्मनात्मानं नात्मानमवसादयेत्।\nआत्मैव ह्यात्मनो बन्धुरात्मैव रिपुरात्मनः॥', translation: 'One must elevate oneself by one\'s own mind, not degrade oneself. The mind alone is one\'s friend and one\'s enemy.' },
    ];
    return res.status(200).json(fallbacks[Math.floor(Math.random() * fallbacks.length)]);
  }
}
