import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { StatusRow } from '../components/StatusRow';
import { useI18n, type AppLanguage } from '../hooks/useI18n';
import {
  hydrateI18n,
  setNarrationLanguageState,
  setUiLanguageState,
} from '../i18n';
import {
  CATEGORY_IDS,
  confidence,
  decayed,
  evidenceCount,
  getPreferenceProfile,
  meanPreference,
  resetPreferenceProfile,
  setCategoryMuted,
  type CategoryId,
  type PreferenceProfile,
} from '../preferences';
import {
  FAKE_LOCATIONS,
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
import type { StringKey } from '../i18n/types';

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
  const [speedThreshold, setSpeedThreshold] = useState(
    SPEED_THRESHOLD_DEFAULT_KMH,
  );
  const [profile, setProfile] = useState<PreferenceProfile | null>(null);

  const reloadProfile = useCallback(async () => {
    setProfile(await getPreferenceProfile());
  }, []);

  useEffect(() => {
    void getSpeedThresholdKmh().then(setSpeedThreshold);
    void reloadProfile();
  }, [reloadProfile]);

  const loc = status.lastLocation
    ? `${status.lastLocation.latitude.toFixed(4)}, ${status.lastLocation.longitude.toFixed(4)} · ${Math.round(status.lastLocation.speedKmh)} km/h`
    : '—';
  const locDisplay = fakeLocation
    ? `${FAKE_LOCATIONS[fakeLocation].label} (debug) · ${loc}`
    : loc;

  const onUiLanguage = useCallback(async (lang: AppLanguage) => {
    const next = await saveUiLanguage(lang);
    hydrateI18n(next);
    setUiLanguageState(lang);
    if (next.narrationFollowsUi) {
      await applyNarrationLanguage(next.narrationLanguage);
    }
  }, []);

  const onFollowUi = useCallback(
    async (follows: boolean) => {
      const next = await saveNarrationLanguage({
        language: follows ? uiLanguage : narrationLanguage,
        followsUi: follows,
      });
      hydrateI18n(next);
      setNarrationLanguageState(next.narrationLanguage, next.narrationFollowsUi);
      await applyNarrationLanguage(next.narrationLanguage);
    },
    [narrationLanguage, uiLanguage],
  );

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

  return (
    <ScrollView
      contentContainerStyle={sharedStyles.content}
      keyboardShouldPersistTaps="handled">
      <View style={sharedStyles.sectionCard}>
        <Text style={sharedStyles.sectionCardTitle}>{t('uiLanguage')}</Text>
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
      </View>

      <View style={sharedStyles.sectionCard}>
        <Text style={sharedStyles.sectionCardTitle}>
          {t('narrationLanguage')}
        </Text>
        <Pressable
          accessibilityRole="button"
          android_ripple={{ color: colors.ripple }}
          style={[
            sharedStyles.chip,
            { flex: 0, alignSelf: 'stretch' },
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
      </View>

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
        <Text style={sharedStyles.sectionCardTitle}>{t('speedThreshold')}</Text>
        <Text style={sharedStyles.hint}>
          {t('speedThresholdValue', { kmh: Math.round(speedThreshold) })}
        </Text>
        <Text style={sharedStyles.hint}>{t('speedThresholdHint')}</Text>
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
        <Text style={sharedStyles.sectionCardTitle}>{t('profileTitle')}</Text>
        {profile?.summaryText ? (
          <>
            <Text style={sharedStyles.hint}>{t('profileSummary')}</Text>
            <Text style={sharedStyles.message}>{profile.summaryText}</Text>
          </>
        ) : null}
        {CATEGORY_IDS.filter(id => id !== 'other').map(category => {
          const stats = profile?.stats[category];
          const now = Date.now();
          const d = stats
            ? decayed(stats, now)
            : { alpha: 2, beta: 2 };
          const conf = confidence(d.alpha, d.beta, category);
          const mean = meanPreference(d.alpha, d.beta);
          const evidence = Math.round(
            evidenceCount(d.alpha, d.beta, category),
          );
          const muted = profile?.muted.includes(category) ?? false;
          const labelKey = `cat_${category}` as StringKey;
          return (
            <View key={category} style={{ marginTop: space.sm }}>
              <StatusRow
                label={t(labelKey)}
                value={
                  conf < 1
                    ? t('profileStillLearning')
                    : `${Math.round(mean * 100)}% · ${t('profileEvidence', { n: evidence })}`
                }
              />
              <Pressable
                accessibilityRole="button"
                android_ripple={{ color: colors.ripple }}
                style={[
                  sharedStyles.chip,
                  { alignSelf: 'flex-start', marginTop: space.xs },
                  muted && sharedStyles.chipSelected,
                ]}
                onPress={() => {
                  void (async () => {
                    await setCategoryMuted(category as CategoryId, !muted);
                    await reloadProfile();
                  })();
                }}>
                <Text
                  style={[
                    sharedStyles.chipText,
                    muted && sharedStyles.chipTextSelected,
                  ]}>
                  {muted ? t('profileUnmute') : t('profileMute')}
                </Text>
              </Pressable>
              <View style={sharedStyles.divider} />
            </View>
          );
        })}
        <Pressable
          accessibilityRole="button"
          android_ripple={{ color: colors.ripple }}
          style={sharedStyles.secondary}
          onPress={() => {
            Alert.alert(t('profileReset'), t('profileResetConfirm'), [
              { text: t('cancel'), style: 'cancel' },
              {
                text: t('profileReset'),
                style: 'destructive',
                onPress: () => {
                  void (async () => {
                    await resetPreferenceProfile();
                    await reloadProfile();
                  })();
                },
              },
            ]);
          }}>
          <Text style={sharedStyles.secondaryText}>{t('profileReset')}</Text>
        </Pressable>
      </View>

      <View style={sharedStyles.sectionCard}>
        <Text style={sharedStyles.sectionCardTitle}>{t('debugLocation')}</Text>
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
      </View>

      <View style={sharedStyles.sectionCard}>
        <Text style={sharedStyles.sectionCardTitle}>{t('diagnostics')}</Text>
        <StatusRow
          label={t('statusTrip')}
          value={status.tripActive ? t('tripActive') : t('tripIdle')}
        />
        <View style={sharedStyles.divider} />
        <StatusRow
          label={t('statusMotion')}
          value={status.moving ? t('moving') : t('stationary')}
        />
        <View style={sharedStyles.divider} />
        <StatusRow label={t('statusLocation')} value={locDisplay} />
        <View style={sharedStyles.divider} />
        <StatusRow label={t('statusLlm')} value={`${status.llmCalls}`} />
        <View style={sharedStyles.divider} />
        <StatusRow
          label={t('statusPrefetch')}
          value={`${status.prefetchCount}`}
        />
        <View style={sharedStyles.divider} />
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
      accessibilityRole="button"
      accessibilityState={{ selected }}
      android_ripple={{ color: colors.ripple }}
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
