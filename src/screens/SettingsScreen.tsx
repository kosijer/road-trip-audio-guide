import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SectionHelp } from '../components/SectionHelp';
import { SelectField } from '../components/SelectField';
import { StatusRow } from '../components/StatusRow';
import { useI18n, type AppLanguage } from '../hooks/useI18n';
import {
  hydrateI18n,
  setNarrationLanguageState,
  setUiLanguageState,
} from '../i18n';
import {
  FAKE_LOCATIONS,
  isSimulateMotion,
  setSimulateMotion,
  type FakeLocationId,
} from '../services/location';
import {
  SPEED_THRESHOLD_DEFAULT_KMH,
  SPEED_THRESHOLD_MAX_KMH,
  SPEED_THRESHOLD_MIN_KMH,
  SPEED_THRESHOLD_STEP_KMH,
  SPEECH_RATE_MAX,
  SPEECH_RATE_MIN,
  SPEECH_RATE_STEP,
  getSpeedThresholdKmh,
  saveNarrationLanguage,
  saveSpeedThresholdKmh,
  saveUiLanguage,
} from '../services/store';
import {
  applyNarrationLanguage,
  applySpeechRate,
  isSpeaking,
  speak,
  stopSpeaking,
} from '../services/tts';
import { colors, sharedStyles, space } from '../theme';
import type { TripStatus } from '../types';

type Props = {
  status: TripStatus;
  speechRate: number;
  setSpeechRate: (rate: number) => void;
  fakeLocation: FakeLocationId | null;
  onFakeLocation: (next: FakeLocationId | null) => void;
};

type DebugLocationValue = 'gps' | FakeLocationId;

export function SettingsScreen({
  status,
  speechRate,
  setSpeechRate,
  fakeLocation,
  onFakeLocation,
}: Props) {
  const { t, uiLanguage, narrationLanguage, narrationFollowsUi } = useI18n();
  const [speedThreshold, setSpeedThreshold] = useState(
    SPEED_THRESHOLD_DEFAULT_KMH,
  );
  const [simMotion, setSimMotion] = useState(isSimulateMotion());

  useEffect(() => {
    void getSpeedThresholdKmh().then(setSpeedThreshold);
  }, []);

  useEffect(() => {
    if (!fakeLocation) {
      setSimMotion(false);
    }
  }, [fakeLocation]);

  const loc = status.lastLocation
    ? `${status.lastLocation.latitude.toFixed(4)}, ${status.lastLocation.longitude.toFixed(4)} · ${Math.round(status.lastLocation.speedKmh)} km/h`
    : '—';
  const locDisplay = fakeLocation
    ? `${FAKE_LOCATIONS[fakeLocation].label} (debug) · ${loc}`
    : loc;

  const languageOptions = useMemo(
    () => [
      { value: 'en' as const, label: t('languageEnglish') },
      { value: 'sr' as const, label: t('languageSerbian') },
    ],
    [t],
  );

  const debugOptions = useMemo(
    () => [
      { value: 'gps' as const, label: t('debugGps') },
      { value: 'london' as const, label: t('debugLondon') },
      { value: 'westminster' as const, label: t('debugWestminster') },
      { value: 'belgrade' as const, label: t('debugBelgrade') },
    ],
    [t],
  );

  const onUiLanguage = useCallback(async (lang: AppLanguage) => {
    const next = await saveUiLanguage(lang);
    hydrateI18n(next);
    setUiLanguageState(lang);
    if (next.narrationFollowsUi) {
      await applyNarrationLanguage(next.narrationLanguage);
    }
  }, []);

  const onFollowUi = useCallback(async () => {
    const follows = !narrationFollowsUi;
    const next = await saveNarrationLanguage({
      language: follows ? uiLanguage : narrationLanguage,
      followsUi: follows,
    });
    hydrateI18n(next);
    setNarrationLanguageState(next.narrationLanguage, next.narrationFollowsUi);
    await applyNarrationLanguage(next.narrationLanguage);
  }, [narrationFollowsUi, narrationLanguage, uiLanguage]);

  const onNarrationLanguage = useCallback(async (lang: AppLanguage) => {
    const next = await saveNarrationLanguage({
      language: lang,
      followsUi: false,
    });
    hydrateI18n(next);
    setNarrationLanguageState(lang, false);
    await applyNarrationLanguage(lang);
  }, []);

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

  const onSpeedThreshold = useCallback(async (kmh: number) => {
    setSpeedThreshold(await saveSpeedThresholdKmh(kmh));
  }, []);

  const onDebugChange = useCallback(
    (value: DebugLocationValue) => {
      onFakeLocation(value === 'gps' ? null : value);
      if (value === 'gps') {
        setSimulateMotion(false);
        setSimMotion(false);
      }
    },
    [onFakeLocation],
  );

  const onSimMotion = useCallback(() => {
    if (!fakeLocation) {
      return;
    }
    const next = setSimulateMotion(!simMotion);
    setSimMotion(next);
  }, [fakeLocation, simMotion]);

  return (
    <ScrollView
      contentContainerStyle={sharedStyles.content}
      keyboardShouldPersistTaps="handled">
      <View style={sharedStyles.sectionCard}>
        <SelectField
          label={t('uiLanguage')}
          value={uiLanguage}
          options={languageOptions}
          onChange={lang => {
            void onUiLanguage(lang);
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: narrationFollowsUi }}
          hitSlop={6}
          onPress={() => {
            void onFollowUi();
          }}>
          <Text
            style={[
              styles.matchLink,
              narrationFollowsUi && styles.matchLinkOn,
            ]}>
            {narrationFollowsUi
              ? `✓ ${t('narrationFollowUi')}`
              : t('narrationFollowUi')}
          </Text>
        </Pressable>
      </View>

      {!narrationFollowsUi ? (
        <View style={sharedStyles.sectionCard}>
          <SelectField
            label={t('narrationLanguage')}
            value={narrationLanguage}
            options={languageOptions}
            onChange={lang => {
              void onNarrationLanguage(lang);
            }}
          />
        </View>
      ) : null}

      <View style={sharedStyles.sectionCard}>
        <Text style={sharedStyles.sectionCardTitle}>{t('speechRate')}</Text>
        <Text style={sharedStyles.hint}>
          {t('speechRateValue', { rate: speechRate.toFixed(2) })}
        </Text>
        <Slider
          style={{ width: '100%', height: 40, marginVertical: space.xs }}
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
      </View>

      <View style={sharedStyles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={[sharedStyles.sectionCardTitle, styles.sectionTitle]}>
            {t('speedThreshold')}
          </Text>
          <SectionHelp
            title={t('speedThreshold')}
            body={t('speedThresholdHint')}
          />
        </View>
        <Text style={sharedStyles.hint}>
          {t('speedThresholdValue', { kmh: Math.round(speedThreshold) })}
        </Text>
        <Slider
          style={{ width: '100%', height: 40, marginVertical: space.xs }}
          minimumValue={SPEED_THRESHOLD_MIN_KMH}
          maximumValue={SPEED_THRESHOLD_MAX_KMH}
          step={SPEED_THRESHOLD_STEP_KMH}
          value={speedThreshold}
          minimumTrackTintColor={colors.accent}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.text}
          onSlidingComplete={value => {
            void onSpeedThreshold(value);
          }}
        />
      </View>

      <View style={sharedStyles.sectionCard}>
        <SelectField
          label={t('debugLocation')}
          value={(fakeLocation ?? 'gps') as DebugLocationValue}
          options={debugOptions}
          onChange={onDebugChange}
        />
        {fakeLocation ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: simMotion }}
              hitSlop={6}
              onPress={onSimMotion}>
              <Text
                style={[
                  styles.matchLink,
                  simMotion && styles.matchLinkOn,
                ]}>
                {simMotion
                  ? `✓ ${t('debugSimulateMotion')}`
                  : t('debugSimulateMotion')}
              </Text>
            </Pressable>
            <Text style={sharedStyles.hint}>{t('debugSimulateMotionHint')}</Text>
          </>
        ) : null}
      </View>

      <View style={sharedStyles.sectionCard}>
        <Text style={sharedStyles.sectionCardTitle}>{t('diagnostics')}</Text>
        <StatusRow label={t('statusLocation')} value={locDisplay} />
        <View style={sharedStyles.divider} />
        <StatusRow label={t('statusLlm')} value={`${status.llmCalls}`} />
        <View style={sharedStyles.divider} />
        <StatusRow
          label={t('statusPrefetch')}
          value={`${status.prefetchCount}`}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginBottom: space.xs,
  },
  sectionTitle: {
    flex: 1,
    marginBottom: 0,
  },
  matchLink: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.dim,
    fontWeight: '600',
  },
  matchLinkOn: {
    color: colors.accent,
  },
});
