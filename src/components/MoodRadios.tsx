import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import type { SessionMood } from '../preferences';
import { colors, space, touchMin, type } from '../theme';

type Props = {
  mood: SessionMood;
  onChange: (mood: SessionMood) => void;
};

const OPTIONS: Array<{
  id: Exclude<SessionMood, null>;
  labelKey: 'moodHistory' | 'moodNature' | 'moodSurprise';
}> = [
  { id: 'history', labelKey: 'moodHistory' },
  { id: 'nature', labelKey: 'moodNature' },
  { id: 'surprise', labelKey: 'moodSurprise' },
];

export function MoodRadios({ mood, onChange }: Props) {
  const { t } = useI18n();
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('moodLabel')}</Text>
      <View style={styles.row}>
        {OPTIONS.map(opt => {
          const selected = mood === opt.id;
          return (
            <Pressable
              key={opt.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              hitSlop={4}
              style={styles.option}
              onPress={() => onChange(selected ? null : opt.id)}>
              <View style={[styles.outer, selected && styles.outerOn]}>
                {selected ? <View style={styles.inner} /> : null}
              </View>
              <Text
                style={[styles.optionLabel, selected && styles.optionLabelOn]}
                numberOfLines={1}>
                {t(opt.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const DOT = 16;

const styles = StyleSheet.create({
  wrap: {
    gap: space.xs,
    marginBottom: space.md,
  },
  label: {
    ...type.caption,
    color: colors.dim,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: space.lg,
    rowGap: space.xs,
  },
  option: {
    minHeight: touchMin * 0.75,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.xs,
  },
  outer: {
    width: DOT,
    height: DOT,
    borderRadius: DOT,
    borderWidth: 1.5,
    borderColor: colors.dim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerOn: {
    borderColor: colors.accent,
  },
  inner: {
    width: DOT * 0.5,
    height: DOT * 0.5,
    borderRadius: DOT,
    backgroundColor: colors.accent,
  },
  optionLabel: {
    ...type.caption,
    color: colors.muted,
    fontWeight: '600',
  },
  optionLabelOn: {
    color: colors.accent,
  },
});
