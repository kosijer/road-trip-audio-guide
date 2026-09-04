import { config } from '../../config';
import { fetchJson } from '../http';
import type { Poi } from '../../types';

export interface LlmProvider {
  generateNarration(input: {
    pois: Poi[];
    mode: 'driving' | 'walking';
    extras?: string[];
  }): Promise<string>;
}

function extractText(payload: {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
}): string {
  const parts = payload.candidates?.[0]?.content?.parts ?? [];
  return parts
    .map(part => part.text)
    .filter((text): text is string => Boolean(text))
    .join('\n')
    .trim();
}

function buildPrompt(
  pois: Poi[],
  mode: 'driving' | 'walking',
  extras: string[] = [],
): string {
  const poiBlock = pois
    .map((poi, index) => {
      const facts = poi.wikidataFacts
        ? Object.entries(poi.wikidataFacts)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
        : '';
      return [
        `#${index + 1} ${poi.title}`,
        `category: ${poi.category ?? poi.source}`,
        `distance_m: ${Math.round(poi.distanceM ?? 0)}`,
        facts && `facts: ${facts}`,
        poi.hoursCaveat && `hours: ${poi.hoursCaveat}`,
        poi.weatherCaveat && `weather: ${poi.weatherCaveat}`,
        `summary: ${poi.summary.slice(0, 900)}`,
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n');

  const length =
    mode === 'driving'
      ? 'Write one narration about a single most interesting place, 30-60 seconds spoken (roughly 80-140 words).'
      : 'Write one narration covering the 1-3 most interesting nearby places, 30-60 seconds spoken.';

  return `You are an in-car audio guide speaking to a passenger in Serbian.
${length}
Use natural spoken Serbian (Latin script preferred). No markdown, no bullet points, no title, no English.
If a place is closed, say so clearly and do not recommend going inside.
If there is rain, mention it before recommending outdoor sites.
Do not invent precise dates or facts that are not in the source text.
${extras.length ? `Additional context: ${extras.join(' ')}` : ''}

Source places:
${poiBlock}`;
}

export const geminiProvider: LlmProvider = {
  async generateNarration({ pois, mode, extras }) {
    if (!config.geminiApiKey) {
      throw new Error('missing_gemini_key');
    }
    const payload = await fetchJson<{
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    }>(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.geminiApiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildPrompt(pois, mode, extras) }] }],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
      25_000,
    );
    const text = extractText(payload);
    if (!text) {
      throw new Error(payload.error?.message || 'empty_narration');
    }
    return text;
  },
};
