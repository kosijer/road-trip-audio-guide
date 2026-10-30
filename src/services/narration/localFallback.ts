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
): string {
  const picked = mode === 'driving' ? pois.slice(0, 1) : pois.slice(0, 3);
  if (picked.length === 0) {
    return 'U blizini trenutno nemam dovoljno podataka za priču.';
  }

  const parts: string[] = [];
  if (extras.length) {
    parts.push(extras.join(' '));
  }

  if (picked.length === 1) {
    const poi = picked[0];
    parts.push(`U blizini je ${poi.title}.`);
    parts.push(summarize(poi.summary));
    if (poi.hoursCaveat) {
      parts.push(poi.hoursCaveat);
    }
    if (poi.weatherCaveat) {
      parts.push(poi.weatherCaveat);
    }
    parts.push('To je za sada sve o ovom mestu.');
    return parts.filter(Boolean).join(' ');
  }

  parts.push('U okolini ima nekoliko zanimljivih mesta.');
  picked.forEach((poi, index) => {
    const lead =
      index === 0 ? 'Prvo' : index === 1 ? 'Zatim' : 'I još';
    parts.push(`${lead}, ${poi.title}. ${summarize(poi.summary)}`);
    if (poi.hoursCaveat) {
      parts.push(poi.hoursCaveat);
    }
  });
  parts.push('To su mesta koja vredi imati na umu dok ste ovuda.');
  return parts.filter(Boolean).join(' ');
}

function summarize(summary: string): string {
  const cleaned = summary.replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    return 'Nemam više detalja pri ruci.';
  }
  // Keep roughly one spoken paragraph.
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
