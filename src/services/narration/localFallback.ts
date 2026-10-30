import type { AppLanguage } from '../../i18n/types';
import { getNarrationLanguage } from '../../i18n';
import type { Poi } from '../../types';

/**
 * Offline / Gemini-outage narration.
 * Not as polished as the LLM script, but keeps the demo usable when
 * Google returns 503 high-demand errors.
 */
export function localNarration(
  pois: Poi[],
  mode: 'driving' | 'walking',
  extras: string[] = [],
  language: AppLanguage = getNarrationLanguage(),
): string {
  const picked = mode === 'driving' ? pois.slice(0, 1) : pois.slice(0, 3);
  const copy = language === 'sr' ? srCopy : enCopy;

  if (picked.length === 0) {
    return copy.empty;
  }

  const parts: string[] = [];
  if (extras.length) {
    parts.push(extras.join(' '));
  }

  if (picked.length === 1) {
    const poi = picked[0];
    parts.push(copy.nearbyOne(poi.title));
    parts.push(summarize(poi.summary, copy.noDetail));
    if (poi.hoursCaveat) {
      parts.push(poi.hoursCaveat);
    }
    if (poi.weatherCaveat) {
      parts.push(poi.weatherCaveat);
    }
    parts.push(copy.closingOne);
    return parts.filter(Boolean).join(' ');
  }

  parts.push(copy.nearbyMany);
  picked.forEach((poi, index) => {
    const lead = copy.leads[Math.min(index, copy.leads.length - 1)];
    parts.push(`${lead}, ${poi.title}. ${summarize(poi.summary, copy.noDetail)}`);
    if (poi.hoursCaveat) {
      parts.push(poi.hoursCaveat);
    }
  });
  parts.push(copy.closingMany);
  return parts.filter(Boolean).join(' ');
}

const enCopy = {
  empty: 'I do not have enough nearby place data for a story right now.',
  nearbyOne: (title: string) => `Nearby is ${title}.`,
  nearbyMany: 'There are a few interesting places nearby.',
  leads: ['First', 'Next', 'Also'],
  closingOne: 'That is all for this place for now.',
  closingMany: 'Those are places worth keeping in mind while you are here.',
  noDetail: 'I do not have more detail at hand.',
};

const srCopy = {
  empty: 'U blizini trenutno nemam dovoljno podataka za priču.',
  nearbyOne: (title: string) => `U blizini je ${title}.`,
  nearbyMany: 'U okolini ima nekoliko zanimljivih mesta.',
  leads: ['Prvo', 'Zatim', 'I još'],
  closingOne: 'To je za sada sve o ovom mestu.',
  closingMany: 'To su mesta koja vredi imati na umu dok ste ovuda.',
  noDetail: 'Nemam više detalja pri ruci.',
};

function summarize(summary: string, empty: string): string {
  const cleaned = summary.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return empty;
  }
  if (cleaned.length <= 280) {
    return cleaned;
  }
  const cut = cleaned.slice(0, 280);
  const lastStop = Math.max(
    cut.lastIndexOf('. '),
    cut.lastIndexOf('! '),
    cut.lastIndexOf('? '),
  );
  if (lastStop > 120) {
    return cut.slice(0, lastStop + 1).trim();
  }
  return `${cut.trim()}…`;
}
