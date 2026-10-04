import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  getDocs,
  query,
  where,
  Bytes
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

// =========================================================
// FIREBASE CONFIG
// =========================================================

const firebaseConfig = {
  apiKey: "AIzaSyAHIFlYWxonoKlf5Gz9Ot4CrwLUp8RIOtU",
  authDomain: "my-plan-bc3e8.firebaseapp.com",
  projectId: "my-plan-bc3e8",
  storageBucket: "my-plan-bc3e8.firebasestorage.app",
  messagingSenderId: "1093515298267",
  appId: "1:1093515298267:web:b9072718f0e5d9545d93fe",
  measurementId: "G-H9VZPXCWSW"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const authPersistenceReady = setPersistence(auth, browserLocalPersistence);

// =========================================================
// APP DATA
// =========================================================

const categories = {
  government: { name: "งานราชการ", icon: "🏛️", color: "#66735a" },
  freelance: { name: "งานออกแบบ", icon: "💼", color: "#a66a4c" },
  personal: { name: "ส่วนตัว", icon: "👤", color: "#8b7e74" },
  fitness: { name: "ออกกำลังกาย", icon: "🏋️", color: "#a95f56" },
  study: { name: "เรียน / พัฒนา", icon: "📚", color: "#b58a43" },
  finance: { name: "การเงิน", icon: "💰", color: "#5f7b72" }
};

const freelanceStatuses = {
  talking: { name: "งานที่กำลังคุย", icon: "💬" },
  in_progress: { name: "อยู่ระหว่างดำเนินการ", icon: "🔵" },
  paid: { name: "เบิกเงินแล้วเสร็จ", icon: "✅" }
};
const freelanceStatusOrder = ["talking", "in_progress", "paid"];

const $ = id => document.getElementById(id);

const todayText = $("today-text");
const timeText = $("time-text");
const todayHeading = $("today-heading");
const todayDayNumber = $("today-day-number");
const calendar = $("calendar");
const monthTitle = $("month-title");
const prevMonth = $("prev-month");
const nextMonth = $("next-month");
const appointmentTitle = $("appointment-title");
const eventList = $("event-list");
const todayEventList = $("today-event-list");
const todayTaskList = $("today-task-list");
const todayTaskSummary = $("today-task-summary");
const nextEvent = $("next-event");
const calendarTaskList = $("calendar-task-list");
const allTaskList = $("all-task-list");
const notificationStatus = $("notification-status");

const loginScreen = $("login-screen");
const loginEmail = $("login-email");
const loginPassword = $("login-password");
const loginButton = $("login-button");
const loginError = $("login-error");
const logoutButton = $("logout-button");
const syncStatus = $("sync-status");
const syncUser = $("sync-user");
const syncDot = $("sync-dot");

const startDate = new Date();
let currentMonth = startDate.getMonth();
let currentYear = startDate.getFullYear();
let selectedDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
let selectedEventId = null;
let editingEventId = null;
let selectedTaskId = null;
let editingTaskId = null;
let selectedFreelanceId = null;
let editingFreelanceId = null;
let taskFilter = "pending";
let planDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
let sourcePickerFilter = "all";
const sourceSelection = new Set();

let currentUser = null;
let unsubscribeEvents = null;
let unsubscribeTasks = null;
let unsubscribeFreelance = null;
let events = normalizeEvents(JSON.parse(localStorage.getItem("planner-events") || "[]"));
let tasks = normalizeTasks(JSON.parse(localStorage.getItem("planner-tasks") || "[]"));
let freelanceProjects = normalizeFreelance(JSON.parse(localStorage.getItem("planner-freelance") || "[]"));

// =========================================================
// NORMALIZE / UTILITIES
// =========================================================

function normalizeEvents(list) {
  if (!Array.isArray(list)) return [];
  return list.map(event => {
    const date = event.date || formatDateKey(new Date());
    const rawEndDate = event.endDate || date;
    const endDate = rawEndDate >= date ? rawEndDate : date;
    const dateMode = event.dateMode === "range" || endDate !== date ? "range" : "single";

    return {
      ...event,
      id: String(event.id ?? makeId("event")),
      title: event.title || "ไม่มีชื่อ",
      categories: Array.isArray(event.categories)
        ? event.categories
        : (event.category ? [event.category] : ["personal"]),
      reminders: Array.isArray(event.reminders)
        ? event.reminders.map(Number).filter(Number.isFinite)
        : [],
      date,
      endDate,
      dateMode,
      startTime: event.startTime || "09:00",
      location: event.location || "",
      note: event.note || ""
    };
  });
}

function normalizeTasks(list) {
  if (!Array.isArray(list)) return [];
  return list.map(task => ({
    ...task,
    id: String(task.id ?? makeId("task")),
    title: task.title || "ไม่มีชื่อ",
    categories: Array.isArray(task.categories)
      ? task.categories
      : (task.category ? [task.category] : ["personal"]),
    priority: task.priority || "normal",
    completed: Boolean(task.completed),
    date: task.date || formatDateKey(new Date()),
    note: task.note || "",
    sourceType: task.sourceType || "custom",
    sourceId: task.sourceId ? String(task.sourceId) : "",
    sourceLabel: task.sourceLabel || ""
  }));
}

function normalizeFreelance(list) {
  if (!Array.isArray(list)) return [];
  return list.map(project => ({
    ...project,
    id: String(project.id ?? makeId("freelance")),
    clientName: normalizeClientName(project.clientName || project.client || "ไม่ระบุผู้ว่าจ้าง"),
    name: project.name || "ไม่มีชื่อโปรเจกต์",
    status: freelanceStatuses[project.status] ? project.status : "in_progress",
    latestUpdate: String(project.latestUpdate || project.workUpdate || "").trim(),
    latestUpdateAt: project.latestUpdateAt || project.workUpdateAt || "",
    totalAmount: Math.max(0, Number(project.totalAmount) || 0),
    receivedAmount: Math.max(0, Number(project.receivedAmount) || 0)
  }));
}

function normalizeClientName(value) {
  const cleaned = String(value || "").trim().replace(/\s+/g, " ");
  return cleaned || "ไม่ระบุผู้ว่าจ้าง";
}

function clientGroupKey(value) {
  return normalizeClientName(value).toLocaleLowerCase("th-TH");
}

function freelanceStatusInfo(value) {
  return freelanceStatuses[value] || freelanceStatuses.in_progress;
}

function updateDateObject(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatFreelanceUpdateDate(value) {
  const date = updateDateObject(value);
  if (!date) return "";
  return date.toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function makeId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dateFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function thaiDate(key) {
  return dateFromKey(key).toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function eventEndDate(event) {
  const start = event?.date || formatDateKey(new Date());
  const end = event?.endDate || start;
  return end >= start ? end : start;
}

function eventOccursOnDate(event, dateKey) {
  if (!event?.date || !dateKey) return false;
  return dateKey >= event.date && dateKey <= eventEndDate(event);
}

function eventDateDisplay(event, includeWeekday = true) {
  if (!event?.date) return "";
  const endDate = eventEndDate(event);
  if (endDate === event.date) return includeWeekday ? thaiDate(event.date) : thaiShortDate(event.date);

  if (includeWeekday) {
    return `${thaiDate(event.date)} ถึง ${thaiDate(endDate)}`;
  }
  return `${thaiShortDate(event.date)} – ${thaiShortDate(endDate)}`;
}

function categoryInfo(key) {
  return categories[key] || categories.personal;
}

function priorityName(priority) {
  return priority === "urgent" ? "ด่วน" : priority === "high" ? "สำคัญ" : "ปกติ";
}

function formatMoney(value) {
  const amount = Number(value) || 0;
  return `฿${amount.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function remainingAmount(project) {
  return Math.max(0, (Number(project.totalAmount) || 0) - (Number(project.receivedAmount) || 0));
}

function saveLocalBackup() {
  localStorage.setItem("planner-events", JSON.stringify(events));
  localStorage.setItem("planner-tasks", JSON.stringify(tasks));
  localStorage.setItem("planner-freelance", JSON.stringify(freelanceProjects));
}

function emptyMessage(text) {
  const element = document.createElement("div");
  element.className = "empty-state";
  element.textContent = text;
  return element;
}

function getChecks(group) {
  return [...document.querySelectorAll(`[data-group="${group}"] input:checked`)].map(input => input.value);
}

function setChecks(group, values) {
  const selected = new Set((values || []).map(String));
  document.querySelectorAll(`[data-group="${group}"] input`).forEach(input => {
    input.checked = selected.has(input.value);
  });
}

function getSingleCheck(group) {
  return getChecks(group)[0] || null;
}

function bindSingleCheckGroup(group) {
  document.querySelectorAll(`[data-group="${group}"] input`).forEach(input => {
    input.addEventListener("change", () => {
      if (!input.checked) return;
      document.querySelectorAll(`[data-group="${group}"] input`).forEach(other => {
        if (other !== input) other.checked = false;
      });
    });
  });
}

bindSingleCheckGroup("task-priority");
bindSingleCheckGroup("freelance-status");

function setSyncState(text, state = "busy") {
  syncStatus.textContent = text;
  syncDot.className = `sync-dot ${state}`;
}

function userCollection(name) {
  if (!currentUser) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
  return collection(db, "users", currentUser.uid, name);
}

function userDoc(name, id) {
  if (!currentUser) throw new Error("ยังไม่ได้เข้าสู่ระบบ");
  return doc(db, "users", currentUser.uid, name, String(id));
}

function firestoreEventData(event) {
  const endDate = eventEndDate(event);
  return {
    title: event.title,
    categories: event.categories,
    reminders: event.reminders,
    date: event.date,
    endDate,
    dateMode: event.dateMode === "range" || endDate !== event.date ? "range" : "single",
    startTime: event.startTime,
    location: event.location || "",
    note: event.note || "",
    updatedAt: serverTimestamp()
  };
}

function firestoreTaskData(task) {
  return {
    title: task.title,
    categories: task.categories,
    priority: task.priority,
    completed: Boolean(task.completed),
    date: task.date,
    note: task.note || "",
    sourceType: task.sourceType || "custom",
    sourceId: task.sourceId ? String(task.sourceId) : "",
    sourceLabel: task.sourceLabel || "",
    updatedAt: serverTimestamp()
  };
}

function firestoreFreelanceData(project) {
  return {
    clientName: normalizeClientName(project.clientName),
    name: project.name,
    status: freelanceStatuses[project.status] ? project.status : "in_progress",
    latestUpdate: String(project.latestUpdate || "").trim(),
    latestUpdateAt: project.latestUpdateAt || "",
    totalAmount: Number(project.totalAmount) || 0,
    receivedAmount: Number(project.receivedAmount) || 0,
    updatedAt: serverTimestamp()
  };
}

// =========================================================
// AUTH + FIRESTORE SYNC
// =========================================================

function authErrorMessage(error) {
  const code = error?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  }
  if (code.includes("too-many-requests")) return "ลองเข้าสู่ระบบหลายครั้งเกินไป กรุณารอสักครู่";
  if (code.includes("network-request-failed")) return "เชื่อมต่ออินเทอร์เน็ตไม่ได้";
  return "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่";
}

async function handleLogin() {
  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    loginError.textContent = "กรุณากรอกอีเมลและรหัสผ่าน";
    return;
  }

  loginError.textContent = "";
  loginButton.disabled = true;
  loginButton.textContent = "กำลังเข้าสู่ระบบ...";

  try {
    await authPersistenceReady;
    await signInWithEmailAndPassword(auth, email, password);
    loginPassword.value = "";
  } catch (error) {
    console.error(error);
    loginError.textContent = authErrorMessage(error);
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "เข้าสู่ระบบ";
  }
}

loginButton.addEventListener("click", handleLogin);
loginPassword.addEventListener("keydown", event => {
  if (event.key === "Enter") handleLogin();
});

logoutButton.addEventListener("click", async () => {
  if (!confirm("ต้องการออกจากระบบ My Planner ใช่หรือไม่?")) return;
  await signOut(auth);
});

async function migrateLocalData(user) {
  const migrationKey = `planner-cloud-migrated-v1-${user.uid}`;
  if (localStorage.getItem(migrationKey)) return;

  const localEvents = normalizeEvents(JSON.parse(localStorage.getItem("planner-events") || "[]"));
  const localTasks = normalizeTasks(JSON.parse(localStorage.getItem("planner-tasks") || "[]"));
  const localFreelance = normalizeFreelance(JSON.parse(localStorage.getItem("planner-freelance") || "[]"));

  if (!localEvents.length && !localTasks.length && !localFreelance.length) {
    localStorage.setItem(migrationKey, "1");
    return;
  }

  setSyncState("กำลังย้ายข้อมูลเดิมขึ้น Cloud...", "busy");

  const writes = [];

  localEvents.forEach(event => {
    const id = String(event.id || makeId("event"));
    writes.push(setDoc(userDoc("events", id), firestoreEventData(event), { merge: true }));
  });

  localTasks.forEach(task => {
    const id = String(task.id || makeId("task"));
    writes.push(setDoc(userDoc("tasks", id), firestoreTaskData(task), { merge: true }));
  });

  localFreelance.forEach(project => {
    const id = String(project.id || makeId("freelance"));
    writes.push(setDoc(userDoc("freelance", id), firestoreFreelanceData(project), { merge: true }));
  });

  await Promise.all(writes);
  localStorage.setItem(migrationKey, "1");
}

function stopCloudListeners() {
  if (unsubscribeEvents) unsubscribeEvents();
  if (unsubscribeTasks) unsubscribeTasks();
  if (unsubscribeFreelance) unsubscribeFreelance();
  unsubscribeEvents = null;
  unsubscribeTasks = null;
  unsubscribeFreelance = null;
}

function startCloudListeners() {
  stopCloudListeners();
  setSyncState("กำลังซิงก์ข้อมูล...", "busy");

  unsubscribeEvents = onSnapshot(
    userCollection("events"),
    snapshot => {
      events = normalizeEvents(snapshot.docs.map(snapshotDoc => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data()
      })));
      saveLocalBackup();
      renderEverything();
      setSyncState(navigator.onLine ? "ซิงก์แล้ว" : "ออฟไลน์ • ใช้ข้อมูลล่าสุด", navigator.onLine ? "online" : "busy");
    },
    error => {
      console.error("Events sync error:", error);
      setSyncState("ซิงก์นัดหมายไม่สำเร็จ", "error");
    }
  );

  unsubscribeTasks = onSnapshot(
    userCollection("tasks"),
    snapshot => {
      tasks = normalizeTasks(snapshot.docs.map(snapshotDoc => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data()
      })));
      saveLocalBackup();
      renderEverything();
      setSyncState(navigator.onLine ? "ซิงก์แล้ว" : "ออฟไลน์ • ใช้ข้อมูลล่าสุด", navigator.onLine ? "online" : "busy");
    },
    error => {
      console.error("Tasks sync error:", error);
      setSyncState("ซิงก์งานไม่สำเร็จ", "error");
    }
  );

  unsubscribeFreelance = onSnapshot(
    userCollection("freelance"),
    snapshot => {
      freelanceProjects = normalizeFreelance(snapshot.docs.map(snapshotDoc => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data()
      })));
      saveLocalBackup();
      renderEverything();
      setSyncState(navigator.onLine ? "ซิงก์แล้ว" : "ออฟไลน์ • ใช้ข้อมูลล่าสุด", navigator.onLine ? "online" : "busy");
    },
    error => {
      console.error("Freelance sync error:", error);
      setSyncState("ซิงก์งานนอกไม่สำเร็จ", "error");
    }
  );
}

onAuthStateChanged(auth, async user => {
  stopCloudListeners();
  currentUser = user;

  if (!user) {
    syncUser.textContent = "ยังไม่ได้เข้าสู่ระบบ";
    setSyncState("ยังไม่ได้เชื่อม Cloud", "busy");
    loginScreen.classList.remove("hidden");
    return;
  }

  syncUser.textContent = user.email || "บัญชี Firebase";
  loginEmail.value = user.email || loginEmail.value;
  loginError.textContent = "";
  loginScreen.classList.add("hidden");

  try {
    await migrateLocalData(user);
    startCloudListeners();
  } catch (error) {
    console.error("Cloud startup error:", error);
    setSyncState("เชื่อม Cloud ไม่สำเร็จ", "error");
    alert("เชื่อม Firebase ไม่สำเร็จ กรุณาตรวจ Firestore Rules และอินเทอร์เน็ต");
  }
});

window.addEventListener("online", () => {
  if (currentUser) setSyncState("ออนไลน์ • กำลังตรวจสอบข้อมูล...", "busy");
});

window.addEventListener("offline", () => {
  if (currentUser) setSyncState("ออฟไลน์ • ใช้ข้อมูลล่าสุด", "busy");
});

// =========================================================
// CLOCK
// =========================================================

function updateClock() {
  const date = new Date();
  timeText.textContent = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
  todayText.textContent = date.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  todayHeading.textContent = date.toLocaleDateString("th-TH", {
    weekday: "long",
    month: "long"
  });
  todayDayNumber.textContent = date.getDate();
}

updateClock();
setInterval(updateClock, 1000);

// =========================================================
// UI COMPONENTS
// =========================================================

function createCategoryBadges(keys, container) {
  container.innerHTML = "";
  (keys || []).forEach(key => {
    const category = categoryInfo(key);
    const badge = document.createElement("span");
    badge.className = "category-badge";
    badge.textContent = `${category.icon} ${category.name}`;
    badge.style.color = category.color;
    badge.style.border = `1px solid ${category.color}`;
    container.appendChild(badge);
  });
}

function createEventCard(event) {
  const mainCategory = categoryInfo(event.categories[0]);
  const card = document.createElement("div");
  card.className = "event-card";
  card.style.setProperty("--category-color", mainCategory.color);

  const time = document.createElement("div");
  time.className = "event-time";
  time.textContent = event.startTime;

  const title = document.createElement("span");
  title.className = "event-title";
  title.textContent = event.title;

  const location = document.createElement("span");
  location.className = "event-location";
  location.textContent = event.location ? `📍 ${event.location}` : "📍 ไม่ได้ระบุสถานที่";

  card.append(time, title, location);

  event.categories.slice(0, 3).forEach(key => {
    const category = categoryInfo(key);
    const badge = document.createElement("span");
    badge.className = "category-mini";
    badge.style.setProperty("--category-color", category.color);
    badge.textContent = `${category.icon} ${category.name}`;
    card.appendChild(badge);
  });

  card.addEventListener("click", () => openEventDetail(event.id));
  return card;
}

function createTaskCard(task) {
  const card = document.createElement("div");
  card.className = "task-card";

  const check = document.createElement("button");
  check.type = "button";
  check.className = `task-check${task.completed ? " completed" : ""}`;
  check.textContent = task.completed ? "✓" : "";

  check.addEventListener("click", async event => {
    event.stopPropagation();
    if (!currentUser) return;

    try {
      setSyncState("กำลังบันทึก...", "busy");
      await setDoc(userDoc("tasks", task.id), firestoreTaskData({
        ...task,
        completed: !task.completed
      }), { merge: true });
    } catch (error) {
      console.error(error);
      setSyncState("บันทึกไม่สำเร็จ", "error");
      alert("เปลี่ยนสถานะงานไม่สำเร็จ");
    }
  });

  const main = document.createElement("div");
  main.className = "task-main";

  const title = document.createElement("span");
  title.className = `task-name${task.completed ? " completed" : ""}`;
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "task-meta";

  const date = document.createElement("span");
  date.textContent = "📅 " + dateFromKey(task.date).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short"
  });

  const taskCategories = document.createElement("span");
  taskCategories.textContent = task.categories
    .slice(0, 2)
    .map(key => `${categoryInfo(key).icon} ${categoryInfo(key).name}`)
    .join(" / ");

  const priority = document.createElement("span");
  priority.textContent = priorityName(task.priority);
  if (task.priority === "urgent") priority.className = "priority-urgent";
  if (task.priority === "high") priority.className = "priority-high";

  meta.append(date, taskCategories, priority);

  if (task.sourceType && task.sourceType !== "custom") {
    const sourceBadge = document.createElement("span");
    sourceBadge.className = "task-source-badge";
    sourceBadge.textContent = task.sourceType === "event" ? "🔗 นัดหมาย" : "💼 งานนอก";
    meta.appendChild(sourceBadge);
  }

  main.append(title, meta);
  main.addEventListener("click", () => openTaskDetail(task.id));
  card.append(check, main);

  return card;
}

// =========================================================
// RENDER
// =========================================================

function renderToday() {
  const key = formatDateKey(new Date());

  todayEventList.innerHTML = "";
  const dayEvents = events
    .filter(event => eventOccursOnDate(event, key))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (!dayEvents.length) {
    todayEventList.appendChild(emptyMessage("วันนี้ยังไม่มีนัดหมาย"));
  } else {
    dayEvents.forEach(event => todayEventList.appendChild(createEventCard(event)));
  }

  todayTaskList.innerHTML = "";
  const dayTasks = tasks.filter(task => task.date === key);
  todayTaskSummary.textContent = `${dayTasks.filter(task => task.completed).length} / ${dayTasks.length} งานเสร็จแล้ว`;

  if (!dayTasks.length) {
    todayTaskList.appendChild(emptyMessage("วันนี้ยังไม่มีงาน"));
  } else {
    dayTasks.forEach(task => todayTaskList.appendChild(createTaskCard(task)));
  }

  renderNextEvent();
}

function renderNextEvent() {
  nextEvent.innerHTML = "";
  const now = new Date();
  const future = events
    .map(event => ({
      event,
      datetime: new Date(`${event.date}T${event.startTime}:00`)
    }))
    .filter(item => item.datetime > now)
    .sort((a, b) => a.datetime - b.datetime);

  if (!future.length) {
    nextEvent.appendChild(emptyMessage("ยังไม่มีนัดหมายถัดไป"));
    return;
  }

  const event = future[0].event;
  const card = document.createElement("div");
  card.className = "next-card";

  const title = document.createElement("strong");
  title.textContent = event.title;

  const detail = document.createElement("small");
  detail.textContent = `${eventDateDisplay(event, false)} • ${event.startTime}`;

  card.append(title, detail);
  card.addEventListener("click", () => openEventDetail(event.id));
  nextEvent.appendChild(card);
}

function renderCalendar() {
  calendar.innerHTML = "";
  const months = [
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
  ];
  const days = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

  monthTitle.textContent = `${months[currentMonth]} ${currentYear + 543}`;

  days.forEach(day => {
    const element = document.createElement("div");
    element.className = "day-name";
    element.textContent = day;
    calendar.appendChild(element);
  });

  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const dayCount = new Date(currentYear, currentMonth + 1, 0).getDate();

  for (let i = 0; i < firstDay; i += 1) {
    calendar.appendChild(document.createElement("div"));
  }

  const realToday = new Date();

  for (let day = 1; day <= dayCount; day += 1) {
    const element = document.createElement("div");
    const date = new Date(currentYear, currentMonth, day);
    const key = formatDateKey(date);

    element.className = "calendar-day";
    element.textContent = day;

    if (
      day === realToday.getDate() &&
      currentMonth === realToday.getMonth() &&
      currentYear === realToday.getFullYear()
    ) {
      element.classList.add("today");
    }

    if (
      day === selectedDate.getDate() &&
      currentMonth === selectedDate.getMonth() &&
      currentYear === selectedDate.getFullYear()
    ) {
      element.classList.add("selected");
    }

    const dayCategories = [...new Set(
      events
        .filter(event => eventOccursOnDate(event, key))
        .flatMap(event => event.categories)
    )].slice(0, 3);

    if (dayCategories.length) {
      const dots = document.createElement("div");
      dots.className = "event-dots";

      dayCategories.forEach(categoryKey => {
        const dot = document.createElement("span");
        dot.className = "event-dot";
        dot.style.background = categoryInfo(categoryKey).color;
        dots.appendChild(dot);
      });

      element.appendChild(dots);
    }

    element.addEventListener("click", () => {
      selectedDate = date;
      renderCalendar();
      renderSelectedDate();
    });

    calendar.appendChild(element);
  }
}

function renderSelectedDate() {
  const key = formatDateKey(selectedDate);
  appointmentTitle.textContent = "นัดหมาย • " + selectedDate.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  eventList.innerHTML = "";
  const selectedEvents = events
    .filter(event => eventOccursOnDate(event, key))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (!selectedEvents.length) {
    eventList.appendChild(emptyMessage("ไม่มีนัดหมาย"));
  } else {
    selectedEvents.forEach(event => eventList.appendChild(createEventCard(event)));
  }

  calendarTaskList.innerHTML = "";
  const selectedTasks = tasks.filter(task => task.date === key);

  if (!selectedTasks.length) {
    calendarTaskList.appendChild(emptyMessage("ไม่มีงาน"));
  } else {
    selectedTasks.forEach(task => calendarTaskList.appendChild(createTaskCard(task)));
  }
}

function renderTaskPage() {
  allTaskList.innerHTML = "";
  const key = formatDateKey(planDate);
  const dayTasks = tasks
    .filter(task => task.date === key)
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const order = { urgent: 0, high: 1, normal: 2 };
      const byPriority = (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
      if (byPriority !== 0) return byPriority;
      return a.title.localeCompare(b.title, "th");
    });

  const completed = dayTasks.filter(task => task.completed).length;
  $("plan-task-summary").textContent = `${completed} / ${dayTasks.length} งานเสร็จแล้ว`;
  $("plan-date-title").textContent = planDate.toLocaleDateString("th-TH", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
  $("plan-date-input").value = key;
  $("plan-list-title").textContent = key === formatDateKey(new Date()) ? "งานที่เลือกไว้วันนี้" : "งานที่เลือกไว้วันนี้นั้น";

  if (!dayTasks.length) {
    allTaskList.appendChild(emptyMessage("วันนี้ยังไม่ได้เลือกงาน • กด “เลือกจากงานที่มี” หรือเพิ่มงานใหม่ได้เลย"));
  } else {
    dayTasks.forEach(task => allTaskList.appendChild(createTaskCard(task)));
  }

  renderOverdueTasks();
}

function renderOverdueTasks() {
  const section = $("plan-overdue-section");
  const list = $("plan-overdue-list");
  const key = formatDateKey(planDate);
  const overdue = tasks
    .filter(task => !task.completed && task.date < key)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 8);

  list.innerHTML = "";
  if (!overdue.length) {
    section.classList.add("hidden");
    return;
  }

  section.classList.remove("hidden");
  $("plan-overdue-count").textContent = `${overdue.length} รายการ`;

  overdue.forEach(task => {
    const row = document.createElement("div");
    row.className = "overdue-task-row";

    const main = document.createElement("div");
    main.className = "overdue-task-main";
    const title = document.createElement("strong");
    title.textContent = task.title;
    const meta = document.createElement("small");
    meta.textContent = `เดิม ${dateFromKey(task.date).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`;
    main.append(title, meta);
    main.addEventListener("click", () => openTaskDetail(task.id));

    const move = document.createElement("button");
    move.type = "button";
    move.className = "move-today-btn";
    move.textContent = "ย้ายมาวันนี้";
    move.addEventListener("click", async event => {
      event.stopPropagation();
      if (!currentUser) return;
      try {
        setSyncState("กำลังย้ายงาน...", "busy");
        await setDoc(userDoc("tasks", task.id), firestoreTaskData({ ...task, date: key }), { merge: true });
      } catch (error) {
        console.error(error);
        alert("ย้ายงานไม่สำเร็จ กรุณาลองใหม่");
      }
    });

    row.append(main, move);
    list.appendChild(row);
  });
}

function createFreelanceCard(project) {
  const card = document.createElement("div");
  card.className = "freelance-card";

  const name = document.createElement("h3");
  name.textContent = project.name;

  const moneyGrid = document.createElement("div");
  moneyGrid.className = "freelance-money-grid";

  const items = [
    ["เงินทั้งหมด", project.totalAmount, ""],
    ["รับมาแล้ว", project.receivedAmount, ""],
    ["เหลือค้างเบิก", remainingAmount(project), "remaining"]
  ];

  items.forEach(([label, value, className]) => {
    const box = document.createElement("div");
    if (className) box.className = className;
    const small = document.createElement("small");
    small.textContent = label;
    const strong = document.createElement("strong");
    strong.textContent = formatMoney(value);
    box.append(small, strong);
    moneyGrid.appendChild(box);
  });

  card.append(name);

  if (project.latestUpdate) {
    const latest = document.createElement("div");
    latest.className = "freelance-latest-update";

    const latestText = document.createElement("p");
    latestText.textContent = `ล่าสุด: ${project.latestUpdate}`;
    latest.appendChild(latestText);

    const updateDate = formatFreelanceUpdateDate(project.latestUpdateAt);
    if (updateDate) {
      const latestDate = document.createElement("small");
      latestDate.textContent = `อัปเดต ${updateDate}`;
      latest.appendChild(latestDate);
    }

    card.appendChild(latest);
  }

  card.appendChild(moneyGrid);
  card.addEventListener("click", () => openFreelanceDetail(project.id));
  return card;
}

function createClientGroup(clientName, projects) {
  const group = document.createElement("section");
  group.className = "client-group";

  const header = document.createElement("div");
  header.className = "client-group-header";

  const titleWrap = document.createElement("div");
  const label = document.createElement("small");
  label.textContent = "ผู้ว่าจ้าง / ลูกค้า";
  const title = document.createElement("h3");
  title.textContent = clientName;
  titleWrap.append(label, title);

  const count = document.createElement("span");
  count.className = "client-project-count";
  count.textContent = `${projects.length} โปรเจกต์`;

  header.append(titleWrap, count);

  const total = projects.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
  const received = projects.reduce((sum, item) => sum + (Number(item.receivedAmount) || 0), 0);
  const remaining = projects.reduce((sum, item) => sum + remainingAmount(item), 0);

  const summary = document.createElement("div");
  summary.className = "client-money-summary";
  [
    ["เงินทั้งหมด", total, ""],
    ["รับแล้ว", received, ""],
    ["ค้างเบิก", remaining, "remaining"]
  ].forEach(([text, value, className]) => {
    const item = document.createElement("div");
    if (className) item.className = className;
    const small = document.createElement("small");
    small.textContent = text;
    const strong = document.createElement("strong");
    strong.textContent = formatMoney(value);
    item.append(small, strong);
    summary.appendChild(item);
  });

  const projectList = document.createElement("div");
  projectList.className = "client-project-list";
  [...projects]
    .sort((a, b) => a.name.localeCompare(b.name, "th"))
    .forEach(project => projectList.appendChild(createFreelanceCard(project)));

  group.append(header, summary, projectList);
  return group;
}

function createFreelanceStatusSection(statusKey, projects) {
  const info = freelanceStatusInfo(statusKey);
  const section = document.createElement("section");
  section.className = `freelance-status-section ${statusKey}`;

  const header = document.createElement("div");
  header.className = "freelance-status-header";
  const title = document.createElement("h3");
  title.textContent = `${info.icon} ${info.name}`;
  const count = document.createElement("span");
  count.textContent = `${projects.length} โปรเจกต์`;
  header.append(title, count);
  section.appendChild(header);

  if (!projects.length) {
    const empty = document.createElement("p");
    empty.className = "freelance-status-empty";
    empty.textContent = "ยังไม่มีโปรเจกต์ในสถานะนี้";
    section.appendChild(empty);
    return section;
  }

  const groups = new Map();
  projects.forEach(project => {
    const displayName = normalizeClientName(project.clientName);
    const key = clientGroupKey(displayName);
    if (!groups.has(key)) groups.set(key, { clientName: displayName, projects: [] });
    groups.get(key).projects.push(project);
  });

  [...groups.values()]
    .sort((a, b) => {
      if (a.clientName === "ไม่ระบุผู้ว่าจ้าง") return 1;
      if (b.clientName === "ไม่ระบุผู้ว่าจ้าง") return -1;
      return a.clientName.localeCompare(b.clientName, "th");
    })
    .forEach(group => section.appendChild(createClientGroup(group.clientName, group.projects)));

  return section;
}

function renderFreelancePage() {
  const list = $("freelance-list");
  list.innerHTML = "";

  const total = freelanceProjects.reduce((sum, item) => sum + (Number(item.totalAmount) || 0), 0);
  const received = freelanceProjects.reduce((sum, item) => sum + (Number(item.receivedAmount) || 0), 0);
  const remaining = freelanceProjects.reduce((sum, item) => sum + remainingAmount(item), 0);

  $("freelance-project-count").textContent = String(freelanceProjects.length);
  $("freelance-total").textContent = formatMoney(total);
  $("freelance-received").textContent = formatMoney(received);
  $("freelance-remaining").textContent = formatMoney(remaining);

  if (!freelanceProjects.length) {
    list.appendChild(emptyMessage("ยังไม่มีโปรเจกต์งานนอก"));
    return;
  }

  freelanceStatusOrder.forEach(statusKey => {
    const projects = freelanceProjects.filter(project => project.status === statusKey);
    list.appendChild(createFreelanceStatusSection(statusKey, projects));
  });
}

function renderEverything() {
  renderToday();
  renderCalendar();
  renderSelectedDate();
  renderTaskPage();
  renderFreelancePage();
  updateNotificationStatus();
}



// =========================================================
// EXCEL EXPORT — GOVERNMENT APPOINTMENTS
// =========================================================

function thaiShortDate(key) {
  return dateFromKey(key).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

function eventCategoryText(event) {
  return (event.categories || [])
    .map(key => categoryInfo(key).name)
    .join(", ");
}

function exportGovernmentAppointmentsToExcel() {
  if (!currentUser) {
    alert("กรุณาเข้าสู่ระบบก่อนส่งออกข้อมูล");
    return;
  }

  if (!window.XLSX) {
    alert("โหลดระบบสร้างไฟล์ Excel ไม่สำเร็จ กรุณาต่ออินเทอร์เน็ตแล้วลองใหม่");
    return;
  }

  const governmentEvents = events
    .filter(event => (event.categories || []).includes("government"))
    .sort((a, b) => {
      const byDate = String(a.date).localeCompare(String(b.date));
      if (byDate !== 0) return byDate;
      return String(a.startTime || "").localeCompare(String(b.startTime || ""));
    });

  if (!governmentEvents.length) {
    alert("ยังไม่มีนัดหมายที่อยู่ในหมวดงานราชการ");
    return;
  }

  const rows = governmentEvents.map((event, index) => ({
    "ลำดับ": index + 1,
    "วันที่เริ่ม": event.date,
    "วันที่สิ้นสุด": eventEndDate(event),
    "ช่วงวันที่แบบไทย": eventDateDisplay(event, false),
    "เวลา": event.startTime || "",
    "เรื่อง / นัดหมาย": event.title || "",
    "สถานที่": event.location || "",
    "รายละเอียด / บันทึก": event.note || "",
    "แจ้งเตือน": reminderText(event.reminders || []),
    "หมวดหมู่": eventCategoryText(event)
  }));

  const worksheet = window.XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 8 },
    { wch: 16 },
    { wch: 16 },
    { wch: 28 },
    { wch: 10 },
    { wch: 34 },
    { wch: 28 },
    { wch: 55 },
    { wch: 24 },
    { wch: 28 }
  ];
  worksheet["!autofilter"] = { ref: `A1:J${rows.length + 1}` };

  const workbook = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(workbook, worksheet, "งานราชการ");

  const filename = `MyPlanner_งานราชการ_${formatDateKey(new Date())}.xlsx`;
  window.XLSX.writeFile(workbook, filename, { compression: true });
}

const governmentExcelButton = $("export-government-excel");
if (governmentExcelButton) {
  governmentExcelButton.addEventListener("click", exportGovernmentAppointmentsToExcel);
}

// =========================================================
// IMAGE ATTACHMENTS (FIRESTORE BYTES)
// Images are compressed in the browser before upload.
// =========================================================

const MAX_IMAGES_PER_ITEM = 6;
const TARGET_IMAGE_BYTES = 430 * 1024;
const pendingImages = { event: [], task: [] };
const galleryUrls = new Map();

function pendingPreviewId(type) {
  return type === "event" ? "event-photo-preview" : "task-photo-preview";
}

function photoStatusId(type) {
  return type === "event" ? "event-photo-status" : "task-photo-status";
}

function editingParentId(type) {
  return type === "event" ? editingEventId : editingTaskId;
}

function clearPendingImages(type) {
  pendingImages[type].forEach(item => URL.revokeObjectURL(item.previewUrl));
  pendingImages[type] = [];
  renderPendingImagePreview(type);
  const status = $(photoStatusId(type));
  if (status) status.textContent = "";
}

function renderPendingImagePreview(type) {
  const container = $(pendingPreviewId(type));
  if (!container) return;
  container.innerHTML = "";

  pendingImages[type].forEach((item, index) => {
    const wrap = document.createElement("div");
    wrap.className = "photo-preview-item";

    const img = document.createElement("img");
    img.src = item.previewUrl;
    img.alt = `รูปที่เลือก ${index + 1}`;
    img.addEventListener("click", () => openPhotoViewer(item.previewUrl));

    const size = document.createElement("span");
    size.className = "photo-size-badge";
    size.textContent = `${Math.max(1, Math.round(item.blob.size / 1024))} KB`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "photo-remove-btn";
    remove.textContent = "×";
    remove.setAttribute("aria-label", "ลบรูปที่เลือก");
    remove.addEventListener("click", () => {
      URL.revokeObjectURL(item.previewUrl);
      pendingImages[type].splice(index, 1);
      renderPendingImagePreview(type);
    });

    wrap.append(img, size, remove);
    container.appendChild(wrap);
  });
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("ไม่สามารถอ่านไฟล์รูปนี้ได้"));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error("บีบอัดรูปไม่สำเร็จ"));
    }, "image/jpeg", quality);
  });
}

async function compressImage(file) {
  const image = await loadImageElement(file);
  let maxSide = 1500;
  let quality = 0.78;
  let blob = null;

  for (let dimensionPass = 0; dimensionPass < 3; dimensionPass += 1) {
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    quality = 0.78;
    while (quality >= 0.42) {
      blob = await canvasToBlob(canvas, quality);
      if (blob.size <= TARGET_IMAGE_BYTES) return blob;
      quality -= 0.08;
    }

    maxSide = Math.round(maxSide * 0.78);
  }

  if (!blob || blob.size > 650 * 1024) {
    throw new Error("รูปนี้ยังมีขนาดใหญ่เกินไปหลังบีบอัด");
  }
  return blob;
}

async function getAttachmentRecords(parentType, parentId) {
  if (!currentUser || !parentId) return [];
  const parentKey = `${parentType}:${parentId}`;
  const snapshot = await getDocs(query(userCollection("attachments"), where("parentKey", "==", parentKey)));
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

async function handlePhotoSelection(type, input) {
  const files = [...(input.files || [])].filter(file => file.type.startsWith("image/"));
  input.value = "";
  if (!files.length) return;

  const status = $(photoStatusId(type));
  const parentId = editingParentId(type);
  let existingCount = 0;

  try {
    if (parentId) existingCount = (await getAttachmentRecords(type, parentId)).length;
  } catch (error) {
    console.error(error);
  }

  const available = MAX_IMAGES_PER_ITEM - existingCount - pendingImages[type].length;
  if (available <= 0) {
    alert(`รายการนี้มีรูปครบ ${MAX_IMAGES_PER_ITEM} รูปแล้ว`);
    return;
  }

  const selected = files.slice(0, available);
  if (files.length > available) alert(`เพิ่มได้อีก ${available} รูป ระบบจะใช้เฉพาะ ${available} รูปแรก`);

  status.textContent = "กำลังบีบอัดรูปอัตโนมัติ...";
  for (const file of selected) {
    try {
      const blob = await compressImage(file);
      const previewUrl = URL.createObjectURL(blob);
      pendingImages[type].push({ blob, previewUrl, originalName: file.name || "photo.jpg" });
      renderPendingImagePreview(type);
    } catch (error) {
      console.error(error);
      alert(`ข้ามรูป ${file.name || "1 รูป"}: ${error.message}`);
    }
  }
  status.textContent = pendingImages[type].length ? `พร้อมอัปโหลด ${pendingImages[type].length} รูป • ระบบบีบอัดให้แล้ว` : "";
}

async function uploadPendingAttachments(type, parentId) {
  const items = [...pendingImages[type]];
  if (!items.length) return;

  const status = $(photoStatusId(type));
  let completed = 0;
  for (const item of items) {
    const attachmentId = makeId("photo");
    const uint8 = new Uint8Array(await item.blob.arrayBuffer());
    await setDoc(userDoc("attachments", attachmentId), {
      parentKey: `${type}:${parentId}`,
      parentType: type,
      parentId: String(parentId),
      mimeType: "image/jpeg",
      originalName: item.originalName,
      size: uint8.byteLength,
      imageBytes: Bytes.fromUint8Array(uint8),
      createdAt: serverTimestamp()
    });
    completed += 1;
    if (status) status.textContent = `อัปโหลดรูป ${completed}/${items.length}...`;
  }
  clearPendingImages(type);
}

function clearGalleryObjectUrls(containerId) {
  const urls = galleryUrls.get(containerId) || [];
  urls.forEach(url => URL.revokeObjectURL(url));
  galleryUrls.set(containerId, []);
}

function openPhotoViewer(url) {
  $("photo-viewer-image").src = url;
  $("photo-viewer-modal").classList.add("show");
}

async function renderAttachmentGallery(parentType, parentId, containerId) {
  const container = $(containerId);
  if (!container) return;
  clearGalleryObjectUrls(containerId);
  container.innerHTML = '<span class="photo-empty">กำลังโหลดรูป...</span>';

  try {
    const records = await getAttachmentRecords(parentType, parentId);
    container.innerHTML = "";
    if (!records.length) {
      container.innerHTML = '<span class="photo-empty">ไม่มีรูปประกอบ</span>';
      return;
    }

    records.sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
    const urls = [];
    records.forEach(record => {
      if (!record.imageBytes || typeof record.imageBytes.toUint8Array !== "function") return;
      const blob = new Blob([record.imageBytes.toUint8Array()], { type: record.mimeType || "image/jpeg" });
      const url = URL.createObjectURL(blob);
      urls.push(url);

      const wrap = document.createElement("div");
      wrap.className = "detail-photo-item";
      const img = document.createElement("img");
      img.src = url;
      img.alt = "รูปประกอบ";
      img.addEventListener("click", () => openPhotoViewer(url));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "photo-remove-btn";
      remove.textContent = "×";
      remove.setAttribute("aria-label", "ลบรูปนี้");
      remove.addEventListener("click", async event => {
        event.stopPropagation();
        if (!confirm("ต้องการลบรูปนี้ใช่หรือไม่?")) return;
        try {
          await deleteDoc(userDoc("attachments", record.id));
          await renderAttachmentGallery(parentType, parentId, containerId);
        } catch (error) {
          console.error(error);
          alert("ลบรูปไม่สำเร็จ");
        }
      });

      wrap.append(img, remove);
      container.appendChild(wrap);
    });
    galleryUrls.set(containerId, urls);
  } catch (error) {
    console.error(error);
    container.innerHTML = '<span class="photo-empty">โหลดรูปไม่สำเร็จ</span>';
  }
}

async function deleteAllAttachments(parentType, parentId) {
  const records = await getAttachmentRecords(parentType, parentId);
  for (const record of records) await deleteDoc(userDoc("attachments", record.id));
}

// =========================================================
// EVENT FORM / DETAIL
// =========================================================

const eventModal = $("event-modal");
const eventDetailModal = $("event-detail-modal");
const eventTitle = $("event-title");
const eventDate = $("event-date");
const eventEndDateInput = $("event-end-date");
const eventEndDateBlock = $("event-end-date-block");
const eventStartDateLabel = $("event-start-date-label");
const eventDateModeInputs = [...document.querySelectorAll('input[name="event-date-mode"]')];
const eventStart = $("event-start-time");
const eventLocation = $("event-location");
const eventNote = $("event-note");

function getEventDateMode() {
  return eventDateModeInputs.find(input => input.checked)?.value || "single";
}

function setEventDateMode(mode = "single") {
  const nextMode = mode === "range" ? "range" : "single";
  eventDateModeInputs.forEach(input => {
    input.checked = input.value === nextMode;
  });
  eventEndDateBlock.classList.toggle("hidden", nextMode !== "range");
  eventStartDateLabel.textContent = nextMode === "range" ? "วันที่เริ่ม" : "วันที่";

  if (nextMode === "single") {
    eventEndDateInput.value = eventDate.value;
  } else if (!eventEndDateInput.value) {
    eventEndDateInput.value = eventDate.value;
  }
}

function openAddEvent(date = selectedDate) {
  editingEventId = null;
  $("event-form-title").textContent = "เพิ่มนัดหมาย";
  eventTitle.value = "";
  setChecks("event-categories", ["personal"]);
  setChecks("event-reminders", []);
  eventDate.value = formatDateKey(date);
  eventEndDateInput.value = eventDate.value;
  setEventDateMode("single");
  eventStart.value = "09:00";
  eventLocation.value = "";
  eventNote.value = "";
  clearPendingImages("event");
  eventModal.classList.add("show");
}

function openEditEvent(id) {
  const event = events.find(item => item.id === String(id));
  if (!event) return;

  editingEventId = event.id;
  $("event-form-title").textContent = "แก้ไขนัดหมาย";
  eventTitle.value = event.title;
  setChecks("event-categories", event.categories);
  setChecks("event-reminders", event.reminders.map(String));
  eventDate.value = event.date;
  eventEndDateInput.value = eventEndDate(event);
  setEventDateMode(event.dateMode === "range" || eventEndDate(event) !== event.date ? "range" : "single");
  eventStart.value = event.startTime;
  eventLocation.value = event.location;
  eventNote.value = event.note;
  clearPendingImages("event");
  eventDetailModal.classList.remove("show");
  eventModal.classList.add("show");
}

async function saveEvent() {
  if (!currentUser) return;

  const title = eventTitle.value.trim();
  const eventCategories = getChecks("event-categories");
  const reminders = getChecks("event-reminders").map(Number);
  const date = eventDate.value;
  const dateMode = getEventDateMode();
  const endDate = dateMode === "range" ? eventEndDateInput.value : date;
  const startTime = eventStart.value;

  if (!title || !eventCategories.length || !date || !startTime || (dateMode === "range" && !endDate)) {
    alert("กรุณากรอกชื่อ เลือกประเภท วันที่ และเวลาเริ่มให้ครบ");
    return;
  }

  if (dateMode === "range" && endDate < date) {
    alert("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม");
    return;
  }

  const id = editingEventId || makeId("event");
  const data = {
    id,
    title,
    categories: eventCategories,
    reminders,
    date,
    endDate,
    dateMode,
    startTime,
    location: eventLocation.value.trim(),
    note: eventNote.value.trim()
  };

  try {
    setSyncState("กำลังบันทึกนัดหมาย...", "busy");
    await setDoc(userDoc("events", id), firestoreEventData(data), { merge: true });
    await uploadPendingAttachments("event", id);

    selectedDate = dateFromKey(date);
    currentMonth = selectedDate.getMonth();
    currentYear = selectedDate.getFullYear();
    eventModal.classList.remove("show");
    editingEventId = null;
    checkDueReminders();
  } catch (error) {
    console.error(error);
    setSyncState("บันทึกนัดหมายไม่สำเร็จ", "error");
    alert("บันทึกนัดหมายไม่สำเร็จ กรุณาลองใหม่");
  }
}

function reminderText(values) {
  if (!values?.length) return "ไม่ตั้งแจ้งเตือน";
  return [...values]
    .sort((a, b) => a - b)
    .map(value => value === 1440 ? "1 วันก่อน" : value === 60 ? "1 ชั่วโมงก่อน" : `${value} นาทีก่อน`)
    .join(", ");
}

function openEventDetail(id) {
  const event = events.find(item => item.id === String(id));
  if (!event) return;

  selectedEventId = event.id;
  createCategoryBadges(event.categories, $("detail-event-categories"));
  $("detail-event-title").textContent = event.title;
  $("detail-event-date").textContent = eventDateDisplay(event);
  $("detail-event-time").textContent = event.startTime;
  $("detail-event-location").textContent = event.location || "ไม่ได้ระบุสถานที่";
  $("detail-event-reminders").textContent = reminderText(event.reminders);
  $("detail-event-note").textContent = event.note || "ไม่มีรายละเอียดเพิ่มเติม";
  eventDetailModal.classList.add("show");
  renderAttachmentGallery("event", event.id, "detail-event-images");
}

// =========================================================
// DAILY PLAN SOURCE PICKER
// =========================================================

const sourcePickerModal = $("source-picker-modal");
const sourcePickerList = $("source-picker-list");
const sourceSearch = $("source-search");

function sourceKey(type, id) {
  return `${type}:${id}`;
}

function sourceAlreadyInPlan(type, id) {
  const key = formatDateKey(planDate);
  return tasks.some(task => task.date === key && task.sourceType === type && String(task.sourceId) === String(id));
}

function eventSourceMeta(event) {
  return `${eventDateDisplay(event, false)} • ${event.startTime}${event.location ? ` • ${event.location}` : ""}`;
}

function sourceMatchesSearch(text, queryText) {
  return String(text || "").toLocaleLowerCase("th-TH").includes(queryText);
}

function createSourceChoice({ type, id, title, meta, group, categories: sourceCategories = [] }) {
  const already = sourceAlreadyInPlan(type, id);
  const label = document.createElement("label");
  label.className = `source-choice${already ? " disabled" : ""}`;
  label.dataset.group = group;
  label.dataset.search = `${title} ${meta}`.toLocaleLowerCase("th-TH");

  const input = document.createElement("input");
  input.type = "checkbox";
  input.value = sourceKey(type, id);
  input.disabled = already;
  input.checked = sourceSelection.has(input.value) && !already;

  const box = document.createElement("span");
  box.className = "source-choice-box";
  box.textContent = "✓";

  const main = document.createElement("span");
  main.className = "source-choice-main";
  const strong = document.createElement("strong");
  strong.textContent = title;
  const small = document.createElement("small");
  small.textContent = meta;
  main.append(strong, small);

  if (already) {
    const added = document.createElement("small");
    added.className = "already-added";
    added.textContent = "✓ อยู่ในแผนวันนี้แล้ว";
    main.appendChild(added);
  }

  input.addEventListener("change", () => {
    if (input.checked) sourceSelection.add(input.value);
    else sourceSelection.delete(input.value);
    updateSourceSelectedCount();
  });

  label.append(input, box, main);
  return label;
}

function appendSourceGroup(titleText, items) {
  if (!items.length) return;
  const header = document.createElement("div");
  header.className = "source-group-title";
  const title = document.createElement("span");
  title.textContent = titleText;
  const count = document.createElement("span");
  count.textContent = `${items.length} รายการ`;
  header.append(title, count);
  sourcePickerList.appendChild(header);
  items.forEach(item => sourcePickerList.appendChild(createSourceChoice(item)));
}

function renderSourcePicker() {
  sourcePickerList.innerHTML = "";
  const queryText = sourceSearch.value.trim().toLocaleLowerCase("th-TH");

  const eventSort = (a, b) => {
    const target = planDate.getTime();
    const da = Math.abs(dateFromKey(a.date).getTime() - target);
    const db = Math.abs(dateFromKey(b.date).getTime() - target);
    if (da !== db) return da - db;
    return String(a.startTime).localeCompare(String(b.startTime));
  };

  const government = events
    .filter(event => event.categories.includes("government"))
    .filter(event => !queryText || sourceMatchesSearch(`${event.title} ${event.location} ${event.note}`, queryText))
    .sort(eventSort)
    .slice(0, queryText ? 100 : 35)
    .map(event => ({
      type: "event", id: event.id, title: event.title, meta: eventSourceMeta(event), group: "government", categories: event.categories
    }));

  const freelance = freelanceProjects
    .filter(project => project.status !== "paid")
    .filter(project => !queryText || sourceMatchesSearch(`${project.name} ${project.clientName}`, queryText))
    .sort((a, b) => a.clientName.localeCompare(b.clientName, "th") || a.name.localeCompare(b.name, "th"))
    .map(project => ({
      type: "freelance", id: project.id, title: project.name,
      meta: `${project.clientName} • ${freelanceStatusInfo(project.status).name}`,
      group: "freelance", categories: ["freelance"]
    }));

  const other = events
    .filter(event => !event.categories.includes("government"))
    .filter(event => !queryText || sourceMatchesSearch(`${event.title} ${event.location} ${event.note}`, queryText))
    .sort(eventSort)
    .slice(0, queryText ? 100 : 25)
    .map(event => ({
      type: "event", id: event.id, title: event.title, meta: eventSourceMeta(event), group: "other", categories: event.categories
    }));

  const filterAllows = group => sourcePickerFilter === "all" || sourcePickerFilter === group;
  if (filterAllows("government")) appendSourceGroup("🏛️ งานราชการจากปฏิทิน", government);
  if (filterAllows("freelance")) appendSourceGroup("💼 โปรเจกต์งานนอก", freelance);
  if (filterAllows("other")) appendSourceGroup("📅 นัดหมายอื่น", other);

  if (!sourcePickerList.children.length) {
    const empty = document.createElement("div");
    empty.className = "source-picker-empty";
    empty.textContent = "ไม่พบรายการที่ตรงกับเงื่อนไข";
    sourcePickerList.appendChild(empty);
  }

  updateSourceSelectedCount();
}

function updateSourceSelectedCount() {
  $("source-selected-count").textContent = sourceSelection.size ? `เลือกแล้ว ${sourceSelection.size} รายการ` : "ยังไม่ได้เลือก";
  $("add-selected-sources").disabled = sourceSelection.size === 0;
}

function openSourcePicker(date = planDate) {
  planDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  sourceSelection.clear();
  sourcePickerFilter = "all";
  sourceSearch.value = "";
  document.querySelectorAll(".source-filter").forEach(button => button.classList.toggle("active", button.dataset.sourceFilter === "all"));
  $("source-picker-date").textContent = `จะเพิ่มลงแผน: ${planDate.toLocaleDateString("th-TH", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`;
  renderSourcePicker();
  sourcePickerModal.classList.add("show");
}

async function addSelectedSourcesToPlan() {
  if (!currentUser || !sourceSelection.size) return;
  const date = formatDateKey(planDate);
  const writes = [];

  sourceSelection.forEach(key => {
    const [type, id] = key.split(":");
    if (sourceAlreadyInPlan(type, id)) return;

    if (type === "event") {
      const event = events.find(item => item.id === id);
      if (!event) return;
      const task = {
        id: makeId("task"),
        title: event.title,
        categories: event.categories?.length ? event.categories : ["personal"],
        priority: "normal",
        completed: false,
        date,
        note: event.note ? `จากนัดหมาย • ${event.note}` : `จากนัดหมาย ${eventSourceMeta(event)}`,
        sourceType: "event",
        sourceId: event.id,
        sourceLabel: `นัดหมาย • ${event.title}`
      };
      writes.push(setDoc(userDoc("tasks", task.id), firestoreTaskData(task), { merge: true }));
      return;
    }

    if (type === "freelance") {
      const project = freelanceProjects.find(item => item.id === id);
      if (!project) return;
      const task = {
        id: makeId("task"),
        title: project.name,
        categories: ["freelance"],
        priority: "normal",
        completed: false,
        date,
        note: `งานนอก • ${project.clientName} • ${freelanceStatusInfo(project.status).name}`,
        sourceType: "freelance",
        sourceId: project.id,
        sourceLabel: `งานนอก • ${project.clientName}`
      };
      writes.push(setDoc(userDoc("tasks", task.id), firestoreTaskData(task), { merge: true }));
    }
  });

  if (!writes.length) {
    sourcePickerModal.classList.remove("show");
    return;
  }

  try {
    setSyncState("กำลังเพิ่มงานลงแผน...", "busy");
    $("add-selected-sources").disabled = true;
    await Promise.all(writes);
    sourceSelection.clear();
    sourcePickerModal.classList.remove("show");
    renderTaskPage();
  } catch (error) {
    console.error(error);
    alert("เพิ่มงานลงแผนไม่สำเร็จ กรุณาลองใหม่");
  } finally {
    updateSourceSelectedCount();
  }
}

function openTaskSource(task) {
  if (!task?.sourceId) return;
  taskDetailModal.classList.remove("show");
  if (task.sourceType === "event") {
    const event = events.find(item => item.id === String(task.sourceId));
    if (event) openEventDetail(event.id);
    else alert("ไม่พบข้อมูลนัดหมายต้นทาง อาจถูกลบไปแล้ว");
    return;
  }
  if (task.sourceType === "freelance") {
    const project = freelanceProjects.find(item => item.id === String(task.sourceId));
    if (project) openFreelanceDetail(project.id);
    else alert("ไม่พบโปรเจกต์ต้นทาง อาจถูกลบไปแล้ว");
  }
}

// =========================================================
// TASK FORM / DETAIL
// =========================================================

const taskModal = $("task-modal");
const taskDetailModal = $("task-detail-modal");
const taskTitle = $("task-title");
const taskDate = $("task-date");
const taskNote = $("task-note");

function openAddTask(date = selectedDate) {
  editingTaskId = null;
  $("task-form-title").textContent = "เพิ่มงาน";
  taskTitle.value = "";
  setChecks("task-categories", ["personal"]);
  taskDate.value = formatDateKey(date);
  setChecks("task-priority", ["normal"]);
  taskNote.value = "";
  clearPendingImages("task");
  taskModal.classList.add("show");
}

function openEditTask(id) {
  const task = tasks.find(item => item.id === String(id));
  if (!task) return;

  editingTaskId = task.id;
  $("task-form-title").textContent = "แก้ไขงาน";
  taskTitle.value = task.title;
  setChecks("task-categories", task.categories);
  taskDate.value = task.date;
  setChecks("task-priority", [task.priority]);
  taskNote.value = task.note;
  clearPendingImages("task");
  taskDetailModal.classList.remove("show");
  taskModal.classList.add("show");
}

async function saveTask() {
  if (!currentUser) return;

  const title = taskTitle.value.trim();
  const taskCategories = getChecks("task-categories");
  const priority = getSingleCheck("task-priority");
  const date = taskDate.value;

  if (!title || !taskCategories.length || !priority || !date) {
    alert("กรุณากรอกชื่องาน เลือกประเภท ความสำคัญ และวันที่");
    return;
  }

  const id = editingTaskId || makeId("task");
  const existing = tasks.find(item => item.id === id);
  const data = {
    id,
    title,
    categories: taskCategories,
    date,
    priority,
    completed: existing ? existing.completed : false,
    note: taskNote.value.trim(),
    sourceType: existing?.sourceType || "custom",
    sourceId: existing?.sourceId || "",
    sourceLabel: existing?.sourceLabel || ""
  };

  try {
    setSyncState("กำลังบันทึกงาน...", "busy");
    await setDoc(userDoc("tasks", id), firestoreTaskData(data), { merge: true });
    await uploadPendingAttachments("task", id);
    taskModal.classList.remove("show");
    editingTaskId = null;
  } catch (error) {
    console.error(error);
    setSyncState("บันทึกงานไม่สำเร็จ", "error");
    alert("บันทึกงานไม่สำเร็จ กรุณาลองใหม่");
  }
}

function openTaskDetail(id) {
  const task = tasks.find(item => item.id === String(id));
  if (!task) return;

  selectedTaskId = task.id;
  createCategoryBadges(task.categories, $("detail-task-categories"));
  $("detail-task-title").textContent = task.title;
  $("detail-task-date").textContent = thaiDate(task.date);
  $("detail-task-priority").textContent = priorityName(task.priority);
  $("detail-task-note").textContent = task.note || "ไม่มีรายละเอียดเพิ่มเติม";

  const sourceRow = $("detail-task-source-row");
  const sourceButton = $("open-task-source");
  if (task.sourceType && task.sourceType !== "custom" && task.sourceId) {
    $("detail-task-source").textContent = task.sourceLabel || (task.sourceType === "event" ? "นัดหมาย" : "งานนอก");
    sourceRow.classList.remove("hidden");
    sourceButton.classList.remove("hidden");
  } else {
    sourceRow.classList.add("hidden");
    sourceButton.classList.add("hidden");
  }

  renderAttachmentGallery("task", task.id, "detail-task-images");

  const complete = $("complete-task");
  complete.textContent = task.completed ? "↩ กลับเป็นยังไม่เสร็จ" : "✓ ทำเสร็จแล้ว";
  complete.classList.toggle("done", task.completed);
  taskDetailModal.classList.add("show");
}

// =========================================================
// FREELANCE FORM / DETAIL
// =========================================================

const freelanceModal = $("freelance-modal");
const freelanceDetailModal = $("freelance-detail-modal");
const freelanceClient = $("freelance-client");
const freelanceName = $("freelance-name");
const freelanceUpdate = $("freelance-update");
const freelanceTotalInput = $("freelance-total-input");
const freelanceReceivedInput = $("freelance-received-input");
const freelanceRemainingPreview = $("freelance-remaining-preview");

function updateFreelancePreview() {
  const total = Math.max(0, Number(freelanceTotalInput.value) || 0);
  const received = Math.max(0, Number(freelanceReceivedInput.value) || 0);
  freelanceRemainingPreview.textContent = formatMoney(Math.max(0, total - received));
}

freelanceTotalInput.addEventListener("input", updateFreelancePreview);
freelanceReceivedInput.addEventListener("input", updateFreelancePreview);

function openAddFreelance() {
  editingFreelanceId = null;
  $("freelance-form-title").textContent = "เพิ่มโปรเจกต์งานนอก";
  freelanceClient.value = "";
  freelanceName.value = "";
  setChecks("freelance-status", ["talking"]);
  freelanceUpdate.value = "";
  freelanceTotalInput.value = "";
  freelanceReceivedInput.value = "";
  updateFreelancePreview();
  freelanceModal.classList.add("show");
}

function openEditFreelance(id) {
  const project = freelanceProjects.find(item => item.id === String(id));
  if (!project) return;

  editingFreelanceId = project.id;
  $("freelance-form-title").textContent = "แก้ไขโปรเจกต์งานนอก";
  freelanceClient.value = project.clientName === "ไม่ระบุผู้ว่าจ้าง" ? "" : project.clientName;
  freelanceName.value = project.name;
  setChecks("freelance-status", [project.status]);
  freelanceUpdate.value = project.latestUpdate || "";
  freelanceTotalInput.value = String(project.totalAmount);
  freelanceReceivedInput.value = String(project.receivedAmount);
  updateFreelancePreview();
  freelanceDetailModal.classList.remove("show");
  freelanceModal.classList.add("show");
}

async function saveFreelance() {
  if (!currentUser) return;

  const clientName = normalizeClientName(freelanceClient.value);
  const name = freelanceName.value.trim();
  const status = getSingleCheck("freelance-status");
  const latestUpdate = freelanceUpdate.value.trim();
  const totalAmount = Number(freelanceTotalInput.value);
  const receivedAmount = Number(freelanceReceivedInput.value);

  if (!name || !status || !Number.isFinite(totalAmount) || !Number.isFinite(receivedAmount)) {
    alert("กรุณากรอกชื่อโปรเจกต์ เลือกสถานะ เงินทั้งหมด และรับมาแล้วให้ครบ");
    return;
  }

  if (totalAmount < 0 || receivedAmount < 0) {
    alert("จำนวนเงินต้องไม่ติดลบ");
    return;
  }

  if (receivedAmount > totalAmount) {
    alert("ยอดรับมาแล้วต้องไม่มากกว่าเงินทั้งหมด");
    return;
  }

  const id = editingFreelanceId || makeId("freelance");
  const existingProject = editingFreelanceId
    ? freelanceProjects.find(item => item.id === String(editingFreelanceId))
    : null;

  let latestUpdateAt = existingProject?.latestUpdateAt || "";
  const previousUpdate = (existingProject?.latestUpdate || "").trim();

  if (latestUpdate !== previousUpdate) {
    latestUpdateAt = latestUpdate ? new Date().toISOString() : "";
  } else if (!existingProject && latestUpdate) {
    latestUpdateAt = new Date().toISOString();
  }

  const data = {
    id,
    clientName,
    name,
    status,
    latestUpdate,
    latestUpdateAt,
    totalAmount,
    receivedAmount
  };

  try {
    setSyncState("กำลังบันทึกงานนอก...", "busy");
    await setDoc(userDoc("freelance", id), firestoreFreelanceData(data), { merge: true });
    freelanceModal.classList.remove("show");
    editingFreelanceId = null;
  } catch (error) {
    console.error(error);
    setSyncState("บันทึกงานนอกไม่สำเร็จ", "error");
    alert("บันทึกโปรเจกต์ไม่สำเร็จ กรุณาลองใหม่");
  }
}

function openFreelanceDetail(id) {
  const project = freelanceProjects.find(item => item.id === String(id));
  if (!project) return;

  selectedFreelanceId = project.id;
  $("detail-freelance-client").textContent = project.clientName;
  const statusInfo = freelanceStatusInfo(project.status);
  const statusBadge = $("detail-freelance-status");
  statusBadge.className = `freelance-status-badge ${project.status}`;
  statusBadge.textContent = `${statusInfo.icon} ${statusInfo.name}`;
  $("detail-freelance-name").textContent = project.name;
  $("detail-freelance-update").textContent = project.latestUpdate || "ยังไม่มีการอัปเดต";
  const updateDate = formatFreelanceUpdateDate(project.latestUpdateAt);
  $("detail-freelance-update-date").textContent = updateDate ? `อัปเดตเมื่อ ${updateDate}` : "";
  $("detail-freelance-total").textContent = formatMoney(project.totalAmount);
  $("detail-freelance-received").textContent = formatMoney(project.receivedAmount);
  $("detail-freelance-remaining").textContent = formatMoney(remainingAmount(project));
  freelanceDetailModal.classList.add("show");
}

// =========================================================
// NAVIGATION + BUTTONS
// =========================================================

document.querySelectorAll(".nav-btn").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".page").forEach(page => page.classList.remove("active"));
    document.querySelectorAll(".nav-btn").forEach(nav => nav.classList.remove("active"));
    $(button.dataset.page).classList.add("active");
    button.classList.add("active");
  });
});

prevMonth.addEventListener("click", () => {
  currentMonth -= 1;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear -= 1;
  }
  renderCalendar();
});

nextMonth.addEventListener("click", () => {
  currentMonth += 1;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear += 1;
  }
  renderCalendar();
});

$("calendar-go-today")?.addEventListener("click", () => {
  const now = new Date();
  selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  currentMonth = selectedDate.getMonth();
  currentYear = selectedDate.getFullYear();
  renderCalendar();
  renderSelectedDate();
});

$("today-add-event").addEventListener("click", () => openAddEvent(new Date()));
$("calendar-add-event").addEventListener("click", () => openAddEvent(selectedDate));
$("today-add-task").addEventListener("click", () => openSourcePicker(new Date()));
$("calendar-add-task").addEventListener("click", () => openSourcePicker(selectedDate));
$("task-add-button").addEventListener("click", () => openAddTask(planDate));
$("plan-pick-source").addEventListener("click", () => openSourcePicker(planDate));
$("freelance-add-button").addEventListener("click", openAddFreelance);

eventDateModeInputs.forEach(input => {
  input.addEventListener("change", () => setEventDateMode(input.value));
});
eventDate.addEventListener("change", () => {
  if (getEventDateMode() === "single") {
    eventEndDateInput.value = eventDate.value;
  } else if (!eventEndDateInput.value || eventEndDateInput.value < eventDate.value) {
    eventEndDateInput.value = eventDate.value;
  }
});

$("save-event").addEventListener("click", saveEvent);
$("save-task").addEventListener("click", saveTask);
$("save-freelance").addEventListener("click", saveFreelance);

$("event-photo-button").addEventListener("click", () => $("event-photo-input").click());
$("task-photo-button").addEventListener("click", () => $("task-photo-input").click());
$("event-photo-input").addEventListener("change", event => handlePhotoSelection("event", event.target));
$("task-photo-input").addEventListener("change", event => handlePhotoSelection("task", event.target));
$("close-photo-viewer").addEventListener("click", () => $("photo-viewer-modal").classList.remove("show"));
$("photo-viewer-modal").addEventListener("click", event => {
  if (event.target === $("photo-viewer-modal")) $("photo-viewer-modal").classList.remove("show");
});

$("edit-event").addEventListener("click", () => {
  if (selectedEventId !== null) openEditEvent(selectedEventId);
});

$("delete-event").addEventListener("click", async () => {
  const event = events.find(item => item.id === String(selectedEventId));
  if (!event || !confirm(`ต้องการลบนัด "${event.title}" ใช่หรือไม่?`)) return;

  try {
    setSyncState("กำลังลบนัดหมาย...", "busy");
    await deleteAllAttachments("event", event.id);
    await deleteDoc(userDoc("events", event.id));
    selectedEventId = null;
    eventDetailModal.classList.remove("show");
  } catch (error) {
    console.error(error);
    setSyncState("ลบนัดหมายไม่สำเร็จ", "error");
    alert("ลบนัดหมายไม่สำเร็จ");
  }
});

$("edit-task").addEventListener("click", () => {
  if (selectedTaskId !== null) openEditTask(selectedTaskId);
});

$("delete-task").addEventListener("click", async () => {
  const task = tasks.find(item => item.id === String(selectedTaskId));
  if (!task || !confirm(`ต้องการลบงาน "${task.title}" ใช่หรือไม่?`)) return;

  try {
    setSyncState("กำลังลบงาน...", "busy");
    await deleteAllAttachments("task", task.id);
    await deleteDoc(userDoc("tasks", task.id));
    selectedTaskId = null;
    taskDetailModal.classList.remove("show");
  } catch (error) {
    console.error(error);
    setSyncState("ลบงานไม่สำเร็จ", "error");
    alert("ลบงานไม่สำเร็จ");
  }
});

$("complete-task").addEventListener("click", async () => {
  const task = tasks.find(item => item.id === String(selectedTaskId));
  if (!task) return;

  try {
    setSyncState("กำลังบันทึก...", "busy");
    await setDoc(userDoc("tasks", task.id), firestoreTaskData({
      ...task,
      completed: !task.completed
    }), { merge: true });
    taskDetailModal.classList.remove("show");
  } catch (error) {
    console.error(error);
    setSyncState("บันทึกไม่สำเร็จ", "error");
    alert("เปลี่ยนสถานะงานไม่สำเร็จ");
  }
});

$("edit-freelance").addEventListener("click", () => {
  if (selectedFreelanceId !== null) openEditFreelance(selectedFreelanceId);
});

$("delete-freelance").addEventListener("click", async () => {
  const project = freelanceProjects.find(item => item.id === String(selectedFreelanceId));
  if (!project || !confirm(`ต้องการลบโปรเจกต์ "${project.name}" ใช่หรือไม่?`)) return;

  try {
    setSyncState("กำลังลบงานนอก...", "busy");
    await deleteDoc(userDoc("freelance", project.id));
    selectedFreelanceId = null;
    freelanceDetailModal.classList.remove("show");
  } catch (error) {
    console.error(error);
    setSyncState("ลบงานนอกไม่สำเร็จ", "error");
    alert("ลบโปรเจกต์ไม่สำเร็จ");
  }
});

$("plan-prev-day").addEventListener("click", () => {
  planDate.setDate(planDate.getDate() - 1);
  renderTaskPage();
});

$("plan-next-day").addEventListener("click", () => {
  planDate.setDate(planDate.getDate() + 1);
  renderTaskPage();
});

$("plan-go-today").addEventListener("click", () => {
  const today = new Date();
  planDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  renderTaskPage();
});

$("plan-date-input").addEventListener("change", event => {
  if (!event.target.value) return;
  planDate = dateFromKey(event.target.value);
  renderTaskPage();
});

sourceSearch.addEventListener("input", renderSourcePicker);
document.querySelectorAll(".source-filter").forEach(button => {
  button.addEventListener("click", () => {
    sourcePickerFilter = button.dataset.sourceFilter;
    document.querySelectorAll(".source-filter").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    renderSourcePicker();
  });
});
$("add-selected-sources").addEventListener("click", addSelectedSourcesToPlan);
$("close-source-picker").addEventListener("click", () => sourcePickerModal.classList.remove("show"));
$("open-task-source").addEventListener("click", () => {
  const task = tasks.find(item => item.id === String(selectedTaskId));
  if (task) openTaskSource(task);
});

function closeModal(modal) {
  modal.classList.remove("show");
}

[
  [$("close-event-form"), eventModal],
  [$("close-event-detail"), eventDetailModal],
  [$("close-task-form"), taskModal],
  [$("close-task-detail"), taskDetailModal],
  [$("close-freelance-form"), freelanceModal],
  [$("close-freelance-detail"), freelanceDetailModal]
].forEach(([button, modal]) => {
  button.addEventListener("click", () => closeModal(modal));
});

[eventModal, eventDetailModal, taskModal, taskDetailModal, freelanceModal, freelanceDetailModal, sourcePickerModal].forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal(modal);
  });
});

// =========================================================
// PWA + LOCAL NOTIFICATION
// =========================================================

let swRegistration = null;

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    swRegistration = await navigator.serviceWorker.register("./sw.js");
    await navigator.serviceWorker.ready;
  } catch (error) {
    console.error("Service worker:", error);
  }
}

function isStandaloneMode() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

function updateNotificationStatus() {
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (!("Notification" in window)) {
    notificationStatus.textContent = isIOS && !isStandaloneMode()
      ? "บน iPhone ให้ Add to Home Screen แล้วเปิดจากไอคอนก่อน"
      : "เบราว์เซอร์นี้ยังไม่รองรับ Notification API";
    return;
  }

  if (Notification.permission === "granted") {
    notificationStatus.textContent = "เปิดแล้ว • พร้อมแจ้งเตือนขณะ Planner ทำงาน";
  } else if (Notification.permission === "denied") {
    notificationStatus.textContent = "ถูกปฏิเสธ • ต้องเปิดสิทธิ์จาก Settings";
  } else {
    notificationStatus.textContent = "ยังไม่ได้เปิดการแจ้งเตือน";
  }
}

async function enableNotifications() {
  if (!("Notification" in window)) {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    alert(isIOS
      ? "บน iPhone ให้เปิดเว็บด้วย Safari → Add to Home Screen → เปิด My Planner จากไอคอน แล้วลองอีกครั้ง"
      : "อุปกรณ์นี้ยังไม่รองรับ Notification API");
    return;
  }

  const permission = await Notification.requestPermission();
  updateNotificationStatus();
  if (permission === "granted") {
    await showNotification("My Planner", "เปิดการแจ้งเตือนเรียบร้อยแล้ว", "planner-enabled");
  }
}

async function showNotification(title, body, tag = "planner") {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const registration = swRegistration || await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    body,
    tag,
    icon: "./icon.svg",
    badge: "./icon.svg",
    data: { url: "./" }
  });
}

$("enable-notifications").addEventListener("click", enableNotifications);
$("test-notification").addEventListener("click", async () => {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    alert("กด 'เปิดแจ้งเตือน' ก่อนครับ");
    return;
  }
  await showNotification("ทดสอบ My Planner", "ถ้าเห็นข้อความนี้ แปลว่าการแจ้งเตือนทำงานแล้ว", `planner-test-${Date.now()}`);
});

function notificationKey(eventId, offset) {
  return `planner-notified-${eventId}-${offset}`;
}

async function checkDueReminders() {
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const now = Date.now();

  for (const event of events) {
    const start = new Date(`${event.date}T${event.startTime}:00`).getTime();

    for (const offset of event.reminders || []) {
      const due = start - offset * 60000;
      const key = notificationKey(event.id, offset);

      if (now >= due && now - due < 120000 && !localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        await showNotification(
          event.title,
          `${reminderText([offset])} • ${event.startTime}${event.location ? ` • ${event.location}` : ""}`,
          key
        );
      }
    }
  }
}

setInterval(checkDueReminders, 30000);

// =========================================================
// EXPORT .ICS
// =========================================================

function pad2(number) {
  return String(number).padStart(2, "0");
}

function icsLocalDate(dateKey, time) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return `${year}${pad2(month)}${pad2(day)}T${pad2(hour)}${pad2(minute)}00`;
}

function escapeICS(value = "") {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function exportEventICS(event) {
  let alarms = "";

  (event.reminders || []).forEach(minutes => {
    alarms += `BEGIN:VALARM\r\nTRIGGER:-PT${minutes}M\r\nACTION:DISPLAY\r\nDESCRIPTION:${escapeICS(event.title)}\r\nEND:VALARM\r\n`;
  });

  const endDate = eventEndDate(event);
  const dtEndLine = endDate !== event.date
    ? `DTEND:${icsLocalDate(endDate, "23:59")}\r\n`
    : "";

  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//My Planner//TH\r\nCALSCALE:GREGORIAN\r\nBEGIN:VEVENT\r\nUID:${event.id}@my-planner\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z")}\r\nDTSTART:${icsLocalDate(event.date, event.startTime)}\r\n${dtEndLine}SUMMARY:${escapeICS(event.title)}\r\nLOCATION:${escapeICS(event.location)}\r\nDESCRIPTION:${escapeICS(event.note)}\r\n${alarms}END:VEVENT\r\nEND:VCALENDAR\r\n`;

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `my-planner-${event.date}.ics`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

$("export-calendar").addEventListener("click", () => {
  const event = events.find(item => item.id === String(selectedEventId));
  if (event) exportEventICS(event);
});

// =========================================================
// START
// =========================================================

registerServiceWorker().then(() => {
  updateNotificationStatus();
  checkDueReminders();
});

saveLocalBackup();
renderEverything();
