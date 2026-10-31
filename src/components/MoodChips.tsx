import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import type { SessionMood } from '../preferences';
import { colors, sharedStyles, space } from '../theme';

type Props = {
  mood: SessionMood;
  onChange: (mood: SessionMood) => void;
};

const OPTIONS: Array<{ id: SessionMood; labelKey: 'moodHistory' | 'moodNature' | 'moodSurprise' }> = [
  { id: 'history', labelKey: 'moodHistory' },
  { id: 'nature', labelKey: 'moodNature' },
  { id: 'surprise', labelKey: 'moodSurprise' },
];

export function MoodChips({ mood, onChange }: Props) {
  const { t } = useI18n();
  return (
    <View style={styles.wrap}>
      <Text style={sharedStyles.hint}>{t('moodLabel')}</Text>
      <View style={sharedStyles.rowBtns}>
        {OPTIONS.map(opt => {
          const selected = mood === opt.id;
          return (
            <Pressable
              key={String(opt.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              android_ripple={{ color: colors.ripple }}
              style={[
                sharedStyles.chip,
                selected && sharedStyles.chipSelected,
              ]}
              onPress={() => onChange(selected ? null : opt.id)}>
              <Text
                style={[
                  sharedStyles.chipText,
                  selected && sharedStyles.chipTextSelected,
                ]}>
                {t(opt.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
    marginBottom: space.md,
  },
});
