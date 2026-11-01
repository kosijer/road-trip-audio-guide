import { Volume2, VolumeX } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import { colors, radius, space, touchMin, type } from '../theme';
import { BackIcon, MenuIcon } from './Icons';

type Props = {
  /** Overlay screens keep a contextual title; main chrome is brand-only. */
  title?: string;
  mode: 'main' | 'overlay';
  speechMuted?: boolean;
  onPressMenu: () => void;
  onPressBack: () => void;
  onToggleMute?: () => void;
};

export function AppHeader({
  title,
  mode,
  speechMuted = false,
  onPressMenu,
  onPressBack,
  onToggleMute,
}: Props) {
  const { t } = useI18n();
  return (
    <View style={styles.bar}>
      {mode === 'overlay' ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('headerBack')}
          android_ripple={{ color: colors.ripple, borderless: true }}
          style={styles.iconBtn}
          onPress={onPressBack}
          hitSlop={8}>
          <BackIcon color={colors.text} size={20} />
        </Pressable>
      ) : null}

      <Text
        style={[styles.brand, mode === 'overlay' && styles.brandOverlay]}
        numberOfLines={1}>
        {mode === 'overlay' && title ? title : t('appName')}
      </Text>

      <View style={styles.actions}>
        {mode === 'main' && onToggleMute ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              speechMuted ? t('speechUnmute') : t('speechMute')
            }
            accessibilityState={{ selected: speechMuted }}
            android_ripple={{ color: colors.ripple, borderless: true }}
            style={styles.iconBtn}
            onPress={onToggleMute}
            hitSlop={8}>
            {speechMuted ? (
              <VolumeX color={colors.accent} size={22} strokeWidth={2.2} />
            ) : (
              <Volume2 color={colors.muted} size={22} strokeWidth={2.2} />
            )}
          </Pressable>
        ) : null}
        {mode === 'main' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('menuOpen')}
            android_ripple={{ color: colors.ripple, borderless: true }}
            style={styles.iconBtn}
            onPress={onPressMenu}
            hitSlop={8}>
            <MenuIcon color={colors.muted} size={18} />
          </Pressable>
        ) : (
          <View style={styles.iconBtnPlaceholder} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    paddingHorizontal: space.sm,
    paddingBottom: space.xs,
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  brand: {
    flex: 1,
    textAlign: 'left',
    paddingLeft: space.sm,
    ...type.title,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: 0.3,
    color: colors.text,
  },
  brandOverlay: {
    fontSize: 18,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  iconBtn: {
    width: touchMin,
    height: touchMin,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  iconBtnPlaceholder: {
    width: touchMin,
    height: touchMin,
  },
});
