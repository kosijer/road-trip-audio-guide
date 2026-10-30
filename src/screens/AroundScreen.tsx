import { useCallback } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { LastStoryCard } from '../components/LastStoryCard';
import { PlaybackRow } from '../components/PlaybackRow';
import { useI18n } from '../hooks/useI18n';
import { walkingNow } from '../services/tripEngine';
import { sharedStyles } from '../theme';
import type { TripStatus } from '../types';

type Props = {
  status: TripStatus;
  setStatus: (next: TripStatus) => void;
  speaking: boolean;
  busy: boolean;
  setBusy: (busy: boolean) => void;
  onStopSpeech: () => void;
  onNext: () => void;
};

export function AroundScreen({
  status,
  setStatus,
  speaking,
  busy,
  setBusy,
  onStopSpeech,
  onNext,
}: Props) {
  const { t } = useI18n();

  const onWalk = useCallback(async () => {
    setBusy(true);
    try {
      setStatus(await walkingNow());
    } finally {
      setBusy(false);
    }
  }, [setBusy, setStatus]);

  return (
    <ScrollView
      contentContainerStyle={sharedStyles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={sharedStyles.title}>{t('tabAround')}</Text>
      <Text style={sharedStyles.subtitle}>{t('subtitle')}</Text>

      <Pressable
        style={[sharedStyles.secondary, busy && sharedStyles.disabled]}
        onPress={onWalk}
        disabled={busy}>
        <Text style={sharedStyles.secondaryText}>
          {busy ? t('walkingBusy') : t('walking')}
        </Text>
      </Pressable>

      <PlaybackRow
        speaking={speaking}
        busy={busy}
        onStop={onStopSpeech}
        onNext={onNext}
      />

      <Text style={sharedStyles.message}>{status.message || '—'}</Text>

      <LastStoryCard
        title={status.lastPoiTitle}
        narration={status.lastNarration}
      />
    </ScrollView>
  );
}
