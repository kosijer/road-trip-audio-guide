import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { colors, radius, sharedStyles, space, touchMin } from '../theme';
import { NextIcon } from './Icons';

type Props = {
  title?: string;
  narration?: string;
  busy?: boolean;
  onNext?: () => void;
};

export function LastStoryCard({ title, narration, busy, onNext }: Props) {
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
});
