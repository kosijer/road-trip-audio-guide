import { config } from '../config';
import { tn } from '../i18n';
import { daypartForHour } from '../preferences/context';
import type { CategoryId, Daypart } from '../preferences/types';
import { fetchJsonSilent } from './http';
import type { Poi } from '../types';

type PlaceHours = {
  openNow?: boolean;
  weekdayText?: string[];
};

export async function lookupOpeningHours(poi: Poi): Promise<PlaceHours | null> {
  if (!config.googleMapsApiKey || !poi.title) {
    return null;
  }
  const data = await fetchJsonSilent<{
    places?: Array<{
      currentOpeningHours?: {
        openNow?: boolean;
        weekdayDescriptions?: string[];
      };
    }>;
  }>('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': config.googleMapsApiKey,
      'X-Goog-FieldMask': 'places.currentOpeningHours',
    },
    body: JSON.stringify({
      textQuery: `${poi.title}`,
      maxResultCount: 1,
      locationBias: {
        circle: {
          center: {
            latitude: poi.location.latitude,
            longitude: poi.location.longitude,
          },
          radius: 400,
        },
      },
    }),
  });
  const hours = data?.places?.[0]?.currentOpeningHours;
  if (!hours) {
    return null;
  }
  return {
    openNow: hours.openNow,
    weekdayText: hours.weekdayDescriptions,
  };
}

/** Categories that are usually closed for a visit late, if hours are unknown. */
const LATE_CLOSED_IF_UNKNOWN: ReadonlySet<CategoryId> = new Set([
  'museums_galleries',
  'religious_sites',
]);

/** Categories that are especially good evening/night picks when hours unknown. */
const LATE_VIABLE_IF_UNKNOWN: ReadonlySet<CategoryId> = new Set([
  'nightlife_social',
  'local_culture_food',
]);

/**
 * Drop places that are closed for an actual visit.
 * Outdoor landmarks that are “closed” stay with a facade caveat (stadiums, monuments).
 * Evening pubs/food stay when hours are unknown; museums do not.
 */
export function applyHoursPolicy(
  poi: Poi,
  opts?: { daypart?: Daypart; primaryCategory?: CategoryId },
): Poi | null {
  const daypart = opts?.daypart ?? daypartForHour(new Date().getHours());
  const late = daypart === 'evening' || daypart === 'night';
  const primary = opts?.primaryCategory;

  if (poi.hours?.openNow === true) {
    return poi;
  }

  if (poi.hours?.openNow === false) {
    // Confirmed closed: indoor / museum / food / nightlife → skip.
    // Outdoor monuments/stadiums → keep with exterior caveat.
    if (
      poi.isIndoorVenue ||
      primary === 'museums_galleries' ||
      primary === 'nightlife_social' ||
      primary === 'local_culture_food' ||
      primary === 'religious_sites'
    ) {
      return null;
    }
    return {
      ...poi,
      hoursCaveat: tn('hoursClosedOutdoor'),
    };
  }

  // Unknown hours — only drop categories that are rarely open for visits late.
  // Do NOT blanket-drop all indoor (that would kill pubs before hours lookup).
  if (late && primary && LATE_CLOSED_IF_UNKNOWN.has(primary)) {
    return null;
  }
  return poi;
}

function looksHoursSensitive(poi: Poi, primary?: CategoryId): boolean {
  if (poi.isIndoorVenue) {
    return true;
  }
  if (
    primary === 'museums_galleries' ||
    primary === 'local_culture_food' ||
    primary === 'nightlife_social' ||
    primary === 'religious_sites'
  ) {
    return true;
  }
  const blob = `${poi.title} ${poi.summary} ${poi.category ?? ''}`.toLowerCase();
  return /museum|gallery|pub|bar|cafe|restaurant|stadium|arena|theatre|theater|cinema|church|mosque/.test(
    blob,
  );
}

/**
 * Look up hours for sensitive places first, then apply policy.
 * Evening nightlife/food with unknown hours still pass.
 */
export async function filterPoisForVisitNow(
  pois: Poi[],
  opts?: {
    primaryCategoryOf?: (poi: Poi) => Promise<CategoryId | undefined>;
    lookupCap?: number;
  },
): Promise<Poi[]> {
  const daypart = daypartForHour(new Date().getHours());
  const late = daypart === 'evening' || daypart === 'night';
  const lookupCap = opts?.lookupCap ?? 14;
  const out: Poi[] = [];
  let lookups = 0;

  // Prefer confirming evening-viable places when late (pubs that are open).
  const ordered = late
    ? [...pois].sort((a, b) => {
        const score = (p: Poi) => {
          const blob = `${p.title} ${p.summary}`.toLowerCase();
          if (/pub|bar|biergarten|nightlife|club/.test(blob)) {
            return 0;
          }
          if (/cafe|restaurant|food|market/.test(blob)) {
            return 1;
          }
          if (/museum|gallery|church/.test(blob) || p.isIndoorVenue) {
            return 3;
          }
          return 2;
        };
        return score(a) - score(b);
      })
    : pois;

  for (const poi of ordered) {
    let primary: CategoryId | undefined;
    if (opts?.primaryCategoryOf) {
      try {
        primary = await opts.primaryCategoryOf(poi);
      } catch {
        primary = undefined;
      }
    }

    let hours = poi.hours;
    const shouldLookup =
      lookups < lookupCap &&
      (looksHoursSensitive(poi, primary) ||
        (late && primary != null && LATE_VIABLE_IF_UNKNOWN.has(primary)));

    if (shouldLookup) {
      lookups += 1;
      hours = (await lookupOpeningHours(poi)) ?? poi.hours;
    }

    const next = applyHoursPolicy(
      { ...poi, hours },
      { daypart, primaryCategory: primary },
    );
    if (next) {
      out.push(next);
    }
  }
  return out;
}
