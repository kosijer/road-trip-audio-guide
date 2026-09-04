declare module '@env' {
  export const LLM_PROVIDER: string;
  export const ANTHROPIC_API_KEY: string;
  export const OPENAI_API_KEY: string;
  export const GEMINI_API_KEY: string;
  export const GOOGLE_MAPS_API_KEY: string;
  export const DRIVING_TRIGGER_INTERVAL_MIN: string;
  export const DRIVING_SPEED_THRESHOLD_KMH: string;
  export const DRIVING_POI_RADIUS_M: string;
  export const WALKING_POI_RADIUS_M: string;
  export const MAX_LLM_CALLS_PER_TRIP: string;
}
