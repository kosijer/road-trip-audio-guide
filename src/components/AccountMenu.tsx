import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import { colors, radius, space, type } from '../theme';

export type AccountMenuAction =
  | 'profile'
  | 'settings'
  | 'changePassword'
  | 'logout';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAction: (action: AccountMenuAction) => void;
};

const ITEMS: Array<{
  id: AccountMenuAction;
  labelKey:
    | 'menuProfile'
    | 'menuSettings'
    | 'menuChangePassword'
    | 'menuLogout';
}> = [
  { id: 'profile', labelKey: 'menuProfile' },
  { id: 'settings', labelKey: 'menuSettings' },
  { id: 'changePassword', labelKey: 'menuChangePassword' },
  { id: 'logout', labelKey: 'menuLogout' },
];

export function AccountMenu({ visible, onClose, onAction }: Props) {
  const { t } = useI18n();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheetWrap} pointerEvents="box-none">
          <View style={styles.sheet}>
            {ITEMS.map((item, index) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                android_ripple={{ color: colors.ripple }}
                style={[
                  styles.row,
                  index < ITEMS.length - 1 && styles.rowBorder,
                ]}
                onPress={() => {
                  onAction(item.id);
                }}>
                <Text style={styles.rowText}>{t(item.labelKey)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  sheetWrap: {
    position: 'absolute',
    top: 56,
    right: space.md,
    left: space.md,
    alignItems: 'flex-end',
  },
  sheet: {
    minWidth: 220,
    maxWidth: 320,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  rowText: {
    ...type.label,
    color: colors.text,
    flex: 1,
  },
});
