/**
 * POI ranking via Clef (with heuristic fallback)
 * ==============================================
 *
 * Pipeline:
 *   1. Keep the cheap keyword `rankPois` order as a shortlist (top N).
 *   2. Ask Clef a single `choice` question whose options are those POIs.
 *   3. Reorder by the returned per-option probabilities.
 *   4. If Clef is off / fails / returns garbage → keep the heuristic order.
 *
 * Why a shortlist first?
 *   - Cheaper (fewer tokens in `state` + fewer criteria).
 *   - Offline / error resilient: discovery still works without Cloudflare.
 *   - Clef never has to score dozens of bus stops from Overpass.
 */

import { config } from '../../config';
import {
  getOrClassifyPoi,
  getPreferenceProfile,
  getSessionState,
  isNightlifeViable,
  buildExposureContext,
  lastExposureForPoi,
  moodCategories,
  rankCandidates as rankByPreferences,
  type SessionMood,
} from '../../preferences';
import type { Poi } from '../../types';

/** Wider heuristic window used to rescue mood matches Clef might bury. */
const MOOD_SCAN = 20;
import {
  asChoiceAnswer,
  isClefConfigured,
  runClef,
  type ClefChoiceQuestion,
} from '../decision/clef';
import { rankPois } from './discover';

/** How many heuristic-top candidates we hand to Clef. */
export const CLEF_SHORTLIST = 8;

/** One focal place per story — clearer map pin and Next progression. */
export function selectionLimit(_mode: 'driving' | 'walking'): number {
  return 1;
}

/**
 * Compact card Clef sees for each candidate.
 * Keep summaries short — long Wikipedia extracts burn context tokens
 * and dilute the decision signal.
 */
function poiCard(poi: Poi, alias: string) {
  const facts = poi.wikidataFacts
    ? Object.entries(poi.wikidataFacts)
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ')
    : undefined;
  return {
    id: alias,
    title: poi.title,
    category: poi.category ?? poi.source,
    distance_m: Math.round(poi.distanceM ?? 0),
    outdoor: poi.isOutdoor,
    indoor_venue: poi.isIndoorVenue,
    hours: poi.hoursCaveat,
    weather: poi.weatherCaveat,
    facts,
    summary: poi.summary.slice(0, 420),
  };
}

/**
 * Build the Clef `choice` criteria map.
 * Keys must be short stable aliases (`p0`, `p1`, …) — not raw POI ids —
 * because criteria keys become answer ids and have length limits.
 */
function buildChoiceQuestion(
  shortlist: Poi[],
  mode: 'driving' | 'walking',
  mood: SessionMood | null,
): { question: ClefChoiceQuestion; aliasToPoi: Map<string, Poi> } {
  const criteria: Record<string, string> = {};
  const aliasToPoi = new Map<string, Poi>();

  shortlist.forEach((poi, index) => {
    const alias = `p${index}`;
    aliasToPoi.set(alias, poi);
    const distance =
      poi.distanceM != null ? `${Math.round(poi.distanceM)}m away` : 'nearby';
    const category = poi.category ?? poi.source;
    criteria[alias] =
      `${poi.title} (${category}, ${distance}). ${poi.summary.slice(0, 160)}`;
  });

  const modeLine =
    mode === 'walking'
      ? 'The listener is on foot (Around / walking).'
      : 'The listener is in a car (Drive).';
  let preference =
    'Prefer notable places over generic amenities. Prefer closer places when interest is similar.';
  if (mood === 'nature') {
    preference =
      'Strongly prefer parks, viewpoints, lakes, coast, and outdoor nature over shops, markets, or indoor venues.';
  } else if (mood === 'history') {
    preference =
      'Strongly prefer historically notable sites (castles, monuments, wartime, famous people) over generic amenities.';
  } else if (mood === 'surprise') {
    preference =
      'Prefer an unexpected but still interesting pick over the most obvious tourist landmark.';
  }

  return {
    aliasToPoi,
    question: {
      type: 'choice',
      instructions: `${modeLine} Which place should the audio travel guide narrate next? ${preference}`,
      criteria,
    },
  };
}

/**
 * Reorder `shortlist` using Clef choice probabilities (highest first).
 * Any alias missing from the probability map stays at the end, preserving
 * relative heuristic order among the leftovers.
 */
export function reorderByProbabilities(
  shortlist: Poi[],
  aliasToPoi: Map<string, Poi>,
  probabilities: Record<string, number>,
): Poi[] {
  const scored = [...aliasToPoi.entries()]
    .map(([alias, poi]) => ({
      poi,
      probability: probabilities[alias] ?? -1,
      heuristicIndex: shortlist.indexOf(poi),
    }))
    .sort((a, b) => {
      if (b.probability !== a.probability) {
        return b.probability - a.probability;
      }
      return a.heuristicIndex - b.heuristicIndex;
    });

  return scored.map(entry => entry.poi);
}

/**
 * Final ranking used right before Gemini writes the narration script.
 *
 * Always returns a non-empty array if `pois` was non-empty: worst case
 * is the original heuristic order sliced to the shortlist size.
 */
export async function rankCandidatesForNarration(
  pois: Poi[],
  mode: 'driving' | 'walking',
): Promise<Poi[]> {
  const heuristic = rankPois(pois);
  const shortlist = heuristic.slice(0, CLEF_SHORTLIST);

  if (shortlist.length <= 1 || !isClefConfigured()) {
    return shortlist;
  }

  const session = await getSessionState();
  const { question, aliasToPoi } = buildChoiceQuestion(
    shortlist,
    mode,
    session.mood,
  );

  try {
    const response = await runClef({
      state: {
        mode,
        mood: session.mood,
        purpose: 'Select the best nearby point(s) of interest for spoken travel narration.',
        candidates: shortlist.map((poi, index) => poiCard(poi, `p${index}`)),
      },
      questions: {
        pick: question,
      },
    });

    const pick = asChoiceAnswer(response.answers.pick);
    if (!pick || !pick.probabilities) {
      console.warn('clef: missing choice answer, using heuristic rank');
      return shortlist;
    }

    const ranked = reorderByProbabilities(
      shortlist,
      aliasToPoi,
      pick.probabilities,
    );
    console.log(
      'clef pick',
      pick.choice,
      'confidence',
      pick.confidence,
      'top',
      ranked[0]?.title,
    );
    return ranked;
  } catch (error) {
    console.warn('clef ranking failed, using heuristic', error);
    return shortlist;
  }
}

/** Convenience: heuristic/Clef shortlist, then preference-aware re-rank. */
export async function selectPoisForNarration(
  pois: Poi[],
  mode: 'driving' | 'walking',
): Promise<Poi[]> {
  const ranked = await rankCandidatesForNarration(pois, mode);
  const limit = selectionLimit(mode);

  try {
    const [profile, session] = await Promise.all([
      getPreferenceProfile(),
      getSessionState(),
    ]);
    const moodCats = new Set(moodCategories(session.mood));
    // Pull mood matches from a wider heuristic band so parks are not stuck
    // below a market-heavy Clef shortlist.
    let pool = [...ranked];
    if (moodCats.size > 0) {
      const heuristic = rankPois(pois).slice(0, MOOD_SCAN);
      for (const poi of heuristic) {
        if (pool.some(p => p.id === poi.id)) {
          continue;
        }
        const classification = await getOrClassifyPoi(poi);
        if (moodCats.has(classification.primaryCategory)) {
          pool.push(poi);
        }
      }
    }

    if (pool.length <= 1) {
      return pool.slice(0, limit);
    }

    const context = buildExposureContext(mode);
    const prefCandidates = [];
    const byId = new Map(pool.map(p => [p.id, p]));
    for (let index = 0; index < pool.length; index++) {
      const poi = pool[index];
      const classification = await getOrClassifyPoi(poi);
      if (
        classification.primaryCategory === 'nightlife_social' &&
        !isNightlifeViable(context.daypart)
      ) {
        continue;
      }
      const prior = await lastExposureForPoi(poi.id);
      // Positional base preserves heuristic/Clef order; prefs apply a bounded nudge.
      prefCandidates.push({
        id: poi.id,
        title: poi.title,
        baseInterest: pool.length - index,
        categories: classification.categories,
        primaryCategory: classification.primaryCategory,
        lastExposedAt: prior?.suggestedAt,
      });
    }
    if (prefCandidates.length === 0) {
      return pool.slice(0, limit);
    }
    const result = rankByPreferences(prefCandidates, profile, session, {
      limit,
    });
    const ordered = result.selected
      .map(c => byId.get(c.id))
      .filter((p): p is Poi => p != null);
    return ordered.length > 0 ? ordered : pool.slice(0, limit);
  } catch (error) {
    console.warn('preference ranking failed, using heuristic', error);
    return ranked.slice(0, limit);
  }
}

/** Exposed for tests / debugging — not used by production callers. */
export function clefConfigSummary(): string {
  if (!config.clefEnabled) {
    return 'clef disabled (CLEF_ENABLED!=true)';
  }
  if (!isClefConfigured()) {
    return 'clef enabled but missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN';
  }
  return 'clef ready';
}
