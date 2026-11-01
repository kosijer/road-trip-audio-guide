import { DeviceEventEmitter } from 'react-native';
import Tts from 'react-native-tts';
import type { AppLanguage } from '../i18n/types';
import { getNarrationLanguage } from '../i18n';
import {
  getSpeechMuted,
  getSpeechRate,
  saveSpeechMuted,
  saveSpeechRate,
} from './store';

export const TTS_EVENT = 'rtag-tts';
export const MUTE_EVENT = 'rtag-tts-mute';

export const SPEECH_RATE_MIN = 0.5;
export const SPEECH_RATE_MAX = 1.5;

type QueueItem = { text: string; resolve: () => void };

let ready = false;
let speaking = false;
let ignoreStaleEvents = false;
const queue: QueueItem[] = [];
let listenersAttached = false;
let currentRate = 1.0;
let currentLanguage: AppLanguage = 'en';
let speechMuted = false;

const TTS_LANGS: Record<AppLanguage, string[]> = {
  en: ['en-US', 'en-GB', 'en_US', 'en'],
  sr: ['sr-RS', 'sr-Latn-RS', 'sr_RS', 'hr-HR', 'bs-BA'],
};

function emitSpeaking(next: boolean) {
  speaking = next;
  DeviceEventEmitter.emit(TTS_EVENT, { speaking: next });
}

async function applyTtsLanguage(lang: AppLanguage): Promise<void> {
  currentLanguage = lang;
  for (const code of TTS_LANGS[lang]) {
    try {
      await Tts.setDefaultLanguage(code);
      return;
    } catch {
      // try next
    }
  }
}

async function ensureReady(): Promise<boolean> {
  if (ready) {
    return true;
  }
  try {
    await Tts.getInitStatus();
    attachListeners();
    // Lower / pause other apps (YouTube Music, etc.) while Along narrates.
    try {
      await Tts.setDucking(true);
    } catch (error) {
      console.warn('tts ducking unavailable', error);
    }
    currentLanguage = getNarrationLanguage();
    await applyTtsLanguage(currentLanguage);
    currentRate = await getSpeechRate();
    speechMuted = await getSpeechMuted();
    await Tts.setDefaultRate(currentRate, true);
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
  Tts.speak(item.text);
  item.resolve();
}

export async function getRate(): Promise<number> {
  currentRate = await getSpeechRate();
  return currentRate;
}

export async function applySpeechRate(rate: number): Promise<number> {
  currentRate = await saveSpeechRate(rate);
  const ok = await ensureReady();
  if (ok) {
    await Tts.setDefaultRate(currentRate, true);
  }
  return currentRate;
}

export async function applyNarrationLanguage(lang: AppLanguage): Promise<void> {
  const ok = await ensureReady();
  if (!ok) {
    currentLanguage = lang;
    return;
  }
  await applyTtsLanguage(lang);
}

export async function speak(text: string): Promise<boolean> {
  const ok = await ensureReady();
  if (!ok || !text.trim()) {
    return false;
  }
  // Muted: keep text/history flow, skip audible TTS (bus / silent reading).
  if (speechMuted) {
    return true;
  }
  const desired = getNarrationLanguage();
  if (desired !== currentLanguage) {
    await applyTtsLanguage(desired);
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

export function isSpeechMuted(): boolean {
  return speechMuted;
}

export async function setSpeechMuted(muted: boolean): Promise<boolean> {
  speechMuted = await saveSpeechMuted(muted);
  DeviceEventEmitter.emit(MUTE_EVENT, { muted: speechMuted });
  if (speechMuted) {
    await stopSpeaking();
  }
  return speechMuted;
}

export function isSpeaking(): boolean {
  return speaking || queue.length > 0;
}
