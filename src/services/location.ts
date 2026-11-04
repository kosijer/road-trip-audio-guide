import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { isPlausibleLocation } from '../geo';
import type { GeoPoint, LocationSample } from '../types';

Geolocation.setRNConfiguration({
  skipPermissionRequests: true,
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto',
});

/** Named spots for indoor / suburb testing without mocking Android GPS. */
export const FAKE_LOCATIONS = {
  london: {
    id: 'london',
    label: 'London',
    latitude: 51.5081,
    longitude: -0.1281,
  },
  belgrade: {
    id: 'belgrade',
    label: 'Beograd',
    latitude: 44.8231,
    longitude: 20.4505,
  },
  westminster: {
    id: 'westminster',
    label: 'Westminster',
    latitude: 51.4994,
    longitude: -0.1245,
  },
} as const;

export type FakeLocationId = keyof typeof FAKE_LOCATIONS;

let locationOverride: (GeoPoint & { label: string }) | null = null;

/** Shared across tabs so Drive doesn't wait again after Around. */
const FRESH_TTL_MS = 120_000;
let cachedFresh: LocationSample | null = null;
let freshInflight: Promise<LocationSample> | null = null;

/** Emulator demo: move east from the fake pin at highway-ish speed. */
const DEMO_SPEED_KMH = 48;
const DEMO_HEADING_DEG = 90;
/** Rebase the demo path before spherical math drifts toward Null Island. */
const DEMO_MAX_DISTANCE_M = 150_000;
let simulateMotion = false;
let motionOrigin: GeoPoint | null = null;
let motionStartedAt = 0;

export function getLocationOverride(): (GeoPoint & { label: string }) | null {
  return locationOverride;
}

export function isSimulateMotion(): boolean {
  return simulateMotion;
}

export function setSimulateMotion(on: boolean): boolean {
  simulateMotion = on && locationOverride != null;
  if (simulateMotion && locationOverride) {
    motionOrigin = {
      latitude: locationOverride.latitude,
      longitude: locationOverride.longitude,
    };
    motionStartedAt = Date.now();
  } else {
    motionOrigin = null;
    motionStartedAt = 0;
  }
  cachedFresh = locationOverride ? overrideSample() : null;
  return simulateMotion;
}

export function setLocationOverride(
  next: FakeLocationId | null,
): (GeoPoint & { label: string }) | null {
  if (!next) {
    locationOverride = null;
    simulateMotion = false;
    motionOrigin = null;
    motionStartedAt = 0;
    return null;
  }
  const spot = FAKE_LOCATIONS[next];
  locationOverride = {
    label: spot.label,
    latitude: spot.latitude,
    longitude: spot.longitude,
  };
  if (simulateMotion) {
    motionOrigin = {
      latitude: spot.latitude,
      longitude: spot.longitude,
    };
    motionStartedAt = Date.now();
  }
  cachedFresh = overrideSample();
  return locationOverride;
}

function speedToKmh(speedMs?: number | null): number {
  if (speedMs == null || Number.isNaN(speedMs) || speedMs < 0) {
    return 0;
  }
  return speedMs * 3.6;
}

export async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }
  const fine = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    {
      title: 'Lokacija',
      message: 'Vodiču je potrebna lokacija da priča o mestima u blizini.',
      buttonPositive: 'Dozvoli',
      buttonNegative: 'Ne',
    },
  );
  if (fine !== PermissionsAndroid.RESULTS.GRANTED) {
    return false;
  }
  if (Number(Platform.Version) >= 33) {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      {
        title: 'Obaveštenja',
        message: 'Obaveštenje drži vožnju aktivnom dok koristite mape.',
        buttonPositive: 'Dozvoli',
        buttonNegative: 'Ne',
      },
    );
  }
  return true;
}

function readPosition(
  enableHighAccuracy: boolean,
  timeoutMs: number,
  maximumAge: number,
): Promise<LocationSample> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos => {
        const sample: LocationSample = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speedKmh: speedToKmh(pos.coords.speed),
          timestamp: pos.timestamp,
          accuracyM: pos.coords.accuracy,
        };
        if (!isPlausibleLocation(sample)) {
          reject(new Error('location_failed: implausible_fix'));
          return;
        }
        resolve(sample);
      },
      error =>
        reject(
          new Error(
            `${error.code ?? ''} ${error.message || 'location_failed'}`.trim(),
          ),
        ),
      {
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge,
      },
    );
  });
}

async function readDeviceLocation(): Promise<LocationSample> {
  try {
    return await readPosition(false, 10_000, 60_000);
  } catch (networkErr) {
    try {
      return await readPosition(true, 20_000, 5_000);
    } catch (gpsErr) {
      throw new Error(
        `location_failed: ${String(networkErr)}; ${String(gpsErr)}`,
      );
    }
  }
}

/**
 * Fresh enough for trip motion. Stale network fixes (60s maxAge) freeze the
 * map and report 0 km/h even on a moving train.
 */
async function readTripDeviceLocation(): Promise<LocationSample> {
  try {
    return await readPosition(true, 15_000, 2_000);
  } catch (gpsErr) {
    try {
      return await readPosition(false, 10_000, 5_000);
    } catch (networkErr) {
      throw new Error(
        `location_failed: ${String(gpsErr)}; ${String(networkErr)}`,
      );
    }
  }
}

function offsetAlongHeading(
  origin: GeoPoint,
  headingDeg: number,
  distanceM: number,
): GeoPoint {
  const R = 6_371_000;
  const δ = distanceM / R;
  const θ = (headingDeg * Math.PI) / 180;
  const φ1 = (origin.latitude * Math.PI) / 180;
  const λ1 = (origin.longitude * Math.PI) / 180;
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ);
  const φ2 = Math.asin(sinφ2);
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * sinδ * cosφ1,
      cosδ - sinφ1 * sinφ2,
    );
  return {
    latitude: (φ2 * 180) / Math.PI,
    longitude: (((λ2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

function overrideSample(): LocationSample {
  const now = Date.now();
  if (simulateMotion && locationOverride) {
    // Fast Refresh / partial re-init can leave motion clock at 0 → huge jump.
    if (!motionOrigin || motionStartedAt <= 0) {
      motionOrigin = {
        latitude: locationOverride.latitude,
        longitude: locationOverride.longitude,
      };
      motionStartedAt = now;
    }
    let elapsedH = Math.max(0, (now - motionStartedAt) / 3_600_000);
    let distanceM = DEMO_SPEED_KMH * 1000 * elapsedH;
    if (distanceM > DEMO_MAX_DISTANCE_M) {
      const ahead = offsetAlongHeading(
        motionOrigin,
        DEMO_HEADING_DEG,
        DEMO_MAX_DISTANCE_M,
      );
      motionOrigin = ahead;
      motionStartedAt = now;
      elapsedH = 0;
      distanceM = 0;
    }
    const point = offsetAlongHeading(
      motionOrigin,
      DEMO_HEADING_DEG,
      distanceM,
    );
    if (!isPlausibleLocation(point)) {
      motionOrigin = {
        latitude: locationOverride.latitude,
        longitude: locationOverride.longitude,
      };
      motionStartedAt = now;
      return {
        latitude: locationOverride.latitude,
        longitude: locationOverride.longitude,
        speedKmh: DEMO_SPEED_KMH,
        timestamp: now,
        accuracyM: 5,
      };
    }
    return {
      latitude: point.latitude,
      longitude: point.longitude,
      speedKmh: DEMO_SPEED_KMH,
      timestamp: now,
      accuracyM: 5,
    };
  }
  return {
    latitude: locationOverride!.latitude,
    longitude: locationOverride!.longitude,
    speedKmh: 0,
    timestamp: now,
    accuracyM: 5,
  };
}

function rememberFresh(sample: LocationSample): LocationSample {
  if (!isPlausibleLocation(sample)) {
    return sample;
  }
  cachedFresh = sample;
  return sample;
}

function cacheStillGood(): LocationSample | null {
  if (!cachedFresh || !isPlausibleLocation(cachedFresh)) {
    return null;
  }
  if (Date.now() - cachedFresh.timestamp > FRESH_TTL_MS) {
    return null;
  }
  return cachedFresh;
}

/** Real GPS only — used for weather so debug POI presets don't invent local rain. */
export async function getRealLocation(): Promise<LocationSample> {
  return readDeviceLocation();
}

export async function getCurrentLocation(): Promise<LocationSample> {
  if (locationOverride) {
    return overrideSample();
  }
  const cached = cacheStillGood();
  if (cached) {
    return cached;
  }
  return rememberFresh(await readDeviceLocation());
}

/**
 * Shared “you are here” fix for maps / Plan origin.
 * Reuses an in-flight request and a short TTL so tabs don’t each wait ~10s.
 */
export async function getFreshLocation(): Promise<LocationSample> {
  if (locationOverride) {
    return overrideSample();
  }
  const cached = cacheStillGood();
  if (cached) {
    return cached;
  }
  if (freshInflight) {
    return freshInflight;
  }
  freshInflight = (async () => {
    // Fast path: recent network/cell fix (up to 30s old), then GPS refine.
    try {
      return rememberFresh(await readPosition(false, 5_000, 30_000));
    } catch {
      // continue
    }
    try {
      return rememberFresh(await readPosition(true, 12_000, 5_000));
    } catch {
      return rememberFresh(await readDeviceLocation());
    }
  })();
  try {
    return await freshInflight;
  } finally {
    freshInflight = null;
  }
}

/** Sync peek for UI that already warmed location. */
export function peekFreshLocation(): LocationSample | null {
  if (locationOverride) {
    return overrideSample();
  }
  return cacheStillGood();
}

/** Kick off permission + first fix during app bootstrap. */
export async function warmFreshLocation(): Promise<LocationSample | null> {
  try {
    await requestLocationPermission();
    return await getFreshLocation();
  } catch (error) {
    console.warn('warmFreshLocation failed', error);
    return null;
  }
}

/** High-accuracy, short-lived fix for Start Trip motion detection. */
export async function getTripLocation(): Promise<LocationSample> {
  if (locationOverride) {
    return overrideSample();
  }
  const sample = await readTripDeviceLocation();
  return rememberFresh(sample);
}
