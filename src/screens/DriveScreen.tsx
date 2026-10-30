import { useCallback, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LastStoryCard } from '../components/LastStoryCard';
import { PlaybackRow } from '../components/PlaybackRow';
import { StatusRow } from '../components/StatusRow';
import { useI18n } from '../hooks/useI18n';
import { getCurrentLocation } from '../services/location';
import { runPrefetch } from '../services/routePrefetch';
import { getStatus } from '../services/store';
import { endTrip, startTrip } from '../services/tripEngine';
import { sharedStyles } from '../theme';
import type { TripStatus } from '../types';

type Props = {
  status: TripStatus;
  setStatus: (next: TripStatus | ((prev: TripStatus) => TripStatus)) => void;
  speaking: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onStopSpeech: () => void;
  onNext: () => void;
};

export function DriveScreen({
  status,
  setStatus,
  speaking,
  busy,
  setBusy,
  onStopSpeech,
  onNext,
}: Props) {
  const { t } = useI18n();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');

  const onToggleTrip = useCallback(async () => {
    setBusy(true);
    try {
      if (status.tripActive) {
        setStatus(await endTrip());
      } else {
        setStatus(await startTrip());
      }
    } finally {
      setBusy(false);
    }
  }, [setBusy, setStatus, status.tripActive]);

  const onPrefetch = useCallback(async () => {
    if (!destination.trim()) {
      return;
    }
    setBusy(true);
    try {
      let from = origin.trim();
      if (!from) {
        const here = await getCurrentLocation();
        from = `${here.latitude},${here.longitude}`;
      }
      const count = await runPrefetch(from, destination.trim(), message =>
        setStatus(prev => ({ ...prev, message })),
      );
      const next = await getStatus();
      setStatus({
        ...next,
        prefetchCount: count,
        message: t('prefetchDone', { count }),
      });
    } catch {
      setStatus(prev => ({ ...prev, message: t('prefetchFailed') }));
    } finally {
      setBusy(false);
    }
  }, [destination, origin, setBusy, setStatus, t]);

  return (
    <ScrollView
      contentContainerStyle={sharedStyles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={sharedStyles.title}>{t('appName')}</Text>
      <Text style={sharedStyles.subtitle}>{t('subtitle')}</Text>

      <Pressable
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

      <PlaybackRow
        speaking={speaking}
        busy={busy}
        onStop={onStopSpeech}
        onNext={onNext}
      />

      <View style={sharedStyles.card}>
        <StatusRow
          label={t('statusTrip')}
          value={status.tripActive ? t('tripActive') : t('tripIdle')}
        />
        <Text style={sharedStyles.message}>{status.message || '—'}</Text>
      </View>

      <Text style={sharedStyles.section}>{t('routePrep')}</Text>
      <Text style={sharedStyles.hint}>{t('prefetchHint')}</Text>
      <TextInput
        value={origin}
        onChangeText={setOrigin}
        placeholder={t('originPlaceholder')}
        placeholderTextColor="#8a7d72"
        style={sharedStyles.input}
      />
      <TextInput
        value={destination}
        onChangeText={setDestination}
        placeholder={t('destinationPlaceholder')}
        placeholderTextColor="#8a7d72"
        style={sharedStyles.input}
      />
      <Pressable
        style={[sharedStyles.secondary, busy && sharedStyles.disabled]}
        onPress={onPrefetch}
        disabled={busy || !destination.trim()}>
        <Text style={sharedStyles.secondaryText}>
          {busy ? t('prefetching') : t('prefetch')}
        </Text>
      </Pressable>

      <LastStoryCard
        title={status.lastPoiTitle}
        narration={status.lastNarration}
      />
    </ScrollView>
  );
}
