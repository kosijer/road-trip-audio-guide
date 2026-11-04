export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type LocationSample = GeoPoint & {
  speedKmh: number;
  timestamp: number;
  accuracyM?: number;
};

export type PoiSource = 'wikipedia' | 'osm';

export type Poi = {
  id: string;
  title: string;
  summary: string;
  location: GeoPoint;
  source: PoiSource;
  category?: string;
  wikidataId?: string;
  wikidataFacts?: Record<string, string>;
  extractLength: number;
  isOutdoor: boolean;
  isIndoorVenue: boolean;
  distanceM?: number;
  hours?: {
    openNow?: boolean;
    weekdayText?: string[];
  };
  hoursCaveat?: string;
  weatherCaveat?: string;
};

export type DrivePhase =
  | 'idle'
  | 'selecting'
  | 'teaser'
  | 'hold'
  | 'full'
  | 'skipped'
  | 'cooldown';

export type UpcomingPoi = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  etaMin?: number;
  distanceM?: number;
  side?: 'left' | 'right' | 'ahead';
};

export type TripStatus = {
  tripActive: boolean;
  moving: boolean;
  lastLocation?: LocationSample;
  lastTriggerAt?: number;
  lastCellId?: string;
  lastNarration?: string;
  lastPoiTitle?: string;
  lastPoiIds?: string[];
  /** Latest preference exposure id (for 👍/👎 feedback). */
  lastExposureId?: string;
  /** Coordinates for map markers of the last narrated place(s). */
  lastPoiMarkers?: Array<{ id: string; title: string; latitude: number; longitude: number }>;
  /** Drive v2 coming-up queue phase. */
  drivePhase?: DrivePhase;
  /** Place currently teased / held before full narration. */
  upcomingPoi?: UpcomingPoi;
  /** Spoken/shown teaser line while in teaser/hold. */
  teaserText?: string;
  llmCalls: number;
  message: string;
  prefetchCount: number;
};

export type RoutePrefetchInput = {
  origin: string;
  destination: string;
};

/** Last Route Prep batch — for map/list preview on Drive. */
export type PrefetchBatch = {
  origin: string;
  destination: string;
  /** Resolved plan origin for the map “you” pin (named place or GPS). */
  originLatitude?: number;
  originLongitude?: number;
  /** How many places the user asked to keep. */
  placeTarget: number;
  /** Internal corridor search points used to find them. */
  sampleCount: number;
  createdAt: number;
  /** Corridor A→B vs inspire loop. Older batches omit this (= corridor). */
  kind?: 'corridor' | 'loop';
  budgetMin?: number;
  mode?: 'walking' | 'driving';
  /** Ordered inspire stops (loop only). */
  stops?: Array<{
    id: string;
    title: string;
    latitude: number;
    longitude: number;
    summary?: string;
    category?: string;
  }>;
  pois: Array<{
    id: string;
    title: string;
    summary: string;
    category?: string;
    latitude: number;
    longitude: number;
    source: PoiSource;
  }>;
};

/** How many places to keep after ranking (not search-point count). */
export const PREFETCH_PLACE_OPTIONS = [5, 12, 25, 50] as const;
export type PrefetchPlaceTarget = (typeof PREFETCH_PLACE_OPTIONS)[number];

/** @deprecated use PREFETCH_PLACE_OPTIONS */
export const PREFETCH_SAMPLE_OPTIONS = PREFETCH_PLACE_OPTIONS;
/** @deprecated use PrefetchPlaceTarget */
export type PrefetchSampleTarget = PrefetchPlaceTarget;

/** Local visit/search history — substrate for a future taste profile. */
export type VisitRating = 1 | 2 | 3 | 4 | 5;

export type VisitRecord = {
  id: string;
  poiId: string;
  title: string;
  category?: string;
  summary?: string;
  source: PoiSource;
  latitude: number;
  longitude: number;
  mode: 'driving' | 'walking';
  narratedAt: number;
  narrationExcerpt?: string;
  /** User rating of the place (not the story). */
  rating?: VisitRating;
  ratedAt?: number;
};
