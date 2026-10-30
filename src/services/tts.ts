import { DeviceEventEmitter } from 'react-native';
import Tts from 'react-native-tts';
import { getSpeechPace, saveSpeechPace, type SpeechPace } from './store';

export type { SpeechPace };

export const TTS_EVENT = 'rtag-tts';

export const SPEECH_RATES: Record<SpeechPace, number> = {
  slow: 0.85,
  normal: 1.0,
  fast: 1.25,
};

type QueueItem = { text: string; resolve: () => void };

let ready = false;
let speaking = false;
let ignoreStaleEvents = false;
const queue: QueueItem[] = [];
let listenersAttached = false;
let currentPace: SpeechPace = 'normal';

function emitSpeaking(next: boolean) {
  speaking = next;
  DeviceEventEmitter.emit(TTS_EVENT, { speaking: next });
}

async function ensureReady(): Promise<boolean> {
  if (ready) {
    return true;
  }
  try {
    await Tts.getInitStatus();
    attachListeners();
    const languages = ['sr-RS', 'sr-Latn-RS', 'sr_RS', 'hr-HR'];
    for (const lang of languages) {
      try {
        await Tts.setDefaultLanguage(lang);
        break;
      } catch {
        // try next
      }
    }
    currentPace = await getSpeechPace();
    await Tts.setDefaultRate(SPEECH_RATES[currentPace], true);
    ready = true;
    return true;
  } catch {
    return false;
  }
}

function attachListeners() {
  if (listenersAttached) {
    return;
  }
  listenersAttached = true;
  Tts.addEventListener('tts-start', () => {
    ignoreStaleEvents = false;
    emitSpeaking(true);
  });
  Tts.addEventListener('tts-finish', () => {
    if (ignoreStaleEvents) {
      return;
    }
    emitSpeaking(false);
    playNext();
  });
  Tts.addEventListener('tts-cancel', () => {
    if (ignoreStaleEvents) {
      return;
    }
    emitSpeaking(false);
    playNext();
  });
}

function playNext() {
  if (speaking) {
    return;
  }
  const item = queue.shift();
  if (!item) {
    return;
  }
  emitSpeaking(true);
  Tts.speak(item.text, {
    androidParams: {
      KEY_PARAM_STREAM: 'STREAM_MUSIC',
    },
  });
  item.resolve();
}

export async function getPace(): Promise<SpeechPace> {
  currentPace = await getSpeechPace();
  return currentPace;
}

export async function applySpeechPace(pace: SpeechPace): Promise<void> {
  currentPace = pace;
  await saveSpeechPace(pace);
  const ok = await ensureReady();
  if (ok) {
    await Tts.setDefaultRate(SPEECH_RATES[pace], true);
  }
}

export async function speak(text: string): Promise<boolean> {
  const ok = await ensureReady();
  if (!ok || !text.trim()) {
    return false;
  }
  await new Promise<void>(resolve => {
    queue.push({ text: text.trim(), resolve });
    playNext();
  });
  return true;
}

export async function stopSpeaking(): Promise<void> {
  queue.length = 0;
  ignoreStaleEvents = true;
  emitSpeaking(false);
  try {
    await Tts.stop();
  } catch {
    // ignore
  }
  setTimeout(() => {
    ignoreStaleEvents = false;
  }, 600);
}

export function isSpeaking(): boolean {
  return speaking || queue.length > 0;
}
