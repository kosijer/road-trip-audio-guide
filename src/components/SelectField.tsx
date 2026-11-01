import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, touchMin, type } from '../theme';

export type SelectOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  label?: string;
  value: T;
  options: Array<SelectOption<T>>;
  onChange: (value: T) => void;
};

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value)?.label ?? value;

  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        android_ripple={{ color: colors.ripple }}
        style={styles.trigger}
        onPress={() => setOpen(true)}>
        <Text style={styles.triggerText} numberOfLines={1}>
          {selected}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {options.map((option, index) => {
              const active = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  android_ripple={{ color: colors.ripple }}
                  style={[
                    styles.option,
                    index < options.length - 1 && styles.optionBorder,
                    active && styles.optionActive,
                  ]}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}>
                  <Text
                    style={[
                      styles.optionText,
                      active && styles.optionTextActive,
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: space.sm,
  },
  label: {
    ...type.section,
    color: colors.accentSoft,
  },
  trigger: {
    minHeight: touchMin,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  triggerText: {
    ...type.label,
    color: colors.text,
    flex: 1,
  },
  chevron: {
    color: colors.dim,
    fontSize: 14,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    padding: space.xl,
  },
  sheet: {
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  option: {
    minHeight: touchMin,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  optionBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderSoft,
  },
  optionActive: {
    backgroundColor: 'rgba(255, 122, 89, 0.14)',
  },
  optionText: {
    ...type.label,
    color: colors.muted,
  },
  optionTextActive: {
    color: colors.accent,
    fontWeight: '700',
  },
});
