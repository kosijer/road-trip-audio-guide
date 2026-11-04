import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  type AppStateStatus,
  DeviceEventEmitter,
  StatusBar,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AccountMenu,
  type AccountMenuAction,
} from './src/components/AccountMenu';
import { AppHeader } from './src/components/AppHeader';
import { BottomTabs, type MainTab } from './src/components/BottomTabs';
import { PlaybackOverlay } from './src/components/PlaybackOverlay';
import { StatusToast } from './src/components/StatusToast';
import { WeatherModal } from './src/components/WeatherModal';
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
  getFreshLocation,
  getLocationOverride,
  peekFreshLocation,
  setLocationOverride,
  warmFreshLocation,
  type FakeLocationId,
} from './src/services/location';
import {
  emptyStatus,
  getLanguageSettings,
  getSpeechMuted,
  getStatus,
  resetSessionOnLaunch,
  setStatus as persistStatus,
} from './src/services/store';
import {
  endTrip,
  narrateNext,
  STATUS_EVENT,
} from './src/services/tripEngine';
import {
  applyNarrationLanguage,
  getRate,
  isSpeaking,
  MUTE_EVENT,
  setSpeechMuted,
  stopSpeaking,
  TTS_EVENT,
} from './src/services/tts';
import {
  getCachedWeather,
  isWeatherStale,
  refreshWeatherFromDevice,
  WEATHER_EVENT,
  WEATHER_STALE_MS,
  type WeatherSnapshot,
} from './src/services/weather';
import { colors, sharedStyles } from './src/theme';
import type { TripStatus } from './src/types';

type Overlay = 'none' | 'settings' | 'profile';

/** Warm-start apps skip launch reset — clear ephemeral UI after a long pause. */
const SESSION_STALE_MS = 30 * 60 * 1000;

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
  const [speechMuted, setSpeechMutedState] = useState(false);
  const [fakeLocation, setFakeLocation] = useState<FakeLocationId | null>(null);
  const [ready, setReady] = useState(false);
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherOpen, setWeatherOpen] = useState(false);
  const appStateRef = useRef<AppStateStatus>(
    (AppState.currentState as AppStateStatus | null) ?? 'active',
  );
  const backgroundedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const warmLocation = () => {
      void warmFreshLocation().then(here => {
        if (here) {
          setStatus(prev => ({ ...prev, lastLocation: here }));
        }
      });
    };

    const wipeEphemeralSession = async () => {
      try {
        const prior = await getStatus();
        if (prior.tripActive) {
          await endTrip();
        }
      } catch (error) {
        console.warn('endTrip on session wipe failed', error);
      }
      const nextStatus = await resetSessionOnLaunch();
      setStatus(nextStatus);
      warmLocation();
    };

    void (async () => {
      // Soft-stop any prior trip keep-alive before wiping session state.
      try {
        const prior = await getStatus();
        if (prior.tripActive) {
          await endTrip();
        }
      } catch (error) {
        console.warn('endTrip on launch failed', error);
      }
      const [nextStatus, languages, rate, muted] = await Promise.all([
        resetSessionOnLaunch(),
        getLanguageSettings(),
        getRate(),
        getSpeechMuted(),
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
      setSpeechMutedState(muted);
      const override = getLocationOverride();
      if (override) {
        const match = (Object.keys(FAKE_LOCATIONS) as FakeLocationId[]).find(
          id => FAKE_LOCATIONS[id].label === override.label,
        );
        setFakeLocation(match ?? null);
      }
      setReady(true);
      // Warm GPS once so Around → Drive share the same fix.
      warmLocation();
      void refreshWeatherFromDevice().then(snap => {
        if (snap) {
          setWeather(snap);
        }
      });
    })();

    const sub = DeviceEventEmitter.addListener(STATUS_EVENT, (next: TripStatus) => {
      setStatus(next);
    });
    const muteSub = DeviceEventEmitter.addListener(
      MUTE_EVENT,
      (payload: { muted: boolean }) => {
        setSpeechMutedState(payload.muted);
      },
    );
    const ttsSub = DeviceEventEmitter.addListener(
      TTS_EVENT,
      (payload: { speaking: boolean }) => {
        setSpeaking(payload.speaking);
      },
    );
    const weatherSub = DeviceEventEmitter.addListener(
      WEATHER_EVENT,
      (payload: { weather: WeatherSnapshot | null }) => {
        setWeather(payload.weather ?? getCachedWeather());
      },
    );
    const poll = setInterval(() => {
      void getStatus().then(setStatus);
      setSpeaking(isSpeaking());
    }, 4000);
    const weatherPoll = setInterval(() => {
      if (appStateRef.current !== 'active') {
        return;
      }
      if (!isWeatherStale()) {
        return;
      }
      void refreshWeatherFromDevice();
    }, WEATHER_STALE_MS);
    const appStateSub = AppState.addEventListener('change', next => {
      const prev = appStateRef.current;
      const wasBackground = Boolean(prev.match(/inactive|background/));
      appStateRef.current = next;
      if (next.match(/inactive|background/)) {
        if (backgroundedAtRef.current == null) {
          backgroundedAtRef.current = Date.now();
        }
        return;
      }
      if (wasBackground && next === 'active') {
        const awayMs =
          backgroundedAtRef.current != null
            ? Date.now() - backgroundedAtRef.current
            : 0;
        backgroundedAtRef.current = null;
        // Warm start after a long pause still held lastPoi / “Latest place”.
        if (awayMs >= SESSION_STALE_MS) {
          void wipeEphemeralSession();
        }
        if (isWeatherStale()) {
          void refreshWeatherFromDevice();
        }
      }
    });
    return () => {
      sub.remove();
      muteSub.remove();
      ttsSub.remove();
      weatherSub.remove();
      clearInterval(poll);
      clearInterval(weatherPoll);
      appStateSub.remove();
    };
  }, []);

  const onPressWeather = useCallback(async () => {
    setWeatherOpen(true);
    if (!isWeatherStale(weather)) {
      return;
    }
    const snap = await refreshWeatherFromDevice();
    if (snap) {
      setWeather(snap);
    }
  }, [weather]);

  const onToggleMute = useCallback(async () => {
    const next = await setSpeechMuted(!speechMuted);
    setSpeechMutedState(next);
  }, [speechMuted]);

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
      if (next) {
        const here = peekFreshLocation();
        setStatus(prev => ({
          ...prev,
          lastLocation: here ?? prev.lastLocation,
          message: t('debugOn', { label: FAKE_LOCATIONS[next].label }),
        }));
        return;
      }
      setStatus(prev => ({
        ...prev,
        message: t('debugOff'),
      }));
      void getFreshLocation()
        .then(here => {
          setStatus(prev => ({ ...prev, lastLocation: here }));
        })
        .catch(() => {
          // Keep last pin until GPS responds.
        });
    },
    [t],
  );

  const onChangeTab = useCallback((next: MainTab) => {
    setOverlay('none');
    setMenuOpen(false);
    setTab(next);
    // Around story must not appear as Drive “Latest place”.
    if (next === 'drive') {
      void (async () => {
        const cur = await getStatus();
        if (cur.tripActive || !cur.lastNarration) {
          return;
        }
        const cleared = await persistStatus({
          lastNarration: undefined,
          lastPoiTitle: undefined,
          lastPoiIds: undefined,
          lastPoiMarkers: undefined,
          lastExposureId: undefined,
          message: '',
        });
        setStatus(cleared);
      })();
    }
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
  const overlayTitle =
    overlay === 'settings'
      ? t('settingsTitle')
      : overlay === 'profile'
        ? t('profileTitle')
        : undefined;

  if (!ready) {
    return <View style={sharedStyles.root} />;
  }

  return (
    <View style={[sharedStyles.root, { paddingTop: insets.top }]}>
      <AppHeader
        title={overlayTitle}
        mode={overlayOpen ? 'overlay' : 'main'}
        speechMuted={speechMuted}
        weatherCode={weather?.current.weatherCode ?? null}
        onPressMenu={() => setMenuOpen(true)}
        onPressBack={() => setOverlay('none')}
        onToggleMute={() => {
          void onToggleMute();
        }}
        onPressWeather={() => {
          void onPressWeather();
        }}
      />
      <AccountMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onAction={onMenuAction}
      />
      <WeatherModal
        visible={weatherOpen}
        weather={weather}
        onClose={() => setWeatherOpen(false)}
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
