/**
 * Расписание колледжа для Telegram Mini App.
 * Данные: schedule_theory.json и schedule_practice.json рядом со страницей.
 * Практика, обычная теория и теория с подгруппами показываются вместе
 * и различаются цветом карточки и точкой в календаре.
 */

const STORAGE_KEY = "college-schedule-filters";
const NOTES_KEY = "college-schedule-notes";
const EDITS_KEY = "college-schedule-edits";
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WEEKDAYS = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KIND_ORDER = ["practice", "theory", "split"];
const KIND_LABEL = { practice: "Практика", theory: "Теория", split: "Теория" };
const KIND_WORD = { practice: "практика", theory: "теория", split: "теория с подгруппами" };
const PAIR_TIMES = {
  1: "08:00–09:40",
  2: "09:50–11:30",
  3: "11:50–13:30",
  4: "13:40–15:20",
  5: "15:40–17:20",
  6: "17:30–19:10",
  7: "19:20–21:00"
};
const SHIFT_TIMES = {
  1: "08:00–11:30",
  2: "12:15–15:45",
  3: "16:30–20:00"
};

const tg = window.Telegram?.WebApp ?? null;

const DEFAULT_COLORS = { practice: "#48d484", theory: "#3b8bfd", split: "#d93b3b" };

const state = {
  group: "",
  subgroup: "all",
  teacher: "all",
  theme: "system",
  look: "standard",
  colors: { practice: "", theory: "", split: "" },
  showGroup: false,
  showTeacher: false,
  showSubgroup: true,
  warnOnOpen: true,
  year: 0,
  month: 0,
  selected: ""
};

/** Уже отсортированные занятия: группа -> массив записей. */
const theoryByGroup = new Map();
const practiceByGroup = new Map();
const theoryByTeacher = new Map();
const practiceByTeacher = new Map();
let groups = [];
let teachers = [];
let awaitingGroup = false;
let pickerRole = "student";
let pickedGroup = "";

const loader = document.querySelector("#loader");
const errorBox = document.querySelector("#error");
const appContent = document.querySelector("#appContent");
const groupField = document.querySelector("#groupField");
const teacherField = document.querySelector("#teacherField");
const subgroupField = document.querySelector("#subgroupField");
const groupSelect = document.querySelector("#groupSelect");
const teacherSelect = document.querySelector("#teacherSelect");
const teacherNow = document.querySelector("#teacherNow");
const subgroupSelect = document.querySelector("#subgroupSelect");
const todayButton = document.querySelector("#todayButton");
const prevMonth = document.querySelector("#prevMonth");
const nextMonth = document.querySelector("#nextMonth");
const monthLabel = document.querySelector("#monthLabel");
const calendar = document.querySelector(".calendar");
const calendarViewport = document.querySelector("#calendarViewport");
const calendarTrack = document.querySelector("#calendarTrack");
let calendarPrev = document.querySelector("#calendarPrev");
let calendarGrid = document.querySelector("#calendarGrid");
let calendarNext = document.querySelector("#calendarNext");
const dayTitle = document.querySelector("#dayTitle");
const dayCount = document.querySelector("#dayCount");
const lessonsBox = document.querySelector("#lessons");
const emptyBox = document.querySelector("#empty");
const countdown = document.querySelector("#countdown");
const countdownText = document.querySelector("#countdownText");
const timeTrack = document.querySelector("#timeTrack");
const timeFill = document.querySelector("#timeFill");
const weekLabel = document.querySelector("#weekLabel");
const dayBody = document.querySelector("#dayBody");
const results = document.querySelector(".results");
const feedbackButton = document.querySelector("#feedbackButton");
const notice = document.querySelector("#notice");
const noticeButton = document.querySelector("#noticeButton");
const groupPicker = document.querySelector("#groupPicker");
const groupSearch = document.querySelector("#groupSearch");
const groupList = document.querySelector("#groupList");
const groupEmpty = document.querySelector("#groupEmpty");
const groupPickerTitle = document.querySelector("#groupPickerTitle");
const groupPickerHint = document.querySelector("#groupPickerHint");
const roleStudent = document.querySelector("#roleStudent");
const roleTeacher = document.querySelector("#roleTeacher");
const subgroupPick = document.querySelector("#subgroupPick");
const subgroupPickList = document.querySelector("#subgroupPickList");
const settings = document.querySelector("#settings");
const settingsButton = document.querySelector("#settingsButton");
const settingsClose = document.querySelector("#settingsClose");
const installButton = document.querySelector("#installButton");
const installDialog = document.querySelector("#installDialog");
const editDialog = document.querySelector("#editDialog");
const editForm = document.querySelector("#editForm");
const editTitle = document.querySelector("#editTitle");
const editNumberLabel = document.querySelector("#editNumberLabel");
const editNumber = document.querySelector("#editNumber");
const editTime = document.querySelector("#editTime");
const editSubject = document.querySelector("#editSubject");
const editSubgroup = document.querySelector("#editSubgroup");
const editRoom = document.querySelector("#editRoom");
const editError = document.querySelector("#editError");
const editClose = document.querySelector("#editClose");
const editCancel = document.querySelector("#editCancel");
const editReset = document.querySelector("#editReset");
const deleteDialog = document.querySelector("#deleteDialog");
const deleteTitle = document.querySelector("#deleteTitle");
const deleteText = document.querySelector("#deleteText");
const deleteClose = document.querySelector("#deleteClose");
const deleteCancel = document.querySelector("#deleteCancel");
const deleteConfirm = document.querySelector("#deleteConfirm");
const conflictDialog = document.querySelector("#conflictDialog");
const conflictText = document.querySelector("#conflictText");
const conflictClose = document.querySelector("#conflictClose");
const conflictCancel = document.querySelector("#conflictCancel");
const conflictConfirm = document.querySelector("#conflictConfirm");
const deletedDialog = document.querySelector("#deletedDialog");
const deletedList = document.querySelector("#deletedList");
const deletedClose = document.querySelector("#deletedClose");
const purgeDialog = document.querySelector("#purgeDialog");
const purgeText = document.querySelector("#purgeText");
const purgeClose = document.querySelector("#purgeClose");
const purgeCancel = document.querySelector("#purgeCancel");
const purgeConfirm = document.querySelector("#purgeConfirm");
const deletedButton = document.querySelector("#deletedButton");
const addButton = document.querySelector("#addButton");
const addDialog = document.querySelector("#addDialog");
const addForm = document.querySelector("#addForm");
const addClose = document.querySelector("#addClose");
const addCancel = document.querySelector("#addCancel");
const addKind = document.querySelector("#addKind");
const addSubgroupField = document.querySelector("#addSubgroupField");
const addSubgroup = document.querySelector("#addSubgroup");
const addTime = document.querySelector("#addTime");
const addNumberField = document.querySelector("#addNumberField");
const addNumberLabel = document.querySelector("#addNumberLabel");
const addNumber = document.querySelector("#addNumber");
const addSlotHint = document.querySelector("#addSlotHint");
const addTimeTextField = document.querySelector("#addTimeTextField");
const addTimeText = document.querySelector("#addTimeText");
const addSubjectField = document.querySelector("#addSubjectField");
const addSubject = document.querySelector("#addSubject");
const addSubjectTextField = document.querySelector("#addSubjectTextField");
const addSubjectText = document.querySelector("#addSubjectText");
const addOther = document.querySelector("#addOther");
const addRoom = document.querySelector("#addRoom");
const addError = document.querySelector("#addError");
const resetDayButton = document.querySelector("#resetDayButton");
const resetDayDialog = document.querySelector("#resetDayDialog");
const resetDayClose = document.querySelector("#resetDayClose");
const resetDayCancel = document.querySelector("#resetDayCancel");
const resetDayConfirm = document.querySelector("#resetDayConfirm");
const installClose = document.querySelector("#installClose");
const installSite = document.querySelector("#installSite");
const themeChoices = document.querySelector("#themeChoices");
const lookChoices = document.querySelector("#lookChoices");
const colorPractice = document.querySelector("#colorPractice");
const colorTheory = document.querySelector("#colorTheory");
const colorSplit = document.querySelector("#colorSplit");
const colorReset = document.querySelector("#colorReset");
const showGroup = document.querySelector("#showGroup");
const showTeacher = document.querySelector("#showTeacher");
const showSubgroup = document.querySelector("#showSubgroup");
const warnOnOpen = document.querySelector("#warnOnOpen");
const CONTACT_URL = "https://t.me/cyrstreming";

function formatISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISO(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function plural(count, one, few, many) {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

/** Родительный падеж после «до начала» и «до конца»: 1 минуты, 2 минут, 21 минуты. */
function genitiveMinutes(count) {
  const abs = Math.abs(count) % 100;
  const last = abs % 10;
  return last === 1 && abs !== 11 ? "минуты" : "минут";
}

/** «1 п/гр» и «1» приводятся к одному номеру. Пустое значение — занятие всей группы. */
function subgroupNumber(value) {
  if (value == null) return null;
  const match = String(value).match(/(\d+)/);
  return match ? match[1] : null;
}

function shiftNumber(value) {
  if (value == null) return 99;
  const match = String(value).match(/(\d+)/);
  return match ? Number(match[1]) : 99;
}

function formatTime(value) {
  return String(value).replace(/\s*-\s*/, "–");
}

function displayText(value, fallback) {
  if (value == null || String(value).trim() === "") return fallback;
  return String(value).trim();
}

/**
 * Общий порядок: дата, номер пары, смена, подгруппа.
 * Номер занятия по предмету считается уже в этом порядке.
 */
function compareLessons(a, b) {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  const pairA = a.pair == null || a.pair === "" ? 99 : Number(a.pair);
  const pairB = b.pair == null || b.pair === "" ? 99 : Number(b.pair);
  if (pairA !== pairB) return pairA - pairB;
  const shiftDiff = shiftNumber(a.shift) - shiftNumber(b.shift);
  if (shiftDiff !== 0) return shiftDiff;
  return (subgroupNumber(a.subgroup) || "").localeCompare(subgroupNumber(b.subgroup) || "", "ru", { numeric: true });
}

function indexByGroup(list) {
  const byGroup = new Map();
  for (const item of list) {
    if (!item || typeof item.group !== "string" || !DATE_RE.test(item.date || "")) continue;
    const group = item.group.trim();
    if (!group) continue;
    let bucket = byGroup.get(group);
    if (!bucket) {
      bucket = [];
      byGroup.set(group, bucket);
    }
    bucket.push(item);
  }
  for (const bucket of byGroup.values()) bucket.sort(compareLessons);
  return byGroup;
}

/**
 * Цвет и номер занятия считаются один раз на исходной записи.
 * Теория с номером подгруппы красится отдельно от общей теории.
 * Счётчик предмета — это занятия той же группы, того же типа и той же подгруппы.
 */
function stampLessons(byGroup, type) {
  for (const [group, lessons] of byGroup) {
    const buckets = new Map();
    for (const lesson of lessons) {
      const subgroup = subgroupNumber(lesson.subgroup);
      lesson.kind = type === "practice" ? "practice" : (subgroup ? "split" : "theory");
      lesson.id = noteKey(lesson);
      const subject = displayText(lesson.subject, "Без названия");
      const key = `${group}|${type}|${subject}|${subgroup || ""}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = [];
        buckets.set(key, bucket);
      }
      bucket.push(lesson);
    }
    for (const bucket of buckets.values()) {
      const total = bucket.length;
      bucket.forEach((lesson, index) => {
        lesson.progress = { index: index + 1, total, left: total - index - 1 };
      });
    }
  }
}

function systemScheme() {
  if (tg?.colorScheme === "dark" || tg?.colorScheme === "light") return tg.colorScheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolvedScheme() {
  return state.theme === "light" || state.theme === "dark" ? state.theme : systemScheme();
}

function applyTheme(scheme) {
  const dark = scheme === "dark";
  document.documentElement.classList.toggle("theme-dark", dark);
  document.documentElement.classList.toggle("theme-light", !dark);
  document.body.classList.toggle("theme-dark", dark);
  document.body.classList.toggle("theme-light", !dark);
  const background = dark ? "#0b132b" : "#f4f6fb";
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) themeMeta.content = background;
  if (!tg) return;
  try { tg.setHeaderColor(background); } catch (error) { /* старые клиенты */ }
  try { tg.setBackgroundColor(background); } catch (error) { /* старые клиенты */ }
  try { tg.setBottomBarColor(background); } catch (error) { /* старые клиенты */ }
}

/* Прозрачная шапка Telegram, чтобы неоновый фон доходил до надписи мини-приложения. */
function openFullscreen() {
  if (!tg || typeof tg.requestFullscreen !== "function") return;
  try {
    if (typeof tg.isVersionAtLeast === "function" && !tg.isVersionAtLeast("8.0")) return;
    if (tg.isFullscreen) return;
    tg.requestFullscreen();
  } catch (error) { /* клиент без полноэкранного режима */ }
}

function applyLook() {
  const simple = state.look === "simple";
  document.documentElement.classList.toggle("look-simple", simple);
  document.documentElement.classList.toggle("look-standard", !simple);
  document.body.classList.toggle("look-simple", simple);
  document.body.classList.toggle("look-standard", !simple);
}

function applyColors() {
  const root = document.documentElement.style;
  const map = { practice: "--c-practice", theory: "--c-theory", split: "--c-split" };
  for (const [key, variable] of Object.entries(map)) {
    if (state.colors[key]) root.setProperty(variable, state.colors[key]);
    else root.removeProperty(variable);
  }
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function parseNotesPayload(raw) {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  if (parsed.items && typeof parsed.items === "object") {
    return { savedAt: Number(parsed.savedAt) || 0, items: parsed.items };
  }
  return { savedAt: 0, items: parsed };
}

function loadNotes() {
  try {
    const payload = parseNotesPayload(localStorage.getItem(NOTES_KEY));
    if (!payload) return { savedAt: 0, items: {} };
    return payload;
  } catch (error) {
    return { savedAt: 0, items: {} };
  }
}

/** Заметка привязана к конкретной паре и остаётся только на этом устройстве. */
function noteKey(lesson) {
  return [
    lesson.date || "",
    lesson.group || "",
    lesson.kind || "",
    displayText(lesson.subject, ""),
    lesson.time || "",
    subgroupNumber(lesson.subgroup) || "",
    lesson.pair == null ? "" : String(lesson.pair),
    lesson.shift || "",
    displayText(lesson.teacher, "")
  ].join("|");
}

const loadedNotes = loadNotes();
const notes = loadedNotes.items;
let notesSavedAt = loadedNotes.savedAt;
let remoteTimer = 0;

/** DeviceStorage переживает закрытие Telegram. CloudStorage — запасной вариант. */
function noteBackend() {
  if (tg?.DeviceStorage && typeof tg.DeviceStorage.setItem === "function") return tg.DeviceStorage;
  if (tg?.CloudStorage && typeof tg.CloudStorage.setItem === "function") return tg.CloudStorage;
  return null;
}

function storageGet(store, key) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value == null ? null : String(value));
    };
    try {
      const result = store.getItem(key, (error, value) => finish(error ? null : value));
      if (result && typeof result.then === "function") {
        result.then((value) => finish(value)).catch(() => finish(null));
      }
    } catch (error) {
      finish(null);
    }
  });
}

function storageSet(store, key, value) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    try {
      const result = store.setItem(key, value, (error) => finish(!error));
      if (result && typeof result.then === "function") {
        result.then(() => finish(true)).catch(() => finish(false));
      }
    } catch (error) {
      finish(false);
    }
  });
}

function notesPayload() {
  return JSON.stringify({ savedAt: notesSavedAt, items: notes });
}

function replaceNotes(items) {
  for (const key of Object.keys(notes)) delete notes[key];
  Object.assign(notes, items || {});
}

let remoteChain = Promise.resolve();

function writeRemote(prefix, payload, savedAt) {
  remoteChain = remoteChain.then(() => writeRemoteNow(prefix, payload, savedAt)).catch(() => {});
}

async function writeRemoteNow(prefix, payload, savedAt) {
  const store = noteBackend();
  if (!store) return;
  const chunks = [];
  for (let index = 0; index < payload.length; index += 3500) {
    chunks.push(payload.slice(index, index + 3500));
  }
  if (!chunks.length) chunks.push("");
  const saved = await storageSet(store, prefix, JSON.stringify({ n: chunks.length, savedAt }));
  if (!saved) return;
  for (let index = 0; index < chunks.length; index += 1) {
    await storageSet(store, `${prefix}-${index}`, chunks[index]);
  }
}

async function readRemote(prefix, parse) {
  const store = noteBackend();
  if (!store) return null;
  const metaRaw = await storageGet(store, prefix);
  if (!metaRaw) return null;
  try {
    const meta = JSON.parse(metaRaw);
    const count = Number(meta.n) || 0;
    let payload = "";
    for (let index = 0; index < count; index += 1) {
      const part = await storageGet(store, `${prefix}-${index}`);
      if (part == null) return null;
      payload += part;
    }
    return (parse || parseNotesPayload)(payload);
  } catch (error) {
    return null;
  }
}

/** Подтягивает заметки, записанные до закрытия, и не затирает более свежую копию. */
async function restoreNotes() {
  const remote = await readRemote("cs-notes");
  if (!remote) {
    if (Object.keys(notes).length) writeRemote("cs-notes", notesPayload(), notesSavedAt);
    return;
  }
  if (remote.savedAt > notesSavedAt) {
    replaceNotes(remote.items);
    notesSavedAt = remote.savedAt;
    try {
      localStorage.setItem(NOTES_KEY, notesPayload());
    } catch (error) {
      /* Локальная копия необязательна, если есть хранилище Telegram. */
    }
    if (!appContent.hidden) render();
    return;
  }
  if (notesSavedAt > remote.savedAt || Object.keys(notes).length) writeRemote("cs-notes", notesPayload(), notesSavedAt);
}

function saveNotes() {
  notesSavedAt = Date.now();
  const payload = notesPayload();
  try {
    localStorage.setItem(NOTES_KEY, payload);
  } catch (error) {
    /* В приватном режиме браузер может запретить localStorage. */
  }
  window.clearTimeout(remoteTimer);
  remoteTimer = window.setTimeout(() => writeRemote("cs-notes", payload, notesSavedAt), 200);
}

function flushNotes() {
  window.clearTimeout(remoteTimer);
  if (!notesSavedAt && !Object.keys(notes).length) return;
  if (!notesSavedAt) notesSavedAt = Date.now();
  const payload = notesPayload();
  try {
    localStorage.setItem(NOTES_KEY, payload);
  } catch (error) {
    /* Локальная копия необязательна, если есть хранилище Telegram. */
  }
  writeRemote("cs-notes", payload, notesSavedAt);
}

function normalizeAdded(item) {
  if (!item || typeof item !== "object" || !item.id || !DATE_RE.test(String(item.date || ""))) return null;
  const kind = item.kind === "practice" || item.kind === "split" || item.kind === "theory" ? item.kind : "theory";
  return {
    id: String(item.id),
    added: true,
    date: String(item.date),
    group: item.group ? String(item.group) : "",
    teacher: item.teacher ? String(item.teacher) : "",
    kind,
    subject: item.subject ? String(item.subject).trim() : "",
    time: item.time ? formatTime(item.time) : "",
    pair: item.pair == null || item.pair === "" ? "" : String(item.pair),
    shift: item.shift ? String(item.shift) : "",
    subgroup: subgroupNumber(item.subgroup) || "",
    room: item.room ? String(item.room).trim() : ""
  };
}

function parseEditsPayload(raw) {
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const added = Array.isArray(parsed.added) ? parsed.added.map(normalizeAdded).filter(Boolean) : [];
  if (parsed.items && typeof parsed.items === "object" && !Array.isArray(parsed.items)) {
    return { savedAt: Number(parsed.savedAt) || 0, items: parsed.items, added };
  }
  return { savedAt: 0, items: parsed, added };
}

function loadEditsStore() {
  try {
    return parseEditsPayload(localStorage.getItem(EDITS_KEY)) || { savedAt: 0, items: {}, added: [] };
  } catch (error) {
    return { savedAt: 0, items: {}, added: [] };
  }
}

const loadedEdits = loadEditsStore();
const edits = loadedEdits.items;
const addedLessons = loadedEdits.added;
let editsSavedAt = loadedEdits.savedAt;
let addCustomSubject = false;
let editsTimer = 0;
let editingId = "";
let purgingId = "";
let pendingConflict = null;

function loadNotesFrom(key) {
  try {
    const payload = parseNotesPayload(localStorage.getItem(key));
    return payload || { savedAt: 0, items: {} };
  } catch (error) {
    return { savedAt: 0, items: {} };
  }
}

function editsPayload() {
  return JSON.stringify({ savedAt: editsSavedAt, items: edits, added: addedLessons });
}

function replaceEdits(items, added) {
  for (const key of Object.keys(edits)) delete edits[key];
  Object.assign(edits, items || {});
  addedLessons.splice(0, addedLessons.length, ...(added || []));
}

async function restoreEdits() {
  const remote = await readRemote("cs-edits", parseEditsPayload);
  if (!remote) {
    if (Object.keys(edits).length || addedLessons.length) writeRemote("cs-edits", editsPayload(), editsSavedAt);
    return;
  }
  if (remote.savedAt > editsSavedAt) {
    replaceEdits(remote.items, remote.added);
    editsSavedAt = remote.savedAt;
    try { localStorage.setItem(EDITS_KEY, editsPayload()); } catch (error) { /* локальная копия необязательна */ }
    if (!appContent.hidden) render();
    return;
  }
  if (editsSavedAt > remote.savedAt || Object.keys(edits).length || addedLessons.length) writeRemote("cs-edits", editsPayload(), editsSavedAt);
}

function saveEdits() {
  editsSavedAt = Date.now();
  const payload = editsPayload();
  try { localStorage.setItem(EDITS_KEY, payload); } catch (error) { /* хранилище может быть запрещено */ }
  window.clearTimeout(editsTimer);
  editsTimer = window.setTimeout(() => writeRemote("cs-edits", payload, editsSavedAt), 200);
}

function flushEdits() {
  window.clearTimeout(editsTimer);
  if (!editsSavedAt && !Object.keys(edits).length && !addedLessons.length) return;
  if (!editsSavedAt) editsSavedAt = Date.now();
  const payload = editsPayload();
  try { localStorage.setItem(EDITS_KEY, payload); } catch (error) { /* локальная копия необязательна */ }
  writeRemote("cs-edits", payload, editsSavedAt);
}

/** Личная правка не меняет общий файл: в карточке показывается копия. */
function viewLesson(lesson) {
  const edit = edits[lesson.id];
  if (!edit) return lesson;
  if (edit.deleted) return null;
  const copy = { ...lesson, personal: true };
  if (edit.time != null) copy.time = edit.time;
  if (edit.subject != null) copy.subject = edit.subject;
  if (edit.subgroup != null) copy.subgroup = edit.subgroup;
  if (edit.room != null) copy.room = edit.room;
  if (edit.pair != null && edit.pair !== "") copy.pair = edit.pair;
  if (edit.shift != null && edit.shift !== "") copy.shift = edit.shift;
  if (lesson.kind !== "practice") copy.kind = subgroupNumber(copy.subgroup) ? "split" : "theory";
  return copy;
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      group: state.group,
      subgroup: state.subgroup,
      teacher: state.teacher,
      theme: state.theme,
      look: state.look,
      colors: state.colors,
      showGroup: state.showGroup,
      showTeacher: state.showTeacher,
      showSubgroup: state.showSubgroup,
      warnOnOpen: state.warnOnOpen,
      subgroupMenu: 3,
      listsDefault: 2,
      pickerReset: 2
    }));
  } catch (error) {
    /* В приватном режиме браузер может запретить localStorage. */
  }
}

/**
 * Фильтр списка.
 * Если преподаватель не выбран, список ограничен группой и включает оба типа занятий.
 * Если выбран, показываются его занятия во всех группах: так преподаватель
 * видит свой день, а студент — у какой группы он сейчас.
 * Подгруппа скрывает чужие подгруппы. Занятие без подгруппы остаётся: оно общее.
 */
function addedForView() {
  if (state.teacher !== "all") return addedLessons.filter((lesson) => lesson.teacher === state.teacher);
  return addedLessons.filter((lesson) => lesson.group === state.group && !lesson.teacher);
}

function sourceLessons() {
  const own = addedForView();
  if (state.teacher !== "all") {
    return [
      ...(practiceByTeacher.get(state.teacher) || []),
      ...(theoryByTeacher.get(state.teacher) || []),
      ...own
    ];
  }
  if (!state.group) return own;
  return [
    ...(practiceByGroup.get(state.group) || []),
    ...(theoryByGroup.get(state.group) || []),
    ...own
  ];
}

/**
 * Подгруппа скрывает чужие занятия. Занятие без номера остаётся: оно на всю группу.
 * Теория делится только на две подгруппы, поэтому третья учится со второй.
 */
function lessonMatchesSubgroup(lesson) {
  if (state.subgroup === "all") return true;
  const number = subgroupNumber(lesson.subgroup);
  if (!number) return true;
  if (number === state.subgroup) return true;
  return lesson.kind === "split" && state.subgroup === "3" && number === "2";
}

function filteredLessons() {
  return sourceLessons().map(viewLesson).filter(Boolean).filter(lessonMatchesSubgroup).sort(compareLessons);
}

/** Неделя считается от понедельника той недели, в которую попадает 1 сентября. */
function academicWeekNumber(iso) {
  const date = parseISO(iso);
  const startYear = date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  const mondayOf = (value) => {
    const copy = new Date(value.getFullYear(), value.getMonth(), value.getDate());
    copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
    return copy;
  };
  const weeks = Math.round((mondayOf(date) - mondayOf(new Date(startYear, 8, 1))) / 86400000 / 7);
  return weeks + 1;
}

function lessonIsPast(lesson, today, nowMinutes) {
  if (lesson.date < today) return true;
  if (lesson.date > today) return false;
  const span = lessonMinutes(lesson);
  return Boolean(span) && nowMinutes >= span[1];
}

function indexByTeacher(byGroup) {
  const byTeacher = new Map();
  for (const lessons of byGroup.values()) {
    for (const lesson of lessons) {
      const name = lesson.teacher == null ? "" : String(lesson.teacher).trim();
      if (!name) continue;
      let bucket = byTeacher.get(name);
      if (!bucket) {
        bucket = [];
        byTeacher.set(name, bucket);
      }
      bucket.push(lesson);
    }
  }
  for (const bucket of byTeacher.values()) bucket.sort(compareLessons);
  return byTeacher;
}

function syncSubgroupOptions() {
  const numbers = new Set();
  for (const lesson of sourceLessons()) {
    const number = subgroupNumber(lesson.subgroup);
    if (number) numbers.add(number);
  }
  const sorted = [...numbers].sort((a, b) => Number(a) - Number(b));
  subgroupSelect.replaceChildren();
  subgroupSelect.add(new Option("Все", "all"));
  for (const number of sorted) subgroupSelect.add(new Option(number, number));
  if (state.subgroup !== "all" && !sorted.includes(state.subgroup)) state.subgroup = "all";
  subgroupSelect.value = state.subgroup;
}

function syncFilters() {
  const byTeacher = state.teacher !== "all";
  groupSelect.disabled = byTeacher;
  groupField.classList.toggle("is-disabled", byTeacher);
}

function lessonMinutes(lesson) {
  if (!lesson.time) return null;
  const match = String(lesson.time).match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return [Number(match[1]) * 60 + Number(match[2]), Number(match[3]) * 60 + Number(match[4])];
}

function minutesFromNow(iso, minuteOfDay, today, nowMinutes) {
  const days = Math.round((parseISO(iso).getTime() - parseISO(today).getTime()) / 86400000);
  return days * 1440 + minuteOfDay - nowMinutes;
}

function formatAhead(mins) {
  if (mins < 60) return `${mins} ${genitiveMinutes(mins)}`;
  if (mins < 1440) {
    const hours = Math.floor(mins / 60);
    const rest = mins % 60;
    const hoursText = `${hours} ${plural(hours, "час", "часа", "часов")}`;
    return rest ? `${hoursText} ${rest} ${genitiveMinutes(rest)}` : hoursText;
  }
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  const daysText = `${days} ${plural(days, "день", "дня", "дней")}`;
  return hours ? `${daysText} ${hours} ${plural(hours, "час", "часа", "часов")}` : daysText;
}

function lessonClockKind(lesson) {
  return lesson.kind === "practice" ? "practice" : "theory";
}

function countdownName(kind) {
  if (kind === "practice") return "практики";
  if (kind === "both") return "занятия";
  return "теории";
}

/**
 * Ближайшее занятие с часами: пара теории или смена практики.
 * Текст называет тип этого занятия. Если до него больше 15 часов, строка скрыта.
 * Красный — до начала 30 минут и меньше. Зелёный — до конца 10 минут и меньше.
 */
function refreshPastLessons() {
  const now = new Date();
  const today = formatISO(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  for (const article of lessonsBox.querySelectorAll(".lesson")) {
    const end = Number(article.dataset.end);
    const date = article.dataset.date || "";
    const past = date < today || (date === today && end > 0 && nowMinutes >= end);
    article.classList.toggle("is-past", past);
  }
}

/**
 * Ближайшее занятие с часами: пара теории или смена практики.
 * Текст называет тип этого занятия. Если до него больше 15 часов, строка скрыта.
 * Красный — до начала 30 минут и меньше. Зелёный — до конца 10 минут и меньше.
 * Ползунок есть только у текущей пары: к концу он доходит до правого края.
 */
function renderCountdown() {
  const now = new Date();
  const today = formatISO(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowSeconds = nowMinutes * 60 + now.getSeconds();
  let current = null;
  let next = null;

  for (const lesson of filteredLessons()) {
    const span = lessonMinutes(lesson);
    if (!span) continue;
    const kind = lessonClockKind(lesson);
    if (lesson.date === today && nowMinutes >= span[0] && nowMinutes < span[1]) {
      const left = span[1] - nowMinutes;
      if (!current || left < current.left) current = { left, kind, start: span[0], end: span[1] };
      else if (left === current.left && kind !== current.kind) current.kind = "both";
    } else {
      const until = minutesFromNow(lesson.date, span[0], today, nowMinutes);
      if (until <= 0) continue;
      if (!next || until < next.until) next = { until, kind };
      else if (until === next.until && kind !== next.kind) next.kind = "both";
    }
  }

  refreshPastLessons();

  if (current) {
    countdown.hidden = false;
    countdown.className = `countdown${current.left <= 10 ? " is-ending" : ""}`;
    countdownText.textContent = `До конца ${countdownName(current.kind)} ${formatAhead(current.left)}`;
    const progress = (nowSeconds - current.start * 60) / ((current.end - current.start) * 60);
    timeTrack.hidden = false;
    timeFill.style.width = `${Math.min(100, Math.max(0, progress * 100))}%`;
    return;
  }
  timeTrack.hidden = true;
  timeFill.style.width = "0%";
  if (next && next.until <= 15 * 60) {
    countdown.hidden = false;
    countdown.className = `countdown${next.until <= 30 ? " is-soon" : ""}`;
    countdownText.textContent = `До начала ${countdownName(next.kind)} ${formatAhead(next.until)}`;
    return;
  }
  countdown.hidden = true;
  countdownText.textContent = "";
  countdown.className = "countdown";
}

function describeByGroup(lessons) {
  const byGroup = new Map();
  for (const lesson of lessons) {
    let subjects = byGroup.get(lesson.group);
    if (!subjects) {
      subjects = new Set();
      byGroup.set(lesson.group, subjects);
    }
    const subject = lesson.subject == null ? "" : String(lesson.subject).trim();
    if (subject) subjects.add(subject);
  }
  return [...byGroup.entries()].map(([group, subjects]) => {
    const list = [...subjects];
    return list.length ? `${group}: ${list.join(", ")}` : group;
  }).join("; ");
}

/** Для выбранного преподавателя показывает, где он занят сегодня. */
function renderTeacherNow() {
  if (state.teacher === "all") {
    teacherNow.hidden = true;
    teacherNow.textContent = "";
    return;
  }
  const today = formatISO(new Date());
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const todayLessons = filteredLessons().filter((lesson) => lesson.date === today);
  const current = todayLessons.filter((lesson) => {
    const span = lessonMinutes(lesson);
    return span && minutes >= span[0] && minutes < span[1];
  });
  teacherNow.hidden = false;
  if (current.length) {
    teacherNow.textContent = `Сейчас ${describeByGroup(current)}`;
    return;
  }
  if (todayLessons.length) {
    teacherNow.textContent = `Сегодня: ${describeByGroup(todayLessons)}`;
    return;
  }
  teacherNow.textContent = "Сегодня у этого преподавателя занятий нет";
}

function setToday() {
  const now = new Date();
  state.year = now.getFullYear();
  state.month = now.getMonth();
  state.selected = formatISO(now);
}

/**
 * Календарь: шесть недель, неделя начинается с понедельника.
 * Точки показывают, какие типы занятий есть в дне после фильтра группы и подгруппы.
 * Один тип дополнительно закрашивает клетку. Дни соседних месяцев видны в сетке
 * текущего месяца бледными. Слева и справа заранее собраны соседние месяцы:
 * при свайпе они въезжают на место, а всё, что вышло за край календаря, обрезается.
 */
function kindsForMonth(lessons, year, month) {
  const kindsByDate = new Map();
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;
  for (const lesson of lessons) {
    if (!lesson.date.startsWith(monthPrefix)) continue;
    let kinds = kindsByDate.get(lesson.date);
    if (!kinds) {
      kinds = new Set();
      kindsByDate.set(lesson.date, kinds);
    }
    if (lesson.kind) kinds.add(lesson.kind);
  }
  return kindsByDate;
}

function fillMonth(target, year, month, kindsByDate) {
  const firstWeekday = new Date(year, month, 1).getDay();
  const offset = (firstWeekday + 6) % 7;
  const today = formatISO(new Date());
  const fragment = document.createDocumentFragment();

  for (let cell = 0; cell < 42; cell += 1) {
    const date = new Date(year, month, 1 - offset + cell);
    const iso = formatISO(date);
    const inMonth = date.getMonth() === month;
    const kinds = inMonth ? kindsByDate.get(iso) : null;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day";
    button.dataset.date = iso;
    if (!inMonth) button.classList.add("is-outside");
    if (date.getDay() === 0 || date.getDay() === 6) button.classList.add("is-weekend");
    if (iso === today) {
      button.classList.add("is-today");
      button.setAttribute("aria-current", "date");
    }
    if (iso === state.selected) button.classList.add("is-selected");
    if (kinds && kinds.has("theory") && kinds.has("split")) button.classList.add("tone-theory");
    else if (kinds && kinds.size === 1) button.classList.add(`tone-${[...kinds][0]}`);
    button.setAttribute("aria-pressed", iso === state.selected ? "true" : "false");
    const kindWords = kinds ? KIND_ORDER.filter((kind) => kinds.has(kind)).map((kind) => KIND_WORD[kind]) : [];
    button.setAttribute(
      "aria-label",
      `${date.getDate()} ${MONTHS_GEN[date.getMonth()]}${kindWords.length ? `, ${kindWords.join(", ")}` : ""}`
    );

    const number = document.createElement("span");
    number.textContent = String(date.getDate());
    const dots = document.createElement("span");
    dots.className = "dots";
    dots.setAttribute("aria-hidden", "true");
    if (kinds) {
      for (const kind of KIND_ORDER) {
        if (!kinds.has(kind)) continue;
        const dot = document.createElement("span");
        dot.className = `dot dot-${kind}`;
        dots.append(dot);
      }
    }
    button.append(number, dots);
    fragment.append(button);
  }

  target.replaceChildren(fragment);
}

/** Кнопка тускнеет, только когда на экране уже открыт сегодняшний день. */
function syncTodayButton() {
  const now = new Date();
  const showingToday = state.selected === formatISO(now)
    && state.year === now.getFullYear()
    && state.month === now.getMonth();
  todayButton.classList.toggle("is-quiet", showingToday);
  todayButton.disabled = showingToday;
}

function syncTrackAccess() {
  calendarPrev.inert = true;
  calendarNext.inert = true;
  calendarGrid.inert = false;
  calendarPrev.classList.add("is-side");
  calendarNext.classList.add("is-side");
  calendarGrid.classList.remove("is-side");
  calendarPrev.setAttribute("aria-hidden", "true");
  calendarNext.setAttribute("aria-hidden", "true");
  calendarGrid.removeAttribute("aria-hidden");
}

function renderCalendar() {
  monthLabel.textContent = `${MONTHS[state.month]} ${state.year}`;
  const lessons = filteredLessons();
  const prev = new Date(state.year, state.month - 1, 1);
  const next = new Date(state.year, state.month + 1, 1);
  fillMonth(calendarPrev, prev.getFullYear(), prev.getMonth(), kindsForMonth(lessons, prev.getFullYear(), prev.getMonth()));
  fillMonth(calendarGrid, state.year, state.month, kindsForMonth(lessons, state.year, state.month));
  fillMonth(calendarNext, next.getFullYear(), next.getMonth(), kindsForMonth(lessons, next.getFullYear(), next.getMonth()));
  syncTrackAccess();
  syncTodayButton();
}

const TRACK_CENTER = -100 / 3;

function placeTrack(percent, animate) {
  calendarTrack.classList.toggle("is-dragging", !animate);
  calendarTrack.style.transition = animate ? "transform 0.28s ease" : "none";
  calendarTrack.style.transform = `translateX(${percent}%)`;
}

function resetCalendarMotion() {
  placeTrack(TRACK_CENTER, false);
}

function changeMonth(delta) {
  const next = new Date(state.year, state.month + delta, 1);
  state.year = next.getFullYear();
  state.month = next.getMonth();
  renderCalendar();
}

function shiftMonth(delta) {
  slideToMonth(delta);
}

let slideTimer = 0;
let slideHandler = null;

function clearSlide() {
  window.clearTimeout(slideTimer);
  if (slideHandler) calendarTrack.removeEventListener("transitionend", slideHandler);
  slideTimer = 0;
  slideHandler = null;
}

/**
 * Соседний месяц уже на экране. Переставляем его в центр без скачка
 * и дорисовываем новый месяц с другого края.
 */
function adoptIncomingMonth(direction) {
  if (direction > 0) {
    const recycled = calendarPrev;
    calendarPrev = calendarGrid;
    calendarGrid = calendarNext;
    calendarNext = recycled;
  } else {
    const recycled = calendarNext;
    calendarNext = calendarGrid;
    calendarGrid = calendarPrev;
    calendarPrev = recycled;
  }
  calendarTrack.replaceChildren(calendarPrev, calendarGrid, calendarNext);
  const shown = new Date(state.year, state.month + direction, 1);
  state.year = shown.getFullYear();
  state.month = shown.getMonth();
  monthLabel.textContent = `${MONTHS[state.month]} ${state.year}`;
  const edge = new Date(state.year, state.month + direction, 1);
  fillMonth(
    direction > 0 ? calendarNext : calendarPrev,
    edge.getFullYear(),
    edge.getMonth(),
    kindsForMonth(filteredLessons(), edge.getFullYear(), edge.getMonth())
  );
  syncTodayButton();
  syncTrackAccess();
  placeTrack(TRACK_CENTER, false);
}

/** Доводит уже видимый соседний месяц до конца и оставляет его на месте. */
function slideToMonth(direction) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  clearSlide();
  if (reduce) {
    changeMonth(direction);
    resetCalendarMotion();
    return;
  }
  const page = 100 / 3;
  placeTrack(direction > 0 ? TRACK_CENTER - page : TRACK_CENTER + page, true);
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    clearSlide();
    adoptIncomingMonth(direction);
  };
  slideHandler = (event) => {
    if (event.propertyName !== "transform") return;
    settle();
  };
  calendarTrack.addEventListener("transitionend", slideHandler);
  slideTimer = window.setTimeout(settle, 360);
}

function isShift(lesson) {
  return lesson.kind === "practice";
}

function unitAccusative(lesson) {
  return isShift(lesson) ? "смену" : "пару";
}

function lessonActions(lesson) {
  const row = document.createElement("div");
  row.className = "lesson-actions";
  const name = unitAccusative(lesson);
  row.append(
    actionButton(`Изменить ${name}`, "edit", lesson.id, "M12.2 3.6l4.2 4.2M3 17l1-4.2L13.4 3.4a1.5 1.5 0 0 1 2.1 0l1.1 1.1a1.5 1.5 0 0 1 0 2.1L7.2 16 3 17z"),
    actionButton(`Удалить ${name}`, "delete", lesson.id, "M4.5 6.5h11M8 6.5V4.8h4v1.7M6.2 6.5l.6 9h6.4l.6-9")
  );
  return row;
}

function actionButton(label, action, id, path) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-btn";
  button.setAttribute("aria-label", label);
  button.dataset[action] = id;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("width", "18");
  svg.setAttribute("height", "18");
  svg.setAttribute("aria-hidden", "true");
  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.setAttribute("d", path);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", "currentColor");
  line.setAttribute("stroke-width", "1.6");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("stroke-linejoin", "round");
  svg.append(line);
  button.append(svg);
  return button;
}

function sourceById(id) {
  const added = addedLessons.find((item) => item.id === id);
  if (added) return added;
  for (const map of [theoryByGroup, practiceByGroup]) {
    for (const list of map.values()) {
      const found = list.find((item) => item.id === id);
      if (found) return found;
    }
  }
  return null;
}

function fieldsOf(lesson) {
  const shift = shiftNumber(lesson.shift);
  return {
    time: lesson.time ? formatTime(lesson.time) : "",
    subject: displayText(lesson.subject, ""),
    subgroup: subgroupNumber(lesson.subgroup) || "",
    room: lesson.room ? String(lesson.room).trim() : "",
    pair: lesson.pair == null || lesson.pair === "" ? "" : String(Number(lesson.pair) || lesson.pair),
    shift: shift === 99 ? "" : String(shift)
  };
}

function slotNumber(table, time) {
  const range = lessonMinutes({ time });
  if (!range) return "";
  for (const [number, slot] of Object.entries(table)) {
    const other = lessonMinutes({ time: slot });
    if (other && other[0] === range[0] && other[1] === range[1]) return number;
  }
  return "";
}

function syncNumberFromTime() {
  const source = sourceById(editingId);
  if (!source) return;
  const number = slotNumber(isShift(source) ? SHIFT_TIMES : PAIR_TIMES, editTime.value);
  if (number) editNumber.value = number;
}

function fillNumberOptions(lesson) {
  const shift = isShift(lesson);
  editNumberLabel.textContent = shift ? "Смена" : "Номер пары";
  const current = shift ? fieldsOf(lesson).shift : fieldsOf(lesson).pair;
  const max = shift ? 3 : 7;
  editNumber.replaceChildren();
  if (!current) editNumber.add(new Option("—", ""));
  for (let number = 1; number <= max; number += 1) editNumber.add(new Option(String(number), String(number)));
  if (current && Number(current) > max) editNumber.add(new Option(current, current));
  editNumber.value = current;
}

function openEdit(id) {
  const source = sourceById(id);
  if (!source) return;
  const view = viewLesson(source) || source;
  editingId = id;
  editTitle.textContent = `Изменить ${unitAccusative(view)}`;
  fillNumberOptions(view);
  editTime.value = view.time ? formatTime(view.time) : "";
  editSubject.value = displayText(view.subject, "");
  editSubgroup.value = subgroupNumber(view.subgroup) || "";
  editRoom.value = view.room ? String(view.room).trim() : "";
  editReset.hidden = !edits[id] || edits[id].deleted;
  editError.hidden = true;
  editDialog.hidden = false;
  syncModal();
  editSubject.focus();
}

function closeEdit() {
  editDialog.hidden = true;
  editingId = "";
  syncModal();
}

function draftFromForm(source) {
  const practice = isShift(source);
  const number = editNumber.value;
  return {
    time: editTime.value.trim() ? formatTime(editTime.value.trim()) : "",
    subject: editSubject.value.trim(),
    subgroup: editSubgroup.value,
    room: editRoom.value.trim(),
    pair: practice ? fieldsOf(source).pair : number,
    shift: practice && number ? `${number} смена` : ""
  };
}

function sameAsSource(next, source) {
  const base = fieldsOf(source);
  const shiftSame = isShift(source)
    ? (next.shift ? String(shiftNumber(next.shift)) : "") === base.shift
    : true;
  const pairSame = isShift(source) || String(next.pair || "") === base.pair;
  return shiftSame && pairSame && next.time === base.time && next.subject === base.subject && next.subgroup === base.subgroup && next.room === base.room;
}

function candidateFrom(source, next) {
  const copy = {
    ...source,
    time: next.time,
    subject: next.subject,
    subgroup: next.subgroup,
    room: next.room,
    pair: next.pair,
    shift: next.shift || source.shift
  };
  if (source.kind !== "practice") copy.kind = subgroupNumber(copy.subgroup) ? "split" : "theory";
  return copy;
}

/**
 * Практика занята только внутри своей подгруппы: смена другой подгруппы не мешает.
 * У теории пустая подгруппа — занятие всей группы, оно пересекается со всеми.
 * Третья подгруппа на теории учится вместе со второй.
 */
function audiencesOverlap(a, b) {
  const left = subgroupNumber(a.subgroup);
  const right = subgroupNumber(b.subgroup);
  if (a.kind === "practice" && b.kind === "practice") return Boolean(left) && left === right;
  if (!left || !right) return true;
  if (left === right) return true;
  return a.kind !== "practice" && b.kind !== "practice" && ((left === "2" && right === "3") || (left === "3" && right === "2"));
}

function rangesOverlap(left, right) {
  if (!left || !right) return false;
  return left[0] < right[1] && right[0] < left[1];
}

function conflictsWith(candidate, exceptId) {
  return sourceLessons().filter((lesson) => {
    if (lesson.date !== candidate.date || lesson.id === exceptId) return false;
    const edit = edits[lesson.id];
    if (edit && edit.deleted) return false;
    const other = viewLesson(lesson);
    if (!other || !audiencesOverlap(candidate, other)) return false;
    const sameSlot = isShift(candidate)
      ? shiftNumber(candidate.shift) !== 99 && shiftNumber(candidate.shift) === shiftNumber(other.shift)
      : candidate.pair != null && candidate.pair !== "" && String(Number(candidate.pair) || candidate.pair) === String(Number(other.pair) || other.pair);
    return sameSlot || rangesOverlap(lessonMinutes(candidate), lessonMinutes(other));
  }).map((lesson) => viewLesson(lesson));
}

function conflictMessage(victims) {
  const quoted = victims.map((lesson) => `«${displayText(lesson.subject, "занятие")}»`).join(", ");
  const kinds = new Set(victims.map((lesson) => lesson.kind === "practice" ? "shift" : "pair"));
  if (victims.length === 1) {
    const word = kinds.has("shift") ? "смена" : "пара";
    return `На это время уже поставлена ${word} ${quoted}. Если продолжить, она будет удалена.`;
  }
  const word = kinds.size === 1 ? (kinds.has("shift") ? "смены" : "пары") : "занятия";
  return `На это время уже поставлены ${word} ${quoted}. Если продолжить, они будут удалены.`;
}

function askConflict(victims, action) {
  pendingConflict = { victims: victims.map((lesson) => lesson.id), action };
  conflictText.textContent = conflictMessage(victims);
  conflictDialog.hidden = false;
  syncModal();
  conflictCancel.focus();
}

function closeConflict() {
  pendingConflict = null;
  conflictDialog.hidden = true;
  syncModal();
}

function confirmConflict() {
  if (!pendingConflict) return;
  for (const id of pendingConflict.victims) edits[id] = { deleted: true };
  pendingConflict.action();
  pendingConflict = null;
  conflictDialog.hidden = true;
  saveEdits();
  closeEdit();
  closeAdd();
  closeDeleted();
  syncModal();
  render();
}

function commitEdit(event) {
  event.preventDefault();
  const source = sourceById(editingId);
  if (!source) return;
  const time = editTime.value.trim();
  const subject = editSubject.value.trim();
  if (time && !lessonMinutes({ time })) {
    editError.hidden = false;
    editError.textContent = "Время укажите как 08:00–09:40";
    return;
  }
  if (!subject) {
    editError.hidden = false;
    editError.textContent = "Напишите название предмета";
    return;
  }
  const next = draftFromForm(source);
  if (sameAsSource(next, source)) {
    delete edits[editingId];
    saveEdits();
    closeEdit();
    render();
    return;
  }
  const base = fieldsOf(source);
  const slotChanged = next.time !== base.time || next.subgroup !== base.subgroup || (isShift(source)
    ? String(shiftNumber(next.shift)) !== base.shift
    : String(next.pair || "") !== base.pair);
  const victims = slotChanged ? conflictsWith(candidateFrom(source, next), source.id) : [];
  const apply = () => { edits[source.id] = next; };
  if (victims.length) {
    askConflict(victims, apply);
    return;
  }
  apply();
  saveEdits();
  closeEdit();
  render();
}

function resetEdit() {
  if (!editingId) return;
  delete edits[editingId];
  saveEdits();
  closeEdit();
  render();
}

function openDelete(id) {
  const source = sourceById(id);
  if (!source) return;
  const view = viewLesson(source) || source;
  editingId = id;
  deleteTitle.textContent = `Удалить ${unitAccusative(view)}`;
  deleteText.textContent = `Убрать ${unitAccusative(view)} «${displayText(view.subject, "это занятие")}» из вашего расписания?`;
  deleteDialog.hidden = false;
  syncModal();
  deleteCancel.focus();
}

function closeDelete() {
  deleteDialog.hidden = true;
  editingId = "";
  syncModal();
}

function confirmDelete() {
  if (!editingId || !sourceById(editingId)) return;
  edits[editingId] = { deleted: true };
  saveEdits();
  closeDelete();
  render();
}

function lessonsOfDay() {
  return sourceLessons().filter((lesson) => lesson.date === state.selected);
}

function deletedOfDay() {
  return lessonsOfDay().filter((lesson) => {
    const edit = edits[lesson.id];
    return edit && edit.deleted && !edit.purged && lessonMatchesSubgroup(lesson);
  });
}

function dayIsChanged() {
  return lessonsOfDay().some((lesson) => {
    if (lesson.added) {
      const view = viewLesson(lesson);
      return lessonMatchesSubgroup(view || lesson);
    }
    const edit = edits[lesson.id];
    if (!edit || edit.purged) return false;
    if (edit.deleted) return lessonMatchesSubgroup(lesson);
    const view = viewLesson(lesson);
    return view && lessonMatchesSubgroup(view);
  });
}

function syncDayTools() {
  const removed = deletedOfDay();
  deletedButton.hidden = removed.length === 0;
  deletedButton.textContent = removed.length ? `Удалённые · ${removed.length}` : "Удалённые";
  resetDayButton.hidden = !dayIsChanged();
}

function openDeleted() {
  deletedList.replaceChildren();
  for (const lesson of deletedOfDay()) {
    const row = document.createElement("div");
    row.className = "deleted-row";
    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = displayText(lesson.subject, "Без названия");
    const meta = document.createElement("p");
    const parts = [];
    if (isShift(lesson) && shiftNumber(lesson.shift) !== 99) parts.push(`${shiftNumber(lesson.shift)} смена`);
    else if (lesson.pair != null && lesson.pair !== "") parts.push(`${lesson.pair} пара`);
    if (lesson.time) parts.push(formatTime(lesson.time));
    meta.textContent = parts.join(" · ");
    text.append(title, meta);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn";
    button.textContent = "Вернуть";
    button.dataset.restore = lesson.id;
    const actions = document.createElement("div");
    actions.className = "deleted-actions";
    actions.append(
      button,
      actionButton("Удалить безвозвратно", "purge", lesson.id, "M4.5 6.5h11M8 6.5V4.8h4v1.7M6.2 6.5l.6 9h6.4l.6-9")
    );
    row.append(text, actions);
    deletedList.append(row);
  }
  deletedDialog.hidden = false;
  syncModal();
}

function closeDeleted() {
  deletedDialog.hidden = true;
  syncModal();
}

function openPurge(id) {
  const source = sourceById(id);
  if (!source || !edits[id] || !edits[id].deleted || edits[id].purged) return;
  purgingId = id;
  const name = displayText(source.subject, "Занятие");
  purgeText.textContent = `«${name}» будет удалено безвозвратно.`;
  purgeDialog.hidden = false;
  syncModal();
  purgeCancel.focus();
}

function closePurge() {
  purgingId = "";
  purgeDialog.hidden = true;
  syncModal();
}

function confirmPurge() {
  const id = purgingId;
  const source = sourceById(id);
  if (!source) {
    closePurge();
    return;
  }
  if (source.added) {
    const index = addedLessons.findIndex((lesson) => lesson.id === id);
    if (index >= 0) addedLessons.splice(index, 1);
    delete edits[id];
  } else {
    edits[id] = { deleted: true, purged: true };
  }
  saveEdits();
  closePurge();
  if (!deletedOfDay().length) closeDeleted();
  else openDeleted();
  render();
}

function restoreLesson(id) {
  const source = sourceById(id);
  if (!source || !edits[id] || !edits[id].deleted) return;
  const victims = conflictsWith(source, id);
  const apply = () => { delete edits[id]; };
  if (victims.length) {
    askConflict(victims, apply);
    return;
  }
  apply();
  saveEdits();
  if (!deletedOfDay().length) closeDeleted();
  else openDeleted();
  render();
}

function openResetDay() {
  resetDayDialog.hidden = false;
  syncModal();
  resetDayCancel.focus();
}

function closeResetDay() {
  resetDayDialog.hidden = true;
  syncModal();
}

function confirmResetDay() {
  const ids = new Set(lessonsOfDay().map((lesson) => lesson.id));
  for (const id of ids) {
    if (edits[id] && edits[id].purged) continue;
    delete edits[id];
  }
  for (let index = addedLessons.length - 1; index >= 0; index -= 1) {
    if (ids.has(addedLessons[index].id)) addedLessons.splice(index, 1);
  }
  saveEdits();
  closeResetDay();
  closeDeleted();
  render();
}

function groupSubjects(kind) {
  const lists = state.group
    ? [...(theoryByGroup.get(state.group) || []), ...(practiceByGroup.get(state.group) || [])]
    : sourceLessons().filter((lesson) => !lesson.added);
  const names = new Set();
  for (const lesson of lists) {
    if (lesson.added) continue;
    if (kind && lesson.kind !== kind) continue;
    const name = displayText(lesson.subject, "");
    if (name) names.add(name);
  }
  return [...names].sort((a, b) => a.localeCompare(b, "ru"));
}

function addTimeTable() {
  return addKind.value === "practice" ? SHIFT_TIMES : PAIR_TIMES;
}

function fillAddNumber() {
  const practice = addKind.value === "practice";
  addNumberLabel.textContent = practice ? "Смена" : "Номер пары";
  const max = practice ? 3 : 7;
  const current = addNumber.value;
  addNumber.replaceChildren();
  for (let number = 1; number <= max; number += 1) addNumber.add(new Option(String(number), String(number)));
  addNumber.value = current && Number(current) <= max ? current : "1";
}

function fillAddTimeOptions() {
  const table = addTimeTable();
  const current = addTime.value || "schedule";
  addTime.replaceChildren();
  addTime.add(new Option("Как в расписании", "schedule"));
  for (const [number, slot] of Object.entries(table)) addTime.add(new Option(slot, number));
  addTime.add(new Option("Своё время", "custom"));
  addTime.value = [...addTime.options].some((option) => option.value === current) ? current : "schedule";
  fillAddNumber();
  syncAddTimeFields();
}

function syncAddTimeFields() {
  const mode = addTime.value;
  addNumberField.hidden = mode !== "schedule";
  addTimeTextField.hidden = mode !== "custom";
  addSlotHint.hidden = mode !== "schedule";
  if (mode === "schedule") addSlotHint.textContent = addTimeTable()[addNumber.value] || "";
}

function syncAddKind() {
  addSubgroupField.hidden = addKind.value !== "split";
  fillAddTimeOptions();
  fillAddSubjects();
  syncAddSubjectMode();
}

function syncAddSubjectMode() {
  addSubjectField.hidden = addCustomSubject;
  addSubjectTextField.hidden = !addCustomSubject;
  addOther.textContent = addCustomSubject ? "Из списка" : "Другое";
}

function fillAddSubjects() {
  const current = addSubject.value;
  const names = groupSubjects(addKind.value === "practice" ? "practice" : "");
  addSubject.replaceChildren();
  for (const name of names) addSubject.add(new Option(name, name));
  if (names.includes(current)) addSubject.value = current;
  if (!names.length) addCustomSubject = true;
}

function openAdd() {
  if (!state.selected || (!state.group && state.teacher === "all")) return;
  addCustomSubject = false;
  const practiceDay = sourceLessons().some((lesson) => {
    if (lesson.date !== state.selected) return false;
    const view = viewLesson(lesson);
    return Boolean(view && view.kind === "practice");
  });
  addKind.value = practiceDay ? "practice" : "theory";
  addSubgroup.value = state.subgroup === "1" || state.subgroup === "2" || state.subgroup === "3" ? state.subgroup : "1";
  addRoom.value = "";
  addSubjectText.value = "";
  addTimeText.value = "";
  addNumber.value = "1";
  fillAddSubjects();
  syncAddKind();
  addTime.value = "schedule";
  syncAddTimeFields();
  syncAddSubjectMode();
  addError.hidden = true;
  addDialog.hidden = false;
  syncModal();
  if (addCustomSubject) addSubjectText.focus();
  else addSubject.focus();
}

function closeAdd() {
  addDialog.hidden = true;
  syncModal();
}

function draftAddedLesson() {
  const kind = addKind.value === "practice" || addKind.value === "split" ? addKind.value : "theory";
  const practice = kind === "practice";
  const table = practice ? SHIFT_TIMES : PAIR_TIMES;
  const mode = addTime.value;
  let number = "";
  let time = "";
  if (mode === "schedule") {
    number = addNumber.value || "1";
    time = table[number] || "";
  } else if (mode === "custom") {
    time = addTimeText.value.trim() ? formatTime(addTimeText.value.trim()) : "";
    number = slotNumber(table, time);
  } else {
    number = mode;
    time = table[number] || "";
  }
  const subject = (addCustomSubject ? addSubjectText.value : addSubject.value).trim();
  return {
    id: `added-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    added: true,
    date: state.selected,
    group: state.teacher === "all" ? state.group : "",
    teacher: state.teacher !== "all" ? state.teacher : "",
    kind,
    subject,
    time,
    pair: practice ? "" : number,
    shift: practice && number ? `${number} смена` : "",
    subgroup: kind === "split"
      ? (addSubgroup.value || "1")
      : practice
        ? (state.subgroup === "1" || state.subgroup === "2" || state.subgroup === "3" ? state.subgroup : "1")
        : "",
    room: addRoom.value.trim()
  };
}

function commitAdd(event) {
  event.preventDefault();
  const lesson = draftAddedLesson();
  if (!lesson.subject) {
    addError.hidden = false;
    addError.textContent = "Выберите предмет или напишите своё название";
    return;
  }
  if (!lesson.time || !lessonMinutes(lesson)) {
    addError.hidden = false;
    addError.textContent = "Время укажите как 08:00–09:40";
    return;
  }
  const victims = conflictsWith(lesson, lesson.id);
  const apply = () => { addedLessons.push(lesson); };
  if (victims.length) {
    askConflict(victims, apply);
    return;
  }
  apply();
  saveEdits();
  closeAdd();
  render();
}

function roomRow(lesson) {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  term.textContent = "Аудитория";
  const description = document.createElement("dd");
  const room = document.createElement("span");
  room.textContent = displayText(lesson.room, "Не указана");
  const note = document.createElement("span");
  note.className = "room-note";
  note.textContent = "Кабинет может не соответствовать расписанию";
  description.append(room, note);
  row.append(term, description);
  return row;
}

function detailRow(label, value) {
  const row = document.createElement("div");
  const term = document.createElement("dt");
  term.textContent = label;
  const description = document.createElement("dd");
  description.textContent = value;
  row.append(term, description);
  return row;
}

function doneMark() {
  const mark = document.createElement("span");
  mark.className = "lesson-done";
  mark.setAttribute("aria-hidden", "true");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 20 20");
  svg.setAttribute("width", "15");
  svg.setAttribute("height", "15");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M4.5 10.4 8 13.8 15.5 6.2");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  mark.append(svg);
  return mark;
}

function badge(text, className) {
  const chip = document.createElement("span");
  chip.className = className ? `badge ${className}` : "badge";
  chip.textContent = text;
  return chip;
}

function progressLine(progress) {
  const line = document.createElement("p");
  line.className = "progress";
  const index = document.createElement("strong");
  index.textContent = `${progress.index}-е`;
  const total = document.createElement("strong");
  total.textContent = String(progress.total);
  const left = document.createElement("strong");
  left.textContent = String(progress.left);
  line.append(
    "Это ",
    index,
    " занятие из ",
    total,
    ". Осталось ",
    left,
    ` ${plural(progress.left, "занятие", "занятия", "занятий")}.`
  );
  return line;
}

function noteField(lesson, chips) {
  const key = lesson.id || noteKey(lesson);
  const wrap = document.createElement("label");
  wrap.className = "note";
  const caption = document.createElement("span");
  caption.textContent = "Заметка для себя";
  const field = document.createElement("textarea");
  field.rows = 3;
  field.maxLength = 500;
  field.placeholder = "Например, домашнее задание";
  field.value = notes[key] || "";
  const mark = () => {
    let badgeNode = chips.querySelector(".badge-note");
    const text = field.value.trim();
    if (!text) {
      if (badgeNode) badgeNode.remove();
      if (!chips.childElementCount) chips.remove();
      return;
    }
    if (!badgeNode) {
      badgeNode = badge("Заметка", "badge-note");
      chips.append(badgeNode);
    }
  };
  field.addEventListener("input", () => {
    const text = field.value.trim();
    if (text) notes[key] = field.value;
    else delete notes[key];
    saveNotes();
    mark();
  });
  mark();
  wrap.append(caption, field);
  return wrap;
}

/**
 * Аккордеон: свёрнутая карточка — это кнопка, раскрытие не перезагружает список.
 * Высота анимируется через grid-template-rows в CSS, стрелка поворачивается
 * классом is-open. Повторный клик сворачивает ту же карточку.
 * Внизу раскрытой карточки — номер этого занятия по предмету и сколько их ещё осталось.
 */
function createLessonCard(lesson, index) {
  const now = new Date();
  const article = document.createElement("article");
  article.className = `lesson kind-${lesson.kind || "theory"}`;
  article.dataset.date = lesson.date;
  const span = lessonMinutes(lesson);
  if (span) article.dataset.end = String(span[1]);
  const past = lessonIsPast(lesson, formatISO(now), now.getHours() * 60 + now.getMinutes());
  if (past) article.classList.add("is-past");

  const head = document.createElement("button");
  head.type = "button";
  head.className = "lesson-head";
  head.setAttribute("aria-expanded", "false");
  head.setAttribute("aria-controls", `lesson-panel-${index}`);

  const main = document.createElement("span");
  main.className = "lesson-main";

  const metaParts = [];
  if (lesson.pair != null && lesson.pair !== "") metaParts.push(`${lesson.pair} пара`);
  if (lesson.shift) {
    const shift = shiftNumber(lesson.shift);
    if (shift !== 99) metaParts.push(`${shift} смена`);
  }
  if (lesson.time) metaParts.push(formatTime(lesson.time));
  if (metaParts.length) {
    const meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = metaParts.join(" · ");
    main.append(meta);
  }

  const subject = document.createElement("span");
  subject.className = "subject";
  subject.textContent = displayText(lesson.subject, "Без названия");
  main.append(subject);

  const chips = document.createElement("span");
  chips.className = "badges";
  if (lesson.kind) chips.append(badge(KIND_LABEL[lesson.kind], `badge-${lesson.kind}`));
  if (state.teacher !== "all" && lesson.group) chips.append(badge(lesson.group));
  const subgroup = subgroupNumber(lesson.subgroup);
  if (subgroup) chips.append(badge(`${subgroup} п/гр`));
  if (lesson.elective === true) chips.append(badge("по выбору", "badge-muted"));
  if (lesson.added) chips.append(badge("своё", "badge-muted"));
  if (lesson.personal) chips.append(badge("изменено", "badge-muted"));
  if (chips.childElementCount) main.append(chips);

  const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  chevron.setAttribute("viewBox", "0 0 20 20");
  chevron.setAttribute("class", "chevron");
  chevron.setAttribute("width", "20");
  chevron.setAttribute("height", "20");
  chevron.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M5 7.5 10 12.5 15 7.5");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.8");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  chevron.append(path);

  head.append(main);
  if (past) head.append(doneMark());
  head.append(chevron);

  const panel = document.createElement("div");
  panel.className = "lesson-panel";
  panel.id = `lesson-panel-${index}`;
  panel.inert = true;
  const inner = document.createElement("div");
  inner.className = "lesson-panel-inner";
  const details = document.createElement("dl");
  details.className = "details";
  details.append(detailRow("Преподаватель", displayText(lesson.teacher, "Не указан")));
  if (lesson.kind === "theory" || lesson.kind === "split" || displayText(lesson.room, "")) {
    details.append(roomRow(lesson));
  }
  inner.append(details);
  inner.append(noteField(lesson, chips));
  if (chips.childElementCount && !chips.parentElement) main.append(chips);
  if (lesson.progress) inner.append(progressLine(lesson.progress));
  panel.append(inner);
  const top = document.createElement("div");
  top.className = "lesson-top";
  top.append(head, lessonActions(lesson));
  article.append(top, panel);

  head.addEventListener("click", () => {
    // Пока список держит фиксированную высоту, раскрытая пара уезжает под календарь.
    releaseDayHeight();
    const open = article.classList.toggle("is-open");
    panel.inert = !open;
    head.setAttribute("aria-expanded", open ? "true" : "false");
  });

  return article;
}

/**
 * Высота списка анимируется, поэтому календарь под ним не прыгает,
 * когда в выбранном дне другое число пар.
 */
function releaseDayHeight() {
  window.clearTimeout(dayBody._heightTimer);
  dayBody._heightTimer = 0;
  if (dayBody._onHeight) {
    dayBody.removeEventListener("transitionend", dayBody._onHeight);
    dayBody._onHeight = null;
  }
  dayBody.style.transition = "none";
  dayBody.style.height = "";
  dayBody.style.overflow = "";
  void dayBody.offsetHeight;
  dayBody.style.transition = "";
}

function placeDayContent(fragment, isEmpty) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  releaseDayHeight();
  const previous = dayBody.getBoundingClientRect().height;
  emptyBox.hidden = !isEmpty;
  lessonsBox.replaceChildren(fragment);
  if (reduce) return;
  const next = dayBody.scrollHeight;
  if (previous < 2 || Math.abs(previous - next) < 2) return;
  dayBody.style.overflow = "hidden";
  dayBody.style.height = `${previous}px`;
  window.requestAnimationFrame(() => {
    dayBody.style.transition = "height 0.4s ease";
    dayBody.style.height = `${next}px`;
  });
  const done = (event) => {
    if (event.propertyName && event.propertyName !== "height") return;
    releaseDayHeight();
  };
  dayBody._onHeight = done;
  dayBody.addEventListener("transitionend", done);
  dayBody._heightTimer = window.setTimeout(releaseDayHeight, 450);
}

function renderDetails() {
  const dayLessons = filteredLessons().filter((lesson) => lesson.date === state.selected);
  const selectedDate = state.selected ? parseISO(state.selected) : new Date();
  dayTitle.textContent = `${WEEKDAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS_GEN[selectedDate.getMonth()]}`;
  const week = state.selected ? academicWeekNumber(state.selected) : academicWeekNumber(formatISO(new Date()));
  weekLabel.textContent = `${week}-я учебная неделя`;
  document.title = state.teacher !== "all"
    ? `Расписание · ${state.teacher}`
    : (state.group ? `Расписание · ${state.group}` : "Расписание занятий");
  syncDayTools();

  if (!dayLessons.length) {
    dayCount.textContent = "";
    placeDayContent(document.createDocumentFragment(), true);
    return;
  }

  dayCount.textContent = `${dayLessons.length} ${plural(dayLessons.length, "занятие", "занятия", "занятий")}`;
  const fragment = document.createDocumentFragment();
  dayLessons.forEach((lesson, index) => fragment.append(createLessonCard(lesson, index)));
  placeDayContent(fragment, false);
}

function scrollToSchedule() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  results.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

function render() {
  syncFilters();
  renderTeacherNow();
  renderCountdown();
  resetCalendarMotion();
  renderCalendar();
  renderDetails();
}

function selectDate(iso, shouldScroll) {
  const date = parseISO(iso);
  state.selected = iso;
  state.year = date.getFullYear();
  state.month = date.getMonth();
  render();
  if (shouldScroll) scrollToSchedule();
}

function isTextField(element) {
  if (!element) return false;
  const tag = element.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return false;
  const type = (element.type || "text").toLowerCase();
  return !["button", "checkbox", "radio", "color", "file", "range", "submit", "reset"].includes(type);
}

/* Пока клавиатура закрывается, телефон иногда сразу возвращает фокус в поле. */
let keyboardGuard = false;

/* Свободное место убирает клавиатуру. Кнопки и другие поля не трогаем, чтобы нажатие сработало. */
function dismissKeyboard(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const hit = target.closest("input, textarea, label");
  if (hit) {
    const field = hit.matches("input, textarea") ? hit : hit.querySelector("input, textarea");
    if (isTextField(field)) {
      keyboardGuard = false;
      return;
    }
  }
  if (target.closest("button, a, select, [role='button']")) return;
  const active = document.activeElement;
  if (!isTextField(active)) return;
  event.preventDefault();
  keyboardGuard = true;
  active.blur();
  window.setTimeout(() => { keyboardGuard = false; }, 500);
}

function guardKeyboardFocus(event) {
  if (!keyboardGuard || !isTextField(event.target)) return;
  const field = event.target;
  window.setTimeout(() => {
    if (keyboardGuard && document.activeElement === field) field.blur();
  }, 0);
}

function closeOnBackdrop(overlay, close) {
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
}

let scrollLocked = false;
let lockedScroll = 0;

function syncModal() {
  const open = !notice.hidden || !groupPicker.hidden || !settings.hidden || !installDialog.hidden || !addDialog.hidden || !editDialog.hidden || !deleteDialog.hidden || !conflictDialog.hidden || !deletedDialog.hidden || !purgeDialog.hidden || !resetDayDialog.hidden;
  document.body.classList.toggle("modal-open", open);
  if (open && !scrollLocked) {
    lockedScroll = window.scrollY;
    scrollLocked = true;
    document.body.style.top = `-${lockedScroll}px`;
  } else if (!open && scrollLocked) {
    scrollLocked = false;
    document.body.style.top = "";
    window.scrollTo(0, lockedScroll);
  }
}

/* Жест по окну не прокручивает расписание под ним. */
let sheetTouchY = 0;

function rememberSheetTouch(event) {
  sheetTouchY = event.touches[0] ? event.touches[0].clientY : 0;
}

function holdSheetScroll(event) {
  if (!document.body.classList.contains("modal-open")) return;
  const overlay = event.target.closest(".overlay");
  if (!overlay || overlay.hidden) return;
  const modal = overlay.querySelector(".modal");
  const y = event.touches[0] ? event.touches[0].clientY : sheetTouchY;
  const dy = y - sheetTouchY;
  sheetTouchY = y;
  if (!modal || !modal.contains(event.target)) {
    event.preventDefault();
    return;
  }
  const canUp = modal.scrollTop > 0;
  const canDown = modal.scrollTop + modal.clientHeight < modal.scrollHeight - 1;
  if ((dy > 0 && !canUp) || (dy < 0 && !canDown)) event.preventDefault();
}

function closeNotice() {
  notice.hidden = true;
  if (awaitingGroup) {
    groupPicker.hidden = false;
    syncModal();
    groupSearch.focus();
    return;
  }
  syncModal();
}

function fillPickerList() {
  groupList.replaceChildren();
  const items = pickerRole === "student" ? groups : teachers;
  for (const item of items) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "group-option";
    if (pickerRole === "student") button.dataset.group = item;
    else button.dataset.teacher = item;
    button.textContent = item;
    if (pickerRole === "student" && item === pickedGroup) button.classList.add("is-on");
    groupList.append(button);
  }
  filterGroupList();
}

function filterGroupList() {
  const query = groupSearch.value.trim().toLocaleLowerCase("ru");
  let visible = 0;
  for (const button of groupList.querySelectorAll(".group-option")) {
    const label = button.dataset.group || button.dataset.teacher || "";
    const match = label.toLocaleLowerCase("ru").includes(query);
    button.hidden = !match;
    if (match) visible += 1;
  }
  groupEmpty.hidden = visible !== 0;
}

function subgroupNumbersFor(group) {
  const numbers = new Set();
  for (const lesson of [...(practiceByGroup.get(group) || []), ...(theoryByGroup.get(group) || [])]) {
    const number = subgroupNumber(lesson.subgroup);
    if (number) numbers.add(number);
  }
  return [...numbers].sort((a, b) => Number(a) - Number(b));
}

function showSubgroupPick(group) {
  subgroupPick.hidden = false;
  subgroupPickList.replaceChildren();
  const add = (label, value) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.subgroup = value;
    button.textContent = label;
    subgroupPickList.append(button);
  };
  add("Вся группа", "all");
  for (const number of subgroupNumbersFor(group)) add(`${number} подгруппа`, number);
}

function finishFirstChoice() {
  awaitingGroup = false;
  groupPicker.hidden = true;
  appContent.hidden = false;
  syncSubgroupOptions();
  saveState();
  setToday();
  syncModal();
  render();
}

function chooseGroup(group, subgroup) {
  state.group = group;
  state.teacher = "all";
  state.subgroup = subgroup;
  groupSelect.value = group;
  teacherSelect.value = "all";
  finishFirstChoice();
}

function chooseTeacher(name) {
  state.teacher = name;
  teacherSelect.value = name;
  state.subgroup = "all";
  if (!state.group && groups.length) {
    state.group = groups[0];
    groupSelect.value = state.group;
  }
  finishFirstChoice();
}

function setPickerRole(role) {
  pickerRole = role;
  pickedGroup = "";
  subgroupPick.hidden = true;
  roleStudent.classList.toggle("is-on", role === "student");
  roleTeacher.classList.toggle("is-on", role === "teacher");
  roleStudent.setAttribute("aria-pressed", role === "student" ? "true" : "false");
  roleTeacher.setAttribute("aria-pressed", role === "teacher" ? "true" : "false");
  groupPickerTitle.textContent = role === "student" ? "Выберите группу" : "Выберите преподавателя";
  groupPickerHint.textContent = role === "student"
    ? "Так расписание сразу откроется на вашей группе. Ниже можно выбрать подгруппу."
    : "Так откроется расписание этого преподавателя по всем группам.";
  groupSearch.placeholder = role === "student" ? "Найти группу" : "Найти преподавателя";
  groupSearch.value = "";
  fillPickerList();
}

function syncFilterVisibility() {
  groupField.hidden = !state.showGroup;
  teacherField.hidden = !state.showTeacher;
  subgroupField.hidden = !state.showSubgroup;
  groupField.parentElement.hidden = !state.showGroup && !state.showTeacher;
}

function syncSettingsControls() {
  for (const button of themeChoices.querySelectorAll("[data-theme]")) {
    button.classList.toggle("is-on", button.dataset.theme === state.theme);
  }
  for (const button of lookChoices.querySelectorAll("[data-look]")) {
    button.classList.toggle("is-on", button.dataset.look === state.look);
  }
  colorPractice.value = state.colors.practice || DEFAULT_COLORS.practice;
  colorTheory.value = state.colors.theory || DEFAULT_COLORS.theory;
  colorSplit.value = state.colors.split || DEFAULT_COLORS.split;
  showGroup.checked = state.showGroup;
  showTeacher.checked = state.showTeacher;
  showSubgroup.checked = state.showSubgroup;
  warnOnOpen.checked = state.warnOnOpen;
}

function closeSettings() {
  settings.hidden = true;
  syncModal();
}

function closeInstall() {
  installDialog.hidden = true;
  syncModal();
}

function openSettings() {
  syncSettingsControls();
  settings.hidden = false;
  syncModal();
}

function setThemeChoice(theme) {
  state.theme = theme;
  applyTheme(resolvedScheme());
  saveState();
  syncSettingsControls();
}

function setLookChoice(look) {
  state.look = look;
  applyLook();
  saveState();
  syncSettingsControls();
}

function setKindColor(key, value) {
  state.colors[key] = value.toLowerCase() === DEFAULT_COLORS[key] ? "" : value;
  applyColors();
  saveState();
}

/** В Telegram открывает чат внутри приложения. В обычном браузере срабатывает ссылка. */
function openFeedbackChat(event) {
  if (!tg || typeof tg.openTelegramLink !== "function") return;
  event.preventDefault();
  tg.openTelegramLink(CONTACT_URL);
}

/**
 * Соседний месяц уже лежит рядом и едет за пальцем.
 * Короткое нажатие выбирает день. Свайп месяца не отменяет этот выбор,
 * если палец почти не сдвинулся.
 */
function bindSwipe() {
  let drag = null;
  let blockClick = false;

  calendar.addEventListener("pointerdown", (event) => {
    if (event.button != null && event.button !== 0) return;
    if (event.target.closest("#prevMonth, #nextMonth, #todayButton")) return;
    clearSlide();
    const day = event.target.closest("[data-date]");
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      axis: "",
      captured: false,
      day: day && calendarGrid.contains(day) ? day : null
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  });

  calendar.addEventListener("pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.axis) {
      if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) * 1.15 ? "x" : "y";
    }
    if (drag.axis !== "x") return;
    if (!drag.captured) {
      drag.captured = true;
      try { calendar.setPointerCapture(event.pointerId); } catch (error) { /* жест уже завершён */ }
    }
    event.preventDefault();
    const width = Math.max(calendarViewport.clientWidth, 1);
    const limited = Math.max(-width, Math.min(width, dx));
    placeTrack(TRACK_CENTER + (limited / width) * (100 / 3), false);
  }, { passive: false });

  function endDrag(event) {
    window.removeEventListener("pointerup", endDrag);
    window.removeEventListener("pointercancel", endDrag);
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.x;
    const horizontal = drag.axis === "x";
    const day = drag.day;
    drag = null;
    if (!horizontal) return;
    const width = Math.max(calendarViewport.clientWidth, 1);
    blockClick = true;
    window.setTimeout(() => { blockClick = false; }, 400);
    if (Math.abs(dx) > Math.min(72, width * 0.22)) {
      slideToMonth(dx < 0 ? 1 : -1);
      return;
    }
    placeTrack(TRACK_CENTER, true);
    if (day) selectDate(day.dataset.date, true);
  }

  calendar.addEventListener("pointerup", endDrag);
  calendar.addEventListener("pointercancel", endDrag);

  calendar.addEventListener("click", (event) => {
    if (blockClick) {
      blockClick = false;
      if (!event.target.closest("#todayButton, #prevMonth, #nextMonth")) {
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }
    const button = event.target.closest("[data-date]");
    if (!button || !calendarGrid.contains(button)) return;
    selectDate(button.dataset.date, true);
  });
}

function bindEvents() {
  groupSelect.addEventListener("change", () => {
    state.group = groupSelect.value;
    syncSubgroupOptions();
    saveState();
    render();
  });

  teacherSelect.addEventListener("change", () => {
    state.teacher = teacherSelect.value;
    syncSubgroupOptions();
    saveState();
    render();
  });

  subgroupSelect.addEventListener("change", () => {
    state.subgroup = subgroupSelect.value;
    saveState();
    render();
  });

  todayButton.addEventListener("click", () => {
    setToday();
    render();
    scrollToSchedule();
  });

  prevMonth.addEventListener("click", () => shiftMonth(-1));
  nextMonth.addEventListener("click", () => shiftMonth(1));

  groupSearch.addEventListener("input", filterGroupList);
  roleStudent.addEventListener("click", () => setPickerRole("student"));
  roleTeacher.addEventListener("click", () => setPickerRole("teacher"));
  groupList.addEventListener("click", (event) => {
    const teacherButton = event.target.closest("[data-teacher]");
    if (teacherButton) {
      chooseTeacher(teacherButton.dataset.teacher);
      return;
    }
    const button = event.target.closest("[data-group]");
    if (!button) return;
    pickedGroup = button.dataset.group;
    for (const item of groupList.querySelectorAll("[data-group]")) {
      item.classList.toggle("is-on", item.dataset.group === pickedGroup);
    }
    showSubgroupPick(pickedGroup);
  });
  subgroupPickList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-subgroup]");
    if (!button || !pickedGroup) return;
    chooseGroup(pickedGroup, button.dataset.subgroup);
  });

  settingsButton.addEventListener("click", openSettings);
  settingsClose.addEventListener("click", closeSettings);
  themeChoices.addEventListener("click", (event) => {
    const button = event.target.closest("[data-theme]");
    if (button) setThemeChoice(button.dataset.theme);
  });
  lookChoices.addEventListener("click", (event) => {
    const button = event.target.closest("[data-look]");
    if (button) setLookChoice(button.dataset.look);
  });
  colorPractice.addEventListener("input", () => setKindColor("practice", colorPractice.value));
  colorTheory.addEventListener("input", () => setKindColor("theory", colorTheory.value));
  colorSplit.addEventListener("input", () => setKindColor("split", colorSplit.value));
  colorReset.addEventListener("click", () => {
    state.colors = { practice: "", theory: "", split: "" };
    applyColors();
    saveState();
    syncSettingsControls();
  });
  showGroup.addEventListener("change", () => {
    state.showGroup = showGroup.checked;
    syncFilterVisibility();
    saveState();
  });
  showTeacher.addEventListener("change", () => {
    state.showTeacher = showTeacher.checked;
    syncFilterVisibility();
    saveState();
  });
  showSubgroup.addEventListener("change", () => {
    state.showSubgroup = showSubgroup.checked;
    syncFilterVisibility();
    saveState();
  });
  warnOnOpen.addEventListener("change", () => {
    state.warnOnOpen = warnOnOpen.checked;
    document.documentElement.classList.toggle("no-entry-warn", !state.warnOnOpen);
    saveState();
  });

  installButton.addEventListener("click", () => {
    installDialog.hidden = false;
    syncModal();
  });
  installClose.addEventListener("click", closeInstall);
  installSite.addEventListener("click", (event) => {
    if (!tg || typeof tg.openLink !== "function") return;
    event.preventDefault();
    tg.openLink(installSite.href);
  });

  feedbackButton.addEventListener("click", openFeedbackChat);
  dayBody.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit]");
    if (edit) {
      openEdit(edit.dataset.edit);
      return;
    }
    const remove = event.target.closest("[data-delete]");
    if (remove) openDelete(remove.dataset.delete);
  });
  editForm.addEventListener("submit", commitEdit);
  editNumber.addEventListener("change", () => {
    const source = sourceById(editingId);
    const number = editNumber.value;
    if (!source || !number) return;
    const table = isShift(source) ? SHIFT_TIMES : PAIR_TIMES;
    if (table[number]) editTime.value = table[number];
  });
  editTime.addEventListener("input", syncNumberFromTime);
  editClose.addEventListener("click", closeEdit);
  editCancel.addEventListener("click", closeEdit);
  editReset.addEventListener("click", resetEdit);
  deleteClose.addEventListener("click", closeDelete);
  deleteCancel.addEventListener("click", closeDelete);
  deleteConfirm.addEventListener("click", confirmDelete);
  conflictClose.addEventListener("click", closeConflict);
  conflictCancel.addEventListener("click", closeConflict);
  conflictConfirm.addEventListener("click", confirmConflict);
  deletedButton.addEventListener("click", openDeleted);
  deletedClose.addEventListener("click", closeDeleted);
  deletedList.addEventListener("click", (event) => {
    const purge = event.target.closest("[data-purge]");
    if (purge) {
      openPurge(purge.dataset.purge);
      return;
    }
    const restore = event.target.closest("[data-restore]");
    if (restore) restoreLesson(restore.dataset.restore);
  });
  purgeClose.addEventListener("click", closePurge);
  purgeCancel.addEventListener("click", closePurge);
  purgeConfirm.addEventListener("click", confirmPurge);
  resetDayButton.addEventListener("click", openResetDay);
  resetDayClose.addEventListener("click", closeResetDay);
  resetDayCancel.addEventListener("click", closeResetDay);
  resetDayConfirm.addEventListener("click", confirmResetDay);
  addButton.addEventListener("click", openAdd);
  addForm.addEventListener("submit", commitAdd);
  addClose.addEventListener("click", closeAdd);
  addCancel.addEventListener("click", closeAdd);
  addKind.addEventListener("change", syncAddKind);
  addTime.addEventListener("change", syncAddTimeFields);
  addNumber.addEventListener("change", () => {
    if (addTime.value === "schedule") addSlotHint.textContent = addTimeTable()[addNumber.value] || "";
  });
  closeOnBackdrop(notice, closeNotice);
  closeOnBackdrop(settings, closeSettings);
  closeOnBackdrop(installDialog, closeInstall);
  closeOnBackdrop(addDialog, closeAdd);
  closeOnBackdrop(editDialog, closeEdit);
  closeOnBackdrop(deleteDialog, closeDelete);
  closeOnBackdrop(deletedDialog, closeDeleted);
  closeOnBackdrop(purgeDialog, closePurge);
  closeOnBackdrop(resetDayDialog, closeResetDay);
  closeOnBackdrop(conflictDialog, closeConflict);
  document.addEventListener("pointerdown", dismissKeyboard);
  document.addEventListener("touchstart", dismissKeyboard, { passive: false });
  document.addEventListener("touchstart", rememberSheetTouch, { passive: true });
  document.addEventListener("touchmove", holdSheetScroll, { passive: false });
  document.addEventListener("focusin", guardKeyboardFocus);

  addOther.addEventListener("click", () => {
    addCustomSubject = !addCustomSubject;
    if (addCustomSubject && !addSubject.options.length) addCustomSubject = true;
    syncAddSubjectMode();
    if (addCustomSubject) addSubjectText.focus();
  });
  bindSwipe();
}

function showFatal(message) {
  loader.hidden = true;
  appContent.hidden = true;
  errorBox.hidden = false;
  errorBox.textContent = message;
}

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("не массив");
  return data;
}

function readPrefs(prefs) {
  if (typeof prefs.subgroup === "string" && (prefs.subgroup === "all" || /^\d+$/.test(prefs.subgroup))) {
    state.subgroup = prefs.subgroup;
  }
  state.theme = prefs.theme === "light" || prefs.theme === "dark" ? prefs.theme : "system";
  state.look = prefs.look === "simple" ? "simple" : "standard";
  const listsSaved = prefs.listsDefault === 2;
  state.showGroup = listsSaved && prefs.showGroup === true;
  state.showTeacher = listsSaved && prefs.showTeacher === true;
  state.showSubgroup = prefs.subgroupMenu === 3 ? prefs.showSubgroup === true : true;
  state.warnOnOpen = prefs.warnOnOpen !== false;
  const colors = prefs.colors && typeof prefs.colors === "object" ? prefs.colors : {};
  for (const key of ["practice", "theory", "split"]) {
    state.colors[key] = /^#[0-9a-fA-F]{6}$/.test(colors[key] || "") ? colors[key] : "";
  }
}

async function init() {
  const prefs = loadPrefs();
  readPrefs(prefs);
  applyTheme(resolvedScheme());
  applyLook();
  applyColors();
  syncFilterVisibility();
  if (tg) {
    tg.ready();
    if (typeof tg.expand === "function") tg.expand();
    openFullscreen();
    if (typeof tg.disableVerticalSwipes === "function") tg.disableVerticalSwipes();
    if (typeof tg.onEvent === "function") {
      tg.onEvent("themeChanged", () => {
        if (state.theme === "system") applyTheme(systemScheme());
      });
    }
  } else {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (state.theme === "system") applyTheme(systemScheme());
    });
  }

  noticeButton.addEventListener("click", closeNotice);
  if (!state.warnOnOpen) {
    notice.hidden = true;
    document.documentElement.classList.remove("no-entry-warn");
    syncModal();
  } else {
    noticeButton.focus();
  }
  bindEvents();
  window.addEventListener("pagehide", () => {
    flushNotes();
    flushEdits();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushNotes();
      flushEdits();
    }
  });
  restoreNotes();
  restoreEdits();
  window.setInterval(renderCountdown, 1000);

  try {
    const [theory, practice] = await Promise.all([
      loadJson("schedule_theory.json?v=4"),
      loadJson("schedule_practice.json?v=4")
    ]);
    for (const [group, lessons] of indexByGroup(theory)) theoryByGroup.set(group, lessons);
    for (const [group, lessons] of indexByGroup(practice)) practiceByGroup.set(group, lessons);
    stampLessons(theoryByGroup, "theory");
    stampLessons(practiceByGroup, "practice");
    for (const [name, lessons] of indexByTeacher(theoryByGroup)) theoryByTeacher.set(name, lessons);
    for (const [name, lessons] of indexByTeacher(practiceByGroup)) practiceByTeacher.set(name, lessons);
    groups = [...new Set([...theoryByGroup.keys(), ...practiceByGroup.keys()])].sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
    if (!groups.length) {
      showFatal("В файлах расписания нет групп.");
      return;
    }

    for (const group of groups) groupSelect.add(new Option(group, group));
    teachers = [...new Set([...theoryByTeacher.keys(), ...practiceByTeacher.keys()])].sort((a, b) => a.localeCompare(b, "ru"));
    for (const name of teachers) teacherSelect.add(new Option(name, name));
    setPickerRole("student");
    state.teacher = teachers.includes(prefs.teacher) ? prefs.teacher : "all";
    teacherSelect.value = state.teacher;
    loader.hidden = true;

    const returning = prefs.pickerReset === 2 && (groups.includes(prefs.group) || state.teacher !== "all");
    if (returning) {
      if (groups.includes(prefs.group)) {
        state.group = prefs.group;
        groupSelect.value = state.group;
      }
      syncSubgroupOptions();
      syncFilterVisibility();
      saveState();
      setToday();
      appContent.hidden = false;
      render();
      return;
    }

    awaitingGroup = true;
    if (notice.hidden) {
      groupPicker.hidden = false;
      syncModal();
      groupSearch.focus();
    }
  } catch (error) {
    showFatal("Не удалось загрузить расписание. Откройте страницу через GitHub Pages или локальный сервер, а не как файл с диска.");
  }
}

init();
