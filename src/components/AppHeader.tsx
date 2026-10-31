import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import { colors, radius, space, touchMin, type } from '../theme';
import { BackIcon, SettingsIcon } from './Icons';

type Props = {
  title: string;
  mode: 'main' | 'settings';
  onPressSettings: () => void;
  onPressBack: () => void;
};

export function AppHeader({
  title,
  mode,
  onPressSettings,
  onPressBack,
}: Props) {
  const { t } = useI18n();
  return (
    <View style={styles.bar}>
      <View style={styles.side}>
        {mode === 'settings' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('headerBack')}
            android_ripple={{ color: colors.ripple, borderless: true }}
            style={styles.iconBtn}
            onPress={onPressBack}
            hitSlop={8}>
            <BackIcon color={colors.text} size={20} />
          </Pressable>
        ) : (
          <View style={styles.iconBtnPlaceholder} />
        )}
      </View>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      <View style={[styles.side, styles.sideEnd]}>
        {mode === 'main' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('settingsTitle')}
            android_ripple={{ color: colors.ripple, borderless: true }}
            style={styles.iconBtn}
            onPress={onPressSettings}
            hitSlop={8}>
            <SettingsIcon color={colors.muted} size={18} bg={colors.card} />
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
    backgroundColor: colors.surface,
  },
  side: {
    width: touchMin,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  sideEnd: {
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    ...type.title,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: colors.text,
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
