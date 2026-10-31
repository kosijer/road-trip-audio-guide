import { useCallback, useEffect, useState } from 'react';
import { DeviceEventEmitter, StatusBar, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppHeader } from './src/components/AppHeader';
import { BottomTabs, type MainTab } from './src/components/BottomTabs';
import { useI18n } from './src/hooks/useI18n';
import { hydrateI18n } from './src/i18n';
import { AroundScreen } from './src/screens/AroundScreen';
import { DriveScreen } from './src/screens/DriveScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import {
  FAKE_LOCATIONS,
  getLocationOverride,
  setLocationOverride,
  type FakeLocationId,
} from './src/services/location';
import {
  emptyStatus,
  getLanguageSettings,
  getStatus,
} from './src/services/store';
import { narrateNext, STATUS_EVENT } from './src/services/tripEngine';
import {
  applyNarrationLanguage,
  getRate,
  isSpeaking,
  stopSpeaking,
  TTS_EVENT,
} from './src/services/tts';
import { colors, sharedStyles } from './src/theme';
import type { TripStatus } from './src/types';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={colors.surface} />
      <AppScreen />
    </SafeAreaProvider>
  );
}

function AppScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [tab, setTab] = useState<MainTab>('around');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState<TripStatus>(emptyStatus());
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [fakeLocation, setFakeLocation] = useState<FakeLocationId | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const [nextStatus, languages, rate] = await Promise.all([
        getStatus(),
        getLanguageSettings(),
        getRate(),
      ]);
      hydrateI18n(languages);
      await applyNarrationLanguage(languages.narrationLanguage);
      setStatus(nextStatus);
      setSpeechRate(rate);
      const override = getLocationOverride();
      if (override) {
        const match = (Object.keys(FAKE_LOCATIONS) as FakeLocationId[]).find(
          id => FAKE_LOCATIONS[id].label === override.label,
        );
        setFakeLocation(match ?? null);
      }
      setReady(true);
    })();

    const sub = DeviceEventEmitter.addListener(STATUS_EVENT, (next: TripStatus) => {
      setStatus(next);
    });
    const ttsSub = DeviceEventEmitter.addListener(
      TTS_EVENT,
      (payload: { speaking: boolean }) => {
        setSpeaking(payload.speaking);
      },
    );
    const poll = setInterval(() => {
      void getStatus().then(setStatus);
      setSpeaking(isSpeaking());
    }, 4000);
    return () => {
      sub.remove();
      ttsSub.remove();
      clearInterval(poll);
    };
  }, []);

  const onStopSpeech = useCallback(async () => {
    await stopSpeaking();
    setSpeaking(false);
  }, []);

  const onNext = useCallback(async () => {
    setBusy(true);
    try {
      setStatus(await narrateNext());
    } finally {
      setBusy(false);
    }
  }, []);

  const onFakeLocation = useCallback(
    (next: FakeLocationId | null) => {
      setLocationOverride(next);
      setFakeLocation(next);
      setStatus(prev => ({
        ...prev,
        message: next
          ? t('debugOn', { label: FAKE_LOCATIONS[next].label })
          : t('debugOff'),
      }));
    },
    [t],
  );

  const onChangeTab = useCallback((next: MainTab) => {
    setSettingsOpen(false);
    setTab(next);
  }, []);

  const headerTitle = settingsOpen
    ? t('settingsTitle')
    : tab === 'around'
      ? t('tabAround')
      : tab === 'drive'
        ? t('tabDrive')
        : t('tabHistory');

  if (!ready) {
    return <View style={sharedStyles.root} />;
  }

  return (
    <View style={[sharedStyles.root, { paddingTop: insets.top }]}>
      <AppHeader
        title={headerTitle}
        mode={settingsOpen ? 'settings' : 'main'}
        onPressSettings={() => setSettingsOpen(true)}
        onPressBack={() => setSettingsOpen(false)}
      />
      <View style={{ flex: 1 }}>
        {settingsOpen ? (
          <SettingsScreen
            status={status}
            speechRate={speechRate}
            setSpeechRate={setSpeechRate}
            fakeLocation={fakeLocation}
            onFakeLocation={onFakeLocation}
          />
        ) : null}
        {!settingsOpen && tab === 'around' ? (
          <AroundScreen
            status={status}
            setStatus={setStatus}
            speaking={speaking}
            busy={busy}
            setBusy={setBusy}
            onStopSpeech={onStopSpeech}
            onNext={onNext}
          />
        ) : null}
        {!settingsOpen && tab === 'drive' ? (
          <DriveScreen
            status={status}
            setStatus={setStatus}
            speaking={speaking}
            busy={busy}
            setBusy={setBusy}
            onStopSpeech={onStopSpeech}
            onNext={onNext}
          />
        ) : null}
        {!settingsOpen && tab === 'history' ? <HistoryScreen /> : null}
      </View>
      <BottomTabs
        active={tab}
        onChange={onChangeTab}
        bottomInset={insets.bottom}
        hidden={settingsOpen}
      />
    </View>
  );
}

export default App;
