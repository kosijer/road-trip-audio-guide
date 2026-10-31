import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { colors, radius, space, touchMin, type } from '../theme';

export type AppTab = 'drive' | 'around' | 'settings';

type Props = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
  bottomInset: number;
};

const TABS: Array<{
  id: AppTab;
  labelKey: 'tabDrive' | 'tabAround' | 'tabSettings';
}> = [
  { id: 'drive', labelKey: 'tabDrive' },
  { id: 'around', labelKey: 'tabAround' },
  { id: 'settings', labelKey: 'tabSettings' },
];

export function BottomTabs({ active, onChange, bottomInset }: Props) {
  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: Math.max(bottomInset, space.sm) },
      ]}>
      {TABS.map(tab => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            android_ripple={{ color: colors.ripple, borderless: false }}
            style={styles.tab}
            onPress={() => onChange(tab.id)}>
            <View
              style={[styles.indicator, selected && styles.indicatorOn]}
            />
            <Text style={[styles.label, selected && styles.labelSelected]}>
              {t(tab.labelKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingHorizontal: space.sm,
    paddingTop: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    minHeight: touchMin + 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.sm,
    paddingVertical: space.sm,
  },
  indicator: {
    width: 22,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
  },
  indicatorOn: {
    backgroundColor: colors.accent,
  },
  label: {
    ...type.caption,
    fontWeight: '600',
    color: colors.dim,
  },
  labelSelected: {
    color: colors.text,
    fontWeight: '700',
  },
});
