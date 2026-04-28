# Oteka

Oteka is a comprehensive, premium AI-powered health and metabolic advisor application. Designed as a mobile-first experience, it leverages advanced multi-model vision pipelines to analyze food, track macronutrients, and provide real-time metabolic insights tailored to individual medical conditions.

## 🌟 Key Features

### 📸 Pro-Level Vision AI Pipeline
- **Multi-Model Architecture**: Combines the descriptive power of Google's **Gemini 3.0** with the deterministic physics and nutritional extraction engine of **DeepSeek R1**.
- **Multi-Food Detection**: Instantly analyzes complex plates (e.g., "Spaghetti and 5 Meatballs"). It identifies every distinct item, extracts its specific quantity and macros, and provides a master combined tally.
- **Medical Safety Protocols**: The AI engine cross-references detected ingredients against your specific listed medical conditions (e.g., Celiac, Hypertension) and assigns metabolic safety scores.
- **Specialized Modes**: Includes specific vision pipelines for scanning **Travel Menus** (finding high-protein options) and **Pantry Inventories** (extracting expiration dates).
- **Memory Optimized**: Client-side canvas downscaling (max 1024px) ensures high-resolution 4K smartphone cameras don't crash the serverless worker memory limits (WORKER_LIMIT fixes applied).

### 🏠 Household Sharing & Smart Logistics
- **Join by Code**: Link multiple user accounts into a single "Household" using a simple 6-character join code.
- **Family-Aware AI**: The shopping generator aggregates the metabolic goals and medical restrictions (allergies) of all household members, ensuring safe and optimal suggestions for the entire family.
- **Shared Inventory**: Real-time synchronization of Pantry and Shopping lists across all devices in the household.
- **Member Attribution**: See exactly who added each item to the shared shopping list.

### ⚡ Premium UI & UX
- **OLED Dark Theme**: A stunning, battery-saving dark interface utilizing `bg-zinc-950` and absolute blacks (`bg-black`) optimized for modern OLED mobile displays.
- **Glassmorphic Design**: Utilizes frosted glass effects (`backdrop-blur`), subtle borders, and dynamic gradients for a responsive, modern feel.
- **Itemized Dashboards**: Visualizes complex data cleanly, such as the `NutrientRadar` and itemized, color-coded daily macro breakdowns.

### 📶 Offline-First Architecture
- **Unified Sync Layer**: Uses **TanStack Query** with persistent IndexedDB storage to manage all data flow. Mutations (logs, inventory changes) are automatically paused when offline and replayed on reconnection.
- **Optimistic UI**: Provides instant feedback for all user actions by updating the local cache immediately, while background synchronization ensures the server stays in sync without blocking the user experience.
- **Storage-First Vision**: Large image captures are uploaded directly to Supabase Storage, reducing Edge Function memory strain and providing a more resilient, asynchronous processing model.

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Framer Motion
- **Native Wrapper**: Capacitor v8 (Supports seamless iOS and Android deployments)
- **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
- **AI Integration**: AI SDK (`@ai-sdk/google`, `@ai-sdk/openai`), Custom Deno Edge Functions
- **Local Storage**: `idb-keyval`, Zustand (State Management)
- **Payments**: Stripe Integrations

## 🚀 Getting Started

### Prerequisites
- Node.js (v20+)
- Android Studio (for native Android builds)
- A Supabase Project (with requisite Edge Functions deployed)

### Web Development
Clone the repository, install dependencies, and run the Next.js dev server:

```bash
npm install
npm run dev
```

> **Note on Patches**: We use `patch-package` to fix persistent issues in third-party libraries (e.g., Capacitor's Gradle typos). These automatically apply post-install. 

### Native Android Deployment
Oteka is built to compile gracefully from Next.js straight into native Android.

1. **Build the Web App**:
   Compiles the Next.js project into a static export payload.
   ```bash
   npm run build
   ```

2. **Sync with Capacitor**:
   Copies the web payload and synchronizes native plugin versions.
   ```bash
   npx cap sync android
   ```

3. **Open Android Studio**:
   ```bash
   npx cap open android
   ```

4. **Run**: Use the green Play button inside Android Studio to deploy to your physical device or emulator.

## 🔧 Useful Commands
- `npx supabase functions deploy vision-pipeline` - Deploys the core AI vision engine.
- `npx supabase functions deploy shopping-generator` - Deploys the household-aware grocery generator.
- `npx patch-package <package-name>` - Saves reproducible patch files for `node_modules`.
