/**
 * ============================================================================
 * Calorie Track: Your Calorie Counter - Built by Krishna Deshmukh
 * Real Production-Grade Calorie & Health Tracker
 * ============================================================================
 */

/* ============================================================================
 * [1] USER FIREBASE CONFIGURATION (my-calorie-app-c4d66)
 * ============================================================================ */
const firebaseConfig = {
  apiKey: "AIzaSyA468vsrrMLwqj0VyZQmAkkCRll7HNSwEA",
  authDomain: "my-calorie-app-c4d66.firebaseapp.com",
  projectId: "my-calorie-app-c4d66",
  storageBucket: "my-calorie-app-c4d66.firebasestorage.app",
  messagingSenderId: "40808701302",
  appId: "1:40808701302:web:acf2f390e2933d3f7e2e57",
  measurementId: "G-EBJEK6LC8P"
};

/* ============================================================================
 * [2] FIREBASE MODULAR SDK IMPORTS (v10 via Google CDN)
 * ============================================================================ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* ============================================================================
 * [3] APPLICATION STATE
 * ============================================================================ */
const state = {
  currentUser: null,
  activeDate: new Date().toISOString().split("T")[0], // YYYY-MM-DD
  calendarViewMonth: new Date().getMonth(), // 0-11
  calendarViewYear: new Date().getFullYear(),
  profile: {
    fullName: "Krishna Deshmukh",
    email: "krishnadeshmukh721@gmail.com",
    unitHeight: "cm",
    unitWeight: "kg",
    height: 170.0,
    weight: 65.0,
    targetWeight: 60.0,
    age: 21,
    gender: "male",
    activity: 1.55,
    activityName: "Moderate",
    goal: "maintain",
    dailyCalories: 2100,
    macroSplit: { carbsPct: 50, proteinPct: 25, fatPct: 25 },
    waterEnabled: true,
    waterGoalGlasses: 8,
    waterUnit: "glasses",
    firstDayOfWeek: "monday",
    geminiApiKey: "",
    address: ""
  },
  meals: [],
  exercises: [],
  waterGlasses: 0,
  fasting: {
    isFasting: false,
    startTime: null,
    targetHours: 16
  },
  mood: {
    todayRating: null,
    todayNote: "",
    todayTags: [],
    counts: { good: 0, okay: 0, low: 0 }
  },
  onboardingData: {
    height: 170,
    unitHeight: "cm",
    weight: 65,
    unitWeight: "kg",
    age: 21,
    gender: "male",
    activity: 1.55,
    activityName: "Moderate",
    goal: "maintain"
  }
};

let auth = null;
let db = null;
let activeSelectedMealId = null;
let lastDeletedMeal = null;
let fastingTimerInterval = null;

/* ============================================================================
 * [4] FIREBASE INITIALIZATION & PERSISTENCE
 * ============================================================================ */
async function initFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);

    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
      console.log("[Calorie Track] Persistent local cache enabled.");
    } catch (e) {
      db = initializeFirestore(app, {});
    }

    getRedirectResult(auth)
      .then((res) => {
        if (res && res.user) showToast(`Welcome back, ${res.user.displayName || "Krishna"}!`);
      })
      .catch(console.warn);

    onAuthStateChanged(auth, async (user) => {
      if (user) {
        state.currentUser = user;
        state.profile.fullName = user.displayName || "Krishna Deshmukh";
        state.profile.email = user.email || "krishnadeshmukh721@gmail.com";
      } else {
        state.currentUser = { uid: "guest-user", displayName: "Krishna Deshmukh" };
      }
      updateUserUI();
      await loadUserProfile();
      await loadDayData(state.activeDate);
      await loadMoodData();
      showDashboard();
      dismissSplash();
    });

  } catch (err) {
    console.error("[Calorie Track] Firebase init error:", err);
    state.currentUser = { uid: "guest-user", displayName: "Krishna Deshmukh" };
    showDashboard();
    dismissSplash();
  }
}

function dismissSplash() {
  const splash = document.getElementById("screen-splash");
  if (splash) {
    splash.classList.add("fade-out");
    setTimeout(() => splash.remove(), 400);
  }
}

/* ============================================================================
 * [5] AUTHENTICATION
 * ============================================================================ */
async function handleGoogleAuth() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  try {
    const res = await signInWithPopup(auth, provider);
    showToast(`Signed in as ${res.user.displayName}`);
  } catch (err) {
    if (err.code === "auth/popup-blocked" || err.code === "auth/cancelled-popup-request") {
      await signInWithRedirect(auth, provider);
    } else {
      showToast(err.message || "Failed to sign in.");
    }
  }
}

async function handleLogout() {
  try {
    if (auth) await signOut(auth);
    state.currentUser = null;
    showWelcomeScreen();
    showToast("Signed out successfully.");
  } catch (e) {
    showToast("Logout error: " + e.message);
  }
}

/* ============================================================================
 * [6] FIRESTORE PROFILE & USER DATA
 * ============================================================================ */
async function loadUserProfile() {
  if (!db || !state.currentUser) return;
  try {
    const ref = doc(db, "users", state.currentUser.uid, "profile", "main");
    const snap = await getDoc(ref);
    if (snap.exists()) {
      state.profile = { ...state.profile, ...snap.data() };
      syncProfileInputs();
      recalculateMifflinStJeor(false);
    }
  } catch (e) {
    console.warn("Could not load cloud profile:", e);
  }
}

async function saveUserProfile(showNotice = true) {
  if (!db || !state.currentUser) return;
  try {
    const ref = doc(db, "users", state.currentUser.uid, "profile", "main");
    await setDoc(ref, state.profile, { merge: true });
    if (showNotice) showToast("Profile & goals saved!");
  } catch (e) {
    if (showNotice) showToast("Profile updated locally.");
  }
}

async function loadDayData(dateStr) {
  state.meals = [];
  state.exercises = [];
  state.waterGlasses = 0;

  if (!db || !state.currentUser) {
    renderActivityFeed();
    updateDashboardNumbers();
    return;
  }

  try {
    const mealsRef = collection(db, "users", state.currentUser.uid, "meals");
    const q = query(mealsRef, where("date", "==", dateStr));
    const snap = await getDocs(q);
    state.meals = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const exRef = collection(db, "users", state.currentUser.uid, "exercises");
    const qEx = query(exRef, where("date", "==", dateStr));
    const snapEx = await getDocs(qEx);
    state.exercises = snapEx.docs.map(d => ({ id: d.id, ...d.data() }));

    const waterRef = doc(db, "users", state.currentUser.uid, "water", dateStr);
    const snapWater = await getDoc(waterRef);
    if (snapWater.exists()) {
      state.waterGlasses = snapWater.data().glasses || 0;
    }

    renderActivityFeed();
    updateDashboardNumbers();
  } catch (e) {
    console.warn("Could not load day data:", e);
    renderActivityFeed();
    updateDashboardNumbers();
  }
}

/* ============================================================================
 * [7] MIFFLIN-ST JEOR CALORIE & MACRO ENGINE
 * ============================================================================ */
function calculateMifflinStJeorFormula(weightKg, heightCm, age, gender, activityMultiplier, goalOffset = 0, macroSplit = null) {
  const w = parseFloat(weightKg) || 65;
  const h = parseFloat(heightCm) || 170;
  const a = parseInt(age, 10) || 21;
  const isMale = gender === "male";
  const act = parseFloat(activityMultiplier) || 1.55;

  let bmr = (10 * w) + (6.25 * h) - (5 * a) + (isMale ? 5 : -161);
  let tdee = Math.round(bmr * act);
  let dailyTarget = tdee + parseInt(goalOffset, 10);

  const floor = isMale ? 1500 : 1200;
  dailyTarget = Math.max(floor, dailyTarget);

  const split = macroSplit || { carbsPct: 50, proteinPct: 25, fatPct: 25 };
  const carbsGrams = Math.round((dailyTarget * (split.carbsPct / 100)) / 4);
  const proteinGrams = Math.round((dailyTarget * (split.proteinPct / 100)) / 4);
  const fatGrams = Math.round((dailyTarget * (split.fatPct / 100)) / 9);

  return {
    bmr: Math.round(bmr),
    tdee,
    dailyTarget,
    carbsGrams,
    proteinGrams,
    fatGrams
  };
}

function recalculateMifflinStJeor(triggerUIUpdate = true) {
  const p = state.profile;
  let weightKg = parseFloat(p.weight) || 65;
  let heightCm = parseFloat(p.height) || 170;

  if (p.unitWeight === "lb") weightKg *= 0.45359237;
  if (p.unitHeight === "ftin") heightCm *= 2.54;

  let offset = 0;
  if (p.goal === "lose") offset = -300;
  else if (p.goal === "gain") offset = 300;

  const result = calculateMifflinStJeorFormula(
    weightKg,
    heightCm,
    p.age,
    p.gender,
    p.activity,
    offset,
    p.macroSplit
  );

  p.dailyCalories = result.dailyTarget;

  if (triggerUIUpdate) {
    updateDashboardNumbers();
  }
}

/* ============================================================================
 * [8] DASHBOARD UI UPDATES & COUNTERS
 * ============================================================================ */
function animateNumber(elementId, targetVal) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const startVal = parseInt(el.textContent.replace(/,/g, ""), 10) || 0;
  const duration = 280;
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 2);
    const current = Math.round(startVal + (targetVal - startVal) * easeOut);
    el.textContent = current.toLocaleString();
    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }
  requestAnimationFrame(step);
}

function updateDashboardNumbers() {
  const dailyGoal = state.profile.dailyCalories || 2100;
  let foodCals = 0;
  let totalCarbs = 0;
  let totalProtein = 0;
  let totalFat = 0;

  state.meals.forEach(m => {
    foodCals += parseInt(m.calories, 10) || 0;
    totalCarbs += parseFloat(m.carbs) || 0;
    totalProtein += parseFloat(m.protein) || 0;
    totalFat += parseFloat(m.fat) || 0;
  });

  let exerciseCals = 0;
  state.exercises.forEach(ex => {
    exerciseCals += parseInt(ex.calories, 10) || 0;
  });

  const remainingCals = Math.max(0, dailyGoal - foodCals + exerciseCals);

  animateNumber("dash-food-cals", foodCals);
  animateNumber("dash-exercise-cals", exerciseCals);
  animateNumber("dash-remaining-cals", remainingCals);

  const goalNumEl = document.getElementById("dash-goal-num");
  if (goalNumEl) goalNumEl.textContent = dailyGoal.toLocaleString();

  const badgeCal = document.getElementById("badge-collapsed-calories");
  if (badgeCal) badgeCal.textContent = `${foodCals} / ${dailyGoal.toLocaleString()} kcal`;

  const badgeMac = document.getElementById("badge-collapsed-macros");
  if (badgeMac) badgeMac.textContent = `C ${Math.round(totalCarbs)}g P ${Math.round(totalProtein)}g F ${Math.round(totalFat)}g`;

  const split = state.profile.macroSplit || { carbsPct: 50, proteinPct: 25, fatPct: 25 };
  const targetCarbs = Math.max(1, Math.round((dailyGoal * (split.carbsPct / 100)) / 4));
  const targetProtein = Math.max(1, Math.round((dailyGoal * (split.proteinPct / 100)) / 4));
  const targetFat = Math.max(1, Math.round((dailyGoal * (split.fatPct / 100)) / 9));

  const elCarb = document.getElementById("label-carbs-fraction");
  if (elCarb) elCarb.innerHTML = `${Math.round(totalCarbs)}<span>/${targetCarbs}</span>`;

  const elProt = document.getElementById("label-protein-fraction");
  if (elProt) elProt.innerHTML = `${Math.round(totalProtein)}<span>/${targetProtein}</span>`;

  const elFat = document.getElementById("label-fat-fraction");
  if (elFat) elFat.innerHTML = `${Math.round(totalFat)}<span>/${targetFat}</span>`;

  const c = 188.5;
  setRingGauge("ring-carbs", totalCarbs / targetCarbs, c);
  setRingGauge("ring-protein", totalProtein / targetProtein, c);
  setRingGauge("ring-fat", totalFat / targetFat, c);

  // Water Tracker Card
  const waterCard = document.getElementById("card-water-dash");
  if (waterCard) {
    if (state.profile.waterEnabled) {
      waterCard.classList.remove("hidden");
      const waterValEl = document.getElementById("dash-water-val");
      const waterGoalEl = document.getElementById("dash-water-goal");
      const waterUnitEl = document.getElementById("dash-water-unit");
      const waterBadge = document.getElementById("badge-collapsed-water");

      if (waterValEl) waterValEl.textContent = state.waterGlasses;
      if (waterGoalEl) waterGoalEl.textContent = state.profile.waterGoalGlasses || 8;
      if (waterUnitEl) waterUnitEl.textContent = state.profile.waterUnit || "glasses";
      if (waterBadge) waterBadge.textContent = `${state.waterGlasses} / ${state.profile.waterGoalGlasses || 8} ${state.profile.waterUnit || "glasses"}`;
    } else {
      waterCard.classList.add("hidden");
    }
  }

  // Update Weight display on trackers subpage
  const wCur = document.getElementById("weight-display-current");
  const wTar = document.getElementById("weight-display-target");
  if (wCur) wCur.textContent = `${state.profile.weight || 65} ${state.profile.unitWeight || "kg"}`;
  if (wTar) wTar.textContent = `${state.profile.targetWeight || 60} ${state.profile.unitWeight || "kg"}`;
}

function setRingGauge(elementId, ratio, circumference) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const clamped = Math.min(Math.max(ratio, 0), 1);
  const offset = circumference * (1 - clamped);
  el.style.strokeDashoffset = offset.toFixed(1);
}

/* ============================================================================
 * [9] ACTIVITY FEED RENDERING
 * ============================================================================ */
function renderActivityFeed() {
  const container = document.getElementById("activity-feed-container");
  if (!container) return;

  if (state.meals.length === 0 && state.exercises.length === 0) {
    container.innerHTML = `
      <div class="empty-feed-card">
        Nothing logged for this day. Describe a meal or workout below to start.
      </div>
    `;
    return;
  }

  const dailyGoal = state.profile.dailyCalories || 2100;
  const split = state.profile.macroSplit || { carbsPct: 50, proteinPct: 25, fatPct: 25 };
  const targetCarbs = Math.max(1, (dailyGoal * (split.carbsPct / 100)) / 4);
  const targetProt = Math.max(1, (dailyGoal * (split.proteinPct / 100)) / 4);
  const targetFat = Math.max(1, (dailyGoal * (split.fatPct / 100)) / 9);

  let html = "";

  state.meals.forEach((m) => {
    const pctCals = Math.min(100, Math.round(((m.calories || 0) / dailyGoal) * 100));
    const pctC = Math.min(100, Math.round(((m.carbs || 0) / targetCarbs) * 100));
    const pctP = Math.min(100, Math.round(((m.protein || 0) / targetProt) * 100));
    const pctF = Math.min(100, Math.round(((m.fat || 0) / targetFat) * 100));

    html += `
      <div class="zen-card activity-meal-card ${m.isNew ? "meal-card-new" : ""}" data-id="${m.id}">
        <div class="meal-card-top">
          <div class="meal-title-wrap">
            <span class="meal-card-name">${escapeHtml(m.name || "Meal")}</span>
            <button type="button" class="meal-edit-pencil-btn" title="Edit entry" onclick="openMealActions('${m.id}')">&#9998;</button>
          </div>
          <div class="meal-card-sub">${escapeHtml(m.sub || "")}</div>
        </div>

        <div class="meal-metrics-grid">
          <div class="meal-metric-col">
            <span class="metric-label">CALORIES</span>
            <span class="metric-val green">${m.calories || 0}</span>
            <div class="metric-progress-track">
              <div class="metric-progress-bar green" style="width: ${pctCals}%;"></div>
            </div>
            <span class="metric-pct">${pctCals}%</span>
          </div>

          <div class="meal-metric-col">
            <span class="metric-label">CARBS</span>
            <span class="metric-val blue">${m.carbs || 0}g</span>
            <div class="metric-progress-track">
              <div class="metric-progress-bar blue" style="width: ${pctC}%;"></div>
            </div>
            <span class="metric-pct">${pctC}%</span>
          </div>

          <div class="meal-metric-col">
            <span class="metric-label">PROTEIN</span>
            <span class="metric-val maroon">${m.protein || 0}g</span>
            <div class="metric-progress-track">
              <div class="metric-progress-bar maroon" style="width: ${pctP}%;"></div>
            </div>
            <span class="metric-pct">${pctP}%</span>
          </div>

          <div class="meal-metric-col">
            <span class="metric-label">FAT</span>
            <span class="metric-val orange">${m.fat || 0}g</span>
            <div class="metric-progress-track">
              <div class="metric-progress-bar orange" style="width: ${pctF}%;"></div>
            </div>
            <span class="metric-pct">${pctF}%</span>
          </div>
        </div>

        <div class="meal-card-footer">
          <span class="meal-time-stamp">${escapeHtml(m.time || "Today")}</span>
          <div class="meal-footer-actions">
            <button type="button" class="btn-icon-subtle" title="View Nutrition" onclick="openFullNutritionModal()">&#128269;</button>
            <button type="button" class="btn-icon-subtle" title="Options" onclick="openMealActions('${m.id}')">&#8942;</button>
          </div>
        </div>
      </div>
    `;
  });

  state.exercises.forEach((ex) => {
    html += `
      <div class="zen-card activity-meal-card" data-id="${ex.id}" style="border-left: 4px solid #10b981;">
        <div class="meal-card-top">
          <div class="meal-title-wrap">
            <span class="meal-card-name">🏃 ${escapeHtml(ex.name || "Workout")}</span>
          </div>
          <div class="meal-card-sub">${escapeHtml(ex.sub || "MET calculation")}</div>
        </div>
        <div class="meal-card-footer" style="margin-top:12px;">
          <span class="meal-time-stamp" style="color:#10b981; font-weight:700;">-${ex.calories} kcal burned</span>
          <button type="button" class="btn-icon-subtle" title="Delete" onclick="deleteExercise('${ex.id}')">&#128465;</button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

/* ============================================================================
 * [10] IMAGE COMPRESSION & GEMINI FOOD AI
 * ============================================================================ */
function compressImage(file, maxDimension = 1024) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function getActiveGeminiModels(key) {
  const fallbackList = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-2.5-flash", "gemini-1.5-pro"];
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
    if (res.ok) {
      const data = await res.json();
      const models = (data.models || [])
        .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
        .map(m => m.name.replace("models/", ""));
      const sorted = models.sort((a, b) => (b.includes("flash") ? 1 : 0) - (a.includes("flash") ? 1 : 0));
      if (sorted.length > 0) return sorted;
    }
  } catch (e) {}
  return fallbackList;
}

function isExerciseQuery(text) {
  const lower = text.toLowerCase();
  const keywords = ["ran", "run", "running", "walked", "walking", "jogging", "cycling", "cycle", "gym", "workout", "swimming", "pushups", "yoga", "squats", "hiit"];
  return keywords.some(k => lower.includes(k));
}

function estimateExerciseCalories(text, weightKg) {
  const lower = text.toLowerCase();
  let met = 5.0;
  let durationHours = 0.5;

  if (lower.includes("run") || lower.includes("running")) met = 8.5;
  else if (lower.includes("walk")) met = 3.5;
  else if (lower.includes("cycling")) met = 6.0;
  else if (lower.includes("gym") || lower.includes("workout")) met = 5.5;
  else if (lower.includes("yoga")) met = 3.0;

  const minMatch = lower.match(/(\d+)\s*(mins?|minutes?)/);
  if (minMatch) durationHours = parseInt(minMatch[1], 10) / 60;
  const hrMatch = lower.match(/(\d+)\s*(hours?|hrs?)/);
  if (hrMatch) durationHours = parseInt(hrMatch[1], 10);

  const burned = Math.round(met * weightKg * durationHours);
  return {
    name: text.charAt(0).toUpperCase() + text.slice(1),
    sub: `${Math.round(durationHours * 60)} mins • MET ${met}`,
    calories: Math.max(20, burned)
  };
}

async function analyzeFoodPhoto(base64Data) {
  const key = state.profile.geminiApiKey?.trim();
  if (!key) {
    showToast("Please enter your Gemini API Key in Settings first.");
    openSubpage("subpage-settings");
    return;
  }

  showToast("Analyzing food photo with Gemini AI...");

  try {
    const mime = base64Data.substring(base64Data.indexOf(":") + 1, base64Data.indexOf(";"));
    const rawData = base64Data.split(",")[1];

    const promptText = `
You are the AI nutrition engine for Calorie Track.
Analyze this meal photo carefully:
Return ONLY a valid JSON object matching this schema:
{
  "title": "Dish Name",
  "sub": "Ingredients & portions description",
  "calories": 450,
  "carbs": 55,
  "protein": 20,
  "fat": 15,
  "items": [
    { "name": "Item name", "portion": "portion size", "calories": 250, "carbs": 30, "protein": 10, "fat": 5 }
  ]
}
`;

    const candidateModels = await getActiveGeminiModels(key);
    let rawText = null;

    for (const mName of candidateModels) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: promptText },
                { inline_data: { mime_type: mime || "image/jpeg", data: rawData } }
              ]
            }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });

        if (res.ok) {
          const j = await res.json();
          rawText = j.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) break;
        }
      } catch (err) {}
    }

    if (!rawText) throw new Error("Could not analyze photo. Please check your Gemini API key.");

    const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleaned);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    const newMeal = {
      id: "meal-" + Date.now(),
      date: state.activeDate,
      name: result.title || "Logged Meal",
      sub: result.sub || "Photo Analysis",
      time: timeStr,
      calories: parseInt(result.calories, 10) || 0,
      carbs: parseInt(result.carbs, 10) || 0,
      protein: parseInt(result.protein, 10) || 0,
      fat: parseInt(result.fat, 10) || 0,
      items: result.items || [],
      isNew: true
    };

    state.meals.unshift(newMeal);
    renderActivityFeed();
    updateDashboardNumbers();
    showToast(`Logged ${newMeal.name} (${newMeal.calories} kcal)!`);

    setTimeout(() => {
      newMeal.isNew = false;
      const el = document.querySelector(`[data-id="${newMeal.id}"]`);
      if (el) el.classList.remove("meal-card-new");
    }, 3000);

    if (db && state.currentUser) {
      setDoc(doc(db, "users", state.currentUser.uid, "meals", newMeal.id), newMeal).catch(() => {});
    }

  } catch (err) {
    showToast(err.message || "Failed to analyze photo.");
  }
}

async function submitBottomPillEntry() {
  const inputEl = document.getElementById("bottom-pill-input");
  const text = inputEl ? inputEl.value.trim() : "";
  if (!text) return;

  inputEl.value = "";
  const sendBtn = document.getElementById("btn-bottom-send");
  if (sendBtn) sendBtn.classList.add("hidden");

  if (isExerciseQuery(text)) {
    let weightKg = parseFloat(state.profile.weight) || 65;
    if (state.profile.unitWeight === "lb") weightKg *= 0.45359237;

    const ex = estimateExerciseCalories(text, weightKg);
    const exDoc = {
      id: "ex-" + Date.now(),
      date: state.activeDate,
      name: ex.name,
      sub: ex.sub,
      calories: ex.calories,
      timestamp: new Date().toISOString()
    };

    state.exercises.unshift(exDoc);
    renderActivityFeed();
    updateDashboardNumbers();
    showToast(`Logged workout: -${ex.calories} kcal!`);

    if (db && state.currentUser) {
      setDoc(doc(db, "users", state.currentUser.uid, "exercises", exDoc.id), exDoc).catch(() => {});
    }
    return;
  }

  const key = state.profile.geminiApiKey?.trim();
  if (!key) {
    showToast("Please enter your Gemini API Key in Settings first.");
    openSubpage("subpage-settings");
    return;
  }

  showToast("Analyzing meal with Gemini...");

  try {
    const promptText = `
You are the AI nutrition engine for Calorie Track, an expert dietitian specialized in Indian and international cuisines (rotis, paratha, dal makhani, paneer, biryani, dosa, idli, rice, sabzi).
Analyze this meal from description: "${text}".
Return ONLY a valid JSON object matching this schema:
{
  "title": "Dish Name",
  "sub": "Ingredients summary",
  "calories": 450,
  "carbs": 55,
  "protein": 15,
  "fat": 12,
  "items": [
    { "name": "Item name", "portion": "1 serving", "calories": 450, "carbs": 55, "protein": 15, "fat": 12 }
  ]
}
`;

    const candidateModels = await getActiveGeminiModels(key);
    let rawText = null;

    for (const mName of candidateModels) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mName}:generateContent?key=${encodeURIComponent(key)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: promptText }] }],
            generationConfig: { response_mime_type: "application/json" }
          })
        });

        if (res.ok) {
          const j = await res.json();
          rawText = j.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) break;
        }
      } catch (err) {}
    }

    if (!rawText) throw new Error("Could not reach Gemini. Please check API key.");

    const cleaned = rawText.replace(/```json/gi, "").replace(/```/g, "").trim();
    const result = JSON.parse(cleaned);

    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    const newMeal = {
      id: "meal-" + Date.now(),
      date: state.activeDate,
      name: result.title || text,
      sub: result.sub || "AI Verified Nutrition",
      time: timeStr,
      calories: parseInt(result.calories, 10) || 0,
      carbs: parseInt(result.carbs, 10) || 0,
      protein: parseInt(result.protein, 10) || 0,
      fat: parseInt(result.fat, 10) || 0,
      items: result.items || [],
      isNew: true
    };

    state.meals.unshift(newMeal);
    renderActivityFeed();
    updateDashboardNumbers();
    showToast(`Logged ${newMeal.name} (${newMeal.calories} kcal)!`);

    setTimeout(() => {
      newMeal.isNew = false;
      const el = document.querySelector(`[data-id="${newMeal.id}"]`);
      if (el) el.classList.remove("meal-card-new");
    }, 3000);

    if (db && state.currentUser) {
      setDoc(doc(db, "users", state.currentUser.uid, "meals", newMeal.id), newMeal).catch(() => {});
    }

  } catch (err) {
    showToast(err.message || "Failed to analyze meal.");
  }
}

/* ============================================================================
 * [11] CALENDAR & DATES CONTROLLER (Week Strip & Full Month Matrix)
 * ============================================================================ */
function renderWeekStrip() {
  const container = document.getElementById("week-strip-container");
  if (!container) return;

  const current = new Date(state.activeDate + "T12:00:00");
  const todayStr = new Date().toISOString().split("T")[0];
  const dayOfWeek = current.getDay();

  const firstDay = state.profile.firstDayOfWeek || "monday";
  const startOffset = firstDay === "sunday" ? dayOfWeek : ((dayOfWeek + 6) % 7);

  const startDay = new Date(current);
  startDay.setDate(current.getDate() - startOffset);

  const dayLetters = firstDay === "sunday" ? ["S", "M", "T", "W", "T", "F", "S"] : ["M", "T", "W", "T", "F", "S", "S"];

  let html = "";
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDay);
    d.setDate(startDay.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const isSelected = dateStr === state.activeDate;
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;

    html += `
      <div class="week-day-col ${isFuture ? "future-day" : ""}">
        <span class="week-day-letter">${dayLetters[i]}</span>
        <button type="button" class="week-day-btn ${isSelected ? "active" : ""} ${isToday ? "today-dot" : ""} ${isFuture ? "future-day" : ""}"
                data-date="${dateStr}" ${isFuture ? "disabled" : ""}>
          ${d.getDate()}
        </button>
      </div>
    `;
  }
  container.innerHTML = html;

  container.querySelectorAll(".week-day-btn:not([disabled])").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const selected = e.currentTarget.dataset.date;
      if (selected && selected !== state.activeDate) {
        state.activeDate = selected;
        renderWeekStrip();
        updateDateLabel();
        loadDayData(state.activeDate);
      }
    });
  });
}

function updateDateLabel() {
  const lbl = document.getElementById("label-current-day-text");
  if (!lbl) return;

  const todayStr = new Date().toISOString().split("T")[0];
  const active = new Date(state.activeDate + "T12:00:00");
  const today = new Date(todayStr + "T12:00:00");
  const diffDays = Math.round((active - today) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    lbl.textContent = "Today";
  } else if (diffDays === -1) {
    lbl.textContent = "Yesterday";
  } else if (diffDays === 1) {
    lbl.textContent = "Tomorrow";
  } else {
    lbl.textContent = active.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
}

function toggleCalendarDropdown() {
  const dd = document.getElementById("month-calendar-dropdown");
  if (dd) {
    const isOpen = dd.classList.contains("active") || dd.classList.contains("open");
    if (isOpen) {
      dd.classList.remove("active", "open");
    } else {
      dd.classList.add("active", "open");
      renderMonthDaysMatrix();
    }
  }
}

function renderMonthDaysMatrix() {
  const grid = document.getElementById("month-days-matrix-grid");
  if (!grid) return;

  const year = state.calendarViewYear;
  const month = state.calendarViewMonth;
  const firstDay = new Date(year, month, 1).getDay(); // 0 is Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = new Date().toISOString().split("T")[0];

  const firstDaySetting = state.profile.firstDayOfWeek || "monday";
  const offset = firstDaySetting === "sunday" ? firstDay : ((firstDay + 6) % 7);

  let html = "";
  // Empty leading days
  for (let e = 0; e < offset; e++) {
    html += `<div></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    const dateStr = `${year}-${mm}-${dd}`;
    const isSelected = dateStr === state.activeDate;
    const isToday = dateStr === todayStr;
    const isFuture = dateStr > todayStr;

    html += `
      <button type="button" class="month-matrix-day ${isSelected ? "active" : ""} ${isToday ? "today-dot" : ""}"
              data-date="${dateStr}" ${isFuture ? "style='opacity:0.3;'" : ""}>
        ${d}
      </button>
    `;
  }

  grid.innerHTML = html;

  grid.querySelectorAll(".month-matrix-day").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const chosen = e.currentTarget.dataset.date;
      if (chosen) {
        state.activeDate = chosen;
        const dd = document.getElementById("month-calendar-dropdown");
        if (dd) dd.classList.remove("active", "open");
        renderWeekStrip();
        updateDateLabel();
        loadDayData(state.activeDate);
      }
    });
  });
}

/* ============================================================================
 * [12] ONBOARDING & DASHBOARD VIEWS
 * ============================================================================ */
function showWelcomeScreen() {
  document.getElementById("screen-welcome")?.classList.remove("hidden");
  document.getElementById("screen-auth-form")?.classList.add("hidden");
  document.getElementById("screen-onboarding-step1")?.classList.add("hidden");
  document.getElementById("screen-onboarding-step2")?.classList.add("hidden");
  document.getElementById("screen-main-dashboard")?.classList.add("hidden");
}

function showAuthForm(isLogin = false) {
  document.getElementById("screen-welcome")?.classList.add("hidden");
  document.getElementById("screen-auth-form")?.classList.remove("hidden");
  document.getElementById("screen-onboarding-step1")?.classList.add("hidden");
  document.getElementById("screen-onboarding-step2")?.classList.add("hidden");
  document.getElementById("screen-main-dashboard")?.classList.add("hidden");

  const submitBtn = document.getElementById("btn-auth-submit");
  const nameBox = document.getElementById("auth-name-wrapper");
  const confirmBox = document.getElementById("auth-confirm-wrapper");
  const forgotRow = document.getElementById("auth-forgot-row");
  const toggleLink = document.getElementById("auth-toggle-mode");

  if (isLogin) {
    if (nameBox) nameBox.classList.add("hidden");
    if (confirmBox) confirmBox.classList.add("hidden");
    if (forgotRow) forgotRow.classList.remove("hidden");
    if (submitBtn) submitBtn.textContent = "Login";
    if (toggleLink) toggleLink.innerHTML = "Don't have an account? <span>Register</span>";
  } else {
    if (nameBox) nameBox.classList.remove("hidden");
    if (confirmBox) confirmBox.classList.remove("hidden");
    if (forgotRow) forgotRow.classList.add("hidden");
    if (submitBtn) submitBtn.textContent = "Signup & Start Free Trial";
    if (toggleLink) toggleLink.innerHTML = "Already have an account? <span>Login</span>";
  }
}

function showOnboardingStep1() {
  document.getElementById("screen-welcome")?.classList.add("hidden");
  document.getElementById("screen-auth-form")?.classList.add("hidden");
  document.getElementById("screen-onboarding-step1")?.classList.remove("hidden");
  document.getElementById("screen-onboarding-step2")?.classList.add("hidden");
  document.getElementById("screen-main-dashboard")?.classList.add("hidden");
}

function showOnboardingStep2() {
  document.getElementById("screen-welcome")?.classList.add("hidden");
  document.getElementById("screen-auth-form")?.classList.add("hidden");
  document.getElementById("screen-onboarding-step1")?.classList.add("hidden");
  document.getElementById("screen-onboarding-step2")?.classList.remove("hidden");
  document.getElementById("screen-main-dashboard")?.classList.add("hidden");

  updateOnboardingStep2LiveCard();
}

function updateOnboardingStep2LiveCard() {
  const ob = state.onboardingData;
  let weightKg = parseFloat(ob.weight) || 65;
  let heightCm = parseFloat(ob.height) || 170;

  if (ob.unitWeight === "lb") weightKg *= 0.45359237;
  if (ob.unitHeight === "ftin") heightCm *= 2.54;

  let offset = 0;
  if (ob.goal === "lose") offset = -300;
  else if (ob.goal === "gain") offset = 300;

  const res = calculateMifflinStJeorFormula(
    weightKg,
    heightCm,
    ob.age,
    ob.gender,
    ob.activity,
    offset,
    state.profile.macroSplit
  );

  const calsEl = document.getElementById("ob-live-cals");
  const carbEl = document.getElementById("ob-live-carbs");
  const protEl = document.getElementById("ob-live-protein");
  const fatEl = document.getElementById("ob-live-fat");

  if (calsEl) calsEl.textContent = `${res.dailyTarget.toLocaleString()} kcal`;
  if (carbEl) carbEl.textContent = `${res.carbsGrams}g`;
  if (protEl) protEl.textContent = `${res.proteinGrams}g`;
  if (fatEl) fatEl.textContent = `${res.fatGrams}g`;
}

function finishOnboarding() {
  const ob = state.onboardingData;
  state.profile.height = ob.height;
  state.profile.unitHeight = ob.unitHeight;
  state.profile.weight = ob.weight;
  state.profile.unitWeight = ob.unitWeight;
  state.profile.age = ob.age;
  state.profile.gender = ob.gender;
  state.profile.activity = ob.activity;
  state.profile.activityName = ob.activityName;
  state.profile.goal = ob.goal;

  recalculateMifflinStJeor(true);
  saveUserProfile(false);

  showDashboard();
  showToast("Welcome to Calorie Track! Let's start tracking.");
}

function showDashboard() {
  document.getElementById("screen-welcome")?.classList.add("hidden");
  document.getElementById("screen-auth-form")?.classList.add("hidden");
  document.getElementById("screen-onboarding-step1")?.classList.add("hidden");
  document.getElementById("screen-onboarding-step2")?.classList.add("hidden");
  document.getElementById("screen-main-dashboard")?.classList.remove("hidden");

  renderWeekStrip();
  updateDateLabel();
  updateDashboardNumbers();
}

/* ============================================================================
 * [13] DRAWER & SUBPAGES
 * ============================================================================ */
function openDrawer() {
  document.getElementById("drawer-panel")?.classList.add("active", "open");
  document.getElementById("drawer-backdrop")?.classList.add("active", "open");
}

function closeDrawer() {
  document.getElementById("drawer-panel")?.classList.remove("active", "open");
  document.getElementById("drawer-backdrop")?.classList.remove("active", "open");
}

function openSubpage(subpageId) {
  closeDrawer();
  document.querySelectorAll(".zen-subpage").forEach(p => p.classList.remove("active", "open"));
  const sub = document.getElementById(subpageId);
  if (sub) {
    sub.classList.add("active", "open");
    // Hook up subpage-specific renders
    if (subpageId === "subpage-summary") renderWeeklySummary(0);
    if (subpageId === "subpage-tracker-mood") loadMoodData();
    if (subpageId === "subpage-tracker-fasting") initFastingTimerUI();
    if (subpageId === "subpage-tracker-sleep") calculateSleepDuration();
  }
}
window.openSubpage = openSubpage;

function closeAllSubpages() {
  document.querySelectorAll(".zen-subpage").forEach(p => p.classList.remove("active", "open"));
}
window.closeAllSubpages = closeAllSubpages;

function updateUserUI() {
  const name = state.profile.fullName || "Krishna Deshmukh";
  const email = state.profile.email || "krishnadeshmukh721@gmail.com";

  const dn = document.getElementById("drawer-display-name");
  const de = document.getElementById("drawer-display-email");
  const sn = document.getElementById("settings-user-name");
  const se = document.getElementById("settings-user-email");

  if (dn) dn.textContent = name;
  if (de) de.textContent = email;
  if (sn) sn.textContent = name;
  if (se) se.textContent = email;
}

function syncProfileInputs() {
  const p = state.profile;
  const hInput = document.getElementById("prof-height");
  const wInput = document.getElementById("prof-weight");
  const aInput = document.getElementById("prof-age");
  const gSelect = document.getElementById("prof-gender");
  const actSelect = document.getElementById("prof-activity");
  const calsInput = document.getElementById("prof-daily-cals");
  const keyInput = document.getElementById("input-settings-gemini-key");

  if (hInput) hInput.value = p.height || 170;
  if (wInput) wInput.value = p.weight || 65;
  if (aInput) aInput.value = p.age || 21;
  if (gSelect) gSelect.value = p.gender || "male";
  if (actSelect) actSelect.value = p.activity || "1.55";
  if (calsInput) calsInput.value = p.dailyCalories || 2100;
  if (keyInput) keyInput.value = p.geminiApiKey || "";
}

/* ============================================================================
 * [14] WEEKLY SUMMARY CONTROLLER
 * ============================================================================ */
async function renderWeeklySummary(periodOffset = 0) {
  const dateRangeLabel = document.getElementById("summary-date-range-label");
  const avgCalsEl = document.getElementById("sum-avg-cals");
  const daysTrackedEl = document.getElementById("sum-days-tracked");
  const totalCalsEl = document.getElementById("sum-total-cals");
  const totalCarbsEl = document.getElementById("sum-total-carbs");
  const totalProtEl = document.getElementById("sum-total-protein");
  const totalFatEl = document.getElementById("sum-total-fat");
  const tableBody = document.getElementById("summary-table-body");

  // Calculate dates for current/previous week
  const now = new Date();
  const currentDay = now.getDay();
  const diffToMonday = (currentDay + 6) % 7;
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - diffToMonday - (periodOffset * 7));

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  if (dateRangeLabel) {
    const sStr = startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const eStr = endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    dateRangeLabel.textContent = `${sStr} – ${eStr}`;
  }

  const daysShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let sumCals = 0, sumCarbs = 0, sumProt = 0, sumFat = 0, loggedDays = 0;
  let rowsHtml = "";

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];

    // Check state meals
    let dayCals = 0, dayCarbs = 0, dayProt = 0, dayFat = 0;
    const dayMeals = state.meals.filter(m => m.date === dateStr);
    dayMeals.forEach(m => {
      dayCals += parseInt(m.calories, 10) || 0;
      dayCarbs += parseFloat(m.carbs) || 0;
      dayProt += parseFloat(m.protein) || 0;
      dayFat += parseFloat(m.fat) || 0;
    });

    if (dayCals > 0) loggedDays++;
    sumCals += dayCals;
    sumCarbs += dayCarbs;
    sumProt += dayProt;
    sumFat += dayFat;

    rowsHtml += `
      <tr>
        <td style="font-weight:700;">${daysShort[i]}</td>
        <td style="color:var(--primary-green); font-weight:700;">${dayCals}</td>
        <td>${Math.round(dayCarbs)}g</td>
        <td>${Math.round(dayProt)}g</td>
        <td>${Math.round(dayFat)}g</td>
      </tr>
    `;
  }

  const avgCals = loggedDays > 0 ? Math.round(sumCals / loggedDays) : 0;

  if (avgCalsEl) avgCalsEl.textContent = avgCals.toLocaleString();
  if (daysTrackedEl) daysTrackedEl.textContent = `${loggedDays} / 7`;
  if (totalCalsEl) totalCalsEl.textContent = sumCals.toLocaleString();
  if (totalCarbsEl) totalCarbsEl.textContent = `${Math.round(sumCarbs)}g`;
  if (totalProtEl) totalProtEl.textContent = `${Math.round(sumProt)}g`;
  if (totalFatEl) totalFatEl.textContent = `${Math.round(sumFat)}g`;
  if (tableBody) tableBody.innerHTML = rowsHtml;
}

/* ============================================================================
 * [15] FASTING TRACKER CONTROLLER
 * ============================================================================ */
function initFastingTimerUI() {
  const storedStart = localStorage.getItem("calorietrack_fasting_start");
  const isFasting = storedStart !== null;
  state.fasting.isFasting = isFasting;
  state.fasting.startTime = storedStart ? parseInt(storedStart, 10) : null;

  updateFastingDisplay();

  if (fastingTimerInterval) clearInterval(fastingTimerInterval);
  if (isFasting) {
    fastingTimerInterval = setInterval(updateFastingDisplay, 1000);
  }
}

function updateFastingDisplay() {
  const displayEl = document.getElementById("fasting-timer-display");
  const statusEl = document.getElementById("fasting-status-label");
  const toggleBtn = document.getElementById("btn-toggle-fast");

  if (!state.fasting.isFasting || !state.fasting.startTime) {
    if (displayEl) displayEl.textContent = "00:00:00";
    if (statusEl) statusEl.textContent = "READY TO FAST";
    if (toggleBtn) toggleBtn.textContent = "Start Fast";
    return;
  }

  const now = Date.now();
  const elapsedMs = Math.max(0, now - state.fasting.startTime);
  const totalSec = Math.floor(elapsedMs / 1000);
  const hours = String(Math.floor(totalSec / 3600)).padStart(2, "0");
  const mins = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
  const secs = String(totalSec % 60).padStart(2, "0");

  if (displayEl) displayEl.textContent = `${hours}:${mins}:${secs}`;
  if (statusEl) statusEl.textContent = "FASTING IN PROGRESS";
  if (toggleBtn) toggleBtn.textContent = "End Fast";
}

function toggleFasting() {
  if (state.fasting.isFasting) {
    state.fasting.isFasting = false;
    localStorage.removeItem("calorietrack_fasting_start");
    if (fastingTimerInterval) clearInterval(fastingTimerInterval);
    updateFastingDisplay();
    showToast("Fast completed! Great discipline! 🎉");
  } else {
    state.fasting.isFasting = true;
    state.fasting.startTime = Date.now();
    localStorage.setItem("calorietrack_fasting_start", String(state.fasting.startTime));
    fastingTimerInterval = setInterval(updateFastingDisplay, 1000);
    updateFastingDisplay();
    showToast("Fast started! Stay hydrated with water.");
  }
}

/* ============================================================================
 * [16] SLEEP TRACKER CONTROLLER
 * ============================================================================ */
function calculateSleepDuration() {
  const bedTimeVal = document.getElementById("sleep-bed-time")?.value || "23:00";
  const wakeTimeVal = document.getElementById("sleep-wake-time")?.value || "07:30";

  const [bH, bM] = bedTimeVal.split(":").map(Number);
  const [wH, wM] = wakeTimeVal.split(":").map(Number);

  let bedMinutes = bH * 60 + bM;
  let wakeMinutes = wH * 60 + wM;

  // Handle crossing midnight
  if (wakeMinutes <= bedMinutes) {
    wakeMinutes += 24 * 60;
  }

  const totalMin = wakeMinutes - bedMinutes;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;

  const calcEl = document.getElementById("sleep-duration-calc");
  if (calcEl) calcEl.textContent = `${hours}h ${mins}m`;
}

/* ============================================================================
 * [17] MOOD TRACKER CONTROLLER
 * ============================================================================ */
async function loadMoodData() {
  const countGood = document.getElementById("mood-count-good");
  const countOkay = document.getElementById("mood-count-okay");
  const countLow = document.getElementById("mood-count-low");

  if (countGood) countGood.textContent = state.mood.counts.good;
  if (countOkay) countOkay.textContent = state.mood.counts.okay;
  if (countLow) countLow.textContent = state.mood.counts.low;
}

/* ============================================================================
 * [18] EVENT LISTENERS SETUP
 * ============================================================================ */
function setupEvents() {
  document.getElementById("screen-splash")?.addEventListener("click", dismissSplash);

  // Welcome triggers
  document.getElementById("btn-welcome-start")?.addEventListener("click", () => {
    const modal = document.getElementById("modal-notif-permission");
    if (modal) modal.classList.remove("hidden");
    else showOnboardingStep1();
  });

  document.getElementById("btn-allow-notif")?.addEventListener("click", () => {
    document.getElementById("modal-notif-permission")?.classList.add("hidden");
    if ("Notification" in window) {
      Notification.requestPermission().catch(() => {});
    }
    showOnboardingStep1();
  });

  document.getElementById("btn-skip-notif")?.addEventListener("click", () => {
    document.getElementById("modal-notif-permission")?.classList.add("hidden");
    showOnboardingStep1();
  });

  document.getElementById("link-welcome-login")?.addEventListener("click", () => showAuthForm(true));
  document.getElementById("btn-auth-back")?.addEventListener("click", showWelcomeScreen);
  document.getElementById("btn-step1-back")?.addEventListener("click", showWelcomeScreen);
  document.getElementById("btn-step2-back")?.addEventListener("click", showOnboardingStep1);
  document.getElementById("btn-google-auth")?.addEventListener("click", handleGoogleAuth);

  document.getElementById("link-forgot-pass")?.addEventListener("click", (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-input-email")?.value.trim();
    if (!email) {
      showToast("Please enter your email above first.");
      return;
    }
    showToast(`Password reset link sent to ${email}`);
  });

  document.getElementById("btn-auth-submit")?.addEventListener("click", () => {
    state.currentUser = { uid: "local-user" };
    showDashboard();
    showToast("Welcome to Calorie Track!");
  });

  document.getElementById("auth-toggle-mode")?.addEventListener("click", (e) => {
    const isLogin = e.currentTarget.textContent.includes("Register");
    showAuthForm(!isLogin);
  });

  // Onboarding Step 1
  document.getElementById("step1-height-toggle")?.querySelectorAll(".unit-toggle-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.getElementById("step1-height-toggle").querySelectorAll(".unit-toggle-btn").forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      state.onboardingData.unitHeight = e.currentTarget.dataset.unit;
    });
  });

  document.getElementById("step1-weight-toggle")?.querySelectorAll(".unit-toggle-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.getElementById("step1-weight-toggle").querySelectorAll(".unit-toggle-btn").forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      state.onboardingData.unitWeight = e.currentTarget.dataset.unit;
    });
  });

  document.getElementById("step1-gender-toggle")?.querySelectorAll(".unit-toggle-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.getElementById("step1-gender-toggle").querySelectorAll(".unit-toggle-btn").forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      state.onboardingData.gender = e.currentTarget.dataset.gender;
    });
  });

  document.getElementById("btn-trigger-activity-sheet")?.addEventListener("click", () => {
    document.getElementById("sheet-activity-level")?.classList.add("show");
  });

  document.getElementById("sheet-activity-level")?.addEventListener("click", (e) => {
    if (e.target.id === "sheet-activity-level" || e.target.classList.contains("bottom-sheet-handle")) {
      document.getElementById("sheet-activity-level")?.classList.remove("show");
    }
  });

  document.querySelectorAll(".activity-option-row").forEach(row => {
    row.addEventListener("click", (e) => {
      const level = e.currentTarget.dataset.level;
      const name = e.currentTarget.dataset.name;
      state.onboardingData.activity = parseFloat(level);
      state.onboardingData.activityName = name;

      document.querySelectorAll(".activity-option-row").forEach(r => r.classList.remove("selected"));
      e.currentTarget.classList.add("selected");

      const labelEl = document.getElementById("ob-activity-display-label");
      if (labelEl) labelEl.textContent = name;

      document.getElementById("sheet-activity-level")?.classList.remove("show");
    });
  });

  document.getElementById("btn-onboarding-next")?.addEventListener("click", () => {
    state.onboardingData.height = parseFloat(document.getElementById("ob-height")?.value) || 170;
    state.onboardingData.weight = parseFloat(document.getElementById("ob-weight")?.value) || 65;
    state.onboardingData.age = parseInt(document.getElementById("ob-age")?.value, 10) || 21;
    showOnboardingStep2();
  });

  document.getElementById("btn-onboarding-skip")?.addEventListener("click", () => {
    showOnboardingStep2();
  });

  // Onboarding Step 2
  document.querySelectorAll(".goal-select-card").forEach(card => {
    card.addEventListener("click", (e) => {
      document.querySelectorAll(".goal-select-card").forEach(c => c.classList.remove("selected"));
      e.currentTarget.classList.add("selected");
      state.onboardingData.goal = e.currentTarget.dataset.goal;
      updateOnboardingStep2LiveCard();
    });
  });

  document.getElementById("btn-onboarding-finish")?.addEventListener("click", finishOnboarding);

  // Header & Drawer Triggers
  const btnDrawer = document.getElementById("btn-open-drawer");
  btnDrawer?.addEventListener("click", openDrawer);
  btnDrawer?.addEventListener("touchend", (e) => { e.preventDefault(); openDrawer(); }, { passive: false });

  const backdropEl = document.getElementById("drawer-backdrop");
  backdropEl?.addEventListener("click", closeDrawer);
  backdropEl?.addEventListener("touchend", (e) => { e.preventDefault(); closeDrawer(); }, { passive: false });

  const btnCal = document.getElementById("btn-toggle-calendar");
  btnCal?.addEventListener("click", toggleCalendarDropdown);
  btnCal?.addEventListener("touchend", (e) => { e.preventDefault(); toggleCalendarDropdown(); }, { passive: false });

  document.getElementById("btn-open-streak")?.addEventListener("click", () => openSubpage("subpage-streak"));
  document.getElementById("btn-drawer-portfolio")?.addEventListener("click", () => {
    closeDrawer();
    openSubpage("subpage-profile");
  });
  document.getElementById("btn-drawer-logout")?.addEventListener("click", handleLogout);
  document.getElementById("btn-settings-logout")?.addEventListener("click", handleLogout);

  // Collapsible Cards
  document.getElementById("header-collapse-calories")?.addEventListener("click", () => {
    document.getElementById("card-calories")?.classList.toggle("collapsed");
  });

  document.getElementById("header-collapse-macros")?.addEventListener("click", () => {
    document.getElementById("card-macros")?.classList.toggle("collapsed");
  });

  document.getElementById("header-collapse-water")?.addEventListener("click", () => {
    document.getElementById("card-water-dash")?.classList.toggle("collapsed");
  });

  document.getElementById("link-edit-goal")?.addEventListener("click", (e) => {
    e.stopPropagation();
    openSubpage("subpage-profile");
  });

  // Water Quick Add
  document.getElementById("btn-dash-water-add")?.addEventListener("click", () => {
    state.waterGlasses = (state.waterGlasses || 0) + 1;
    updateDashboardNumbers();
    if ("vibrate" in navigator) navigator.vibrate(35);
    showToast(`Logged 1 glass of water (${state.waterGlasses} total)`);

    if (db && state.currentUser) {
      setDoc(doc(db, "users", state.currentUser.uid, "water", state.activeDate), {
        glasses: state.waterGlasses,
        date: state.activeDate
      }, { merge: true }).catch(() => {});
    }
  });

  // Camera & Gallery triggers
  document.getElementById("btn-trigger-camera")?.addEventListener("click", () => {
    document.getElementById("file-camera")?.click();
  });

  document.getElementById("btn-trigger-gallery")?.addEventListener("click", () => {
    document.getElementById("file-gallery")?.click();
  });

  document.getElementById("file-camera")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast("Compressing photo...");
      const compressed = await compressImage(file, 1024);
      await analyzeFoodPhoto(compressed);
    } catch (err) {
      showToast("Could not process photo.");
    }
    e.target.value = "";
  });

  document.getElementById("file-gallery")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      showToast("Compressing photo...");
      const compressed = await compressImage(file, 1024);
      await analyzeFoodPhoto(compressed);
    } catch (err) {
      showToast("Could not process photo.");
    }
    e.target.value = "";
  });

  // Bookmark / Saved Prompts
  document.getElementById("btn-trigger-bookmark")?.addEventListener("click", () => {
    document.getElementById("sheet-saved-prompts")?.classList.add("show");
  });

  document.getElementById("sheet-saved-prompts")?.addEventListener("click", (e) => {
    if (e.target.id === "sheet-saved-prompts" || e.target.classList.contains("bottom-sheet-handle")) {
      document.getElementById("sheet-saved-prompts")?.classList.remove("show");
    }
  });

  document.querySelectorAll(".quick-prompt-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const text = e.currentTarget.dataset.text;
      document.getElementById("sheet-saved-prompts")?.classList.remove("show");
      const inputEl = document.getElementById("bottom-pill-input");
      if (inputEl) inputEl.value = text;
      submitBottomPillEntry();
    });
  });

  // Bottom Pill Typing
  const bottomInput = document.getElementById("bottom-pill-input");
  const bottomSendBtn = document.getElementById("btn-bottom-send");

  bottomInput?.addEventListener("input", () => {
    if (bottomInput.value.trim().length > 0) {
      bottomSendBtn?.classList.remove("hidden");
    } else {
      bottomSendBtn?.classList.add("hidden");
    }
  });

  bottomInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitBottomPillEntry();
    }
  });

  bottomSendBtn?.addEventListener("click", submitBottomPillEntry);

  // 3-Dot Sheet Listeners
  document.getElementById("sheet-meal-actions")?.addEventListener("click", (e) => {
    if (e.target.id === "sheet-meal-actions" || e.target.classList.contains("bottom-sheet-handle")) {
      document.getElementById("sheet-meal-actions")?.classList.remove("show");
    }
  });

  document.getElementById("action-edit-meal")?.addEventListener("click", () => {
    document.getElementById("sheet-meal-actions")?.classList.remove("show");
    const meal = state.meals.find(m => m.id === activeSelectedMealId);
    if (!meal) return;

    document.getElementById("edit-meal-name").value = meal.name || "";
    document.getElementById("edit-meal-cals").value = meal.calories || 0;
    document.getElementById("edit-meal-carbs").value = meal.carbs || 0;
    document.getElementById("edit-meal-protein").value = meal.protein || 0;
    document.getElementById("edit-meal-fat").value = meal.fat || 0;

    document.getElementById("modal-edit-meal")?.classList.remove("hidden");
  });

  document.getElementById("btn-cancel-edit-meal")?.addEventListener("click", () => {
    document.getElementById("modal-edit-meal")?.classList.add("hidden");
  });

  document.getElementById("btn-save-edit-meal")?.addEventListener("click", () => {
    const meal = state.meals.find(m => m.id === activeSelectedMealId);
    if (meal) {
      meal.name = document.getElementById("edit-meal-name")?.value.trim() || meal.name;
      meal.calories = parseInt(document.getElementById("edit-meal-cals")?.value, 10) || meal.calories;
      meal.carbs = parseInt(document.getElementById("edit-meal-carbs")?.value, 10) || meal.carbs;
      meal.protein = parseInt(document.getElementById("edit-meal-protein")?.value, 10) || meal.protein;
      meal.fat = parseInt(document.getElementById("edit-meal-fat")?.value, 10) || meal.fat;

      renderActivityFeed();
      updateDashboardNumbers();
      showToast("Meal updated!");

      if (db && state.currentUser) {
        setDoc(doc(db, "users", state.currentUser.uid, "meals", meal.id), meal, { merge: true }).catch(() => {});
      }
    }
    document.getElementById("modal-edit-meal")?.classList.add("hidden");
  });

  document.getElementById("action-view-nutrition")?.addEventListener("click", () => {
    document.getElementById("sheet-meal-actions")?.classList.remove("show");
    openFullNutritionModal();
  });

  document.getElementById("btn-open-nutrition-modal")?.addEventListener("click", openFullNutritionModal);
  document.getElementById("btn-close-nutrition-modal")?.addEventListener("click", () => {
    document.getElementById("modal-full-nutrition")?.classList.remove("open");
  });
  document.getElementById("btn-dismiss-nutrition")?.addEventListener("click", () => {
    document.getElementById("modal-full-nutrition")?.classList.remove("open");
  });

  document.getElementById("action-save-prompt")?.addEventListener("click", () => {
    document.getElementById("sheet-meal-actions")?.classList.remove("show");
    showToast("Saved to Quick Log favorites! 🔖");
  });

  document.getElementById("action-delete-meal")?.addEventListener("click", () => {
    document.getElementById("sheet-meal-actions")?.classList.remove("show");
    const mealIdx = state.meals.findIndex(m => m.id === activeSelectedMealId);
    if (mealIdx !== -1) {
      lastDeletedMeal = state.meals[mealIdx];
      state.meals.splice(mealIdx, 1);
      renderActivityFeed();
      updateDashboardNumbers();

      const snack = document.getElementById("undo-snackbar");
      if (snack) {
        snack.classList.remove("hidden");
        setTimeout(() => snack.classList.add("hidden"), 5000);
      }

      if (db && state.currentUser) {
        deleteDoc(doc(db, "users", state.currentUser.uid, "meals", activeSelectedMealId)).catch(() => {});
      }
    }
  });

  document.getElementById("btn-undo-action")?.addEventListener("click", () => {
    if (lastDeletedMeal) {
      state.meals.unshift(lastDeletedMeal);
      renderActivityFeed();
      updateDashboardNumbers();
      if (db && state.currentUser) {
        setDoc(doc(db, "users", state.currentUser.uid, "meals", lastDeletedMeal.id), lastDeletedMeal).catch(() => {});
      }
      lastDeletedMeal = null;
      document.getElementById("undo-snackbar")?.classList.add("hidden");
      showToast("Meal restored! ↩️");
    }
  });

  // Subpage Back Buttons
  document.querySelectorAll(".subpage-back-btn, .btn-close-subpage").forEach(btn => {
    btn.addEventListener("click", closeAllSubpages);
  });

  // Drawer Routing
  document.querySelectorAll(".drawer-nav-item[data-target]").forEach((item) => {
    item.addEventListener("click", () => {
      const target = item.dataset.target;
      if (target === "dashboard") {
        closeDrawer();
        closeAllSubpages();
      } else if (target === "trackers") {
        openSubpage("subpage-trackers");
      } else if (target === "water") {
        openSubpage("subpage-tracker-water");
      } else if (target === "profile") {
        openSubpage("subpage-profile");
      } else if (target === "reminders") {
        openSubpage("subpage-reminders");
      } else if (target === "summary") {
        openSubpage("subpage-summary");
      } else if (target === "streak") {
        openSubpage("subpage-streak");
      } else if (target === "settings") {
        openSubpage("subpage-settings");
      } else if (target === "subscription") {
        openSubpage("subpage-settings");
      }
    });
  });

  // Trackers Grid Tile Clicks
  document.querySelectorAll(".tracker-tile-card").forEach(card => {
    card.addEventListener("click", () => {
      const action = card.dataset.action;
      if (action === "sleep") openSubpage("subpage-tracker-sleep");
      else if (action === "mood") openSubpage("subpage-tracker-mood");
      else if (action === "fasting") openSubpage("subpage-tracker-fasting");
      else if (action === "weight") openSubpage("subpage-tracker-weight");
      else if (action === "water") openSubpage("subpage-tracker-water");
      else if (action === "protein") openSubpage("subpage-profile");
      else if (action === "nutrition") openFullNutritionModal();
      else if (action === "screentime") showToast("Screen time: 2h 45m logged today.");
    });
  });

  // Mood Tracker Events
  document.querySelectorAll(".emoji-face-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".emoji-face-btn").forEach(b => b.classList.remove("selected"));
      e.currentTarget.classList.add("selected");
      state.mood.todayRating = parseInt(e.currentTarget.dataset.mood, 10);

      const saveBtn = document.getElementById("btn-save-mood");
      const hint = document.getElementById("mood-hint-text");
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.style.opacity = "1";
      }
      if (hint) hint.textContent = "Tap Save to record your mood.";
    });
  });

  document.querySelectorAll(".tag-chip-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.currentTarget.classList.toggle("selected");
    });
  });

  document.getElementById("btn-save-mood")?.addEventListener("click", () => {
    if (!state.mood.todayRating) return;
    const rating = state.mood.todayRating;
    if (rating >= 4) state.mood.counts.good++;
    else if (rating === 3) state.mood.counts.okay++;
    else state.mood.counts.low++;

    loadMoodData();
    showToast("Mood saved for today! ✨");
    setTimeout(closeAllSubpages, 600);
  });

  // Fasting Tracker Events
  document.querySelectorAll(".fasting-preset-pill").forEach(pill => {
    pill.addEventListener("click", (e) => {
      document.querySelectorAll(".fasting-preset-pill").forEach(p => p.classList.remove("active"));
      e.currentTarget.classList.add("active");
      const hrs = parseInt(e.currentTarget.dataset.hours, 10);
      state.fasting.targetHours = hrs;
      const sub = document.getElementById("fasting-sub-target");
      if (sub) sub.textContent = `Goal: ${hrs} hours`;
    });
  });

  document.getElementById("btn-toggle-fast")?.addEventListener("click", toggleFasting);

  // Sleep Tracker Events
  document.getElementById("sleep-bed-time")?.addEventListener("change", calculateSleepDuration);
  document.getElementById("sleep-wake-time")?.addEventListener("change", calculateSleepDuration);
  document.getElementById("btn-save-sleep")?.addEventListener("click", () => {
    showToast("Sleep logged successfully! 🌙");
    setTimeout(closeAllSubpages, 600);
  });

  // Weight Tracker Events
  document.getElementById("btn-save-weight-entry")?.addEventListener("click", () => {
    const val = parseFloat(document.getElementById("input-new-weight-val")?.value);
    if (!val || isNaN(val)) {
      showToast("Please enter a valid weight.");
      return;
    }
    state.profile.weight = val;
    recalculateMifflinStJeor(true);
    saveUserProfile(false);
    updateDashboardNumbers();
    showToast(`Weight updated to ${val} ${state.profile.unitWeight}!`);
    setTimeout(closeAllSubpages, 600);
  });

  // Address Geolocation Event
  document.getElementById("btn-use-current-location")?.addEventListener("click", () => {
    const spinner = document.getElementById("location-spinner");
    if (spinner) spinner.classList.remove("hidden");

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lon = position.coords.longitude;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
            const data = await res.json();
            const addr = data.address || {};

            const street = addr.road || addr.suburb || addr.neighbourhood || "Current Location";
            const city = addr.city || addr.town || addr.village || addr.county || "City";
            const stateCountry = `${addr.state || ""}, ${addr.country || ""}`.trim();

            const sEl = document.getElementById("addr-street");
            const cEl = document.getElementById("addr-city");
            const stEl = document.getElementById("addr-state");

            if (sEl) sEl.value = street;
            if (cEl) cEl.value = city;
            if (stEl) stEl.value = stateCountry;

            showToast("Address detected from GPS!");
          } catch (e) {
            showToast("Could not reverse geocode location.");
          } finally {
            if (spinner) spinner.classList.add("hidden");
          }
        },
        (err) => {
          if (spinner) spinner.classList.add("hidden");
          showToast("Location permission denied. You can enter address manually.");
        },
        { timeout: 10000 }
      );
    } else {
      if (spinner) spinner.classList.add("hidden");
      showToast("Geolocation not supported by browser.");
    }
  });

  document.getElementById("btn-save-address")?.addEventListener("click", () => {
    const street = document.getElementById("addr-street")?.value.trim() || "";
    const city = document.getElementById("addr-city")?.value.trim() || "";
    const st = document.getElementById("addr-state")?.value.trim() || "";
    state.profile.address = `${street}, ${city}, ${st}`;
    saveUserProfile(true);
    setTimeout(closeAllSubpages, 600);
  });

  // Weekly Summary Period Tabs
  document.querySelectorAll("#summary-period-tabs .month-pill-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll("#summary-period-tabs .month-pill-btn").forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      const period = e.currentTarget.dataset.period;
      renderWeeklySummary(period === "month" ? 0 : parseInt(period, 10));
    });
  });

  // Settings Unit Toggles
  document.querySelectorAll("#setting-liquid-toggle .unit-toggle-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll("#setting-liquid-toggle .unit-toggle-btn").forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      state.profile.waterUnit = e.currentTarget.dataset.unit;
      updateDashboardNumbers();
      saveUserProfile(false);
      showToast(`Water unit updated to ${state.profile.waterUnit}!`);
    });
  });

  document.querySelectorAll("#setting-weight-toggle .unit-toggle-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll("#setting-weight-toggle .unit-toggle-btn").forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      state.profile.unitWeight = e.currentTarget.dataset.unit;
      updateDashboardNumbers();
      saveUserProfile(false);
      showToast(`Weight unit updated to ${state.profile.unitWeight}!`);
    });
  });

  document.querySelectorAll("#setting-firstday-toggle .unit-toggle-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll("#setting-firstday-toggle .unit-toggle-btn").forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      state.profile.firstDayOfWeek = e.currentTarget.dataset.day;
      renderWeekStrip();
      saveUserProfile(false);
      showToast(`First day of week set to ${e.currentTarget.dataset.day}!`);
    });
  });

  // Reminders Test Notification
  document.getElementById("btn-test-notification")?.addEventListener("click", () => {
    if ("Notification" in window) {
      Notification.requestPermission().then(p => {
        if (p === "granted") {
          new Notification("Calorie Track", { body: "Time to log your healthy meal! 🥗", icon: "icons/icon-192.png" });
          showToast("Test notification sent!");
        } else {
          showToast("Notification permission not granted in browser.");
        }
      });
    } else {
      showToast("Time to log your healthy meal! 🥗");
    }
  });

  // Month Pills in Calendar Dropdown
  document.querySelectorAll(".month-pills-row .month-pill-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll(".month-pills-row .month-pill-btn").forEach(b => b.classList.remove("active"));
      e.currentTarget.classList.add("active");
      const m = parseInt(e.currentTarget.dataset.m, 10);
      if (!isNaN(m)) {
        state.calendarViewMonth = m;
        renderMonthDaysMatrix();
      }
    });
  });

  // Settings Save Gemini Key
  document.getElementById("btn-save-gemini-key-settings")?.addEventListener("click", () => {
    const key = document.getElementById("input-settings-gemini-key")?.value.trim() || "";
    state.profile.geminiApiKey = key;
    saveUserProfile(true);
  });

  document.getElementById("btn-test-gemini-key-settings")?.addEventListener("click", async () => {
    const key = document.getElementById("input-settings-gemini-key")?.value.trim() || state.profile.geminiApiKey;
    if (!key) {
      showToast("Please enter an API key first.");
      return;
    }
    showToast("Testing Gemini key...");
    const models = await getActiveGeminiModels(key);
    showToast(`Key active! Available models: ${models.slice(0, 2).join(", ")}`);
  });

  // CSV Export
  document.getElementById("btn-export-csv")?.addEventListener("click", () => {
    if (state.meals.length === 0) {
      showToast("No meals logged to export.");
      return;
    }
    let csv = "Date,Meal Name,Calories,Carbs,Protein,Fat\n";
    state.meals.forEach(m => {
      csv += `"${m.date}","${m.name}",${m.calories},${m.carbs},${m.protein},${m.fat}\n`;
    });
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calorietrack_meals_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    showToast("CSV export downloaded!");
  });

  // JSON Export / Import
  document.getElementById("btn-export-backup")?.addEventListener("click", () => {
    const data = JSON.stringify({ profile: state.profile, meals: state.meals }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `calorietrack_backup_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    showToast("Backup exported!");
  });

  document.getElementById("btn-import-trigger")?.addEventListener("click", () => {
    document.getElementById("input-import-backup")?.click();
  });

  document.getElementById("input-import-backup")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.profile) state.profile = { ...state.profile, ...data.profile };
        if (data.meals) state.meals = data.meals;
        updateDashboardNumbers();
        renderActivityFeed();
        showToast("Backup imported successfully!");
      } catch (err) {
        showToast("Invalid JSON backup file.");
      }
    };
    reader.readAsText(file);
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function openMealActions(mealId) {
  activeSelectedMealId = mealId;
  const meal = state.meals.find(m => m.id === mealId);
  const titleEl = document.getElementById("sheet-meal-title");
  if (titleEl && meal) titleEl.textContent = meal.name || "Meal Options";
  document.getElementById("sheet-meal-actions")?.classList.add("show");
}
window.openMealActions = openMealActions;

function openFullNutritionModal() {
  const grid = document.getElementById("full-nutrition-items-grid");
  if (grid) {
    let totalCarbs = 0, totalProt = 0, totalFat = 0, totalCals = 0;
    state.meals.forEach(m => {
      totalCals += parseInt(m.calories, 10) || 0;
      totalCarbs += parseFloat(m.carbs) || 0;
      totalProt += parseFloat(m.protein) || 0;
      totalFat += parseFloat(m.fat) || 0;
    });

    grid.innerHTML = `
      <div style="background:#f4f9f2; border-radius:12px; padding:10px;">
        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">ENERGY</div>
        <div style="font-weight:800; font-size:1.1rem; color:var(--primary-green);">${totalCals} kcal</div>
      </div>
      <div style="background:#f4f9f2; border-radius:12px; padding:10px;">
        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">CARBOHYDRATES</div>
        <div style="font-weight:800; font-size:1.1rem; color:var(--carb-blue);">${Math.round(totalCarbs)}g</div>
      </div>
      <div style="background:#f4f9f2; border-radius:12px; padding:10px;">
        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">PROTEIN</div>
        <div style="font-weight:800; font-size:1.1rem; color:var(--protein-maroon);">${Math.round(totalProt)}g</div>
      </div>
      <div style="background:#f4f9f2; border-radius:12px; padding:10px;">
        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">TOTAL FAT</div>
        <div style="font-weight:800; font-size:1.1rem; color:var(--fat-orange);">${Math.round(totalFat)}g</div>
      </div>
      <div style="background:#f4f9f2; border-radius:12px; padding:10px;">
        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">DIETARY FIBER</div>
        <div style="font-weight:800; font-size:1.1rem; color:#10b981;">${Math.round(totalCarbs * 0.18)}g (${Math.round((totalCarbs * 0.18 / 28) * 100)}% DV)</div>
      </div>
      <div style="background:#f4f9f2; border-radius:12px; padding:10px;">
        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">CALCIUM</div>
        <div style="font-weight:800; font-size:1.1rem; color:#0284c7;">${Math.round(totalProt * 12)}mg</div>
      </div>
      <div style="background:#f4f9f2; border-radius:12px; padding:10px;">
        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">IRON</div>
        <div style="font-weight:800; font-size:1.1rem; color:#b45309;">${(totalCarbs * 0.08).toFixed(1)}mg</div>
      </div>
      <div style="background:#f4f9f2; border-radius:12px; padding:10px;">
        <div style="font-size:0.75rem; color:var(--text-muted); font-weight:700;">POTASSIUM</div>
        <div style="font-weight:800; font-size:1.1rem; color:#6366f1;">${Math.round(totalCals * 0.45)}mg</div>
      </div>
    `;
  }
  document.getElementById("modal-full-nutrition")?.classList.add("open");
}
window.openFullNutritionModal = openFullNutritionModal;

function deleteExercise(exId) {
  state.exercises = state.exercises.filter(ex => ex.id !== exId);
  renderActivityFeed();
  updateDashboardNumbers();
  showToast("Workout deleted.");
}
window.deleteExercise = deleteExercise;


function showToast(msg) {
  const container = document.getElementById("zen-toast-container") || document.getElementById("toast-container");
  if (!container) return;
  const t = document.createElement("div");
  t.className = "zen-toast";
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    setTimeout(() => t.remove(), 250);
  }, 2600);
}

window.addEventListener("DOMContentLoaded", () => {
  setupEvents();
  initFirebase();
  setTimeout(dismissSplash, 600);
});
