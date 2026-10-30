import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../i18n';
import { colors } from '../theme';

export type AppTab = 'drive' | 'around' | 'settings';

type Props = {
  active: AppTab;
  onChange: (tab: AppTab) => void;
  bottomInset: number;
};

const TABS: Array<{ id: AppTab; labelKey: 'tabDrive' | 'tabAround' | 'tabSettings' }> = [
  { id: 'drive', labelKey: 'tabDrive' },
  { id: 'around', labelKey: 'tabAround' },
  { id: 'settings', labelKey: 'tabSettings' },
];

export function BottomTabs({ active, onChange, bottomInset }: Props) {
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(bottomInset, 8) }]}>
      {TABS.map(tab => {
        const selected = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            style={[styles.tab, selected && styles.tabSelected]}
            onPress={() => onChange(tab.id)}>
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
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  tab: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  tabSelected: {
    backgroundColor: colors.border,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  label: { color: colors.dim, fontSize: 14, fontWeight: '700' },
  labelSelected: { color: colors.text },
});
