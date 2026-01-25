import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.oteka.app',
  appName: 'Oteka',
  webDir: 'out', // Next.js static export folder (or 'public' if not static)
  server: {
    androidScheme: 'https',
    // In dev, you might point this to your local IP:
    // url: 'http://192.168.1.x:3000',
    // cleartext: true
  },
  plugins: {
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#488AFF",
      sound: "beep.wav",
    },
  },
};

export default config;
