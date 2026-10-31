/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('@react-native-community/slider', () => 'Slider');
jest.mock('react-native-maps', () => {
  const React = require('react');
  const { View } = require('react-native');
  const MockMap = (props: object) => React.createElement(View, props);
  MockMap.Marker = (props: object) => React.createElement(View, props);
  MockMap.Circle = (props: object) => React.createElement(View, props);
  return MockMap;
});

test('renders English Around tab by default', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  for (let i = 0; i < 5; i++) {
    await ReactTestRenderer.act(async () => {
      await new Promise<void>(resolve => {
        setTimeout(resolve, 0);
      });
    });
    const text = JSON.stringify(tree!.toJSON());
    if (text.includes("What's around me?")) {
      expect(text).toContain('Around');
      expect(text).toContain('Drive');
      expect(text).toContain('History');
      expect(text).toContain('Settings');
      await ReactTestRenderer.act(() => {
        tree.unmount();
      });
      return;
    }
  }
  throw new Error('App did not hydrate English Around screen');
});
