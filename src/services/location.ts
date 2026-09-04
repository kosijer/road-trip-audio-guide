import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import type { LocationSample } from '../types';

Geolocation.setRNConfiguration({
  skipPermissionRequests: false,
  authorizationLevel: 'whenInUse',
  locationProvider: 'auto',
});

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

export function getCurrentLocation(timeoutMs = 15_000): Promise<LocationSample> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      pos => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          speedKmh: speedToKmh(pos.coords.speed),
          timestamp: pos.timestamp,
          accuracyM: pos.coords.accuracy,
        });
      },
      error => reject(new Error(error.message || 'location_failed')),
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 8_000,
      },
    );
  });
}
