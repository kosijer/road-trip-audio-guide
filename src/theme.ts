import { Platform, StyleSheet } from 'react-native';

/**
 * Along palette — deep navy night road with coral energy and teal spark.
 * Dark enough for driving, lively enough to not feel muddy brown.
 */
export const colors = {
  bg: '#07131f',
  surface: '#0e1e30',
  card: '#152a40',
  cardElevated: '#1c3550',
  border: '#2a4666',
  borderSoft: '#213750',
  accent: '#ff7a59',
  accentMuted: '#c45a40',
  accentSoft: '#5eead4',
  text: '#f2f7ff',
  muted: '#a9c0d8',
  dim: '#7e97b0',
  message: '#d7e6f5',
  story: '#c5d6e8',
  go: '#14b8a6',
  goPressed: '#0f766e',
  stop: '#f43f5e',
  stopPressed: '#be123c',
  white: '#fff',
  ripple: 'rgba(255, 122, 89, 0.16)',
  overlay: 'rgba(7, 19, 31, 0.45)',
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
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
});

export const sharedStyles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  contentWithOverlay: {
    paddingBottom: 96,
  },
  headerBlock: { gap: space.sm, marginBottom: space.xs },
  title: { ...type.display, color: colors.text },
  screenTitle: { ...type.title, color: colors.text },
  subtitle: { ...type.body, color: colors.muted },
  mapCard: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderSoft,
    backgroundColor: colors.card,
  },
  primary: {
    minHeight: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    ...elevation,
  },
  go: { backgroundColor: colors.go },
  stop: { backgroundColor: colors.stop },
  primaryText: { ...type.button, color: colors.white, fontSize: 20 },
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
    backgroundColor: 'rgba(255, 122, 89, 0.22)',
    borderColor: colors.accent,
  },
  chipText: { ...type.label, color: colors.muted },
  chipTextSelected: { color: colors.text },
  disabled: { opacity: 0.45 },
  section: {
    ...type.section,
    color: colors.accentSoft,
    marginBottom: -space.xs,
  },
  hint: { ...type.caption, color: colors.dim },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.borderSoft,
  },
  sectionCardTitle: {
    ...type.section,
    color: colors.accentSoft,
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
