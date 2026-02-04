# Oteka

Comprehensive health and metabolic advisor application.

## Getting Started

### Prerequisites

- Node.js & npm
- Android Studio (for Android build)
- Supabase account (for database/auth)

### Web Development

```bash
npm install
npm run dev
```

### Android Deployment

1. **Build the Web App**:
   ```bash
   npm run build
   ```

2. **Sync with Capacitor**:
   ```bash
   npx cap sync android
   ```

3. **Open in Android Studio**:
   ```bash
   npx cap open android
   ```

4. **Run**: Use the green Play button in Android Studio.

## Build System & Patches

We use `patch-package` to fix persistent issues in third-party libraries (e.g., Capacitor's ProGuard settings). These patches are automatically applied after `npm install`.

If you modify a library in `node_modules` and want to save it:
```bash
npx patch-package <package-name>
```

## Tech Stack

- **Framework**: Next.js 15+ (App Router)
- **Native**: Capacitor
- **Database**: Supabase
- **AI**: Gemini 3.0 Flash, DeepSeek R1
- **Optimization**: WASM (Rust)

