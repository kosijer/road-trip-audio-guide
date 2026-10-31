import { Pressable, StyleSheet, View } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import { colors, radius, space, touchMin } from '../theme';
import { NextIcon, StopIcon } from './Icons';

type Props = {
  visible: boolean;
  speaking: boolean;
  busy: boolean;
  bottomOffset: number;
  onStop: () => void;
  onNext: () => void;
};

/** Floating Stop / Next controls — icons only, above the tab bar. */
export function PlaybackOverlay({
  visible,
  speaking,
  busy,
  bottomOffset,
  onStop,
  onNext,
}: Props) {
  const { t } = useI18n();
  if (!visible) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: bottomOffset + space.sm }]}>
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('stopSpeech')}
          android_ripple={{ color: colors.ripple, borderless: true }}
          style={[styles.btn, !speaking && styles.btnDisabled]}
          onPress={onStop}
          disabled={!speaking}>
          <StopIcon color={speaking ? colors.white : colors.dim} size={22} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('nextStory')}
          android_ripple={{ color: colors.ripple, borderless: true }}
          style={[styles.btn, styles.btnNext, busy && styles.btnDisabled]}
          onPress={onNext}
          disabled={busy}>
          <NextIcon color={colors.text} size={22} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 20,
  },
  bar: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: {
    width: touchMin + 8,
    height: touchMin + 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.stop,
  },
  btnNext: {
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnDisabled: {
    opacity: 0.35,
  },
});
