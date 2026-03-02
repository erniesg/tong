export const runtime = 'nodejs';
export const maxDuration = 15;

/**
 * Free batch translation via Google Translate (no API key needed).
 * Sends words joined by newlines, parses the response.
 */

const LANG_CODES: Record<string, string> = {
  en: 'en',
  zh: 'zh-CN',
  ja: 'ja',
  ko: 'ko',
};

async function googleTranslate(text: string, from: string, to: string): Promise<string> {
  const sl = LANG_CODES[from] ?? from;
  const tl = LANG_CODES[to] ?? to;
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Translate returned ${res.status}`);

  const data = await res.json();
  // Response shape: [[["translated","original",null,null,N], ...], ...]
  // Concatenate all translated segments
  const segments = data?.[0] as Array<[string, ...unknown[]]> | undefined;
  if (!segments) return text;
  return segments.map((seg) => seg[0]).join('');
}

export async function POST(req: Request) {
  const body = await req.json();
  const { words, from, to } = body as {
    words: string[];
    from: string;
    to: string;
  };

  if (!words?.length || !from || !to) {
    return Response.json({ error: 'Missing words, from, or to' }, { status: 400 });
  }

  const batch = words.slice(0, 30);

  try {
    // Join words with newline separator, translate in one call, then split
    const joined = batch.join('\n');
    const translated = await googleTranslate(joined, from, to);
    const parts = translated.split('\n');

    const result: Record<string, string> = {};
    for (let i = 0; i < batch.length; i++) {
      result[batch[i]] = (parts[i] ?? '').trim();
    }

    return Response.json({ translations: result });
  } catch (e) {
    console.error('[translate] error:', e);
    return Response.json({ translations: {} }, { status: 200 });
  }
}
