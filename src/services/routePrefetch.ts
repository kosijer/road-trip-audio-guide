import { fetchRouteSamples } from './directions';
import { discoverPois } from './poi/discover';
import { config } from '../config';
import { savePois, setStatus } from './store';

export async function runPrefetch(
  origin: string,
  destination: string,
  onProgress?: (message: string) => void,
): Promise<number> {
  onProgress?.('Tražim rutu…');
  const samples = await fetchRouteSamples(origin.trim(), destination.trim());
  if (samples.length === 0) {
    throw new Error('route_failed');
  }
  const seen = new Set<string>();
  for (let i = 0; i < samples.length; i++) {
    onProgress?.(`Preuzimam mesta ${i + 1}/${samples.length}…`);
    try {
      const pois = await discoverPois(samples[i], config.drivingPoiRadiusM);
      await savePois(pois);
      pois.forEach(p => seen.add(p.id));
    } catch {
      // skip this sample if the network blips
    }
  }
  await setStatus({ prefetchCount: seen.size });
  return seen.size;
}
