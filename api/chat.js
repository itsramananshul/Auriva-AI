// Edge runtime — no timeout, streams tokens as Gemini generates them
export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { contents, systemPrompt } = await req.json();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`;

  const geminiRes = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: { maxOutputTokens: 8192, temperature: 0.85 }
    })
  });

  if (!geminiRes.ok) {
    const err = await geminiRes.json().catch(() => ({}));
    return new Response(
      JSON.stringify({ error: err?.error?.message || 'Gemini error' }),
      { status: geminiRes.status, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parse Gemini SSE and forward only the text to the client
  const encoder = new TextEncoder();
  const stream  = new ReadableStream({
    async start(controller) {
      const reader  = geminiRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;
            try {
              const json = JSON.parse(data);
              const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
              if (text) controller.enqueue(encoder.encode(text));
            } catch {}
          }
        }
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' }
  });
}
