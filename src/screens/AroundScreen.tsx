import { useCallback, useEffect, useState } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LastStoryCard } from '../components/LastStoryCard';
import { MoodRadios } from '../components/MoodRadios';
import { NearbyMap } from '../components/NearbyMap';
import { useI18n } from '../hooks/useI18n';
import { config } from '../config';
import {
  getSessionState,
  setSessionMood,
  type SessionMood,
} from '../preferences';
import { getCurrentLocation } from '../services/location';
import {
  suggestNearbyPlaces,
  type NearbySuggestion,
} from '../services/suggestNearby';
import { walkingNow } from '../services/tripEngine';
import { colors, sharedStyles, space, type } from '../theme';
import type { GeoPoint, TripStatus } from '../types';

type Props = {
  status: TripStatus;
  setStatus: (next: TripStatus) => void;
  speaking: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onNext: () => void;
};

export function AroundScreen({
  status,
  setStatus,
  speaking,
  busy,
  setBusy,
  onNext,
}: Props) {
  const { t } = useI18n();
  const [mapCenter, setMapCenter] = useState<GeoPoint | null>(
    status.lastLocation ?? null,
  );
  const [mood, setMood] = useState<SessionMood>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [more, setMore] = useState<NearbySuggestion[] | null>(null);

  useEffect(() => {
    void getSessionState().then(s => setMood(s.mood));
  }, []);

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
        // Keep placeholder until the user taps around.
      });
    return () => {
      cancelled = true;
    };
  }, [status.lastLocation]);

  const onWalk = useCallback(async () => {
    setBusy(true);
    setMore(null);
    try {
      const next = await walkingNow();
      setStatus(next);
      if (next.lastLocation) {
        setMapCenter(next.lastLocation);
      }
    } finally {
      setBusy(false);
    }
  }, [setBusy, setStatus]);

  const onMore = useCallback(async () => {
    if (moreBusy || busy) {
      return;
    }
    setMoreBusy(true);
    try {
      const here = status.lastLocation ?? (await getCurrentLocation());
      setMapCenter(here);
      const excludeIds = status.lastPoiIds ?? [];
      const list = await suggestNearbyPlaces(here, {
        limit: 5,
        excludeIds,
      });
      setMore(list);
      if (list.length === 0) {
        setStatus({ ...status, message: t('aroundMoreEmpty') });
      }
    } catch (error) {
      console.warn('around more failed', error);
      setStatus({
        ...status,
        message: t('locationFailed'),
      });
    } finally {
      setMoreBusy(false);
    }
  }, [busy, moreBusy, setStatus, status, t]);

  const openMaps = useCallback(async (item: NearbySuggestion) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`;
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.warn('maps open failed', error);
    }
  }, []);

  return (
    <ScrollView
      contentContainerStyle={[
        sharedStyles.content,
        (speaking || busy || moreBusy) && sharedStyles.contentWithOverlay,
      ]}
      keyboardShouldPersistTaps="handled">
      <View style={sharedStyles.mapCard}>
        <NearbyMap
          center={mapCenter}
          markers={status.lastPoiMarkers}
          radiusM={config.walkingPoiRadiusM}
        />
      </View>

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
          sharedStyles.go,
          (busy || moreBusy) && sharedStyles.disabled,
        ]}
        onPress={onWalk}
        disabled={busy || moreBusy}>
        <Text style={sharedStyles.primaryText}>
          {busy ? t('walkingBusy') : t('walking')}
        </Text>
      </Pressable>

      <LastStoryCard
        title={status.lastPoiTitle}
        narration={status.lastNarration}
        exposureId={status.lastExposureId}
        busy={busy}
        onNext={onNext}
      />

      <Pressable
        accessibilityRole="button"
        android_ripple={{ color: colors.ripple }}
        style={[
          sharedStyles.secondary,
          (busy || moreBusy) && sharedStyles.disabled,
        ]}
        onPress={() => {
          void onMore();
        }}
        disabled={busy || moreBusy}>
        <Text style={sharedStyles.secondaryText}>
          {moreBusy ? t('aroundMoreBusy') : t('aroundMore')}
        </Text>
      </Pressable>

      {more && more.length > 0 ? (
        <View style={sharedStyles.sectionCard}>
          {more.map(item => (
            <View key={item.id} style={styles.moreRow}>
              <View style={styles.moreText}>
                <Text style={sharedStyles.storyTitle}>{item.title}</Text>
                <Text style={sharedStyles.hint}>
                  {item.distanceM >= 1000
                    ? `${(item.distanceM / 1000).toFixed(1)} km`
                    : `${Math.round(item.distanceM)} m`}
                  {item.category ? ` · ${item.category}` : ''}
                </Text>
              </View>
              <Pressable
                accessibilityRole="link"
                android_ripple={{ color: colors.ripple }}
                style={styles.mapsBtn}
                onPress={() => {
                  void openMaps(item);
                }}>
                <Text style={styles.mapsBtnText}>{t('aroundMoreOpenMaps')}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  moreRow: {
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  moreText: {
    gap: 2,
  },
  mapsBtn: {
    alignSelf: 'flex-start',
    paddingVertical: space.xs,
  },
  mapsBtnText: {
    ...type.caption,
    color: colors.accent,
    fontWeight: '700',
  },
});
