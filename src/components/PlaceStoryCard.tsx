import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import {
  getExposures,
  setExposureOutcome,
  setNarrationQuality,
  type ExposureOutcome,
} from '../preferences';
import { colors, radius, sharedStyles, space, touchMin } from '../theme';
import type { VisitRating } from '../types';
import { NextIcon } from './Icons';
import { MapsLinks, type MapsTravelMode } from './MapsLinks';
import { PreferenceFeedback } from './PreferenceFeedback';
import { StarRating } from './StarRating';

export type PlaceStoryCardProps = {
  /** Place name — always shown when present. */
  title?: string;
  /** Spoken / written narration body. */
  narration?: string;
  /** Optional distance label already formatted (e.g. "1.2 km"). */
  distanceLabel?: string;
  latitude?: number;
  longitude?: number;
  /** Walking (Around) vs driving (Drive / A→B). */
  mapsMode?: MapsTravelMode;
  exposureId?: string;
  /** Show taste + narration stars when exposure exists. */
  showRating?: boolean;
  busy?: boolean;
  onNext?: () => void;
};

/**
 * Canonical “latest place” card — same layout on Around and Drive.
 */
export function PlaceStoryCard({
  title,
  narration,
  distanceLabel,
  latitude,
  longitude,
  mapsMode = 'walking',
  exposureId,
  showRating = true,
  busy,
  onNext,
}: PlaceStoryCardProps) {
  const { t } = useI18n();
  const [outcome, setOutcome] = useState<ExposureOutcome | undefined>();
  const [quality, setQuality] = useState<VisitRating | undefined>();

  useEffect(() => {
    if (!exposureId) {
      setOutcome(undefined);
      setQuality(undefined);
      return;
    }
    void getExposures().then(rows => {
      const row = rows.find(e => e.id === exposureId);
      setOutcome(row?.outcome === 'ignored' ? undefined : row?.outcome);
      setQuality(row?.narrationQuality);
    });
  }, [exposureId]);

  const onTaste = useCallback(
    async (next: ExposureOutcome) => {
      if (!exposureId) {
        return;
      }
      const saved = await setExposureOutcome(exposureId, next);
      setOutcome(saved?.outcome === 'ignored' ? undefined : saved?.outcome);
    },
    [exposureId],
  );

  const onQuality = useCallback(
    async (rating: VisitRating) => {
      if (!exposureId) {
        return;
      }
      const next = quality === rating ? null : rating;
      await setNarrationQuality(exposureId, next);
      setQuality(next ?? undefined);
    },
    [exposureId, quality],
  );

  if (!title && !narration) {
    return null;
  }

  const hasMaps =
    latitude != null &&
    longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  return (
    <View style={sharedStyles.sectionCard}>
      <View style={styles.header}>
        <Text style={[sharedStyles.sectionCardTitle, styles.eyebrow]}>
          {t('placeLatest')}
        </Text>
        {onNext ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('nextStory')}
            android_ripple={{ color: colors.ripple, borderless: true }}
            style={[styles.nextBtn, busy && sharedStyles.disabled]}
            onPress={onNext}
            disabled={busy}
            hitSlop={6}>
            <NextIcon color={colors.accent} size={18} />
          </Pressable>
        ) : null}
      </View>
      {title ? <Text style={sharedStyles.storyTitle}>{title}</Text> : null}
      {distanceLabel ? (
        <Text style={sharedStyles.hint}>{distanceLabel}</Text>
      ) : null}
      {narration ? <Text style={sharedStyles.story}>{narration}</Text> : null}
      {showRating && exposureId ? (
        <>
          <PreferenceFeedback
            outcome={outcome}
            busy={busy}
            onLiked={() => {
              void onTaste('liked');
            }}
            onNotInterested={() => {
              void onTaste('not_interested');
            }}
          />
          <Text style={styles.qualityLabel}>{t('prefNarrationQuality')}</Text>
          <StarRating
            value={quality}
            editable={!busy}
            onChange={rating => {
              void onQuality(rating);
            }}
          />
        </>
      ) : null}
      {hasMaps ? (
        <MapsLinks
          latitude={latitude!}
          longitude={longitude!}
          mode={mapsMode}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  eyebrow: {
    flex: 1,
    marginBottom: 0,
  },
  nextBtn: {
    width: touchMin - 4,
    height: touchMin - 4,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  qualityLabel: {
    marginTop: space.md,
    marginBottom: space.sm,
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
});
