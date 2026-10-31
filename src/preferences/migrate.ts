import { getVisitHistory } from '../services/store';
import { classifyFromMapping } from './categoryMapping';
import { applyExposureOutcome } from './learning';
import {
  ensureStatsInitialized,
  getCategoryStatsMap,
  getExposures,
  isLegacyMigrated,
  markLegacyMigrated,
  saveCategoryStatsMap,
  saveClassification,
  saveExposures,
} from './preferenceStore';
import type { ExposureOutcome, ExposureRecord } from './types';

function ratingToOutcome(rating: number): ExposureOutcome {
  if (rating >= 4) {
    return 'liked';
  }
  if (rating <= 2) {
    return 'skipped';
  }
  return 'ignored';
}

/** One-time: map legacy History star ratings into exposures (cautious). */
export async function migrateLegacyRatingsIfNeeded(): Promise<void> {
  if (await isLegacyMigrated()) {
    return;
  }
  await ensureStatsInitialized();
  const visits = await getVisitHistory();
  const rated = visits.filter(v => v.rating != null);
  if (rated.length === 0) {
    await markLegacyMigrated();
    return;
  }

  const exposures = await getExposures();
  let stats = await getCategoryStatsMap();

  for (const visit of rated) {
    const mapped =
      classifyFromMapping({
        id: visit.poiId,
        title: visit.title,
        summary: visit.summary ?? '',
        category: visit.category,
      }) ?? {
        poiId: visit.poiId,
        categories: ['other' as const],
        primaryCategory: 'other' as const,
        era: 'unknown' as const,
        source: 'mapping' as const,
        classifiedAt: Date.now(),
      };
    await saveClassification(mapped);

    // Legacy context not reconstructable → viable=false so stats stay clean
    // except we still store the mapping of outcomes for future.
    const exposure: ExposureRecord = {
      id: `legacy_${visit.id}`,
      poiId: visit.poiId,
      sessionId: 'legacy',
      suggestedAt: visit.narratedAt,
      context: {
        daypart: 'afternoon',
        weekday: 0,
        season: 'summer',
        weatherOk: null,
        mode: visit.mode,
        timeBudgetMin: null,
      },
      viable: false,
      blockedReason: 'legacy_unknown_context',
      outcome: 'ignored',
      statsApplied: false,
      categories: mapped.categories,
      primaryCategory: mapped.primaryCategory,
      narrationQuality: visit.rating,
    };

    const outcome = ratingToOutcome(visit.rating!);
    // Spec: migrate outcomes for bookkeeping; viable=false means no stats pollution.
    const applied = applyExposureOutcome(stats, exposure, outcome);
    stats = applied.stats;
    exposures.push(applied.exposure);
  }

  await saveExposures(exposures);
  await saveCategoryStatsMap(stats);
  await markLegacyMigrated();
}

export { ratingToOutcome };
