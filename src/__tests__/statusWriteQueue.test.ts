import AsyncStorage from '@react-native-async-storage/async-storage';
import { emptyStatus, setStatus } from '../services/store';

describe('setStatus write queue', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    await setStatus(emptyStatus());
  });

  it('does not drop concurrent upcomingPoi / lastPoiMarkers patches', async () => {
    const location = {
      latitude: 51.51,
      longitude: -0.2,
      speedKmh: 40,
      timestamp: Date.now(),
      accuracyM: 5,
    };
    const markers = [
      {
        id: 'wiki:1',
        title: 'Hyde Park',
        latitude: 51.507,
        longitude: -0.165,
      },
    ];

    // Simulate Drive GPS tick racing the teaser / narration status writes.
    await Promise.all([
      setStatus({ lastLocation: location, moving: true }),
      setStatus({
        upcomingPoi: {
          id: 'wiki:1',
          title: 'Hyde Park',
          latitude: 51.507,
          longitude: -0.165,
          distanceM: 1200,
        },
        drivePhase: 'teaser',
      }),
      setStatus({ lastTriggerAt: Date.now() }),
    ]);

    let status = await setStatus({});
    expect(status.upcomingPoi?.title).toBe('Hyde Park');
    expect(status.lastLocation?.latitude).toBe(51.51);

    await Promise.all([
      setStatus({ lastLocation: { ...location, latitude: 51.511 } }),
      setStatus({
        lastPoiMarkers: markers,
        lastNarration: 'Hyde Park is ahead.',
        lastPoiTitle: 'Hyde Park',
        upcomingPoi: undefined,
        drivePhase: 'full',
      }),
      setStatus({ moving: true }),
    ]);

    status = await setStatus({});
    expect(status.lastPoiMarkers?.[0]?.title).toBe('Hyde Park');
    expect(status.upcomingPoi).toBeUndefined();
    expect(status.lastLocation?.latitude).toBe(51.511);
  });
});
