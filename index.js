/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { headlessTripTask } from './src/services/tripEngine';

AppRegistry.registerComponent(appName, () => App);

for (let i = 1; i <= 20; i += 1) {
  AppRegistry.registerHeadlessTask(`Trip${i}`, () => headlessTripTask);
}
