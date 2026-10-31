import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LastStoryCard } from '../components/LastStoryCard';
import { MoodChips } from '../components/MoodChips';
import { NearbyMap } from '../components/NearbyMap';
import { useI18n } from '../hooks/useI18n';
import { config } from '../config';
import {
  getSessionState,
  setSessionMood,
  type SessionMood,
} from '../preferences';
import { getCurrentLocation } from '../services/location';
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

  return (
    <ScrollView
      contentContainerStyle={[
        sharedStyles.content,
        (speaking || busy) && sharedStyles.contentWithOverlay,
      ]}
      keyboardShouldPersistTaps="handled">
      <View style={sharedStyles.mapCard}>
        <NearbyMap
          center={mapCenter}
          markers={status.lastPoiMarkers}
          radiusM={config.walkingPoiRadiusM}
        />
      </View>

      <MoodChips
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
          busy && sharedStyles.disabled,
        ]}
        onPress={onWalk}
        disabled={busy}>
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
    </ScrollView>
  );
}
