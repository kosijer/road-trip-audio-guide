import { config } from '../../config';
import type { Poi } from '../../types';
import { geminiProvider, type LlmProvider } from './gemini';

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
  return selectProvider().generateNarration({ pois, mode, extras });
}
