import { config } from '../../config';
import { fetchJson } from '../http';
import {
  extractPackageResultStdout,
  parsePackageResultStdout,
} from './parse';
import type { SlingshotPackageResult, SlingshotRunInput } from './types';

const POLL_MS = 2_000;
const TIMEOUT_MS = 90_000;

type RunCreateResponse = {
  id: string;
  status?: string;
};

type RunStatusResponse = {
  id: string;
  status?: string;
  exec_metadata?: Record<string, unknown>;
};

export class SlingshotConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlingshotConfigError';
  }
}

export function slingshotConfigured(): boolean {
  return Boolean(
    config.slingshotPat &&
      config.slingshotTaskId &&
      config.slingshotWorkflowId &&
      config.slingshotBaseUrl,
  );
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${config.slingshotPat}`,
    'Content-Type': 'application/json',
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function runRoadGuideWorkflow(
  input: SlingshotRunInput,
): Promise<SlingshotPackageResult> {
  if (!slingshotConfigured()) {
    throw new SlingshotConfigError('slingshot env incomplete');
  }

  const created = await fetchJson<RunCreateResponse>(
    `${config.slingshotBaseUrl}/tasks/${config.slingshotTaskId}/runs`,
    {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        runName: `along-${Date.now()}`,
        overrides: {
          workflow: config.slingshotWorkflowId,
          variables: {
            latitude: String(input.latitude),
            longitude: String(input.longitude),
            language: input.language,
            mood: input.mood,
            mode: input.mode,
            radiusMeters: String(input.radiusMeters),
          },
        },
      }),
    },
    30_000,
  );

  if (!created?.id) {
    throw new Error('slingshot: run create missing id');
  }

  const started = Date.now();
  let run: RunStatusResponse | null = null;
  while (Date.now() - started < TIMEOUT_MS) {
    run = await fetchJson<RunStatusResponse>(
      `${config.slingshotBaseUrl}/tasks/${config.slingshotTaskId}/runs/${created.id}`,
      { headers: authHeaders() },
      30_000,
    );
    const status = (run.status || '').toLowerCase();
    if (status === 'completed') {
      const stdout = extractPackageResultStdout(run);
      return parsePackageResultStdout(stdout);
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(`slingshot: run ${status}`);
    }
    await sleep(POLL_MS);
  }
  throw new Error('slingshot: run timeout');
}
