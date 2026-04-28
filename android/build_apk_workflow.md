---
description: Build Android APK for testing
---

# Build Android APK

This workflow builds a debug APK that can be installed on Android devices for
testing.

1. **Build Web Assets** Compiles the Next.js application into static assets.
   ```bash
   npm run build
   ```

2. **Sync Native Project** Copies the web assets to the Android project.
   ```bash
   npx cap sync android
   ```

3. **Build APK** Uses Gradle to assemble the debug APK. // turbo
   ```bash
   cd android
   ./gradlew assembleDebug
   ```

4. **Locate APK** The built APK will be located at:
   `android/app/build/outputs/apk/debug/app-debug.apk`
