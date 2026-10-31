import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { LastStoryCard } from '../components/LastStoryCard';
import { NearbyMap } from '../components/NearbyMap';
import { useI18n } from '../hooks/useI18n';
import { config } from '../config';
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
};

export function AroundScreen({
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

      {status.message.trim() ? (
        <View style={sharedStyles.card}>
          <Text style={sharedStyles.message}>{status.message}</Text>
        </View>
      ) : null}

      <LastStoryCard
        title={status.lastPoiTitle}
        narration={status.lastNarration}
      />
    </ScrollView>
  );
}
