import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { MoodRadios } from '../components/MoodRadios';
import { NearbyMap } from '../components/NearbyMap';
import { PlaceAccordionList } from '../components/PlaceAccordionList';
import { PlaceStoryCard } from '../components/PlaceStoryCard';
import { useI18n } from '../hooks/useI18n';
import { config } from '../config';
import {
  getSessionState,
  setSessionMood,
  type SessionMood,
} from '../preferences';
import { getFreshLocation } from '../services/location';
import {
  suggestNearbyPlaces,
  type NearbySuggestion,
} from '../services/suggestNearby';
import { walkingNow } from '../services/tripEngine';
import { colors, sharedStyles } from '../theme';
import type { GeoPoint, TripStatus } from '../types';

type Props = {
  status: TripStatus;
  setStatus: (next: TripStatus) => void;
  speaking: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onNext: () => void;
};

function formatDistanceM(distanceM: number): string {
  return distanceM >= 1000
    ? `${(distanceM / 1000).toFixed(1)} km`
    : `${Math.round(distanceM)} m`;
}

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
  const locating = mapCenter == null;
  const [mood, setMood] = useState<SessionMood>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [more, setMore] = useState<NearbySuggestion[] | null>(null);
  /** “More nearby” only after a successful Around me this visit to the tab. */
  const [hasAroundResult, setHasAroundResult] = useState(false);

  useEffect(() => {
    void getSessionState().then(s => setMood(s.mood));
  }, []);

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
        // Keep placeholder until the user taps around.
      });
    return () => {
      cancelled = true;
    };
  }, [status.lastLocation]);

  const focus = status.lastPoiMarkers?.[0];

  const onWalk = useCallback(async () => {
    setBusy(true);
    setMore(null);
    try {
      const next = await walkingNow();
      setStatus(next);
      if (next.lastLocation) {
        setMapCenter(next.lastLocation);
      }
      setHasAroundResult(
        Boolean(next.lastNarration?.trim() || next.lastPoiTitle?.trim()),
      );
    } catch {
      setHasAroundResult(false);
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
      const here = await getFreshLocation();
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

  const moreItems = useMemo(
    () =>
      (more ?? []).map(item => ({
        id: item.id,
        title: item.title,
        distanceLabel: `${formatDistanceM(item.distanceM)}${
          item.category ? ` · ${item.category}` : ''
        }`,
        summary: item.summary,
        latitude: item.latitude,
        longitude: item.longitude,
      })),
    [more],
  );

  const mapMarkers = useMemo(() => {
    const byId = new Map<
      string,
      { id: string; title: string; latitude: number; longitude: number }
    >();
    for (const m of status.lastPoiMarkers ?? []) {
      byId.set(m.id, m);
    }
    for (const item of more ?? []) {
      byId.set(item.id, {
        id: item.id,
        title: item.title,
        latitude: item.latitude,
        longitude: item.longitude,
      });
    }
    return [...byId.values()];
  }, [more, status.lastPoiMarkers]);

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
          markers={mapMarkers}
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
          (busy || moreBusy || locating) && sharedStyles.disabled,
        ]}
        onPress={onWalk}
        disabled={busy || moreBusy || locating}>
        <Text style={sharedStyles.primaryText}>
          {busy ? t('walkingBusy') : locating ? t('locating') : t('walking')}
        </Text>
      </Pressable>

      {hasAroundResult ? (
        <PlaceStoryCard
          title={status.lastPoiTitle}
          narration={status.lastNarration}
          exposureId={status.lastExposureId}
          latitude={focus?.latitude}
          longitude={focus?.longitude}
          mapsMode="walking"
          busy={busy}
          onNext={onNext}
        />
      ) : null}

      {hasAroundResult ? (
        <Pressable
          accessibilityRole="button"
          android_ripple={{ color: colors.ripple }}
          style={[
            sharedStyles.secondary,
            (busy || moreBusy || locating) && sharedStyles.disabled,
          ]}
          onPress={() => {
            void onMore();
          }}
          disabled={busy || moreBusy || locating}>
          <Text style={sharedStyles.secondaryText}>
            {moreBusy ? t('aroundMoreBusy') : t('aroundMore')}
          </Text>
        </Pressable>
      ) : null}

      {hasAroundResult && moreItems.length > 0 ? (
        <PlaceAccordionList items={moreItems} />
      ) : null}
    </ScrollView>
  );
}
