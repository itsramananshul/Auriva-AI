export default async function handler(req, res) {
  // Random seed passed from client to encourage variety
  const seed = req.query.seed || Math.random();

  const prompt = `Return a random verse from the Bhagavad Gita as a JSON object. The seed for randomness is: ${seed}.

Rules:
- Pick a genuinely random verse spread across all 18 chapters
- Do NOT always pick the famous ones (like 2.47 or 4.7). Explore all chapters.
- Respond with ONLY a valid JSON object — no markdown, no code fences, no explanation
- The JSON must have exactly these fields:
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
    // Hard fallback — at least return something different-looking each run
    const fallbacks = [
      { chapter: 2, verse: 47, sanskrit: 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन।\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि॥', translation: 'You have a right to perform your prescribed duties, but you are not entitled to the fruits of your actions.' },
      { chapter: 4, verse: 7, sanskrit: 'यदा यदा हि धर्मस्य ग्लानिर्भवति भारत।\nअभ्युत्थानमधर्मस्य तदात्मानं सृजाम्यहम्॥', translation: 'Whenever there is a decline in righteousness and an increase in unrighteousness, O Arjuna, at that time I manifest Myself on earth.' },
      { chapter: 3, verse: 27, sanskrit: 'प्रकृतेः क्रियमाणानि गुणैः कर्माणि सर्वशः।\nअहङ्कारविमूढात्मा कर्ताहमिति मन्यते॥', translation: 'All actions are performed by the modes of material nature, yet the deluded soul, confused by ego, thinks: I am the doer.' },
      { chapter: 6, verse: 5, sanskrit: 'उद्धरेदात्मनात्मानं नात्मानमवसादयेत्।\nआत्मैव ह्यात्मनो बन्धुरात्मैव रिपुरात्मनः॥', translation: 'One must elevate oneself by one\'s own mind, not degrade oneself. The mind alone is one\'s friend and one\'s enemy.' },
      { chapter: 9, verse: 22, sanskrit: 'अनन्याश्चिन्तयन्तो मां ये जनाः पर्युपासते।\nतेषां नित्याभियुक्तानां योगक्षेमं वहाम्यहम्॥', translation: 'For those who worship Me with devotion, meditating on My transcendental form, I carry what they lack and preserve what they have.' },
    ];
    const pick = fallbacks[Math.floor(Math.random() * fallbacks.length)];
    return res.status(200).json(pick);
  }
}
