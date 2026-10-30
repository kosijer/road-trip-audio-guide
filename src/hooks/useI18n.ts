import { useEffect, useState } from 'react';
import {
  getNarrationFollowsUi,
  getNarrationLanguage,
  getUiLanguage,
  subscribeI18n,
  t,
  type AppLanguage,
} from '../i18n';

export function useI18n() {
  const [, setTick] = useState(0);
  useEffect(() => subscribeI18n(() => setTick(n => n + 1)), []);
  return {
    t,
    uiLanguage: getUiLanguage(),
    narrationLanguage: getNarrationLanguage(),
    narrationFollowsUi: getNarrationFollowsUi(),
  };
}

export type { AppLanguage };
