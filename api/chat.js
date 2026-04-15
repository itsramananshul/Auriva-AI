export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { contents, systemPrompt } = req.body;
  if (!contents?.length) return res.status(400).json({ error: 'Missing contents' });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 8192, temperature: 0.85 }
    })
  });

  const data = await response.json();
  if (!response.ok) {
    return res.status(response.status).json({
      error: data?.error?.message || `Gemini error ${response.status}`
    });
  }
  return res.status(200).json(data);
}
