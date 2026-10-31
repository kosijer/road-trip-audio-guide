import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

type IconProps = {
  color: string;
  size?: number;
  /** Background punch-out for gear hub (match parent button fill). */
  bg?: string;
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

export function PlanIcon({ color, size = 22 }: IconProps) {
  const pin = size * 0.22;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          position: 'absolute',
          width: size * 0.62,
          height: 2,
          backgroundColor: color,
          transform: [{ rotate: '-28deg' }],
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: size * 0.08,
          bottom: size * 0.18,
          width: pin,
          height: pin,
          borderRadius: pin,
          backgroundColor: color,
        }}
      />
      <View
        style={{
          position: 'absolute',
          right: size * 0.1,
          top: size * 0.14,
          width: pin,
          height: pin,
          borderRadius: pin,
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

export function SettingsIcon({
  color,
  size = 22,
  bg = colors.card,
}: IconProps) {
  // Drawn gear (Unicode ⚙ often clips on Android Text metrics).
  const outer = size * 0.92;
  const toothW = size * 0.2;
  const toothH = size * 0.72;
  const hole = size * 0.18;
  return (
    <View style={[styles.box, { width: size, height: size, overflow: 'visible' }]}>
      {[0, 45, 90, 135].map(deg => (
        <View
          key={deg}
          style={{
            position: 'absolute',
            width: toothW,
            height: toothH,
            borderRadius: toothW,
            backgroundColor: color,
            transform: [{ rotate: `${deg}deg` }],
          }}
        />
      ))}
      <View
        style={{
          width: outer * 0.58,
          height: outer * 0.58,
          borderRadius: outer,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View
          style={{
            width: hole,
            height: hole,
            borderRadius: hole,
            backgroundColor: bg,
          }}
        />
      </View>
    </View>
  );
}

export function StopIcon({ color, size = 22 }: IconProps) {
  const box = size * 0.55;
  return (
    <View style={[styles.box, { width: size, height: size }]}>
      <View
        style={{
          width: box,
          height: box,
          borderRadius: 3,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

export function NextIcon({ color, size = 22 }: IconProps) {
  const bar = size * 0.12;
  const tri = size * 0.42;
  return (
    <View
      style={[
        styles.box,
        { width: size, height: size, flexDirection: 'row', gap: 2 },
      ]}>
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: tri / 2,
          borderBottomWidth: tri / 2,
          borderLeftWidth: tri * 0.85,
          borderTopColor: 'transparent',
          borderBottomColor: 'transparent',
          borderLeftColor: color,
        }}
      />
      <View
        style={{
          width: bar,
          height: tri,
          borderRadius: 1,
          backgroundColor: color,
        }}
      />
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
