const INTERESTING = [
  'castle',
  'palace',
  'fortress',
  'battle',
  'birthplace',
  'temple',
  'church',
  'monastery',
  'museum',
  'ruins',
  'ancient',
  'archaeolog',
  'monument',
  'memorial',
  'mosque',
  'cathedral',
  'tower',
  'harbour',
  'harbor',
  'port',
  'bridge',
  'amphitheatre',
  'amphitheater',
  'acropolis',
  'knossos',
  'minoa',
  'ottoman',
  'venetian',
  'byzantin',
];

const OUTDOOR_HINTS = [
  'viewpoint',
  'ruins',
  'archaeolog',
  'park',
  'trail',
  'garden',
  'beach',
  'gorge',
  'canyon',
  'peak',
  'nature',
];

const INDOOR_HINTS = ['museum', 'gallery', 'exhibition', 'church', 'mosque', 'monastery'];

export function scoreKeywords(title: string, summary: string): number {
  const text = `${title} ${summary}`.toLowerCase();
  let score = 0;
  for (const word of INTERESTING) {
    if (text.includes(word)) {
      score += 3;
    }
  }
  return score;
}

export function interestingness(title: string, summary: string, extractLength: number): number {
  return scoreKeywords(title, summary) + Math.min(20, Math.floor(extractLength / 80));
}

export function inferFlags(
  title: string,
  summary: string,
  tags?: Record<string, string>,
): { isOutdoor: boolean; isIndoorVenue: boolean; category?: string } {
  const text = `${title} ${summary} ${JSON.stringify(tags ?? {})}`.toLowerCase();
  const historic = tags?.historic;
  const tourism = tags?.tourism;
  const isOutdoor =
    OUTDOOR_HINTS.some(h => text.includes(h)) ||
    historic === 'ruins' ||
    historic === 'archaeological_site' ||
    tourism === 'viewpoint';
  const isIndoorVenue =
    INDOOR_HINTS.some(h => text.includes(h)) || tourism === 'museum';
  return {
    isOutdoor,
    isIndoorVenue,
    category: historic || tourism,
  };
}
