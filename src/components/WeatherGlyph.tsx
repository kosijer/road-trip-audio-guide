import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';
import { weatherBucket } from '../services/weatherCodes';
import { colors } from '../theme';

const BY_BUCKET: Record<string, LucideIcon> = {
  clear: Sun,
  mostlyClear: Sun,
  partlyCloudy: CloudSun,
  overcast: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  thunder: CloudLightning,
  unknown: Cloud,
};

type Props = {
  weatherCode?: number | null;
  size?: number;
  color?: string;
  strokeWidth?: number;
};

export function WeatherGlyph({
  weatherCode,
  size = 22,
  color = colors.muted,
  strokeWidth = 2.2,
}: Props) {
  const Icon = BY_BUCKET[weatherBucket(weatherCode)] ?? Cloud;
  return <Icon color={color} size={size} strokeWidth={strokeWidth} />;
}
