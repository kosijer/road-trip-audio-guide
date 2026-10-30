/**
 * @deprecated Use `t` / `tn` from `src/i18n` instead.
 * Kept as a thin re-export so older imports do not break mid-refactor.
 */
import { t } from './i18n';
import type { StringKey } from './i18n/types';
import { en } from './i18n/en';

export const s: Record<StringKey, string> = new Proxy(en, {
  get(_target, prop: string) {
    return t(prop as StringKey);
  },
});
