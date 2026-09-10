import { registerRootComponent } from 'expo';

import App from './App';
// перехватчик ставим до отрисовки — иначе ранние ошибки пройдут мимо
import { installGlobalHandler } from './src/crash';

installGlobalHandler();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
