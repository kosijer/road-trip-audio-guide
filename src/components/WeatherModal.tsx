import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../hooks/useI18n';
import type { WeatherSnapshot } from '../services/weather';
import { weatherLabelKey } from '../services/weatherCodes';
import { colors, radius, space, type } from '../theme';
import { WeatherGlyph } from './WeatherGlyph';

type Props = {
  visible: boolean;
  weather: WeatherSnapshot | null;
  onClose: () => void;
};

function formatHour(iso: string): string {
  // Open-Meteo local: 2026-11-03T14:00
  const hour = iso.slice(11, 13);
  const minute = iso.slice(14, 16);
  if (!hour) {
    return iso;
  }
  return minute && minute !== '00' ? `${hour}:${minute}` : `${hour}:00`;
}

function formatTemp(c: number): string {
  return `${Math.round(c)}°`;
}

export function WeatherModal({ visible, weather, onClose }: Props) {
  const { t } = useI18n();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('sectionHelpClose')}
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
        <View style={styles.card}>
          {weather ? (
            <>
              <View style={styles.current}>
                <WeatherGlyph
                  weatherCode={weather.current.weatherCode}
                  size={56}
                  color={colors.accentSoft}
                  strokeWidth={1.8}
                />
                <Text style={styles.temp}>
                  {formatTemp(weather.current.temperatureC)}
                </Text>
                <Text style={styles.condition}>
                  {t(weatherLabelKey(weather.current.weatherCode))}
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hourlyRow}>
                {weather.hourly.map(hour => (
                  <View key={hour.time} style={styles.hourCell}>
                    <Text style={styles.hourTime}>{formatHour(hour.time)}</Text>
                    <WeatherGlyph
                      weatherCode={hour.weatherCode}
                      size={22}
                      color={colors.muted}
                    />
                    <Text style={styles.hourTemp}>
                      {formatTemp(hour.temperatureC)}
                    </Text>
                    <Text style={styles.hourPrecip}>
                      {Math.round(hour.precipProbability)}%
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </>
          ) : (
            <Text style={styles.empty}>{t('weatherUnavailable')}</Text>
          )}
          <Pressable
            accessibilityRole="button"
            android_ripple={{ color: colors.ripple }}
            style={styles.close}
            onPress={onClose}>
            <Text style={styles.closeText}>{t('sectionHelpClose')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.lg,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    padding: space.lg,
    gap: space.md,
  },
  current: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
  },
  temp: {
    ...type.display,
    color: colors.text,
  },
  condition: {
    ...type.label,
    color: colors.muted,
    fontWeight: '600',
  },
  hourlyRow: {
    gap: space.sm,
    paddingVertical: space.xs,
  },
  hourCell: {
    width: 64,
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.cardElevated,
  },
  hourTime: {
    ...type.caption,
    color: colors.dim,
  },
  hourTemp: {
    ...type.label,
    color: colors.text,
    fontWeight: '600',
  },
  hourPrecip: {
    ...type.caption,
    color: colors.accentSoft,
    fontSize: 11,
  },
  empty: {
    ...type.body,
    color: colors.story,
    textAlign: 'center',
    paddingVertical: space.lg,
  },
  close: {
    alignSelf: 'flex-end',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  closeText: {
    ...type.label,
    color: colors.accent,
  },
});
