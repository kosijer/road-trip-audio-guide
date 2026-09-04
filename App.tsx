import { useCallback, useEffect, useState } from 'react';
import {
  DeviceEventEmitter,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { s } from './src/strings';
import type { TripStatus } from './src/types';
import { emptyStatus, getStatus } from './src/services/store';
import { getCurrentLocation } from './src/services/location';
import { endTrip, startTrip, STATUS_EVENT, walkingNow } from './src/services/tripEngine';
import { runPrefetch } from './src/services/routePrefetch';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#1b1714" />
      <AppScreen />
    </SafeAreaProvider>
  );
}

function AppScreen() {
  const insets = useSafeAreaInsets();
  const [status, setStatus] = useState<TripStatus>(emptyStatus());
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getStatus().then(setStatus);
    const sub = DeviceEventEmitter.addListener(STATUS_EVENT, (next: TripStatus) => {
      setStatus(next);
    });
    const poll = setInterval(() => {
      void getStatus().then(setStatus);
    }, 4000);
    return () => {
      sub.remove();
      clearInterval(poll);
    };
  }, []);

  const onToggleTrip = useCallback(async () => {
    setBusy(true);
    try {
      if (status.tripActive) {
        setStatus(await endTrip());
      } else {
        setStatus(await startTrip());
      }
    } finally {
      setBusy(false);
    }
  }, [status.tripActive]);

  const onWalk = useCallback(async () => {
    setBusy(true);
    try {
      setStatus(await walkingNow());
    } finally {
      setBusy(false);
    }
  }, []);

  const onPrefetch = useCallback(async () => {
    if (!destination.trim()) {
      return;
    }
    setBusy(true);
    try {
      let from = origin.trim();
      if (!from) {
        const here = await getCurrentLocation();
        from = `${here.latitude},${here.longitude}`;
      }
      const count = await runPrefetch(
        from,
        destination.trim(),
        message => setStatus(prev => ({ ...prev, message })),
      );
      setStatus(await getStatus().then(next => ({ ...next, prefetchCount: count, message: `Keširano ${count} mesta.` })));
    } catch {
      setStatus(prev => ({ ...prev, message: 'Ruta nije pronađena. Proverite odredište.' }));
    } finally {
      setBusy(false);
    }
  }, [origin, destination]);

  const loc = status.lastLocation
    ? `${status.lastLocation.latitude.toFixed(4)}, ${status.lastLocation.longitude.toFixed(4)} · ${Math.round(status.lastLocation.speedKmh)} km/h`
    : '—';

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{s.appName}</Text>
        <Text style={styles.subtitle}>{s.subtitle}</Text>

        <Pressable
          style={[styles.primary, status.tripActive ? styles.stop : styles.go, busy && styles.disabled]}
          onPress={onToggleTrip}
          disabled={busy}>
          <Text style={styles.primaryText}>
            {status.tripActive ? s.endTrip : s.startTrip}
          </Text>
        </Pressable>

        <Pressable
          style={[styles.secondary, busy && styles.disabled]}
          onPress={onWalk}
          disabled={busy}>
          <Text style={styles.secondaryText}>{busy ? s.walkingBusy : s.walking}</Text>
        </Pressable>

        <Text style={styles.section}>{s.status}</Text>
        <View style={styles.card}>
          <Row label="Vožnja" value={status.tripActive ? s.tripActive : s.tripIdle} />
          <Row label="Kretanje" value={status.moving ? s.moving : s.stationary} />
          <Row label="Lokacija" value={loc} />
          <Row label="LLM" value={`${status.llmCalls}`} />
          <Row label="Keš rute" value={`${status.prefetchCount}`} />
          <Text style={styles.message}>{status.message || '—'}</Text>
        </View>

        <Text style={styles.section}>Priprema rute</Text>
        <Text style={styles.hint}>{s.prefetchHint}</Text>
        <TextInput
          value={origin}
          onChangeText={setOrigin}
          placeholder={s.originPlaceholder}
          placeholderTextColor="#8a7d72"
          style={styles.input}
        />
        <TextInput
          value={destination}
          onChangeText={setDestination}
          placeholder={s.destinationPlaceholder}
          placeholderTextColor="#8a7d72"
          style={styles.input}
        />
        <Pressable
          style={[styles.secondary, busy && styles.disabled]}
          onPress={onPrefetch}
          disabled={busy || !destination.trim()}>
          <Text style={styles.secondaryText}>{busy ? s.prefetching : s.prefetch}</Text>
        </Pressable>

        {status.lastNarration ? (
          <>
            <Text style={styles.section}>{s.lastStory}</Text>
            <View style={styles.card}>
              <Text style={styles.storyTitle}>{status.lastPoiTitle}</Text>
              <Text style={styles.story}>{status.lastNarration}</Text>
            </View>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1b1714' },
  content: { padding: 20, gap: 12, paddingBottom: 40 },
  title: { color: '#f4e6d4', fontSize: 32, fontWeight: '700' },
  subtitle: { color: '#cbbbaa', fontSize: 16, marginBottom: 8 },
  primary: {
    minHeight: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  go: { backgroundColor: '#2f6f4e' },
  stop: { backgroundColor: '#8b3a32' },
  primaryText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  secondary: {
    minHeight: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3a312b',
    borderWidth: 1,
    borderColor: '#c47b3b',
  },
  secondaryText: { color: '#f4e6d4', fontSize: 18, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  section: { color: '#c47b3b', fontSize: 14, fontWeight: '700', marginTop: 8 },
  hint: { color: '#8a7d72', fontSize: 13 },
  card: {
    backgroundColor: '#261f1b',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rowLabel: { color: '#8a7d72' },
  rowValue: { color: '#f4e6d4', flex: 1, textAlign: 'right' },
  message: { color: '#e6d3b8', marginTop: 4 },
  input: {
    backgroundColor: '#261f1b',
    color: '#f4e6d4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3a312b',
  },
  storyTitle: { color: '#f4e6d4', fontWeight: '700', fontSize: 16 },
  story: { color: '#d8c6b0', fontSize: 16, lineHeight: 24 },
});

export default App;
