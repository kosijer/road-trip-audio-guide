import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import { colors, radius, space, touchMin, type } from '../theme';
import type { VisitRating } from '../types';

const STARS: VisitRating[] = [1, 2, 3, 4, 5];

type Props = {
  value?: VisitRating;
  onChange?: (rating: VisitRating) => void;
  /** Compact read-only strip for accordion headers. */
  compact?: boolean;
  editable?: boolean;
};

export function StarRating({
  value,
  onChange,
  compact = false,
  editable = true,
}: Props) {
  const { t } = useI18n();
  const current = value ?? 0;

  if (compact && !editable) {
    return (
      <Text style={styles.compact}>
        {STARS.map(star => ((value ?? 0) >= star ? '★' : '☆')).join('')}
      </Text>
    );
  }

  return (
    <View style={styles.row}>
      {STARS.map(star => {
        const on = current >= star;
        return (
          <Pressable
            key={star}
            accessibilityRole="button"
            accessibilityLabel={t('historyStarLabel', { n: String(star) })}
            disabled={!editable || !onChange}
            android_ripple={{ color: colors.ripple, borderless: true }}
            style={compact ? styles.starHitCompact : styles.starHit}
            onPress={() => onChange?.(star)}
            hitSlop={4}>
            <Text
              style={[
                compact ? styles.starCompact : styles.star,
                on && styles.starOn,
              ]}>
              {on ? '★' : '☆'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compact: {
    ...type.caption,
    letterSpacing: 1,
    color: colors.accent,
    fontWeight: '700',
  },
  starHit: {
    minWidth: touchMin - 4,
    minHeight: touchMin - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  starHitCompact: {
    width: 22,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: {
    fontSize: 26,
    lineHeight: 30,
    color: colors.dim,
  },
  starCompact: {
    fontSize: 14,
    lineHeight: 18,
    color: colors.dim,
  },
  starOn: {
    color: colors.accent,
  },
});
