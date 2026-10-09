import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kblox2.wished',
  appName: 'Forma 3D',
  webDir: 'dist',
  android: {
    minSdkVersion: 30,
  },
};

export default config;
