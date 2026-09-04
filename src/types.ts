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

export type TripStatus = {
  tripActive: boolean;
  moving: boolean;
  lastLocation?: LocationSample;
  lastTriggerAt?: number;
  lastCellId?: string;
  lastNarration?: string;
  lastPoiTitle?: string;
  llmCalls: number;
  message: string;
  prefetchCount: number;
};

export type RoutePrefetchInput = {
  origin: string;
  destination: string;
};
