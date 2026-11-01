import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import { colors, radius, space, touchMin, type } from '../theme';
import { HelpIcon } from './Icons';

type Props = {
  title: string;
  body: string;
};

/** Compact ? control that reveals section explanation without cluttering the card. */
export function SectionHelp({ title, body }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('sectionHelpA11y')}
        android_ripple={{ color: colors.ripple, borderless: true }}
        style={styles.btn}
        hitSlop={8}
        onPress={() => setOpen(true)}>
        <HelpIcon color={colors.dim} size={16} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.card}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.body}>{body}</Text>
            <Pressable
              accessibilityRole="button"
              android_ripple={{ color: colors.ripple }}
              style={styles.close}
              onPress={() => setOpen(false)}>
              <Text style={styles.closeText}>{t('sectionHelpClose')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: touchMin - 12,
    height: touchMin - 12,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: space.lg,
    gap: space.sm,
  },
  title: {
    ...type.label,
    color: colors.text,
    fontWeight: '700',
  },
  body: {
    ...type.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.story,
  },
  close: {
    alignSelf: 'flex-end',
    marginTop: space.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  closeText: {
    ...type.label,
    color: colors.accent,
  },
});
