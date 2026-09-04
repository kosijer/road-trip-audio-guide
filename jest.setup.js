jest.mock('@react-native-async-storage/async-storage', () => {
  const mockMemory = new Map();
  return {
    setItem: jest.fn((key, value) => {
      mockMemory.set(key, value);
      return Promise.resolve();
    }),
    getItem: jest.fn(key => Promise.resolve(mockMemory.get(key) ?? null)),
    multiRemove: jest.fn(keys => {
      keys.forEach(key => mockMemory.delete(key));
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      mockMemory.clear();
      return Promise.resolve();
    }),
  };
});

jest.mock('@react-native-community/geolocation', () => ({
  __esModule: true,
  default: {
    setRNConfiguration: jest.fn(),
    getCurrentPosition: jest.fn(),
    requestAuthorization: jest.fn(),
  },
}));

jest.mock('react-native-background-actions', () => ({
  __esModule: true,
  default: {
    start: jest.fn(),
    stop: jest.fn(),
    isRunning: () => false,
    updateNotification: jest.fn(),
  },
}));

jest.mock('react-native-tts', () => ({
  __esModule: true,
  default: {
    getInitStatus: jest.fn(async () => true),
    setDefaultLanguage: jest.fn(),
    setDefaultRate: jest.fn(),
    speak: jest.fn(),
    stop: jest.fn(),
    addEventListener: jest.fn(),
    removeAllListeners: jest.fn(),
  },
}));

jest.mock('react-native-safe-area-context', () => {
  const inset = { top: 0, right: 0, bottom: 0, left: 0 };
  return {
    SafeAreaProvider: ({ children }) => children,
    useSafeAreaInsets: () => inset,
  };
});
