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
  ios: {
    scheme: "https",
    contentInset: "automatic",
    scrollEnabled: true,
    backgroundColor: "#0E0903",
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
