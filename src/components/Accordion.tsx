import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  /** Compact trailing content in the header (e.g. star rating). */
  trailing?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function Accordion({
  title,
  subtitle,
  trailing,
  open,
  onToggle,
  children,
}: Props) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        android_ripple={{ color: colors.ripple }}
        style={styles.header}
        onPress={onToggle}>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={open ? undefined : 2}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
        <Text style={[styles.chevron, open && styles.chevronOpen]}>▾</Text>
      </Pressable>
      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 56,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...type.label,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
  },
  subtitle: {
    ...type.caption,
    color: colors.dim,
  },
  trailing: {
    marginRight: space.xs,
  },
  chevron: {
    fontSize: 16,
    color: colors.dim,
    transform: [{ rotate: '-90deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '0deg' }],
    color: colors.accent,
  },
  body: {
    paddingHorizontal: space.lg,
    paddingBottom: space.lg,
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderSoft,
    paddingTop: space.md,
  },
});
