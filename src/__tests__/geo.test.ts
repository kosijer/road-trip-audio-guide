import { haversineM, sampleAlongRoute } from '../geo';
import { interestingness, scoreKeywords } from '../services/poi/score';

describe('geo', () => {
  it('computes haversine distance for nearby Crete points', () => {
    const knossos = { latitude: 35.2978, longitude: 25.1631 };
    const heraklion = { latitude: 35.3387, longitude: 25.1442 };
    const meters = haversineM(knossos, heraklion);
    expect(meters).toBeGreaterThan(4000);
    expect(meters).toBeLessThan(8000);
  });

  it('samples constructed points about every 8 km', () => {
    const points = [];
    for (let i = 0; i < 20; i++) {
      points.push({ latitude: 35.3, longitude: 23.7 + i * 0.08 });
    }
    const samples = sampleAlongRoute(points, 8);
    expect(samples.length).toBeGreaterThan(2);
    expect(samples.length).toBeLessThan(points.length);
  });
});

describe('poi scoring', () => {
  it('ranks a castle above a generic shop name', () => {
    const castle = interestingness(
      'Koules Fortress',
      'Venetian castle at the harbour of Heraklion.',
      400,
    );
    const weak = interestingness('Bus stop', 'A local bus stop.', 20);
    expect(scoreKeywords('Koules Fortress', 'Venetian castle')).toBeGreaterThan(0);
    expect(castle).toBeGreaterThan(weak);
  });
});
