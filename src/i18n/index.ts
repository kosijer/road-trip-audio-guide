import { en } from './en';
import { sr } from './sr';
import type { AppLanguage, StringKey } from './types';

export type { AppLanguage, StringKey };

const dictionaries: Record<AppLanguage, Record<StringKey, string>> = {
  en,
  sr,
};

let uiLanguage: AppLanguage = 'en';
let narrationLanguage: AppLanguage = 'en';
let narrationFollowsUi = true;

const listeners = new Set<() => void>();

function notify() {
  listeners.forEach(listener => listener());
}

export function subscribeI18n(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getUiLanguage(): AppLanguage {
  return uiLanguage;
}

export function getNarrationLanguage(): AppLanguage {
  return narrationLanguage;
}

export function getNarrationFollowsUi(): boolean {
  return narrationFollowsUi;
}

export function setUiLanguageState(lang: AppLanguage): void {
  uiLanguage = lang;
  if (narrationFollowsUi) {
    narrationLanguage = lang;
  }
  notify();
}

export function setNarrationLanguageState(
  lang: AppLanguage,
  followsUi: boolean,
): void {
  narrationFollowsUi = followsUi;
  narrationLanguage = followsUi ? uiLanguage : lang;
  notify();
}

export function hydrateI18n(input: {
  uiLanguage: AppLanguage;
  narrationLanguage: AppLanguage;
  narrationFollowsUi: boolean;
}): void {
  uiLanguage = input.uiLanguage;
  narrationFollowsUi = input.narrationFollowsUi;
  narrationLanguage = input.narrationFollowsUi
    ? input.uiLanguage
    : input.narrationLanguage;
  notify();
}

export function t(
  key: StringKey,
  vars?: Record<string, string | number>,
): string {
  return format(dictionaries[uiLanguage][key] ?? en[key] ?? key, vars);
}

/** Strings that feed into spoken narration / LLM extras. */
export function tn(
  key: StringKey,
  vars?: Record<string, string | number>,
): string {
  return format(
    dictionaries[narrationLanguage][key] ?? en[key] ?? key,
    vars,
  );
}

function format(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) {
    return template;
  }
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
