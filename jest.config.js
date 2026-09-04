module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@env$': '<rootDir>/src/test/env.mock.js',
  },
  forceExit: true,
};
