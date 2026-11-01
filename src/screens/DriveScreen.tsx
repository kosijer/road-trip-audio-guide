import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NearbyMap } from '../components/NearbyMap';
import { useI18n } from '../hooks/useI18n';
import { haversineM } from '../geo';
import { config } from '../config';
import { getCurrentLocation } from '../services/location';
import { getPrefetchBatch } from '../services/store';
import { endTrip, startTrip } from '../services/tripEngine';
import { colors, sharedStyles, space, type } from '../theme';
import type { GeoPoint, PrefetchBatch, TripStatus } from '../types';

type Props = {
  status: TripStatus;
  setStatus: (next: TripStatus | ((prev: TripStatus) => TripStatus)) => void;
  speaking: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
};

type SuggestedPlace = {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  distanceM?: number;
};

function nearestFromBatch(
  batch: PrefetchBatch | null,
  here: GeoPoint | null,
): SuggestedPlace | null {
  if (!batch?.pois.length) {
    return null;
  }
  if (!here) {
    const first = batch.pois[0];
    return {
      id: first.id,
      title: first.title,
      latitude: first.latitude,
      longitude: first.longitude,
    };
  }
  let best: SuggestedPlace | null = null;
  let bestD = Infinity;
  for (const poi of batch.pois) {
    const d = haversineM(here, {
      latitude: poi.latitude,
      longitude: poi.longitude,
    });
    if (d < bestD) {
      bestD = d;
      best = {
        id: poi.id,
        title: poi.title,
        latitude: poi.latitude,
        longitude: poi.longitude,
        distanceM: d,
      };
    }
  }
  return best;
}

export function DriveScreen({
  status,
  setStatus,
  speaking,
  busy,
  setBusy,
}: Props) {
  const { t } = useI18n();
  const [mapCenter, setMapCenter] = useState<GeoPoint | null>(
    status.lastLocation ?? null,
  );
  const [batch, setBatch] = useState<PrefetchBatch | null>(null);

  useEffect(() => {
    void getPrefetchBatch().then(setBatch);
  }, [status.prefetchCount, status.tripActive]);

  useEffect(() => {
    if (status.lastLocation) {
      setMapCenter(status.lastLocation);
      return;
    }
    let cancelled = false;
    void getCurrentLocation()
      .then(here => {
        if (!cancelled) {
          setMapCenter(here);
        }
      })
      .catch(() => {
        // Keep placeholder until trip starts.
      });
    return () => {
      cancelled = true;
    };
  }, [status.lastLocation]);

  const suggested = useMemo((): SuggestedPlace | null => {
    const focus = status.lastPoiMarkers?.[0];
    if (focus) {
      const distanceM = mapCenter
        ? haversineM(mapCenter, {
            latitude: focus.latitude,
            longitude: focus.longitude,
          })
        : undefined;
      return { ...focus, distanceM };
    }
    return nearestFromBatch(batch, mapCenter);
  }, [batch, mapCenter, status.lastPoiMarkers]);

  const markers = useMemo(
    () =>
      suggested
        ? [
            {
              id: suggested.id,
              title: suggested.title,
              latitude: suggested.latitude,
              longitude: suggested.longitude,
            },
          ]
        : [],
    [suggested],
  );

  const onToggleTrip = useCallback(async () => {
    setBusy(true);
    try {
      if (status.tripActive) {
        setStatus(await endTrip());
      } else {
        setStatus(await startTrip());
      }
    } catch (error) {
      console.warn('trip toggle failed', error);
      setStatus(prev => ({
        ...prev,
        message: t('tripStartFailed'),
      }));
    } finally {
      setBusy(false);
    }
  }, [setBusy, setStatus, status.tripActive, t]);

  const onDirections = useCallback(async () => {
    if (!suggested) {
      return;
    }
    const url = `https://www.google.com/maps/dir/?api=1&destination=${suggested.latitude},${suggested.longitude}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn('directions failed', error);
    }
  }, [suggested]);

  return (
    <ScrollView
      contentContainerStyle={[
        sharedStyles.content,
        (speaking || busy) && sharedStyles.contentWithOverlay,
      ]}
      keyboardShouldPersistTaps="handled">
      <Pressable
        accessibilityRole="button"
        android_ripple={{ color: colors.ripple }}
        style={[
          sharedStyles.primary,
          status.tripActive ? sharedStyles.stop : sharedStyles.go,
          busy && sharedStyles.disabled,
        ]}
        onPress={onToggleTrip}
        disabled={busy}>
        <Text style={sharedStyles.primaryText}>
          {status.tripActive ? t('endTrip') : t('startTrip')}
        </Text>
      </Pressable>

      <View style={sharedStyles.mapCard}>
        <NearbyMap
          center={mapCenter}
          markers={markers}
          radiusM={config.drivingPoiRadiusM}
        />
      </View>
      {status.tripActive ? (
        <Text style={styles.motionHint}>
          {status.moving ? t('moving') : t('stationary')}
          {status.lastLocation
            ? ` · ${Math.round(status.lastLocation.speedKmh)} km/h`
            : ''}
        </Text>
      ) : null}

      {suggested ? (
        <View style={sharedStyles.sectionCard}>
          <Text style={sharedStyles.sectionCardTitle}>{t('driveNextUp')}</Text>
          <Text style={sharedStyles.storyTitle}>{suggested.title}</Text>
          {suggested.distanceM != null ? (
            <Text style={sharedStyles.hint}>
              {t('driveDistance', {
                km: (suggested.distanceM / 1000).toFixed(
                  suggested.distanceM >= 1000 ? 1 : 2,
                ),
              })}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="link"
            android_ripple={{ color: colors.ripple }}
            style={sharedStyles.secondary}
            onPress={() => {
              void onDirections();
            }}>
            <Text style={sharedStyles.secondaryText}>{t('driveDirections')}</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={sharedStyles.hint}>{t('driveNoSuggestion')}</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  motionHint: {
    ...type.caption,
    color: colors.dim,
    marginTop: -space.sm,
    marginBottom: space.sm,
    paddingHorizontal: space.xs,
  },
});
