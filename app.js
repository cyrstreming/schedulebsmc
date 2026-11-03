/**
 * Расписание колледжа для Telegram Mini App.
 * Данные: schedule_theory.json и schedule_practice.json рядом со страницей.
 * Практика, обычная теория и теория с подгруппами показываются вместе
 * и различаются цветом карточки и точкой в календаре.
 */

const STORAGE_KEY = "college-schedule-filters";
const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const WEEKDAYS = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KIND_ORDER = ["practice", "theory", "split"];
const KIND_LABEL = { practice: "Практика", theory: "Теория", split: "Теория" };
const KIND_WORD = { practice: "практика", theory: "теория", split: "теория с подгруппами" };

const tg = window.Telegram?.WebApp ?? null;

const state = {
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
let awaitingGroup = false;

const loader = document.querySelector("#loader");
const errorBox = document.querySelector("#error");
const appContent = document.querySelector("#appContent");
const groupField = document.querySelector("#groupField");
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
const feedbackButton = document.querySelector("#feedbackButton");
const notice = document.querySelector("#notice");
const noticeButton = document.querySelector("#noticeButton");
const groupPicker = document.querySelector("#groupPicker");
const groupSearch = document.querySelector("#groupSearch");
const groupList = document.querySelector("#groupList");
const groupEmpty = document.querySelector("#groupEmpty");
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
      subgroup: state.subgroup,
      teacher: state.teacher
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
function sourceLessons() {
  if (state.teacher !== "all") {
    return [
      ...(practiceByTeacher.get(state.teacher) || []),
      ...(theoryByTeacher.get(state.teacher) || [])
    ];
  }
  if (!state.group) return [];
  return [
    ...(practiceByGroup.get(state.group) || []),
    ...(theoryByGroup.get(state.group) || [])
  ];
}

function filteredLessons() {
  const source = sourceLessons();
  const visible = state.subgroup === "all"
    ? source
    : source.filter((lesson) => {
      const number = subgroupNumber(lesson.subgroup);
      return !number || number === state.subgroup;
    });
  return visible.sort(compareLessons);
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
function renderCountdown() {
  const now = new Date();
  const today = formatISO(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  let current = null;
  let next = null;

  for (const lesson of filteredLessons()) {
    const span = lessonMinutes(lesson);
    if (!span) continue;
    const kind = lessonClockKind(lesson);
    if (lesson.date === today && nowMinutes >= span[0] && nowMinutes < span[1]) {
      const left = span[1] - nowMinutes;
      if (!current || left < current.left) current = { left, kind };
      else if (left === current.left && kind !== current.kind) current.kind = "both";
    } else {
      const until = minutesFromNow(lesson.date, span[0], today, nowMinutes);
      if (until <= 0) continue;
      if (!next || until < next.until) next = { until, kind };
      else if (until === next.until && kind !== next.kind) next.kind = "both";
    }
  }

  if (current) {
    countdown.hidden = false;
    countdown.className = `countdown${current.left <= 10 ? " is-ending" : ""}`;
    countdown.textContent = `До конца ${countdownName(current.kind)} ${formatAhead(current.left)}`;
    return;
  }
  if (next && next.until <= 15 * 60) {
    countdown.hidden = false;
    countdown.className = `countdown${next.until <= 30 ? " is-soon" : ""}`;
    countdown.textContent = `До начала ${countdownName(next.kind)} ${formatAhead(next.until)}`;
    return;
  }
  countdown.hidden = true;
  countdown.textContent = "";
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
    if (kinds && kinds.size === 1) button.classList.add(`tone-${[...kinds][0]}`);
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

/**
 * Аккордеон: свёрнутая карточка — это кнопка, раскрытие не перезагружает список.
 * Высота анимируется через grid-template-rows в CSS, стрелка поворачивается
 * классом is-open. Повторный клик сворачивает ту же карточку.
 * Внизу раскрытой карточки — номер этого занятия по предмету и сколько их ещё осталось.
 */
function createLessonCard(lesson, index) {
  const article = document.createElement("article");
  article.className = `lesson kind-${lesson.kind || "theory"}`;

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
  if (lesson.kind === "theory" || lesson.kind === "split") details.append(roomRow(lesson));
  inner.append(details);
  if (lesson.progress) inner.append(progressLine(lesson.progress));
  panel.append(inner);
  article.append(head, panel);

  head.addEventListener("click", () => {
    const open = article.classList.toggle("is-open");
    head.setAttribute("aria-expanded", open ? "true" : "false");
  });

  return article;
}

function renderDetails() {
  const all = filteredLessons();
  const dayLessons = all.filter((lesson) => lesson.date === state.selected);
  const selectedDate = state.selected ? parseISO(state.selected) : new Date();
  dayTitle.textContent = `${WEEKDAYS[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTHS_GEN[selectedDate.getMonth()]}`;
  document.title = state.group ? `Расписание · ${state.group}` : "Расписание занятий";

  if (!dayLessons.length) {
    dayCount.textContent = "";
    lessonsBox.replaceChildren();
    emptyBox.hidden = false;
    return;
  }

  emptyBox.hidden = true;
  dayCount.textContent = `${dayLessons.length} ${plural(dayLessons.length, "занятие", "занятия", "занятий")}`;
  const fragment = document.createDocumentFragment();
  dayLessons.forEach((lesson, index) => fragment.append(createLessonCard(lesson, index)));
  lessonsBox.classList.remove("is-fresh");
  lessonsBox.replaceChildren(fragment);
  void lessonsBox.offsetWidth;
  lessonsBox.classList.add("is-fresh");
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
  if (shouldScroll) dayTitle.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeNotice() {
  notice.hidden = true;
  if (awaitingGroup) {
    groupPicker.hidden = false;
    groupSearch.focus();
    return;
  }
  document.body.classList.remove("modal-open");
}

function fillGroupList() {
  groupList.replaceChildren();
  for (const group of groups) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "group-option";
    button.dataset.group = group;
    button.textContent = group;
    groupList.append(button);
  }
}

function filterGroupList() {
  const query = groupSearch.value.trim().toLocaleLowerCase("ru");
  let visible = 0;
  for (const button of groupList.querySelectorAll("[data-group]")) {
    const match = button.dataset.group.toLocaleLowerCase("ru").includes(query);
    button.hidden = !match;
    if (match) visible += 1;
  }
  groupEmpty.hidden = visible !== 0;
}

function chooseGroup(group) {
  state.group = group;
  groupSelect.value = group;
  awaitingGroup = false;
  groupPicker.hidden = true;
  document.body.classList.remove("modal-open");
  appContent.hidden = false;
  syncSubgroupOptions();
  saveState();
  setToday();
  render();
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
    dayTitle.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  prevMonth.addEventListener("click", () => shiftMonth(-1));
  nextMonth.addEventListener("click", () => shiftMonth(1));

  groupSearch.addEventListener("input", filterGroupList);
  groupList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-group]");
    if (!button) return;
    chooseGroup(button.dataset.group);
  });

  feedbackButton.addEventListener("click", openFeedbackChat);
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
  window.setInterval(renderCountdown, 30000);

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
    fillGroupList();
    const teachers = [...new Set([...theoryByTeacher.keys(), ...practiceByTeacher.keys()])].sort((a, b) => a.localeCompare(b, "ru"));
    for (const name of teachers) teacherSelect.add(new Option(name, name));
    const prefs = loadPrefs();
    if (typeof prefs.subgroup === "string" && (prefs.subgroup === "all" || /^\d+$/.test(prefs.subgroup))) {
      state.subgroup = prefs.subgroup;
    }
    state.teacher = teachers.includes(prefs.teacher) ? prefs.teacher : "all";
    teacherSelect.value = state.teacher;
    loader.hidden = true;

    if (groups.includes(prefs.group)) {
      state.group = prefs.group;
      groupSelect.value = state.group;
      syncSubgroupOptions();
      saveState();
      setToday();
      appContent.hidden = false;
      render();
      return;
    }

    awaitingGroup = true;
  } catch (error) {
    showFatal("Не удалось загрузить расписание. Откройте страницу через GitHub Pages или локальный сервер, а не как файл с диска.");
  }
}

init();
