import {
  CLEF_ENABLED,
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN,
  DRIVE_TEASER_HOLD_MS,
  DRIVING_POI_RADIUS_M,
  DRIVING_SPEED_THRESHOLD_KMH,
  DRIVING_TRIGGER_INTERVAL_MIN,
  GEMINI_API_KEY,
  GEMINI_MODEL,
  GOOGLE_MAPS_API_KEY,
  LLM_PROVIDER,
  MAX_LLM_CALLS_PER_TRIP,
  WALKING_POI_RADIUS_M,
} from '@env';

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function flag(value: string | undefined): boolean {
  const normalized = (value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

export const config = {
  llmProvider: (LLM_PROVIDER || 'gemini').toLowerCase(),
  geminiApiKey: GEMINI_API_KEY || '',
  geminiModel: (GEMINI_MODEL || 'gemini-flash-lite-latest').trim(),
  googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
  clefEnabled: flag(CLEF_ENABLED),
  cloudflareAccountId: CLOUDFLARE_ACCOUNT_ID || '',
  cloudflareApiToken: CLOUDFLARE_API_TOKEN || '',
  drivingTriggerIntervalMin: num(DRIVING_TRIGGER_INTERVAL_MIN, 3),
  drivingSpeedThresholdKmh: num(DRIVING_SPEED_THRESHOLD_KMH, 25),
  drivingPoiRadiusM: num(DRIVING_POI_RADIUS_M, 5000),
  walkingPoiRadiusM: num(WALKING_POI_RADIUS_M, 800),
  maxLlmCallsPerTrip: num(MAX_LLM_CALLS_PER_TRIP, 30),
  /** Silence after teaser before full narration (Drive v2). */
  driveTeaserHoldMs: num(DRIVE_TEASER_HOLD_MS, 10_000),
  driveNarrowHalfAngleDeg: 25,
  driveWideHalfAngleDeg: 60,
  /**
   * Hard distance caps for cones (meters). Lead *time* scales with speed;
   * these only stop absurd discovery radii (highway 15–22 min ≈ 25–40 km).
   */
  driveNarrowLookaheadCapM: 30_000,
  driveWideLookaheadCapM: 45_000,
  /** Min gap after a full story before selecting again. */
  driveSelectCooldownMs: num(DRIVING_TRIGGER_INTERVAL_MIN, 3) * 60_000,
  /** Shorter gap after Skip so the trip keeps moving. */
  driveSkipCooldownMs: 45_000,
  /** Skip re-narrating the same place within this window (Around / Next / Drive). */
  narratedCooldownMs: 6 * 60 * 60 * 1000,
  locationTickMs: 15_000,
  sustainedSpeedSamples: 3,
  corridorCellDeg: 0.045,
  prefetchSampleKm: 8,
  wikipediaUserAgent:
    'RoadTripAudioGuide/1.0 (personal travel companion; https://github.com/kosijer/road-trip-audio-guide)',
};

export type AppConfig = typeof config;
