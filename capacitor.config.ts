import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.momentsatsea.app',
  appName: 'MomentsAtSea',
  webDir: 'out',           // ← This is critical
  bundledWebRuntime: false
};

export default config;
