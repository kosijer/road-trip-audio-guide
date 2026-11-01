import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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

export function PlanScreen({ status, setStatus, busy }: Props) {
  const { t } = useI18n();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [prefetching, setPrefetching] = useState(false);
  const [placeTarget, setPlaceTarget] = useState<PrefetchPlaceTarget>(12);
  const [batch, setBatch] = useState<PrefetchBatch | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showPlaceSettings, setShowPlaceSettings] = useState(false);

  const blocked = busy || prefetching;

  useEffect(() => {
    void (async () => {
      setPlaceTarget(await getPrefetchPlaceTarget());
      setBatch(await getPrefetchBatch());
    })();
  }, []);

  const onPlaceTarget = useCallback(async (next: PrefetchPlaceTarget) => {
    setPlaceTarget(next);
    await savePrefetchPlaceTarget(next);
    setShowPlaceSettings(false);
  }, []);

  const onPrefetch = useCallback(async () => {
    if (!destination.trim() || prefetching) {
      return;
    }
    setPrefetching(true);
    setExpandedId(null);
    try {
      let from = origin.trim();
      if (!from) {
        const here = await getCurrentLocation();
        from = `${here.latitude},${here.longitude}`;
      }
      const { count, batch: nextBatch } = await runPrefetch(
        from,
        destination.trim(),
        message => setStatus(prev => ({ ...prev, message })),
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

  const prefetchLabel = prefetching
    ? status.message.trim() || t('prefetching')
    : t('prefetch');

  const markers = useMemo(
    () =>
      (batch?.pois ?? []).map(poi => ({
        id: poi.id,
        title: poi.title,
        latitude: poi.latitude,
        longitude: poi.longitude,
      })),
    [batch],
  );

  return (
    <ScrollView
      contentContainerStyle={sharedStyles.content}
      keyboardShouldPersistTaps="handled">
      <View style={sharedStyles.sectionCard}>
        <View style={styles.routeHeader}>
          <Text style={[sharedStyles.sectionCardTitle, styles.routeTitle]}>
            {t('routePrep')}
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
        <Text style={sharedStyles.hint}>{t('planHint')}</Text>
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
          style={[sharedStyles.secondary, blocked && sharedStyles.disabled]}
          onPress={onPrefetch}
          disabled={blocked || !destination.trim()}>
          <Text style={sharedStyles.secondaryText} numberOfLines={2}>
            {prefetchLabel}
          </Text>
        </Pressable>
      </View>

      {batch ? (
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
            {batch.origin} → {batch.destination} ·{' '}
            {t('prefetchListTitle', { count: batch.pois.length })}
          </Text>
          <View style={sharedStyles.mapCard}>
            <CorridorMap markers={markers} height={210} />
          </View>
          {batch.pois.map(poi => {
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
  routeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  routeTitle: {
    flex: 1,
    marginBottom: 0,
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
