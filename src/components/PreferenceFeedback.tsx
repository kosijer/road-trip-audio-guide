import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import { colors, radius, sharedStyles, space, touchMin, type } from '../theme';
import type { ExposureOutcome } from '../preferences';

type Props = {
  outcome?: ExposureOutcome;
  busy?: boolean;
  onLiked: () => void;
  onNotInterested: () => void;
};

export function PreferenceFeedback({
  outcome,
  busy,
  onLiked,
  onNotInterested,
}: Props) {
  const { t } = useI18n();
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('prefTastePrompt')}</Text>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('prefLiked')}
          android_ripple={{ color: colors.ripple }}
          style={[
            styles.btn,
            outcome === 'liked' && styles.btnOn,
            busy && sharedStyles.disabled,
          ]}
          disabled={busy}
          onPress={onLiked}>
          <Text style={styles.glyph}>👍</Text>
          <Text
            style={[styles.btnText, outcome === 'liked' && styles.btnTextOn]}>
            {t('prefLiked')}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('prefNotInterested')}
          android_ripple={{ color: colors.ripple }}
          style={[
            styles.btn,
            outcome === 'not_interested' && styles.btnOn,
            busy && sharedStyles.disabled,
          ]}
          disabled={busy}
          onPress={onNotInterested}>
          <Text style={styles.glyph}>👎</Text>
          <Text
            style={[
              styles.btnText,
              outcome === 'not_interested' && styles.btnTextOn,
            ]}>
            {t('prefNotInterested')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
    marginTop: space.md,
  },
  label: {
    ...type.caption,
    color: colors.muted,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: space.sm,
  },
  btn: {
    flex: 1,
    minHeight: touchMin,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    gap: 2,
  },
  btnOn: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(255, 122, 89, 0.16)',
  },
  glyph: {
    fontSize: 18,
  },
  btnText: {
    ...type.caption,
    color: colors.muted,
    fontWeight: '600',
    textAlign: 'center',
  },
  btnTextOn: {
    color: colors.accent,
  },
});
