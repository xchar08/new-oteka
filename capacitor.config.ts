import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.oteka.app",
  appName: "Oteka",
  webDir: "out",
  server: {
    androidScheme: "https",
    cleartext: true,
    allowNavigation: ["*"],
  },
};

export default config;
