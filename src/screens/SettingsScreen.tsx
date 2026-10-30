import Slider from '@react-native-community/slider';
import { useCallback } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StatusRow } from '../components/StatusRow';
import { useI18n, type AppLanguage } from '../hooks/useI18n';
import {
  hydrateI18n,
  setNarrationLanguageState,
  setUiLanguageState,
} from '../i18n';
import {
  FAKE_LOCATIONS,
  type FakeLocationId,
} from '../services/location';
import {
  SPEECH_RATE_MAX,
  SPEECH_RATE_MIN,
  SPEECH_RATE_STEP,
  saveNarrationLanguage,
  saveUiLanguage,
} from '../services/store';
import { applyNarrationLanguage, applySpeechRate, isSpeaking, speak, stopSpeaking } from '../services/tts';
import { colors, sharedStyles } from '../theme';
import type { TripStatus } from '../types';

type Props = {
  status: TripStatus;
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  fakeLocation: FakeLocationId | null;
  onFakeLocation: (next: FakeLocationId | null) => void;
};

export function SettingsScreen({
  status,
  speechRate,
  setSpeechRate,
  fakeLocation,
  onFakeLocation,
}: Props) {
  const { t, uiLanguage, narrationLanguage, narrationFollowsUi } = useI18n();

  const loc = status.lastLocation
    ? `${status.lastLocation.latitude.toFixed(4)}, ${status.lastLocation.longitude.toFixed(4)} · ${Math.round(status.lastLocation.speedKmh)} km/h`
    : '—';
  const locDisplay = fakeLocation
    ? `${FAKE_LOCATIONS[fakeLocation].label} (debug) · ${loc}`
    : loc;

  const onUiLanguage = useCallback(
    async (lang: AppLanguage) => {
      const next = await saveUiLanguage(lang);
      hydrateI18n(next);
      setUiLanguageState(lang);
      if (next.narrationFollowsUi) {
        await applyNarrationLanguage(next.narrationLanguage);
      }
    },
    [],
  );

  const onFollowUi = useCallback(async (follows: boolean) => {
    const next = await saveNarrationLanguage({
      language: follows ? uiLanguage : narrationLanguage,
      followsUi: follows,
    });
    hydrateI18n(next);
    setNarrationLanguageState(next.narrationLanguage, next.narrationFollowsUi);
    await applyNarrationLanguage(next.narrationLanguage);
  }, [narrationLanguage, uiLanguage]);

  const onNarrationLanguage = useCallback(
    async (lang: AppLanguage) => {
      const next = await saveNarrationLanguage({
        language: lang,
        followsUi: false,
      });
      hydrateI18n(next);
      setNarrationLanguageState(lang, false);
      await applyNarrationLanguage(lang);
    },
    [],
  );

  const onRateChange = useCallback(
    async (rate: number) => {
      const restart = isSpeaking() && Boolean(status.lastNarration);
      if (restart) {
        await stopSpeaking();
      }
      const applied = await applySpeechRate(rate);
      setSpeechRate(applied);
      if (restart && status.lastNarration) {
        await speak(status.lastNarration);
      }
    },
    [setSpeechRate, status.lastNarration],
  );

  return (
    <ScrollView
      contentContainerStyle={sharedStyles.content}
      keyboardShouldPersistTaps="handled">
      <Text style={sharedStyles.title}>{t('settingsTitle')}</Text>

      <Text style={sharedStyles.section}>{t('uiLanguage')}</Text>
      <View style={sharedStyles.rowBtns}>
        <LangChip
          selected={uiLanguage === 'en'}
          label={t('languageEnglish')}
          onPress={() => {
            void onUiLanguage('en');
          }}
        />
        <LangChip
          selected={uiLanguage === 'sr'}
          label={t('languageSerbian')}
          onPress={() => {
            void onUiLanguage('sr');
          }}
        />
      </View>

      <Text style={sharedStyles.section}>{t('narrationLanguage')}</Text>
      <Pressable
        style={[
          sharedStyles.chip,
          narrationFollowsUi && sharedStyles.chipSelected,
        ]}
        onPress={() => {
          void onFollowUi(!narrationFollowsUi);
        }}>
        <Text
          style={[
            sharedStyles.chipText,
            narrationFollowsUi && sharedStyles.chipTextSelected,
          ]}>
          {t('narrationFollowUi')}
        </Text>
      </Pressable>
      {!narrationFollowsUi ? (
        <View style={sharedStyles.rowBtns}>
          <LangChip
            selected={narrationLanguage === 'en'}
            label={t('languageEnglish')}
            onPress={() => {
              void onNarrationLanguage('en');
            }}
          />
          <LangChip
            selected={narrationLanguage === 'sr'}
            label={t('languageSerbian')}
            onPress={() => {
              void onNarrationLanguage('sr');
            }}
          />
        </View>
      ) : null}

      <Text style={sharedStyles.section}>{t('speechRate')}</Text>
      <Text style={sharedStyles.hint}>
        {t('speechRateValue', { rate: speechRate.toFixed(2) })}
      </Text>
      <Slider
        style={{ width: '100%', height: 40 }}
        minimumValue={SPEECH_RATE_MIN}
        maximumValue={SPEECH_RATE_MAX}
        step={SPEECH_RATE_STEP}
        value={speechRate}
        minimumTrackTintColor={colors.accent}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.text}
        onSlidingComplete={value => {
          void onRateChange(value);
        }}
      />

      <Text style={sharedStyles.section}>{t('debugLocation')}</Text>
      <View style={sharedStyles.rowBtns}>
        <LangChip
          selected={fakeLocation === null}
          label={t('debugGps')}
          onPress={() => onFakeLocation(null)}
        />
        <LangChip
          selected={fakeLocation === 'london'}
          label={t('debugLondon')}
          onPress={() => onFakeLocation('london')}
        />
      </View>
      <View style={sharedStyles.rowBtns}>
        <LangChip
          selected={fakeLocation === 'westminster'}
          label={t('debugWestminster')}
          onPress={() => onFakeLocation('westminster')}
        />
        <LangChip
          selected={fakeLocation === 'belgrade'}
          label={t('debugBelgrade')}
          onPress={() => onFakeLocation('belgrade')}
        />
      </View>

      <Text style={sharedStyles.section}>{t('diagnostics')}</Text>
      <View style={sharedStyles.card}>
        <StatusRow
          label={t('statusTrip')}
          value={status.tripActive ? t('tripActive') : t('tripIdle')}
        />
        <StatusRow
          label={t('statusMotion')}
          value={status.moving ? t('moving') : t('stationary')}
        />
        <StatusRow label={t('statusLocation')} value={locDisplay} />
        <StatusRow label={t('statusLlm')} value={`${status.llmCalls}`} />
        <StatusRow
          label={t('statusPrefetch')}
          value={`${status.prefetchCount}`}
        />
        <Text style={sharedStyles.message}>{status.message || '—'}</Text>
      </View>
    </ScrollView>
  );
}

function LangChip({
  selected,
  label,
  onPress,
}: {
  selected: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[sharedStyles.chip, selected && sharedStyles.chipSelected]}
      onPress={onPress}>
      <Text
        style={[
          sharedStyles.chipText,
          selected && sharedStyles.chipTextSelected,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}
