import Tts from 'react-native-tts';

type QueueItem = { text: string; resolve: () => void };

let ready = false;
let speaking = false;
const queue: QueueItem[] = [];
let listenersAttached = false;

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
    await Tts.setDefaultRate(0.42, true);
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
  Tts.addEventListener('tts-finish', () => {
    speaking = false;
    playNext();
  });
  Tts.addEventListener('tts-cancel', () => {
    speaking = false;
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
  speaking = true;
  Tts.speak(item.text, {
    androidParams: {
      KEY_PARAM_STREAM: 'STREAM_MUSIC',
    },
  });
  item.resolve();
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
  speaking = false;
  try {
    await Tts.stop();
  } catch {
    // ignore
  }
}

export function isSpeaking(): boolean {
  return speaking || queue.length > 0;
}
