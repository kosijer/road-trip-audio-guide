import {
  DRIVING_POI_RADIUS_M,
  DRIVING_SPEED_THRESHOLD_KMH,
  DRIVING_TRIGGER_INTERVAL_MIN,
  GEMINI_API_KEY,
  GOOGLE_MAPS_API_KEY,
  LLM_PROVIDER,
  MAX_LLM_CALLS_PER_TRIP,
  WALKING_POI_RADIUS_M,
} from '@env';

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  llmProvider: (LLM_PROVIDER || 'gemini').toLowerCase(),
  geminiApiKey: GEMINI_API_KEY || '',
  googleMapsApiKey: GOOGLE_MAPS_API_KEY || '',
  drivingTriggerIntervalMin: num(DRIVING_TRIGGER_INTERVAL_MIN, 3),
  drivingSpeedThresholdKmh: num(DRIVING_SPEED_THRESHOLD_KMH, 25),
  drivingPoiRadiusM: num(DRIVING_POI_RADIUS_M, 5000),
  walkingPoiRadiusM: num(WALKING_POI_RADIUS_M, 800),
  maxLlmCallsPerTrip: num(MAX_LLM_CALLS_PER_TRIP, 30),
  locationTickMs: 15_000,
  sustainedSpeedSamples: 3,
  corridorCellDeg: 0.045,
  prefetchSampleKm: 8,
  wikipediaUserAgent:
    'RoadTripAudioGuide/1.0 (personal travel companion; https://github.com/kosijer/road-trip-audio-guide)',
};

export type AppConfig = typeof config;
