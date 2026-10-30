import {
  hydrateI18n,
  setNarrationLanguageState,
  setUiLanguageState,
  t,
  getNarrationLanguage,
  getUiLanguage,
  getNarrationFollowsUi,
} from '../i18n';

describe('i18n', () => {
  beforeEach(() => {
    hydrateI18n({
      uiLanguage: 'en',
      narrationLanguage: 'en',
      narrationFollowsUi: true,
    });
  });

  it('defaults to English UI copy', () => {
    expect(t('startTrip')).toBe('Start trip');
    expect(getUiLanguage()).toBe('en');
  });

  it('switches UI to Serbian', () => {
    setUiLanguageState('sr');
    expect(t('startTrip')).toBe('Pokreni vožnju');
    expect(getNarrationLanguage()).toBe('sr');
  });

  it('keeps narration independent when follow is off', () => {
    setUiLanguageState('en');
    setNarrationLanguageState('sr', false);
    expect(getNarrationFollowsUi()).toBe(false);
    expect(getUiLanguage()).toBe('en');
    expect(getNarrationLanguage()).toBe('sr');
    expect(t('walking')).toBe("What's around me?");
  });
});
