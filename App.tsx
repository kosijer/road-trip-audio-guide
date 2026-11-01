import { useCallback, useEffect, useState } from 'react';
import { Alert, DeviceEventEmitter, StatusBar, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AccountMenu,
  type AccountMenuAction,
} from './src/components/AccountMenu';
import { AppHeader } from './src/components/AppHeader';
import { BottomTabs, type MainTab } from './src/components/BottomTabs';
import { useI18n } from './src/hooks/useI18n';
import { hydrateI18n } from './src/i18n';
import { AroundScreen } from './src/screens/AroundScreen';
import { DriveScreen } from './src/screens/DriveScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { PlanScreen } from './src/screens/PlanScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import {
  FAKE_LOCATIONS,
  getLocationOverride,
  setLocationOverride,
  type FakeLocationId,
} from './src/services/location';
import { PlaybackOverlay } from './src/components/PlaybackOverlay';
import { StatusToast } from './src/components/StatusToast';
import {
  emptyStatus,
  getLanguageSettings,
  getStatus,
  sanitizeStatusOnLaunch,
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

type Overlay = 'none' | 'settings' | 'profile';

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
  const [overlay, setOverlay] = useState<Overlay>('none');
  const [menuOpen, setMenuOpen] = useState(false);
  const [status, setStatus] = useState<TripStatus>(emptyStatus());
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechRate, setSpeechRate] = useState(1);
  const [fakeLocation, setFakeLocation] = useState<FakeLocationId | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void (async () => {
      const [nextStatus, languages, rate] = await Promise.all([
        sanitizeStatusOnLaunch(),
        getLanguageSettings(),
        getRate(),
      ]);
      try {
        const {
          ensureStatsInitialized,
          migrateLegacyRatingsIfNeeded,
        } = await import('./src/preferences');
        await ensureStatsInitialized();
        await migrateLegacyRatingsIfNeeded();
      } catch (error) {
        console.warn('preferences bootstrap failed', error);
      }
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
    setOverlay('none');
    setMenuOpen(false);
    setTab(next);
  }, []);

  const onMenuAction = useCallback(
    (action: AccountMenuAction) => {
      setMenuOpen(false);
      if (action === 'profile') {
        setOverlay('profile');
        return;
      }
      if (action === 'settings') {
        setOverlay('settings');
        return;
      }
      Alert.alert(t('menuSoonTitle'), t('menuSoonBody'));
    },
    [t],
  );

  const overlayOpen = overlay !== 'none';
  const headerTitle =
    overlay === 'settings'
      ? t('settingsTitle')
      : overlay === 'profile'
        ? t('profileTitle')
        : tab === 'around'
          ? t('tabAround')
          : tab === 'drive'
            ? t('tabDrive')
            : tab === 'plan'
              ? t('tabPlan')
              : t('tabHistory');

  if (!ready) {
    return <View style={sharedStyles.root} />;
  }

  return (
    <View style={[sharedStyles.root, { paddingTop: insets.top }]}>
      <AppHeader
        title={headerTitle}
        mode={overlayOpen ? 'overlay' : 'main'}
        onPressMenu={() => setMenuOpen(true)}
        onPressBack={() => setOverlay('none')}
      />
      <AccountMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onAction={onMenuAction}
      />
      <View style={{ flex: 1 }}>
        {overlay === 'settings' ? (
          <SettingsScreen
            status={status}
            speechRate={speechRate}
            setSpeechRate={setSpeechRate}
            fakeLocation={fakeLocation}
            onFakeLocation={onFakeLocation}
          />
        ) : null}
        {overlay === 'profile' ? <ProfileScreen /> : null}
        {!overlayOpen && tab === 'around' ? (
          <AroundScreen
            status={status}
            setStatus={setStatus}
            speaking={speaking}
            busy={busy}
            setBusy={setBusy}
            onNext={onNext}
          />
        ) : null}
        {!overlayOpen && tab === 'drive' ? (
          <DriveScreen
            status={status}
            setStatus={setStatus}
            speaking={speaking}
            busy={busy}
            setBusy={setBusy}
          />
        ) : null}
        {!overlayOpen && tab === 'plan' ? (
          <PlanScreen status={status} setStatus={setStatus} busy={busy} />
        ) : null}
        {!overlayOpen && tab === 'history' ? <HistoryScreen /> : null}
        {!overlayOpen &&
        (tab === 'around' || tab === 'drive' || tab === 'plan') ? (
          <StatusToast
            message={status.message}
            sticky={busy}
            lastPoiTitle={status.lastPoiTitle}
            bottomOffset={
              tab === 'plan' ? 8 : speaking || busy ? 72 : 8
            }
          />
        ) : null}
        {!overlayOpen && (tab === 'around' || tab === 'drive') ? (
          <PlaybackOverlay
            visible={speaking}
            speaking={speaking}
            busy={busy}
            bottomOffset={0}
            onStop={onStopSpeech}
            onNext={onNext}
          />
        ) : null}
      </View>
      <BottomTabs
        active={tab}
        onChange={onChangeTab}
        bottomInset={insets.bottom}
        hidden={overlayOpen}
      />
    </View>
  );
}

export default App;
