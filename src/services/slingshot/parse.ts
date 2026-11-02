import type { SlingshotPackageResult } from './types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parsePackageResultStdout(
  stdout: unknown,
): SlingshotPackageResult {
  let value: unknown = stdout;
  if (typeof value === 'string') {
    value = JSON.parse(value);
  }
  if (typeof value === 'string') {
    value = JSON.parse(value);
  }
  const root = asRecord(value);
  if (!root) {
    throw new Error('slingshot: Package Result is not an object');
  }
  if (root.ok !== true) {
    throw new Error('slingshot: Package Result ok!=true');
  }
  const narration = asRecord(root.narration);
  const place = asRecord(root.place);
  const weather = asRecord(root.weather);
  const script =
    typeof narration?.script === 'string' ? narration.script.trim() : '';
  if (!script) {
    throw new Error('slingshot: missing narration.script');
  }
  if (!place || typeof place.title !== 'string') {
    throw new Error('slingshot: missing place.title');
  }
  if (!weather) {
    throw new Error('slingshot: missing weather');
  }
  return root as unknown as SlingshotPackageResult;
}

/** Find Package Result stdout inside a completed run payload. */
export function extractPackageResultStdout(run: unknown): string {
  const root = asRecord(run);
  const meta = asRecord(root?.exec_metadata);
  const allOutputs = asRecord(meta?.allOutputs);
  if (!allOutputs) {
    throw new Error('slingshot: missing allOutputs');
  }
  for (const bag of Object.values(allOutputs)) {
    const nodes = asRecord(bag);
    const pkg = asRecord(nodes?.['Package Result']);
    const data = asRecord(pkg?.data);
    if (typeof data?.stdout === 'string' && data.stdout.trim()) {
      return data.stdout;
    }
  }
  throw new Error('slingshot: Package Result stdout not found');
}
