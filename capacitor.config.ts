import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.theo.flow',
  appName: 'Theo Flow',
  webDir: 'dist',
  // Keep the APK shell stable while Cloudflare-hosted web releases arrive
  // immediately when the app is opened.
  server: {
    url: 'https://theo-flow.dbsguswl0110.workers.dev/',
    cleartext: false
  }
};

export default config;
