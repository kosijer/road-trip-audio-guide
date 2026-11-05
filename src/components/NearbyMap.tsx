import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { config } from '../config';
import { haversineM, isPlausibleLocation } from '../geo';
import { t } from '../i18n';
import { colors, radius, sharedStyles, space } from '../theme';
import type { GeoPoint } from '../types';

export type MapMarker = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
};

type Props = {
  center?: GeoPoint | null;
  markers?: MapMarker[];
  radiusM?: number;
  height?: number;
  /** Draw search radius circle around center (Around). */
  showRadius?: boolean;
  /**
   * `bounds` (default): fit camera to you + markers.
   * `follow`: keep the camera on you; markers stay visible but don’t zoom out.
   */
  cameraMode?: 'bounds' | 'follow';
};

const DEFAULT_DELTA = 0.02;
const EDGE = { top: 40, right: 40, bottom: 40, left: 40 };

function markersSignature(markers: MapMarker[]): string {
  return markers
    .filter(isPlausibleLocation)
    .map(m => `${m.id}:${m.latitude.toFixed(5)},${m.longitude.toFixed(5)}`)
    .join('|');
}

function regionForPoints(points: GeoPoint[]): Region | null {
  if (points.length === 0) {
    return null;
  }
  if (points.length === 1) {
    return {
      latitude: points[0].latitude,
      longitude: points[0].longitude,
      latitudeDelta: DEFAULT_DELTA,
      longitudeDelta: DEFAULT_DELTA,
    };
  }
  let minLat = points[0].latitude;
  let maxLat = points[0].latitude;
  let minLon = points[0].longitude;
  let maxLon = points[0].longitude;
  for (const p of points) {
    minLat = Math.min(minLat, p.latitude);
    maxLat = Math.max(maxLat, p.latitude);
    minLon = Math.min(minLon, p.longitude);
    maxLon = Math.max(maxLon, p.longitude);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(DEFAULT_DELTA, (maxLat - minLat) * 1.4 || DEFAULT_DELTA),
    longitudeDelta: Math.max(DEFAULT_DELTA, (maxLon - minLon) * 1.4 || DEFAULT_DELTA),
  };
}

export function NearbyMap({
  center,
  markers = [],
  radiusM = 800,
  height = 220,
  showRadius = true,
  cameraMode = 'bounds',
}: Props) {
  const mapRef = useRef<MapView | null>(null);

  const fitPoints = useMemo((): GeoPoint[] => {
    const points: GeoPoint[] = [];
    if (center && isPlausibleLocation(center)) {
      points.push(center);
    }
    for (const m of markers) {
      if (!isPlausibleLocation(m)) {
        continue;
      }
      // Follow: only pull the camera out for POIs still “nearby” so a highway
      // lookahead doesn’t zoom the map to a postage stamp of London.
      if (
        cameraMode === 'follow' &&
        center &&
        isPlausibleLocation(center) &&
        haversineM(center, m) > config.driveMapFitLastPoiMaxM
      ) {
        continue;
      }
      points.push({ latitude: m.latitude, longitude: m.longitude });
    }
    return points;
  }, [cameraMode, center, markers]);

  const region: Region | null = useMemo(() => {
    if (fitPoints.length >= 2) {
      return regionForPoints(fitPoints);
    }
    if (!center || !isPlausibleLocation(center)) {
      return null;
    }
    // Single-point / far POI: tight street-level frame on you.
    const followDelta =
      cameraMode === 'follow'
        ? DEFAULT_DELTA
        : Math.max(DEFAULT_DELTA, (radiusM / 111_000) * 2.4);
    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: followDelta,
      longitudeDelta: followDelta,
    };
  }, [cameraMode, center, fitPoints, radiusM]);

  const markerKey = markersSignature(markers);
  const lastFitKey = useRef<string>('');

  useEffect(() => {
    if (!mapRef.current || fitPoints.length === 0 || !region) {
      return;
    }
    // Refit when the found POI set changes; otherwise nudge along `region`
    // (includes nearby POI while following) without re-running fitToCoordinates.
    const fitKey = `${markerKey}|${fitPoints.length >= 2 ? 'poi' : 'you'}`;
    if (fitPoints.length >= 2 && fitKey !== lastFitKey.current) {
      lastFitKey.current = fitKey;
      mapRef.current.fitToCoordinates(fitPoints, {
        edgePadding: EDGE,
        animated: true,
      });
      return;
    }
    lastFitKey.current = fitKey;
    mapRef.current.animateToRegion(region, 350);
  }, [fitPoints, markerKey, region]);

  const usableCenter =
    center && isPlausibleLocation(center) ? center : null;
  const usableMarkers = markers.filter(isPlausibleLocation);

  if (!usableCenter || !region) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={sharedStyles.hint}>{t('mapWaiting')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
        liteMode={false}>
        <Marker
          coordinate={usableCenter}
          title={t('mapYou')}
          pinColor={colors.accent}
        />
        {showRadius ? (
          <Circle
            center={usableCenter}
            radius={radiusM}
            strokeColor={colors.accent}
            fillColor="rgba(255, 122, 89, 0.14)"
            strokeWidth={1}
          />
        ) : null}
        {usableMarkers.map(marker => (
          <Marker
            key={marker.id}
            identifier={marker.id}
            coordinate={{
              latitude: marker.latitude,
              longitude: marker.longitude,
            }}
            title={marker.title}
            pinColor={colors.go}
            tracksViewChanges={false}
          />
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  placeholder: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    minHeight: 160,
  },
});
