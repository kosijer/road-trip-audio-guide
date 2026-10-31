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
import type { Poi } from '../../types';
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

  return {
    aliasToPoi,
    question: {
      type: 'choice',
      instructions:
        'Which place should an in-car audio travel guide narrate next for a curious passenger? Prefer historically or culturally notable sites over generic amenities. Prefer closer places when interest is similar.',
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

  const { question, aliasToPoi } = buildChoiceQuestion(shortlist);

  try {
    const response = await runClef({
      state: {
        mode,
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

/** Convenience: rank then take driving/walking selection size. */
export async function selectPoisForNarration(
  pois: Poi[],
  mode: 'driving' | 'walking',
): Promise<Poi[]> {
  const ranked = await rankCandidatesForNarration(pois, mode);
  return ranked.slice(0, selectionLimit(mode));
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
