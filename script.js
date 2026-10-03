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
  serverTimestamp
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
  government: { name: "งานราชการ", icon: "🏛️", color: "#2878ff" },
  freelance: { name: "งานออกแบบ", icon: "💼", color: "#8b5cf6" },
  personal: { name: "ส่วนตัว", icon: "👤", color: "#14a673" },
  fitness: { name: "ออกกำลังกาย", icon: "🏋️", color: "#ef4e7b" },
  study: { name: "เรียน / พัฒนา", icon: "📚", color: "#e59323" },
  finance: { name: "การเงิน", icon: "💰", color: "#16a085" }
};

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
  return list.map(event => ({
    ...event,
    id: String(event.id ?? makeId("event")),
    title: event.title || "ไม่มีชื่อ",
    categories: Array.isArray(event.categories)
      ? event.categories
      : (event.category ? [event.category] : ["personal"]),
    reminders: Array.isArray(event.reminders)
      ? event.reminders.map(Number).filter(Number.isFinite)
      : [],
    date: event.date || formatDateKey(new Date()),
    startTime: event.startTime || "09:00",
    location: event.location || "",
    note: event.note || ""
  }));
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
    note: task.note || ""
  }));
}

function normalizeFreelance(list) {
  if (!Array.isArray(list)) return [];
  return list.map(project => ({
    ...project,
    id: String(project.id ?? makeId("freelance")),
    name: project.name || "ไม่มีชื่อโปรเจกต์",
    totalAmount: Math.max(0, Number(project.totalAmount) || 0),
    receivedAmount: Math.max(0, Number(project.receivedAmount) || 0)
  }));
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
  return {
    title: event.title,
    categories: event.categories,
    reminders: event.reminders,
    date: event.date,
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
    updatedAt: serverTimestamp()
  };
}

function firestoreFreelanceData(project) {
  return {
    name: project.name,
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
    .filter(event => event.date === key)
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
  detail.textContent = `${thaiDate(event.date)} • ${event.startTime}`;

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
        .filter(event => event.date === key)
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
    .filter(event => event.date === key)
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
  const todayKey = formatDateKey(new Date());
  let list = [...tasks];

  if (taskFilter === "pending") list = list.filter(task => !task.completed);
  if (taskFilter === "today") list = list.filter(task => task.date === todayKey);
  if (taskFilter === "done") list = list.filter(task => task.completed);

  list.sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;
    return a.date.localeCompare(b.date);
  });

  if (!list.length) {
    allTaskList.appendChild(emptyMessage("ยังไม่มีงานในรายการนี้"));
    return;
  }

  list.forEach(task => allTaskList.appendChild(createTaskCard(task)));
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

  card.append(name, moneyGrid);
  card.addEventListener("click", () => openFreelanceDetail(project.id));
  return card;
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

  [...freelanceProjects]
    .sort((a, b) => a.name.localeCompare(b.name, "th"))
    .forEach(project => list.appendChild(createFreelanceCard(project)));
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
// EVENT FORM / DETAIL
// =========================================================

const eventModal = $("event-modal");
const eventDetailModal = $("event-detail-modal");
const eventTitle = $("event-title");
const eventDate = $("event-date");
const eventStart = $("event-start-time");
const eventLocation = $("event-location");
const eventNote = $("event-note");

function openAddEvent(date = selectedDate) {
  editingEventId = null;
  $("event-form-title").textContent = "เพิ่มนัดหมาย";
  eventTitle.value = "";
  setChecks("event-categories", ["personal"]);
  setChecks("event-reminders", []);
  eventDate.value = formatDateKey(date);
  eventStart.value = "09:00";
  eventLocation.value = "";
  eventNote.value = "";
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
  eventStart.value = event.startTime;
  eventLocation.value = event.location;
  eventNote.value = event.note;
  eventDetailModal.classList.remove("show");
  eventModal.classList.add("show");
}

async function saveEvent() {
  if (!currentUser) return;

  const title = eventTitle.value.trim();
  const eventCategories = getChecks("event-categories");
  const reminders = getChecks("event-reminders").map(Number);
  const date = eventDate.value;
  const startTime = eventStart.value;

  if (!title || !eventCategories.length || !date || !startTime) {
    alert("กรุณากรอกชื่อ เลือกประเภท วันที่ และเวลาเริ่มให้ครบ");
    return;
  }

  const id = editingEventId || makeId("event");
  const data = {
    id,
    title,
    categories: eventCategories,
    reminders,
    date,
    startTime,
    location: eventLocation.value.trim(),
    note: eventNote.value.trim()
  };

  try {
    setSyncState("กำลังบันทึกนัดหมาย...", "busy");
    await setDoc(userDoc("events", id), firestoreEventData(data), { merge: true });

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
  $("detail-event-date").textContent = thaiDate(event.date);
  $("detail-event-time").textContent = event.startTime;
  $("detail-event-location").textContent = event.location || "ไม่ได้ระบุสถานที่";
  $("detail-event-reminders").textContent = reminderText(event.reminders);
  $("detail-event-note").textContent = event.note || "ไม่มีรายละเอียดเพิ่มเติม";
  eventDetailModal.classList.add("show");
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
    note: taskNote.value.trim()
  };

  try {
    setSyncState("กำลังบันทึกงาน...", "busy");
    await setDoc(userDoc("tasks", id), firestoreTaskData(data), { merge: true });
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
const freelanceName = $("freelance-name");
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
  freelanceName.value = "";
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
  freelanceName.value = project.name;
  freelanceTotalInput.value = String(project.totalAmount);
  freelanceReceivedInput.value = String(project.receivedAmount);
  updateFreelancePreview();
  freelanceDetailModal.classList.remove("show");
  freelanceModal.classList.add("show");
}

async function saveFreelance() {
  if (!currentUser) return;

  const name = freelanceName.value.trim();
  const totalAmount = Number(freelanceTotalInput.value);
  const receivedAmount = Number(freelanceReceivedInput.value);

  if (!name || !Number.isFinite(totalAmount) || !Number.isFinite(receivedAmount)) {
    alert("กรุณากรอกชื่อโปรเจกต์ เงินทั้งหมด และรับมาแล้วให้ครบ");
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
  const data = { id, name, totalAmount, receivedAmount };

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
  $("detail-freelance-name").textContent = project.name;
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

$("today-add-event").addEventListener("click", () => openAddEvent(new Date()));
$("calendar-add-event").addEventListener("click", () => openAddEvent(selectedDate));
$("today-add-task").addEventListener("click", () => openAddTask(new Date()));
$("calendar-add-task").addEventListener("click", () => openAddTask(selectedDate));
$("task-add-button").addEventListener("click", () => openAddTask(new Date()));
$("freelance-add-button").addEventListener("click", openAddFreelance);
$("save-event").addEventListener("click", saveEvent);
$("save-task").addEventListener("click", saveTask);
$("save-freelance").addEventListener("click", saveFreelance);

$("edit-event").addEventListener("click", () => {
  if (selectedEventId !== null) openEditEvent(selectedEventId);
});

$("delete-event").addEventListener("click", async () => {
  const event = events.find(item => item.id === String(selectedEventId));
  if (!event || !confirm(`ต้องการลบนัด "${event.title}" ใช่หรือไม่?`)) return;

  try {
    setSyncState("กำลังลบนัดหมาย...", "busy");
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

document.querySelectorAll(".filter-btn").forEach(button => {
  button.addEventListener("click", () => {
    taskFilter = button.dataset.filter;
    document.querySelectorAll(".filter-btn").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    renderTaskPage();
  });
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

[eventModal, eventDetailModal, taskModal, taskDetailModal, freelanceModal, freelanceDetailModal].forEach(modal => {
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

  const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//My Planner//TH\r\nCALSCALE:GREGORIAN\r\nBEGIN:VEVENT\r\nUID:${event.id}@my-planner\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z")}\r\nDTSTART:${icsLocalDate(event.date, event.startTime)}\r\nSUMMARY:${escapeICS(event.title)}\r\nLOCATION:${escapeICS(event.location)}\r\nDESCRIPTION:${escapeICS(event.note)}\r\n${alarms}END:VEVENT\r\nEND:VCALENDAR\r\n`;

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
