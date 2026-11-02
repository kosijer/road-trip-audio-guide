export type SlingshotRunInput = {
  latitude: number;
  longitude: number;
  language: string;
  mood: string;
  mode: 'walk' | 'drive';
  radiusMeters: number;
};

export type SlingshotWeather = {
  summary: string;
  rainRisk: 'none' | 'low' | 'medium' | 'high' | string;
  rainingNow: boolean;
  suggestions: Array<{
    title: string;
    why: string;
    indoorFriendly: boolean;
  }>;
  caution: string | null;
};

export type SlingshotPlace = {
  pageid: number;
  title: string;
  lat: number;
  lon: number;
  distMeters: number;
  why: string;
  fitsWeather: boolean;
};

export type SlingshotNarration = {
  script: string;
  wordCount: number;
  placeTitle: string;
  language: string;
};

export type SlingshotPackageResult = {
  ok: boolean;
  input?: SlingshotRunInput;
  weather: SlingshotWeather;
  place: SlingshotPlace;
  narration: SlingshotNarration;
};
