import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import { initTheme } from './theme/dark-mode';
import './app.scss';

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    const cleanup = initTheme();
    return cleanup;
  });

  return children;
}

export default App;
