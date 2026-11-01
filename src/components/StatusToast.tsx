import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, space, type } from '../theme';

type Props = {
  message: string;
  /** Keep visible while an operation is in progress. */
  sticky?: boolean;
  bottomOffset?: number;
  lastPoiTitle?: string;
};

/** Drive motion lines — shown inline on Drive, never as a toast. */
const MOTION_TOAST_BLOCKLIST = new Set([
  'Moving',
  'Stopped / slow traffic',
  'U pokretu',
  'Stajanje / spor saobraćaj',
]);

function isUsefulToast(message: string, lastPoiTitle?: string): boolean {
  const m = message.trim();
  if (!m || m === '—') {
    return false;
  }
  if (MOTION_TOAST_BLOCKLIST.has(m)) {
    return false;
  }
  if (lastPoiTitle && m === lastPoiTitle.trim()) {
    return false;
  }
  return true;
}

/** Bottom toast for transient status — hides redundant POI-title echoes. */
export function StatusToast({
  message,
  sticky = false,
  bottomOffset = 0,
  lastPoiTitle,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('');
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    if (!isUsefulToast(message, lastPoiTitle)) {
      setVisible(false);
      return;
    }
    setText(message.trim());
    setVisible(true);
    if (!sticky) {
      hideTimer.current = setTimeout(() => setVisible(false), 3500);
    }
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
    };
  }, [message, sticky, lastPoiTitle]);

  if (!visible || !text) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { bottom: bottomOffset + space.sm }]}>
      <View style={styles.toast}>
        <Text style={styles.text} numberOfLines={2}>
          {text}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    zIndex: 15,
    alignItems: 'center',
  },
  toast: {
    maxWidth: '100%',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(14, 30, 48, 0.92)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    ...type.caption,
    color: colors.message,
    textAlign: 'center',
    fontWeight: '600',
  },
});
