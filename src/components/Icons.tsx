import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type IconProps = {
  color: string;
  size?: number;
};

/** Minimal geometric icons — no extra native deps. */
export function AroundIcon({ color, size = 22 }: IconProps) {
  const core = Math.round(size * 0.28);
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={[
          styles.ring,
          {
            width: size * 0.72,
            height: size * 0.72,
            borderRadius: size,
            borderColor: color,
          },
        ]}
      />
      <View
        style={{
          position: 'absolute',
          width: core,
          height: core,
          borderRadius: core,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function DriveIcon({ color, size = 22 }: IconProps) {
  const w = size * 0.55;
  const h = size * 0.42;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: w / 2,
          borderRightWidth: w / 2,
          borderBottomWidth: h,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
          marginBottom: 2,
        }}
      />
      <View
        style={{
          width: size * 0.18,
          height: size * 0.28,
          borderRadius: 2,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function HistoryIcon({ color, size = 22 }: IconProps) {
  const dial = size * 0.78;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: dial,
          height: dial,
          borderRadius: dial,
          borderWidth: 2,
          borderColor: color,
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: dial * 0.18,
        }}>
        <View
          style={{
            width: 2,
            height: dial * 0.28,
            backgroundColor: color,
            borderRadius: 1,
          }}
        />
      </View>
    </View>
  );
}

export function SettingsIcon({ color, size = 22 }: IconProps) {
  const hub = size * 0.28;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      {[0, 60, 120].map(deg => (
        <View
          key={deg}
          style={{
            position: 'absolute',
            width: size * 0.22,
            height: size * 0.72,
            borderRadius: 3,
            backgroundColor: color,
            transform: [{ rotate: `${deg}deg` }],
            opacity: 0.95,
          }}
        />
      ))}
      <View
        style={{
          width: hub + 6,
          height: hub + 6,
          borderRadius: hub,
          backgroundColor: colors.card,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1,
        }}>
        <View
          style={{
            width: hub,
            height: hub,
            borderRadius: hub,
            borderWidth: 2,
            borderColor: color,
          }}
        />
      </View>
    </View>
  );
}

export function BackIcon({ color, size = 22 }: IconProps) {
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: size * 0.42,
          height: size * 0.42,
          borderLeftWidth: 2.5,
          borderBottomWidth: 2.5,
          borderColor: color,
          transform: [{ rotate: '45deg' }],
          marginLeft: size * 0.18,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    borderWidth: 2,
    position: 'absolute',
  },
});
