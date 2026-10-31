import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import { t } from '../i18n';
import { colors, radius, sharedStyles, space } from '../theme';
import type { MapMarker } from './NearbyMap';

type Props = {
  markers: MapMarker[];
  height?: number;
};

function regionForMarkers(markers: MapMarker[]): Region | null {
  if (markers.length === 0) {
    return null;
  }
  let minLat = markers[0].latitude;
  let maxLat = markers[0].latitude;
  let minLon = markers[0].longitude;
  let maxLon = markers[0].longitude;
  for (const m of markers) {
    minLat = Math.min(minLat, m.latitude);
    maxLat = Math.max(maxLat, m.latitude);
    minLon = Math.min(minLon, m.longitude);
    maxLon = Math.max(maxLon, m.longitude);
  }
  const latDelta = Math.max(0.04, (maxLat - minLat) * 1.35 || 0.08);
  const lonDelta = Math.max(0.04, (maxLon - minLon) * 1.35 || 0.08);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lonDelta,
  };
}

export function CorridorMap({ markers, height = 220 }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const region = useMemo(() => regionForMarkers(markers), [markers]);

  useEffect(() => {
    if (!mapRef.current || markers.length === 0) {
      return;
    }
    mapRef.current.fitToCoordinates(
      markers.map(m => ({
        latitude: m.latitude,
        longitude: m.longitude,
      })),
      {
        edgePadding: { top: 36, right: 36, bottom: 36, left: 36 },
        animated: true,
      },
    );
  }, [markers]);

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
        {markers.map(marker => (
          <Marker
            key={marker.id}
            coordinate={{
              latitude: marker.latitude,
              longitude: marker.longitude,
            }}
            title={marker.title}
            pinColor={colors.accent}
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
