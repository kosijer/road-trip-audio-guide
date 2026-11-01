import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import { colors, space, type } from '../theme';

export type MapsTravelMode = 'walking' | 'driving';

type Props = {
  latitude: number;
  longitude: number;
  /** Walking for Around / walk loops; driving for Drive / A→B. */
  mode: MapsTravelMode;
};

async function openMaps(
  latitude: number,
  longitude: number,
  travelmode: MapsTravelMode,
) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=${travelmode}`;
  try {
    await Linking.openURL(url);
  } catch (error) {
    console.warn('maps open failed', error);
  }
}

/** Subtle secondary link — travel mode is decided by the caller. */
export function MapsLinks({ latitude, longitude, mode }: Props) {
  const { t } = useI18n();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={t('mapsOpen')}
      hitSlop={8}
      onPress={() => {
        void openMaps(latitude, longitude, mode);
      }}
      style={styles.link}>
      <Text style={styles.linkText}>{t('mapsOpen')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'flex-start',
    marginTop: space.md,
    paddingVertical: space.xs,
  },
  linkText: {
    ...type.caption,
    color: colors.dim,
    textDecorationLine: 'underline',
    fontWeight: '500',
  },
});
