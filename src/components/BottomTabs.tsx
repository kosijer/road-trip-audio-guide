import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { colors, radius, space, touchMin, type } from '../theme';
import { AroundIcon, DriveIcon, HistoryIcon, PlanIcon } from './Icons';

export type MainTab = 'around' | 'drive' | 'plan' | 'history';
/** @deprecated use MainTab; settings lives in the header now */
export type AppTab = MainTab | 'settings';

type Props = {
  active: MainTab;
  onChange: (tab: MainTab) => void;
  bottomInset: number;
  hidden?: boolean;
};

const TABS: Array<{
  id: MainTab;
  labelKey: 'tabAround' | 'tabDrive' | 'tabPlan' | 'tabHistory';
  Icon: typeof AroundIcon;
}> = [
  { id: 'around', labelKey: 'tabAround', Icon: AroundIcon },
  { id: 'drive', labelKey: 'tabDrive', Icon: DriveIcon },
  { id: 'plan', labelKey: 'tabPlan', Icon: PlanIcon },
  { id: 'history', labelKey: 'tabHistory', Icon: HistoryIcon },
];

export function BottomTabs({
  active,
  onChange,
  bottomInset,
  hidden,
}: Props) {
  if (hidden) {
    return <View style={{ height: bottomInset }} />;
  }

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(bottomInset, space.sm) }]}>
      <View style={styles.bar}>
        {TABS.map(tab => {
          const selected = tab.id === active;
          const color = selected ? colors.accent : colors.dim;
          const { Icon } = tab;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              android_ripple={{ color: colors.ripple, borderless: false }}
              style={styles.tab}
              onPress={() => onChange(tab.id)}>
              <View style={[styles.iconWell, selected && styles.iconWellOn]}>
                <Icon color={color} size={20} />
              </View>
              <Text
                style={[styles.label, selected && styles.labelSelected]}
                numberOfLines={1}>
                {t(tab.labelKey)}
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
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    backgroundColor: colors.bg,
  },
  bar: {
    flexDirection: 'row',
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    paddingVertical: space.xs,
    paddingHorizontal: space.xs,
  },
  tab: {
    flex: 1,
    minHeight: touchMin + 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radius.md,
    paddingVertical: space.sm,
  },
  iconWell: {
    width: 36,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWellOn: {
    backgroundColor: 'rgba(255, 122, 89, 0.20)',
  },
  label: {
    ...type.caption,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    color: colors.dim,
  },
  labelSelected: {
    color: colors.accent,
    fontWeight: '700',
  },
});
