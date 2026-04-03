import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.thirstmetrics.speedtest',
  appName: 'SpeedTest',
  webDir: 'out',
  server: {
    url: 'https://speedtest.thirstmetrics.com',
    cleartext: false,
  },
  android: {
    backgroundColor: '#030712',
  },
};

export default config;
