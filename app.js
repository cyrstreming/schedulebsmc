/**
 * Расписание колледжа для Telegram Mini App.
 * Данные: schedule_theory.json и schedule_practice.json рядом со страницей.
 */

const STORAGE_KEY = "college-schedule-filters";
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WEEKDAYS = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const tg = window.Telegram?.WebApp ?? null;

const state = {
  type: "practice",
  group: "",
  subgroup: "all",
  teacher: "all",
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

const loader = document.querySelector("#loader");
const errorBox = document.querySelector("#error");
const appContent = document.querySelector("#appContent");
const groupField = document.querySelector("#groupField");
const groupSelect = document.querySelector("#groupSelect");
const teacherSelect = document.querySelector("#teacherSelect");
const teacherNow = document.querySelector("#teacherNow");
const subgroupField = document.querySelector("#subgroupField");
const subgroupSelect = document.querySelector("#subgroupSelect");
const tabPractice = document.querySelector("#tabPractice");
const tabTheory = document.querySelector("#tabTheory");
const todayButton = document.querySelector("#todayButton");
const prevMonth = document.querySelector("#prevMonth");
const nextMonth = document.querySelector("#nextMonth");
const monthLabel = document.querySelector("#monthLabel");
const calendarGrid = document.querySelector("#calendarGrid");
const dayTitle = document.querySelector("#dayTitle");
const dayCount = document.querySelector("#dayCount");
const statsBox = document.querySelector("#stats");
const lessonsBox = document.querySelector("#lessons");
const emptyBox = document.querySelector("#empty");
const feedbackButton = document.querySelector("#feedbackButton");
const notice = document.querySelector("#notice");
const noticeButton = document.querySelector("#noticeButton");
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
 * Индекс в статистике считается уже по этому порядку.
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
}

function currentScheme() {
  if (tg?.colorScheme === "dark" || tg?.colorScheme === "light") return tg.colorScheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    return {};
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      group: state.group,
      type: state.type,
      subgroup: state.subgroup,
      teacher: state.teacher
    }));
  } catch (error) {
    /* В приватном режиме браузер может запретить localStorage. */
  }
}

function defaultGroup() {
  const source = state.type === "practice" ? practiceByGroup : theoryByGroup;
  return groups.find((group) => source.has(group)) || groups[0] || "";
}

/**
 * Фильтр списка.
 * Если преподаватель не выбран, список ограничен группой.
 * Если выбран, показываются его занятия во всех группах: так преподаватель
 * видит свой день, а студент — у какой группы он сейчас.
 * Подгруппа применяется только к практике. «Все» оставляет записи без подгруппы.
 */
function filteredLessons() {
  const byTeacher = state.teacher !== "all";
  const source = byTeacher
    ? (state.type === "practice" ? practiceByTeacher : theoryByTeacher).get(state.teacher) || []
    : (state.type === "practice" ? practiceByGroup : theoryByGroup).get(state.group) || [];
  if (state.type !== "practice" || state.subgroup === "all") return source;
  return source.filter((lesson) => subgroupNumber(lesson.subgroup) === state.subgroup);
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
  const lessons = state.teacher === "all"
    ? practiceByGroup.get(state.group) || []
    : practiceByTeacher.get(state.teacher) || [];
  const numbers = new Set();
  for (const lesson of lessons) {
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

function syncTypeUI() {
  const practice = state.type === "practice";
  const byTeacher = state.teacher !== "all";
  subgroupField.classList.toggle("is-hidden", !practice);
  subgroupSelect.disabled = !practice;
  groupSelect.disabled = byTeacher;
  groupField.classList.toggle("is-disabled", byTeacher);
  tabPractice.setAttribute("aria-selected", practice ? "true" : "false");
  tabTheory.setAttribute("aria-selected", practice ? "false" : "true");
}

function lessonMinutes(lesson) {
  if (!lesson.time) return null;
  const match = String(lesson.time).match(/(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/);
  if (!match) return null;
  return [Number(match[1]) * 60 + Number(match[2]), Number(match[3]) * 60 + Number(match[4])];
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
    return span && minutes >= span[0] && minutes <= span[1];
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
 * Точка и заливка ставятся на день, у которого есть хотя бы одно занятие
 * после фильтра группы, типа и подгруппы. Дни соседних месяцев видны,
 * но не подсвечиваются как «есть пары», чтобы сетка читалась как текущий месяц.
 * Клик по такому дню перелистывает месяц и выбирает его.
 */
function renderCalendar() {
  monthLabel.textContent = `${MONTHS[state.month]} ${state.year}`;
  const busy = new Set();
  const monthPrefix = `${state.year}-${String(state.month + 1).padStart(2, "0")}`;
  for (const lesson of filteredLessons()) {
    if (lesson.date.startsWith(monthPrefix)) busy.add(lesson.date);
  }

  const firstWeekday = new Date(state.year, state.month, 1).getDay();
  const offset = (firstWeekday + 6) % 7;
  const today = formatISO(new Date());
  const fragment = document.createDocumentFragment();

  for (let cell = 0; cell < 42; cell += 1) {
    const date = new Date(state.year, state.month, 1 - offset + cell);
    const iso = formatISO(date);
    const inMonth = date.getMonth() === state.month;
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
    const hasLessons = inMonth && busy.has(iso);
    if (hasLessons) button.classList.add("has-lessons");
    button.setAttribute("aria-pressed", iso === state.selected ? "true" : "false");
    button.setAttribute(
      "aria-label",
      `${date.getDate()} ${MONTHS_GEN[date.getMonth()]}${hasLessons ? ", есть занятия" : ""}`
    );

    const number = document.createElement("span");
    number.textContent = String(date.getDate());
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.setAttribute("aria-hidden", "true");
    button.append(number, dot);
    fragment.append(button);
  }

  calendarGrid.replaceChildren(fragment);
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

function badge(text, muted) {
  const chip = document.createElement("span");
  chip.className = muted ? "badge badge-muted" : "badge";
  chip.textContent = text;
  return chip;
}

/**
 * Аккордеон: свёрнутая карточка — это кнопка, раскрытие не перезагружает список.
 * Высота анимируется через grid-template-rows в CSS, стрелка поворачивается
 * классом is-open. Повторный клик сворачивает ту же карточку.
 */
function createLessonCard(lesson, index) {
  const article = document.createElement("article");
  article.className = "lesson";

  const head = document.createElement("button");
  head.type = "button";
  head.className = "lesson-head";
  head.setAttribute("aria-expanded", "false");
  head.setAttribute("aria-controls", `lesson-panel-${index}`);

  const main = document.createElement("span");
  main.className = "lesson-main";

  const metaParts = [];
  if (lesson.pair != null && lesson.pair !== "") metaParts.push(`${lesson.pair} пара`);
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
  if (state.teacher !== "all" && lesson.group) chips.append(badge(lesson.group));
  const subgroup = subgroupNumber(lesson.subgroup);
  if (subgroup) chips.append(badge(`${subgroup} п/гр`));
  if (lesson.shift) {
    const shift = shiftNumber(lesson.shift);
    chips.append(badge(shift === 99 ? String(lesson.shift) : `${shift} см.`));
  }
  if (lesson.elective === true) chips.append(badge("по выбору", true));
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

  head.append(main, chevron);

  const panel = document.createElement("div");
  panel.className = "lesson-panel";
  panel.id = `lesson-panel-${index}`;
  const inner = document.createElement("div");
  inner.className = "lesson-panel-inner";
  const details = document.createElement("dl");
  details.className = "details";
  details.append(detailRow("Преподаватель", displayText(lesson.teacher, "Не указан")));
  if (state.type === "theory") details.append(roomRow(lesson));
  inner.append(details);
  panel.append(inner);
  article.append(head, panel);

  head.addEventListener("click", () => {
    const open = article.classList.toggle("is-open");
    head.setAttribute("aria-expanded", open ? "true" : "false");
  });

  return article;
}

/**
 * Статистика выбранного дня.
 * Y — все занятия текущего типа с учётом группы и подгруппы (это и есть семестр в JSON).
 * X — позиция занятий этого дня в списке, отсортированном по дате.
 * Если в дне несколько записей, показывается диапазон, например «12–14-е».
 * Z — сколько записей осталось с сегодняшнего дня включительно, а не с выбранной даты.
 */
function renderDetails() {
  const all = filteredLessons();
  const dayLessons = [];
  const indexes = [];
  for (let i = 0; i < all.length; i += 1) {
    if (all[i].date === state.selected) {
      dayLessons.push(all[i]);
      indexes.push(i + 1);
    }
  }

  const selectedDate = state.selected ? parseISO(state.selected) : new Date();
  dayTitle.textContent = `${WEEKDAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS_GEN[selectedDate.getMonth()]}`;
  document.title = state.group ? `Расписание · ${state.group}` : "Расписание занятий";

  if (!dayLessons.length) {
    dayCount.textContent = "";
    statsBox.hidden = true;
    statsBox.replaceChildren();
    lessonsBox.replaceChildren();
    emptyBox.hidden = false;
    return;
  }

  emptyBox.hidden = true;
  dayCount.textContent = `${dayLessons.length} ${plural(dayLessons.length, "занятие", "занятия", "занятий")}`;

  const today = formatISO(new Date());
  let left = 0;
  for (const lesson of all) {
    if (lesson.date >= today) left += 1;
  }
  const position = indexes.length === 1
    ? `${indexes[0]}-е занятие`
    : `${indexes[0]}–${indexes[indexes.length - 1]}-е занятия`;

  const paragraph = document.createElement("p");
  paragraph.style.margin = "0";
  const positionEl = document.createElement("strong");
  positionEl.textContent = position;
  const totalEl = document.createElement("strong");
  totalEl.textContent = String(all.length);
  const leftEl = document.createElement("strong");
  leftEl.textContent = String(left);
  paragraph.append(
    "Это ",
    positionEl,
    " из ",
    totalEl,
    " (До конца семестра осталось ",
    leftEl,
    ` ${plural(left, "занятие", "занятия", "занятий")})`
  );
  statsBox.replaceChildren(paragraph);
  statsBox.hidden = false;

  const fragment = document.createDocumentFragment();
  dayLessons.forEach((lesson, index) => fragment.append(createLessonCard(lesson, index)));
  lessonsBox.replaceChildren(fragment);
}

function render() {
  syncTypeUI();
  renderTeacherNow();
  renderCalendar();
  renderDetails();
}

function selectDate(iso, shouldScroll) {
  const date = parseISO(iso);
  state.selected = iso;
  state.year = date.getFullYear();
  state.month = date.getMonth();
  render();
  if (shouldScroll) dayTitle.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function closeNotice() {
  notice.hidden = true;
  document.body.classList.remove("modal-open");
}

/** В Telegram открывает чат внутри приложения. В обычном браузере срабатывает ссылка. */
function openFeedbackChat(event) {
  if (!tg || typeof tg.openTelegramLink !== "function") return;
  event.preventDefault();
  tg.openTelegramLink(CONTACT_URL);
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

  document.querySelector(".tabs").addEventListener("click", (event) => {
    const tab = event.target.closest("[data-type]");
    if (!tab || tab.dataset.type === state.type) return;
    state.type = tab.dataset.type;
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
    dayTitle.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  prevMonth.addEventListener("click", () => {
    const next = new Date(state.year, state.month - 1, 1);
    state.year = next.getFullYear();
    state.month = next.getMonth();
    renderCalendar();
  });

  nextMonth.addEventListener("click", () => {
    const next = new Date(state.year, state.month + 1, 1);
    state.year = next.getFullYear();
    state.month = next.getMonth();
    renderCalendar();
  });

  calendarGrid.addEventListener("click", (event) => {
    const button = event.target.closest("[data-date]");
    if (!button) return;
    selectDate(button.dataset.date, true);
  });

  feedbackButton.addEventListener("click", openFeedbackChat);
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

async function init() {
  applyTheme(currentScheme());
  if (tg) {
    tg.ready();
    if (typeof tg.expand === "function") tg.expand();
    if (typeof tg.disableVerticalSwipes === "function") tg.disableVerticalSwipes();
    if (typeof tg.onEvent === "function") {
      tg.onEvent("themeChanged", () => applyTheme(currentScheme()));
    }
  } else {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(currentScheme()));
  }

  noticeButton.addEventListener("click", closeNotice);
  noticeButton.focus();
  bindEvents();

  try {
    const [theory, practice] = await Promise.all([
      loadJson("schedule_theory.json"),
      loadJson("schedule_practice.json")
    ]);
    for (const [group, lessons] of indexByGroup(theory)) theoryByGroup.set(group, lessons);
    for (const [group, lessons] of indexByGroup(practice)) practiceByGroup.set(group, lessons);
    for (const [name, lessons] of indexByTeacher(theoryByGroup)) theoryByTeacher.set(name, lessons);
    for (const [name, lessons] of indexByTeacher(practiceByGroup)) practiceByTeacher.set(name, lessons);
    groups = [...new Set([...theoryByGroup.keys(), ...practiceByGroup.keys()])].sort((a, b) => a.localeCompare(b, "ru", { numeric: true }));
    if (!groups.length) {
      showFatal("В файлах расписания нет групп.");
      return;
    }

    for (const group of groups) groupSelect.add(new Option(group, group));
    const teachers = [...new Set([...theoryByTeacher.keys(), ...practiceByTeacher.keys()])].sort((a, b) => a.localeCompare(b, "ru"));
    for (const name of teachers) teacherSelect.add(new Option(name, name));
    const prefs = loadPrefs();
    if (prefs.type === "practice" || prefs.type === "theory") state.type = prefs.type;
    if (typeof prefs.subgroup === "string" && (prefs.subgroup === "all" || /^\d+$/.test(prefs.subgroup))) {
      state.subgroup = prefs.subgroup;
    }
    state.group = groups.includes(prefs.group) ? prefs.group : defaultGroup();
    state.teacher = teachers.includes(prefs.teacher) ? prefs.teacher : "all";
    groupSelect.value = state.group;
    teacherSelect.value = state.teacher;
    syncSubgroupOptions();
    saveState();
    setToday();
    loader.hidden = true;
    appContent.hidden = false;
    render();
  } catch (error) {
    showFatal("Не удалось загрузить расписание. Откройте страницу через GitHub Pages или локальный сервер, а не как файл с диска.");
  }
}

init();
