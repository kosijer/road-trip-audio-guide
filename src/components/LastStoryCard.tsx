import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import {
  getExposures,
  setExposureOutcome,
  setNarrationQuality,
  type ExposureOutcome,
} from '../preferences';
import { colors, radius, sharedStyles, space, touchMin } from '../theme';
import type { VisitRating } from '../types';
import { NextIcon } from './Icons';
import { PreferenceFeedback } from './PreferenceFeedback';
import { StarRating } from './StarRating';

type Props = {
  title?: string;
  narration?: string;
  exposureId?: string;
  busy?: boolean;
  onNext?: () => void;
};

export function LastStoryCard({
  title,
  narration,
  exposureId,
  busy,
  onNext,
}: Props) {
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

  if (!narration) {
    return null;
  }
  return (
    <View style={sharedStyles.sectionCard}>
      <View style={styles.header}>
        <Text style={[sharedStyles.sectionCardTitle, styles.title]}>
          {t('lastStory')}
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
      <Text style={sharedStyles.story}>{narration}</Text>
      {exposureId ? (
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
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  title: {
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
