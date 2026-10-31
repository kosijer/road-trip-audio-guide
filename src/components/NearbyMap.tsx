import { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Circle, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
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
};

const DEFAULT_DELTA = 0.02;

export function NearbyMap({
  center,
  markers = [],
  radiusM = 800,
  height = 220,
}: Props) {
  const mapRef = useRef<MapView | null>(null);

  const region: Region | null = useMemo(() => {
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
  }, [center, radiusM]);

  useEffect(() => {
    if (!mapRef.current || !region) {
      return;
    }
    mapRef.current.animateToRegion(region, 350);
  }, [region]);

  if (!center || !region) {
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
          coordinate={center}
          title={t('mapYou')}
          pinColor={colors.accent}
        />
        <Circle
          center={center}
          radius={radiusM}
          strokeColor={colors.accent}
          fillColor="rgba(255, 122, 89, 0.14)"
          strokeWidth={1}
        />
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
    minHeight: 160,
  },
});
