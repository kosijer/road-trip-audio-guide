import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { t } from '../i18n';
import { colors, radius, sharedStyles, space } from '../theme';
import type { GeoPoint } from '../types';
import type { MapMarker } from './NearbyMap';

type Props = {
  markers: MapMarker[];
  /** Optional “you are here” pin (different color). */
  userLocation?: GeoPoint | null;
  height?: number;
};

const EDGE = { top: 36, right: 36, bottom: 36, left: 36 };

function regionForPoints(points: GeoPoint[]): Region | null {
  if (points.length === 0) {
    return null;
  }
  if (points.length === 1) {
    return {
      latitude: points[0].latitude,
      longitude: points[0].longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
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
    latitudeDelta: Math.max(0.04, (maxLat - minLat) * 1.35 || 0.08),
    longitudeDelta: Math.max(0.04, (maxLon - minLon) * 1.35 || 0.08),
  };
}

export function CorridorMap({
  markers,
  userLocation = null,
  height = 220,
}: Props) {
  const mapRef = useRef<MapView | null>(null);

  const fitPoints = useMemo((): GeoPoint[] => {
    const points: GeoPoint[] = markers.map(m => ({
      latitude: m.latitude,
      longitude: m.longitude,
    }));
    if (userLocation) {
      points.push(userLocation);
    }
    return points;
  }, [markers, userLocation]);

  const region = useMemo(() => regionForPoints(fitPoints), [fitPoints]);

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

  if (!region || markers.length === 0) {
    return (
      <View style={[styles.placeholder, { height }]}>
        <Text style={sharedStyles.hint}>{t('prefetchMapEmpty')}</Text>
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
        toolbarEnabled={false}>
        {userLocation ? (
          <Marker
            coordinate={userLocation}
            title={t('mapYou')}
            pinColor={colors.accent}
          />
        ) : null}
        {markers.map(marker => (
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
    minHeight: 140,
  },
});
