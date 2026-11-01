import Slider from '@react-native-community/slider';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Accordion } from '../components/Accordion';
import { CorridorMap } from '../components/CorridorMap';
import { SettingsIcon } from '../components/Icons';
import { useI18n } from '../hooks/useI18n';
import { getCurrentLocation } from '../services/location';
import {
  INSPIRE_BUDGET_MAX,
  INSPIRE_BUDGET_MIN,
  INSPIRE_BUDGET_STEP,
  runInspireLoop,
  type InspireMode,
} from '../services/inspireLoop';
import { runPrefetch } from '../services/routePrefetch';
import {
  clearPrefetchBatch,
  getPrefetchBatch,
  getPrefetchPlaceTarget,
  getStatus,
  savePrefetchPlaceTarget,
} from '../services/store';
import { colors, radius, sharedStyles, space, touchMin, type } from '../theme';
import {
  PREFETCH_PLACE_OPTIONS,
  type PrefetchBatch,
  type PrefetchPlaceTarget,
  type TripStatus,
} from '../types';

type Props = {
  status: TripStatus;
  setStatus: (next: TripStatus | ((prev: TripStatus) => TripStatus)) => void;
  busy: boolean;
};

type PlanMode = 'loop' | 'ab';

function budgetLabel(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours} h` : `${hours.toFixed(1)} h`;
}

export function PlanScreen({ status, setStatus, busy }: Props) {
  const { t } = useI18n();
  const [planMode, setPlanMode] = useState<PlanMode>('loop');

  const [inspireOrigin, setInspireOrigin] = useState('');
  const [inspireMode, setInspireMode] = useState<InspireMode>('walking');
  const [budgetMin, setBudgetMin] = useState(60);
  const [inspiring, setInspiring] = useState(false);
  const [inspireProgress, setInspireProgress] = useState('');

  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [prefetching, setPrefetching] = useState(false);
  const [prefetchProgress, setPrefetchProgress] = useState('');
  const [placeTarget, setPlaceTarget] = useState<PrefetchPlaceTarget>(12);
  const [batch, setBatch] = useState<PrefetchBatch | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPlaceSettings, setShowPlaceSettings] = useState(false);

  const working = inspiring || prefetching;
  const blocked = busy || working;

  useEffect(() => {
    void (async () => {
      setPlaceTarget(await getPrefetchPlaceTarget());
      const existing = await getPrefetchBatch();
      setBatch(existing);
      if (existing?.kind === 'loop') {
        setPlanMode('loop');
      } else if (existing) {
        setPlanMode('ab');
      }
    })();
  }, []);

  const onPlaceTarget = useCallback(async (next: PrefetchPlaceTarget) => {
    setPlaceTarget(next);
    await savePrefetchPlaceTarget(next);
    setShowPlaceSettings(false);
  }, []);

  const mapInspireProgress = useCallback(
    (raw: string) => {
      if (raw === 'inspire_discover') {
        return t('inspireDiscover');
      }
      if (raw === 'inspire_ranking') {
        return t('inspireRanking');
      }
      if (raw === 'inspire_prefetch') {
        return t('inspirePrefetch');
      }
      return t('inspireBusy');
    },
    [t],
  );

  const onInspire = useCallback(async () => {
    if (inspiring) {
      return;
    }
    setInspiring(true);
    setInspireProgress(t('inspireBusy'));
    setExpandedId(null);
    setStatus(prev => ({ ...prev, message: '' }));
    try {
      const trimmed = inspireOrigin.trim();
      let label = trimmed;
      let point;
      const coord = trimmed.match(
        /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/,
      );
      if (coord) {
        point = {
          latitude: Number(coord[1]),
          longitude: Number(coord[2]),
        };
      } else {
        const here = await getCurrentLocation();
        point = here;
        if (!trimmed) {
          label = `${here.latitude.toFixed(4)}, ${here.longitude.toFixed(4)}`;
        }
      }

      const { stopCount, cacheCount, batch: nextBatch } = await runInspireLoop({
        originLabel: label,
        origin: point,
        mode: inspireMode,
        budgetMin,
        onProgress: message => setInspireProgress(mapInspireProgress(message)),
      });
      setBatch(nextBatch);
      if (!inspireOrigin.trim()) {
        setInspireOrigin(label);
      }
      const next = await getStatus();
      setStatus({
        ...next,
        prefetchCount: cacheCount,
        message: t('inspireDone', { count: stopCount }),
      });
    } catch (error) {
      console.warn('inspire failed', error);
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('location')) {
        setStatus(prev => ({ ...prev, message: t('locationFailed') }));
      } else if (
        msg.includes('network_failed') ||
        msg.includes('Network request failed')
      ) {
        setStatus(prev => ({ ...prev, message: t('prefetchNetworkFailed') }));
      } else {
        setStatus(prev => ({ ...prev, message: t('inspireEmpty') }));
      }
    } finally {
      setInspiring(false);
      setInspireProgress('');
    }
  }, [
    budgetMin,
    inspireMode,
    inspireOrigin,
    inspiring,
    mapInspireProgress,
    setStatus,
    t,
  ]);

  const onPrefetch = useCallback(async () => {
    if (!destination.trim() || prefetching) {
      return;
    }
    setPrefetching(true);
    setPrefetchProgress(t('prefetching'));
    setExpandedId(null);
    setStatus(prev => ({ ...prev, message: '' }));
    try {
      let from = origin.trim();
      if (!from) {
        const here = await getCurrentLocation();
        from = `${here.latitude},${here.longitude}`;
      }
      const { count, batch: nextBatch } = await runPrefetch(
        from,
        destination.trim(),
        message => setPrefetchProgress(message),
      );
      setBatch(nextBatch);
      if (!origin.trim()) {
        setOrigin(from);
      }
      const next = await getStatus();
      setStatus({
        ...next,
        prefetchCount: count,
        message: t('prefetchDone', { count }),
      });
    } catch (error) {
      console.warn('prefetch failed', error);
      const network =
        error instanceof Error &&
        (error.message.includes('network_failed') ||
          error.message.includes('Network request failed'));
      setStatus(prev => ({
        ...prev,
        message: network ? t('prefetchNetworkFailed') : t('prefetchFailed'),
      }));
    } finally {
      setPrefetching(false);
      setPrefetchProgress('');
    }
  }, [destination, origin, prefetching, setStatus, t]);

  const onClearRoute = useCallback(async () => {
    await clearPrefetchBatch();
    setBatch(null);
    setExpandedId(null);
    setStatus(prev => ({
      ...prev,
      prefetchCount: 0,
      message: '',
    }));
  }, [setStatus]);

  const markers = useMemo(() => {
    if (batch?.kind === 'loop' && batch.stops?.length) {
      return batch.stops.map(s => ({
        id: s.id,
        title: s.title,
        latitude: s.latitude,
        longitude: s.longitude,
      }));
    }
    return (batch?.pois ?? []).map(poi => ({
      id: poi.id,
      title: poi.title,
      latitude: poi.latitude,
      longitude: poi.longitude,
    }));
  }, [batch]);

  const showPreview =
    batch != null &&
    ((planMode === 'loop' && batch.kind === 'loop') ||
      (planMode === 'ab' && batch.kind !== 'loop'));

  return (
    <ScrollView
      contentContainerStyle={sharedStyles.content}
      keyboardShouldPersistTaps="handled">
      <View style={styles.modeTabs}>
        {(
          [
            ['loop', 'planTabLoop'],
            ['ab', 'planTabAb'],
          ] as const
        ).map(([mode, labelKey]) => {
          const selected = planMode === mode;
          return (
            <Pressable
              key={mode}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              android_ripple={{ color: colors.ripple }}
              style={[styles.modeTab, selected && styles.modeTabOn]}
              disabled={working}
              onPress={() => setPlanMode(mode)}>
              <Text style={[styles.modeTabText, selected && styles.modeTabTextOn]}>
                {t(labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {planMode === 'loop' ? (
        <View style={sharedStyles.sectionCard}>
          <Text style={sharedStyles.hint}>{t('inspireHint')}</Text>
          <TextInput
            value={inspireOrigin}
            onChangeText={setInspireOrigin}
            placeholder={t('inspireOriginPlaceholder')}
            placeholderTextColor={colors.dim}
            style={sharedStyles.input}
            editable={!inspiring}
          />
          <View style={sharedStyles.rowBtns}>
            {(
              [
                ['walking', 'inspireWalk'],
                ['driving', 'inspireDrive'],
              ] as const
            ).map(([mode, labelKey]) => {
              const selected = inspireMode === mode;
              return (
                <Pressable
                  key={mode}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  android_ripple={{ color: colors.ripple }}
                  style={[
                    sharedStyles.chip,
                    selected && sharedStyles.chipSelected,
                  ]}
                  disabled={inspiring}
                  onPress={() => setInspireMode(mode)}>
                  <Text
                    style={[
                      sharedStyles.chipText,
                      selected && sharedStyles.chipTextSelected,
                    ]}>
                    {t(labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.budgetLabel}>{t('inspireBudget')}</Text>
          <Text style={sharedStyles.hint}>
            {t('inspireBudgetValue', { label: budgetLabel(budgetMin) })}
          </Text>
          <Slider
            style={{ width: '100%', height: 40, marginVertical: space.xs }}
            minimumValue={INSPIRE_BUDGET_MIN}
            maximumValue={INSPIRE_BUDGET_MAX}
            step={INSPIRE_BUDGET_STEP}
            value={budgetMin}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.border}
            thumbTintColor={colors.text}
            disabled={inspiring}
            onValueChange={setBudgetMin}
          />
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: colors.ripple }}
            style={[
              sharedStyles.primary,
              sharedStyles.go,
              blocked && sharedStyles.disabled,
              styles.ctaRow,
            ]}
            onPress={() => {
              void onInspire();
            }}
            disabled={blocked}>
            {inspiring ? (
              <ActivityIndicator color={colors.white} style={styles.spinner} />
            ) : null}
            <Text style={sharedStyles.primaryText} numberOfLines={2}>
              {inspiring
                ? inspireProgress || t('inspireBusy')
                : t('inspireSuggest')}
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={sharedStyles.sectionCard}>
          <View style={styles.routeHeader}>
            <Text style={[sharedStyles.hint, styles.routeHint]}>
              {t('planHint')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('prefetchPlaces')}
              android_ripple={{ color: colors.ripple, borderless: true }}
              style={styles.gearBtn}
              onPress={() => setShowPlaceSettings(v => !v)}
              hitSlop={8}>
              <SettingsIcon
                color={showPlaceSettings ? colors.accent : colors.muted}
                size={18}
                bg={colors.surface}
              />
            </Pressable>
          </View>
          {showPlaceSettings ? (
            <View style={styles.placeSettings}>
              <Text style={styles.samplesLabel}>{t('prefetchPlaces')}</Text>
              <Text style={sharedStyles.hint}>{t('prefetchPlacesHint')}</Text>
              <View style={sharedStyles.rowBtns}>
                {PREFETCH_PLACE_OPTIONS.map(option => (
                  <Pressable
                    key={option}
                    accessibilityRole="button"
                    accessibilityState={{ selected: placeTarget === option }}
                    android_ripple={{ color: colors.ripple }}
                    style={[
                      sharedStyles.chip,
                      placeTarget === option && sharedStyles.chipSelected,
                    ]}
                    disabled={prefetching}
                    onPress={() => {
                      void onPlaceTarget(option);
                    }}>
                    <Text
                      style={[
                        sharedStyles.chipText,
                        placeTarget === option && sharedStyles.chipTextSelected,
                      ]}>
                      {option}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
          <TextInput
            value={origin}
            onChangeText={setOrigin}
            placeholder={t('originPlaceholder')}
            placeholderTextColor={colors.dim}
            style={sharedStyles.input}
            editable={!prefetching}
          />
          <TextInput
            value={destination}
            onChangeText={setDestination}
            placeholder={t('destinationPlaceholder')}
            placeholderTextColor={colors.dim}
            style={sharedStyles.input}
            editable={!prefetching}
          />
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: colors.ripple }}
            style={[
              sharedStyles.secondary,
              blocked && sharedStyles.disabled,
              styles.ctaRow,
            ]}
            onPress={onPrefetch}
            disabled={blocked || !destination.trim()}>
            {prefetching ? (
              <ActivityIndicator color={colors.accent} style={styles.spinner} />
            ) : null}
            <Text style={sharedStyles.secondaryText} numberOfLines={2}>
              {prefetching
                ? prefetchProgress || t('prefetching')
                : t('prefetch')}
            </Text>
          </Pressable>
        </View>
      )}

      {showPreview ? (
        <View style={sharedStyles.sectionCard}>
          <View style={styles.routeHeader}>
            <Text style={[sharedStyles.sectionCardTitle, styles.routeTitle]}>
              {t('prefetchPreview')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('prefetchClear')}
              android_ripple={{ color: colors.ripple }}
              style={styles.clearBtn}
              onPress={() => {
                void onClearRoute();
              }}>
              <Text style={styles.clearText}>{t('prefetchClear')}</Text>
            </Pressable>
          </View>
          <Text style={sharedStyles.hint}>
            {batch!.origin} → {batch!.destination} ·{' '}
            {batch!.kind === 'loop' && batch!.stops
              ? t('inspireStops', { count: batch!.stops.length })
              : t('prefetchListTitle', { count: batch!.pois.length })}
          </Text>
          <View style={sharedStyles.mapCard}>
            <CorridorMap markers={markers} height={210} />
          </View>
          {(batch!.kind === 'loop' && batch!.stops
            ? batch!.stops.map(s => {
                const poi = batch!.pois.find(p => p.id === s.id);
                return {
                  id: s.id,
                  title: s.title,
                  category: poi?.category,
                  summary: poi?.summary ?? '',
                };
              })
            : batch!.pois
          ).map(poi => {
            const open = expandedId === poi.id;
            return (
              <Accordion
                key={poi.id}
                title={poi.title}
                subtitle={poi.category}
                open={open}
                onToggle={() =>
                  setExpandedId(prev => (prev === poi.id ? null : poi.id))
                }>
                {poi.summary ? (
                  <Text style={styles.poiSummary}>{poi.summary}</Text>
                ) : null}
              </Accordion>
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  modeTabs: {
    flexDirection: 'row',
    gap: space.sm,
    marginBottom: space.sm,
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  modeTab: {
    flex: 1,
    minHeight: touchMin * 0.85,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  modeTabOn: {
    backgroundColor: colors.card,
  },
  modeTabText: {
    ...type.label,
    color: colors.dim,
    fontWeight: '600',
  },
  modeTabTextOn: {
    color: colors.accent,
  },
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  routeHint: {
    flex: 1,
  },
  routeTitle: {
    flex: 1,
    marginBottom: 0,
  },
  budgetLabel: {
    ...type.caption,
    color: colors.muted,
    fontWeight: '600',
    marginTop: space.sm,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  spinner: {
    marginRight: 2,
  },
  gearBtn: {
    width: touchMin,
    height: touchMin,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    overflow: 'visible',
  },
  placeSettings: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  samplesLabel: {
    ...type.caption,
    color: colors.muted,
    fontWeight: '600',
  },
  clearBtn: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
  },
  clearText: {
    ...type.caption,
    color: colors.accent,
    fontWeight: '700',
  },
  poiSummary: {
    ...type.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.story,
  },
});
