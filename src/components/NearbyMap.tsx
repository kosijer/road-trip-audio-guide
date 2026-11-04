import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { isPlausibleLocation } from '../geo';
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
};

const DEFAULT_DELTA = 0.02;
const EDGE = { top: 40, right: 40, bottom: 40, left: 40 };

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
      points.push({ latitude: m.latitude, longitude: m.longitude });
    }
    return points;
  }, [center, markers]);

  const region: Region | null = useMemo(() => {
    if (fitPoints.length >= 2) {
      return regionForPoints(fitPoints);
    }
    if (!center) {
      return null;
    }
    const latDelta = Math.max(DEFAULT_DELTA, (radiusM / 111_000) * 2.4);
    return {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: latDelta,
      longitudeDelta: latDelta,
    };
  }, [center, fitPoints, radiusM]);

  useEffect(() => {
    if (!mapRef.current || fitPoints.length === 0) {
      return;
    }
    if (fitPoints.length >= 2) {
      mapRef.current.fitToCoordinates(fitPoints, {
        edgePadding: EDGE,
        animated: true,
      });
      return;
    }
    if (region) {
      mapRef.current.animateToRegion(region, 350);
    }
  }, [fitPoints, region]);

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
            coordinate={{
              latitude: marker.latitude,
              longitude: marker.longitude,
            }}
            title={marker.title}
            pinColor={colors.go}
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
