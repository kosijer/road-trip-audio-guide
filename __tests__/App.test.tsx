/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('@react-native-community/slider', () => 'Slider');

test('renders English drive tab by default', async () => {
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
    if (text.includes('Road Trip Audio Guide')) {
      expect(text).toContain('Start trip');
      expect(text).toContain('Drive');
      expect(text).toContain('Around');
      expect(text).toContain('Settings');
      await ReactTestRenderer.act(() => {
        tree.unmount();
      });
      return;
    }
  }
  throw new Error('App did not hydrate English drive screen');
});
