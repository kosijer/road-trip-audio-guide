import { Platform, StyleSheet } from 'react-native';

/** Dark travel-companion palette with Material-ish tonal roles. */
export const colors = {
  bg: '#14110f',
  surface: '#1c1815',
  card: '#241f1b',
  cardElevated: '#2a2420',
  border: '#3a322c',
  borderSoft: '#322b26',
  accent: '#d0894a',
  accentMuted: '#8a5a32',
  text: '#f3e8da',
  muted: '#c4b5a5',
  dim: '#8f8174',
  message: '#e4d4c0',
  story: '#d6c6b2',
  go: '#2f6f4e',
  goPressed: '#265a40',
  stop: '#9a4038',
  stopPressed: '#7e342e',
  white: '#fff',
  ripple: 'rgba(243, 232, 218, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.25)',
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  pill: 999,
};

export const type = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '700' as const },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const },
  section: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700' as const,
    letterSpacing: 0.4,
    textTransform: 'uppercase' as const,
  },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  button: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
};

/** Minimum Material touch target. */
export const touchMin = 48;

export const elevation = Platform.select({
  android: { elevation: 2 },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
});

export const sharedStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xxl,
    gap: space.lg,
  },
  headerBlock: { gap: space.sm, marginBottom: space.xs },
  title: { ...type.display, color: colors.text },
  screenTitle: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.muted },
  primary: {
    minHeight: 56,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    ...elevation,
  },
  go: { backgroundColor: colors.go },
  stop: { backgroundColor: colors.stop },
  primaryText: { ...type.button, color: colors.white, fontSize: 18 },
  secondary: {
    minHeight: touchMin,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.accentMuted,
    paddingHorizontal: space.lg,
  },
  secondaryText: { ...type.button, color: colors.text, fontSize: 16 },
  rowBtns: { flexDirection: 'row', gap: space.sm },
  halfBtn: {
    flex: 1,
    minHeight: touchMin,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
  },
  chip: {
    flex: 1,
    minHeight: touchMin,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
  },
  chipSelected: {
    backgroundColor: colors.accentMuted,
    borderColor: colors.accent,
  },
  chipText: { ...type.label, color: colors.muted },
  chipTextSelected: { color: colors.text },
  disabled: { opacity: 0.45 },
  section: {
    ...type.section,
    color: colors.accent,
    marginBottom: -space.xs,
  },
  hint: { ...type.caption, color: colors.dim },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  sectionCardTitle: {
    ...type.section,
    color: colors.accent,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.md,
  },
  rowLabel: { ...type.caption, color: colors.dim, paddingTop: 2 },
  rowValue: {
    ...type.label,
    color: colors.text,
    flex: 1,
    textAlign: 'right',
  },
  message: { ...type.body, color: colors.message, fontSize: 15 },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderRadius: radius.sm,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    minHeight: touchMin,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  storyTitle: { ...type.label, color: colors.text, fontSize: 17 },
  story: { ...type.body, color: colors.story },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
