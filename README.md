# 📱 Calorie Track — Real Android Health & Calorie Tracker App
**Author:** Krishna Deshmukh  
**Package:** `com.calorietrack.app`  
**Stack:** Angular / Standalone Signals + Capacitor Android + Firebase Firestore + Gemini Multimodal Vision AI  

---

## 🎯 About The Project
**Calorie Track** is a full-featured, production-ready Android mobile application built for placement portfolio showcasing and daily personal health tracking. Designed to deliver 100% feature parity with top Play Store apps (like Zencalorie), it provides real-time AI food recognition, macronutrient breakdown, health trackers, and persistent offline storage.

### 🌟 Key Android Features
- **Native Android APK Architecture:** Built with Capacitor 6 native runtime (`@capacitor/android`, `@capacitor/camera`, `@capacitor/local-notifications`, `@capacitor/geolocation`, `@capacitor/haptics`).
- **Smooth Side Menu (☰ Drawer):** Sliding navigation drawer with profile card (`Krishna Deshmukh`), badge, and instant access to all screens.
- **Interactive Calendar & Date Matrix:** Tap `Today ∨` to open the month selector and day grid, or swipe across the 7-day week strip. Future days are disabled.
- **Collapsible Dashboard Cards:**
  - 🔥 **Calories Card:** Food, Exercise, Remaining calories with goal edit shortcut (`Goal: 2,100 kcal >`). Collapsed badge preview.
  - 📊 **Macros Card:** 3 dynamic circular SVG rings (Blue for Carbs, Maroon for Protein, Orange for Fat).
  - 💧 **Water Card:** Real-time hydration counter with haptic feedback vibration.
- **Multimodal AI Food & Workout Logging (Gemini 1.5):** Text, gallery upload, or live camera capture with automatic 1024px image compression and nutrient estimation.
- **Interactive Meal Management:** 3-dot bottom sheet with Edit, Full Micronutrient Breakdown, Save to Favorites, and Delete with a 5-second Undo Snackbar.
- **8 Dedicated Trackers Hub (2x4 Grid):**
  1. 🌙 **Sleep Tracker:** Bed and wake time pickers, automatic midnight-crossing calculation, 1-5 emoji sleep quality, 14-day history chart.
  2. 😊 **Mood Tracker:** 5 emoji mood faces, 8 mood tags, good/okay/low counters.
  3. ⏳ **Fasting Tracker:** Presets (12:12, 14:10, 16:8, 18:6, Custom), live stopwatch timer surviving app reboots via localStorage.
  4. 🥩 **Protein Tracker:** Target vs intake progress bar with remaining grams.
  5. 🥗 **Micronutrient Tracker:** Quick chips for Fiber, Calcium, Iron, Vitamin D, Sodium, Sugars.
  6. 📱 **Screen Time Tracker:** Manual daily hours and minutes tracker.
  7. 💧 **Water Tracker:** Stepper goal selector and units (Glasses, ml, oz).
  8. ⚖️ **Weight Tracker:** Current and target weight cards with BMR feedback loop.
- **Weekly Summary & Analytics:** Tabs for This Week / Last Week / 1 Month, net caloric balance, and Mon-Sun table breakdown.
- **Offline First:** Local caching with Firebase Firestore synchronization.

---

## 🚀 How to Get the Android APK on Your Phone

### Option A: Automatic 1-Click APK Build via GitHub Actions (Recommended)
This repository includes an automated GitHub Actions pipeline in `.github/workflows/build-apk.yml`.
1. Upload/push this codebase to your GitHub repository `krishna-Deshmukh13/calorie-tracker`.
2. Go to the **Actions** tab on your GitHub repository.
3. You will see **"Build Android APK (Calorie Track)"** running automatically.
4. When it completes (approx. 2-3 minutes), click on the run and download **`CalorieTrack-debug-apk`**!
5. Transfer the `.apk` to your Android phone (or download directly on your phone's browser), tap it, and press **Install**!

### Option B: Build with Android Studio on Your Laptop
1. Open **Android Studio**.
2. Select **Open an Existing Project** and choose the `android` folder inside this directory.
3. Wait for Gradle sync to complete.
4. Connect your Android phone with USB (with USB Debugging enabled) and click the green **Run (▶)** button, OR click **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
5. The generated APK will be in `android/app/build/outputs/apk/debug/app-debug.apk`.

### Option C: Instant PWA Home Screen App (Zero Setup)
1. Open your live GitHub Pages link: `https://krishna-deshmukh13.github.io/calorie-tracker/` on Chrome on your Android phone.
2. Tap the Chrome three-dot menu (⋮) in the top right corner.
3. Tap **"Install App"** (or **"Add to Home screen"**).
4. The app installs immediately with the Calorie Track icon, full-screen native splash, and offline persistence!

---

## 🛠️ Project Structure
```
├── .github/workflows/
│   └── build-apk.yml          # Automated Android APK Cloud Build Pipeline
├── android/                   # Native Android Studio Project (Gradle, Java, Manifest)
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── AndroidManifest.xml   # Camera, Notifications, Geolocation, Alarms
│   │   │   ├── res/mipmap-*/         # High-res App Launcher Icons
│   │   │   └── assets/public/        # Compiled Mobile Web Engine
├── css/
│   └── styles.css             # Native mobile UI styling (palette #eaf3e7, #527e26)
├── icons/                     # Web and Android app icons (192px, 512px)
├── js/
│   └── app.js                 # Complete app logic, Drawer, Calendar, Trackers, AI
├── www/                       # Built distribution directory for Android packaging
├── build_www.js               # Web asset packaging script
├── capacitor.config.json      # Native Capacitor Android configuration
├── index.html                 # Mobile application single-page interface
├── package.json               # Android dependencies & Capacitor build scripts
└── sw.js                      # Service Worker v5 with automated cache busting
```
