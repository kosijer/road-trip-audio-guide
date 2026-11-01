import { config } from '../../config';
import type { AppLanguage } from '../../i18n/types';
import { getNarrationLanguage } from '../../i18n';
import type { SessionMood } from '../../preferences';
import { fetchJson, HttpError } from '../http';
import type { Poi } from '../../types';

export interface LlmProvider {
  generateNarration(input: {
    pois: Poi[];
    mode: 'driving' | 'walking';
    extras?: string[];
    language?: AppLanguage;
    mood?: SessionMood;
  }): Promise<string>;
}

/**
 * Prefer lite models: `gemini-flash-latest` is often 503/timeout under free-tier load.
 * Primary can be overridden with GEMINI_MODEL in `.env`.
 */
const FALLBACK_MODELS = [
  'gemini-flash-lite-latest',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
];

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

function languageInstructions(language: AppLanguage): string {
  if (language === 'sr') {
    return 'Speak to the listener in Serbian (Latin script preferred). No English in the spoken script.';
  }
  return 'Speak to the listener in clear natural English.';
}

function modeInstructions(mode: 'driving' | 'walking'): string {
  if (mode === 'driving') {
    return [
      'Mode: driving — the listener is a car passenger.',
      'Write one narration about a single most interesting place, 30-60 seconds spoken (roughly 80-140 words).',
      'You may say we are driving past / coming up on the place.',
      'Do not tell them to get out and walk unless the place is a clear stop.',
    ].join('\n');
  }
  return [
    'Mode: walking — the listener is on foot exploring nearby (Around mode).',
    'Write one narration covering the 1-3 most interesting nearby places, 30-60 seconds spoken.',
    'Speak as a walking guide: "as you walk", "nearby", "from here", "on foot".',
    'Never mention driving, cars, passengers, "drive by", "driving past", or "from the road".',
  ].join('\n');
}

function moodInstructions(mood: SessionMood | undefined): string {
  if (mood === 'nature') {
    return 'Session mood: nature — emphasize landscape, outdoors, parks, views, and atmosphere. Keep history brief unless it is essential.';
  }
  if (mood === 'history') {
    return 'Session mood: history — lean into historical context, eras, and notable events.';
  }
  if (mood === 'surprise') {
    return 'Session mood: surprise — keep the tone curious and unexpected; avoid the most obvious tourist spiel.';
  }
  return '';
}

function buildPrompt(
  pois: Poi[],
  mode: 'driving' | 'walking',
  extras: string[] = [],
  language: AppLanguage = 'en',
  mood?: SessionMood,
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

  const moodLine = moodInstructions(mood);

  return `You are a mobile audio travel guide.
${languageInstructions(language)}
${modeInstructions(mode)}
${moodLine}
No markdown, no bullet points, no title.
If a place is closed, say so clearly and do not recommend going inside.
Only mention rain or weather if Additional context explicitly says so. Never invent weather, rain, or current conditions.
Do not invent precise dates or facts that are not in the source text.
${extras.length ? `Additional context: ${extras.join(' ')}` : ''}

Source places:
${poiBlock}`;
}

function modelCandidates(): string[] {
  const preferred = (config.geminiModel || '').trim();
  const ordered = preferred
    ? [preferred, ...FALLBACK_MODELS.filter(m => m !== preferred)]
    : FALLBACK_MODELS;
  return ordered;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) {
    return error.status === 429 || error.status === 503 || error.status === 500;
  }
  const message = String(error);
  return /AbortError|aborted|timeout|network/i.test(message);
}

async function callGemini(model: string, prompt: string): Promise<string> {
  const payload = await fetchJson<{
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message?: string };
  }>(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.7,
        },
      }),
    },
    45_000,
  );
  const text = extractText(payload);
  if (!text) {
    throw new Error(payload.error?.message || 'empty_narration');
  }
  return text;
}

export const geminiProvider: LlmProvider = {
  async generateNarration({ pois, mode, extras, language, mood }) {
    if (!config.geminiApiKey) {
      throw new Error('missing_gemini_key');
    }
    const prompt = buildPrompt(
      pois,
      mode,
      extras,
      language ?? getNarrationLanguage(),
      mood,
    );
    const models = modelCandidates();
    let lastError: unknown;

    for (const model of models) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const text = await callGemini(model, prompt);
          console.log('gemini ok', model, `attempt=${attempt + 1}`);
          return text;
        } catch (error) {
          lastError = error;
          console.warn('gemini attempt failed', model, attempt + 1, error);
          if (!isRetryable(error) || attempt === 1) {
            break;
          }
          await sleep(800 * (attempt + 1));
        }
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(String(lastError || 'gemini_failed'));
  },
};
