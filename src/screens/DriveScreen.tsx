import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MoodRadios } from '../components/MoodRadios';
import { NearbyMap } from '../components/NearbyMap';
import { PlaceStoryCard } from '../components/PlaceStoryCard';
import { useI18n } from '../hooks/useI18n';
import { haversineM } from '../geo';
import { config } from '../config';
import {
  getSessionState,
  setSessionMood,
  type SessionMood,
} from '../preferences';
import { getFreshLocation } from '../services/location';
import { prefetchBatchUsableForDrive } from '../services/prefetch';
import { getPrefetchBatch } from '../services/store';
import {
  endTrip,
  skipUpcomingTeaser,
  startTrip,
} from '../services/tripEngine';
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
  const locating = mapCenter == null;
  const [batch, setBatch] = useState<PrefetchBatch | null>(null);
  const [mood, setMood] = useState<SessionMood>(null);
  const [skipBusy, setSkipBusy] = useState(false);

  useEffect(() => {
    void getSessionState().then(s => setMood(s.mood));
  }, []);

  useEffect(() => {
    void getPrefetchBatch().then(next => {
      setBatch(prefetchBatchUsableForDrive(next) ? next : null);
    });
  }, [status.prefetchCount, status.tripActive]);

  useEffect(() => {
    if (status.lastLocation) {
      setMapCenter(status.lastLocation);
    }
    let cancelled = false;
    void getFreshLocation()
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

  const upcoming = status.upcomingPoi;
  const showComingUp =
    status.tripActive &&
    Boolean(upcoming) &&
    (status.drivePhase === 'teaser' || status.drivePhase === 'hold');

  const suggested = useMemo((): SuggestedPlace | null => {
    if (status.tripActive && upcoming) {
      return {
        id: upcoming.id,
        title: upcoming.title,
        latitude: upcoming.latitude,
        longitude: upcoming.longitude,
        distanceM: upcoming.distanceM,
      };
    }
    if (status.tripActive) {
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
      return null;
    }
    return nearestFromBatch(batch, mapCenter);
  }, [batch, mapCenter, status.lastPoiMarkers, status.tripActive, upcoming]);

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

  const onSkip = useCallback(async () => {
    if (skipBusy) {
      return;
    }
    setSkipBusy(true);
    try {
      setStatus(await skipUpcomingTeaser());
    } finally {
      setSkipBusy(false);
    }
  }, [setStatus, skipBusy]);

  const focus = status.lastPoiMarkers?.[0];
  const showNarrated = Boolean(
    status.lastNarration && status.tripActive && !showComingUp,
  );
  const distanceLabel =
    suggested?.distanceM != null
      ? t('driveDistance', {
          km: (suggested.distanceM / 1000).toFixed(
            suggested.distanceM >= 1000 ? 1 : 2,
          ),
        })
      : undefined;

  return (
    <ScrollView
      contentContainerStyle={[
        sharedStyles.content,
        (speaking || busy || skipBusy) && sharedStyles.contentWithOverlay,
      ]}
      keyboardShouldPersistTaps="handled">
      <View style={sharedStyles.mapCard}>
        <NearbyMap
          center={mapCenter}
          markers={markers}
          radiusM={config.drivingPoiRadiusM}
          showRadius={false}
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

      <MoodRadios
        mood={mood}
        onChange={next => {
          setMood(next);
          void setSessionMood(next);
        }}
      />

      <Pressable
        accessibilityRole="button"
        android_ripple={{ color: colors.ripple }}
        style={[
          sharedStyles.primary,
          status.tripActive ? sharedStyles.stop : sharedStyles.go,
          (busy || (!status.tripActive && locating)) && sharedStyles.disabled,
        ]}
        onPress={onToggleTrip}
        disabled={busy || (!status.tripActive && locating)}>
        <Text style={sharedStyles.primaryText}>
          {status.tripActive
            ? t('endTrip')
            : locating
              ? t('locating')
              : t('startTrip')}
        </Text>
      </Pressable>

      {showComingUp && upcoming ? (
        <View style={styles.comingUp}>
          <Text style={styles.comingUpLabel}>{t('driveComingUp')}</Text>
          <Text style={styles.comingUpTitle}>{upcoming.title}</Text>
          {status.teaserText ? (
            <Text style={styles.comingUpBody}>{status.teaserText}</Text>
          ) : null}
          {upcoming.etaMin != null || upcoming.distanceM != null ? (
            <Text style={sharedStyles.hint}>
              {[
                upcoming.etaMin != null ? `~${upcoming.etaMin} min` : null,
                distanceLabel,
                upcoming.side,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          ) : null}
          {status.drivePhase === 'hold' ? (
            <Text style={sharedStyles.hint}>{t('driveTeaserHoldHint')}</Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: colors.ripple }}
            style={[
              sharedStyles.secondary,
              (busy || skipBusy) && sharedStyles.disabled,
            ]}
            onPress={() => {
              void onSkip();
            }}
            disabled={busy || skipBusy}>
            <Text style={sharedStyles.secondaryText}>
              {t('driveTeaserSkip')}
            </Text>
          </Pressable>
        </View>
      ) : showNarrated ? (
        <PlaceStoryCard
          title={status.lastPoiTitle}
          narration={status.lastNarration}
          exposureId={status.lastExposureId}
          latitude={focus?.latitude}
          longitude={focus?.longitude}
          mapsMode="driving"
          distanceLabel={
            focus && mapCenter
              ? t('driveDistance', {
                  km: (
                    haversineM(mapCenter, {
                      latitude: focus.latitude,
                      longitude: focus.longitude,
                    }) / 1000
                  ).toFixed(1),
                })
              : undefined
          }
          busy={busy}
        />
      ) : suggested && !status.tripActive ? (
        <PlaceStoryCard
          title={suggested.title}
          distanceLabel={distanceLabel}
          latitude={suggested.latitude}
          longitude={suggested.longitude}
          mapsMode={batch?.mode === 'walking' ? 'walking' : 'driving'}
          showRating={false}
        />
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
  comingUp: {
    gap: space.sm,
    marginTop: space.sm,
  },
  comingUpLabel: {
    ...type.caption,
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  comingUpTitle: {
    ...type.title,
    color: colors.text,
  },
  comingUpBody: {
    ...type.body,
    color: colors.text,
  },
});
