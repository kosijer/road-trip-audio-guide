import { config } from '../../config';
import { getNarrationLanguage } from '../../i18n';
import type { Poi } from '../../types';
import { geminiProvider, type LlmProvider } from './gemini';
import { localNarration } from './localFallback';

function selectProvider(): LlmProvider {
  switch (config.llmProvider) {
    case 'gemini':
    default:
      return geminiProvider;
  }
}

export async function generateNarration(
  pois: Poi[],
  mode: 'driving' | 'walking',
  extras: string[] = [],
): Promise<string> {
  if (pois.length === 0) {
    throw new Error('no_pois');
  }
  const language = getNarrationLanguage();
  try {
    return await selectProvider().generateNarration({
      pois,
      mode,
      extras,
      language,
    });
  } catch (error) {
    console.warn('llm narration failed, using local fallback', error);
    return localNarration(pois, mode, extras, language);
  }
}
