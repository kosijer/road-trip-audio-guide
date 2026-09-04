/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders Serbian home screen', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  const text = JSON.stringify(tree!.toJSON());
  expect(text).toContain('Vodič za put');
  expect(text).toContain('Pokreni vožnju');
  expect(text).toContain('Šta ima u okolini?');
  await ReactTestRenderer.act(() => {
    tree.unmount();
  });
});
