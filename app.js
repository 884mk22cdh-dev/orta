/* ============ Расписание студента — приложение по дизайну «Расписание студента.dc.html» ============ */
'use strict';

/* ---------- Данные ---------- */
const COLORS = { purple:'#6C4FE0', red:'#F4564E', yellow:'#F2B23E', green:'#3DB96B', blue:'#3E9BF0', teal:'#22B8A6' };

const DEFAULT_STATE = {
  onboarded: false,
  setup: { university:'КазНУ им. аль-Фараби', faculty:'Информационные технологии', course:2, group:'ВТ-201' },
  profile: { firstName:'Оскар', lastName:'Жанболат', initials:'ОЖ' },
  chips: 'subjects',
  showAllSubjects: false,
  bookmarks: [],
  notifChangesOn: true,
  remindBefore: 15,
  theme: 'light',
  lang: 'ru',
  lastSync: null,
  readNotifs: ['n4'],
  subjects: [
    { id:'math', name:'Математика',        color:COLORS.purple, icon:'calculator', time:'09:00', tInitials:'АС', tShort:'Айгүль С.', tFull:'Айгүль Сериковна' },
    { id:'hist', name:'История Казахстана', color:COLORS.red,    icon:'landmark',   time:'11:00', tInitials:'ДН', tShort:'Дана Н.',   tFull:'Дана Нұрланқызы' },
    { id:'phys', name:'Физика',             color:COLORS.yellow, icon:'atom',       time:'13:00', tInitials:'ЕМ', tShort:'Ерлан М.',  tFull:'Ерлан Мұратұлы' },
    { id:'eng',  name:'Английский язык',    color:COLORS.green,  icon:'languages',  time:'15:00', tInitials:'АЖ', tShort:'Асель Ж.',  tFull:'Асель Жанатқызы' },
    { id:'chem', name:'Химия',              color:COLORS.teal,   icon:'flask-conical', time:'10:40', tInitials:'ГӘ', tShort:'Гүлнара Ә.', tFull:'Гүлнара Әбенова' },
    { id:'prog', name:'Программирование',   color:COLORS.blue,   icon:'code',       time:'12:40', tInitials:'ТО', tShort:'Тимур О.',  tFull:'Тимур Оразбаев' },
  ],
};

/* Расписание по дням недели: 0=Пн … 5=Сб (воскресенье — пар нет) */
const SCHEDULE = [
  [ // Пн
    { id:'mon1', start:'09:00', end:'09:50', name:'Математика', room:'214', teacher:'Айгүль Сериковна', tInitials:'АС', color:COLORS.purple, type:'Лекция', tag:null, building:'Главный, А', icon:'calculator', badge:'∫x' },
    { id:'mon2', start:'10:40', end:'12:10', name:'Английский язык', room:'118', teacher:'Асель Жанатқызы', tInitials:'АЖ', color:COLORS.green, type:'Практика', tag:'Практика', building:'Главный, Б', icon:'languages' },
    { id:'mon3', start:'13:00', end:'14:30', name:'История Казахстана', room:'305', teacher:'Дана Нұрланқызы', tInitials:'ДН', color:COLORS.red, type:'Лекция', tag:null, building:'Главный, А', icon:'landmark' },
  ],
  [ // Вт — как в дизайне
    { id:'tue1', start:'08:00', end:'08:50', name:'Математика', room:'214', teacher:'Айгүль Сериковна', tInitials:'АС', color:COLORS.purple, type:'Лекция', tag:null, building:'Главный, А', icon:'calculator', badge:'∫x' },
    { id:'tue2', start:'09:00', end:'10:30', name:'Физика', room:'312', teacher:'Ерлан Мұратұлы', tInitials:'ЕМ', color:COLORS.blue, type:'Практика', tag:'Практика', building:'Главный, В', icon:'atom' },
    { id:'tue3', start:'10:40', end:'12:10', name:'Химия', room:'401', teacher:'Гүлнара Әбенова', tInitials:'ГӘ', color:COLORS.teal, type:'Лабораторная', tag:'Лаба', building:'Химический корпус', icon:'flask-conical' },
    { id:'tue4', start:'12:40', end:'14:10', name:'Программирование', room:'220', teacher:'Тимур Оразбаев', tInitials:'ТО', color:COLORS.green, type:'Практика', tag:'Практика', building:'IT-корпус', icon:'code' },
  ],
  [ // Ср
    { id:'wed1', start:'09:00', end:'10:30', name:'Программирование', room:'220', teacher:'Тимур Оразбаев', tInitials:'ТО', color:COLORS.blue, type:'Лекция', tag:null, building:'IT-корпус', icon:'code' },
    { id:'wed2', start:'10:40', end:'12:10', name:'Математика', room:'214', teacher:'Айгүль Сериковна', tInitials:'АС', color:COLORS.purple, type:'Практика', tag:'Практика', building:'Главный, А', icon:'calculator', badge:'∫x' },
    { id:'wed3', start:'12:40', end:'14:10', name:'Английский язык', room:'118', teacher:'Асель Жанатқызы', tInitials:'АЖ', color:COLORS.green, type:'Практика', tag:'Практика', building:'Главный, Б', icon:'languages' },
    { id:'wed4', start:'14:20', end:'15:50', name:'Физика', room:'312', teacher:'Ерлан Мұратұлы', tInitials:'ЕМ', color:COLORS.yellow, type:'Лекция', tag:null, building:'Главный, В', icon:'atom' },
  ],
  [ // Чт — с отменённой парой (как на макете «офлайн + отмена»)
    { id:'thu1', start:'08:00', end:'08:50', name:'Математика', room:'214', teacher:'Айгүль Сериковна', tInitials:'АС', color:COLORS.purple, type:'Лекция', tag:null, building:'Главный, А', icon:'calculator', badge:'∫x' },
    { id:'thu2', start:'09:00', end:'10:30', name:'Физика', room:'312', teacher:'Ерлан Мұратұлы', tInitials:'ЕМ', color:COLORS.blue, type:'Практика', tag:'Отменена', cancelled:true, building:'Главный, В', icon:'atom' },
    { id:'thu3', start:'10:40', end:'12:10', name:'Химия', room:'401', teacher:'Гүлнара Әбенова', tInitials:'ГӘ', color:COLORS.teal, type:'Лабораторная', tag:'Лаба', building:'Химический корпус', icon:'flask-conical' },
    { id:'thu4', start:'12:40', end:'14:10', name:'Программирование', room:'220', teacher:'Тимур Оразбаев', tInitials:'ТО', color:COLORS.green, type:'Практика', tag:'Практика', building:'IT-корпус', icon:'code' },
  ],
  [ // Пт
    { id:'fri1', start:'09:00', end:'10:30', name:'История Казахстана', room:'305', teacher:'Дана Нұрланқызы', tInitials:'ДН', color:COLORS.red, type:'Семинар', tag:'Семинар', building:'Главный, А', icon:'landmark' },
    { id:'fri2', start:'10:40', end:'12:10', name:'Математика', room:'214', teacher:'Айгүль Сериковна', tInitials:'АС', color:COLORS.purple, type:'Лекция', tag:null, building:'Главный, А', icon:'calculator', badge:'∫x' },
    { id:'fri3', start:'12:40', end:'14:10', name:'Английский язык', room:'118', teacher:'Асель Жанатқызы', tInitials:'АЖ', color:COLORS.green, type:'Практика', tag:'Практика', building:'Главный, Б', icon:'languages' },
  ],
  [ // Сб
    { id:'sat1', start:'10:00', end:'11:30', name:'Физика', room:'312', teacher:'Ерлан Мұратұлы', tInitials:'ЕМ', color:COLORS.yellow, type:'Лабораторная', tag:'Лаба', building:'Главный, В', icon:'atom' },
    { id:'sat2', start:'11:40', end:'13:10', name:'Программирование', room:'220', teacher:'Тимур Оразбаев', tInitials:'ТО', color:COLORS.blue, type:'Практика', tag:'Практика', building:'IT-корпус', icon:'code' },
  ],
];

const NOTIFS = [
  { id:'n1', color:COLORS.purple, bg:'rgba(108,79,224,.08)', icon:'clock',       html:'Через 15 минут начнётся <b>Математика</b>, ауд. 214', when:'12 минут назад' },
  { id:'n2', color:COLORS.red,    bg:'rgba(244,86,78,.08)',  icon:'refresh-cw',  html:'Расписание на четверг обновилось — 2 изменения', when:'1 час назад' },
  { id:'n3', color:COLORS.yellow, bg:'rgba(242,178,62,.10)', icon:'triangle-alert', html:'Замена: Физику 09:00 ведёт другой преподаватель', when:'3 часа назад' },
  { id:'n4', color:COLORS.purple, bg:'#fff',                 icon:'clock',       html:'Напоминание: завтра История Казахстана в 15:00', when:'вчера' },
];

const UNIVERSITIES = ['КазНУ им. аль-Фараби', 'ЕНУ им. Гумилёва', 'КБТУ', 'Astana IT University'];
const FACULTIES = ['Информационные технологии', 'Экономика и бизнес', 'Юриспруденция', 'Механика и математика'];
const GROUPS = ['ВТ-201', 'ВТ-202', 'ВТ-203', 'ИС-201'];
const MONTHS_GEN = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const WEEKDAYS_FULL = ['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'];
const DAY_NAMES = ['Пн','Вт','Ср','Чт','Пт','Сб'];
const PICK_ICONS = ['calculator','atom','languages','landmark','flask-conical','code','book-open','music','palette','dumbbell'];

/* ---------- Состояние ---------- */
const LS_KEY = 'student-schedule-state-v1';
let state = loadState();
let route = { name: state.onboarded ? 'home' : 'onboarding' };
let setupStep = 0; // 0 = приветствие, 1..4 = шаги настройки
let selectedDay = clampDay(mondayIndex(new Date()));
let searchOpen = false;
let searchQuery = '';
let sheetOpen = false;
let draft = null;

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return Object.assign({}, DEFAULT_STATE, JSON.parse(raw));
  } catch (e) {}
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}
function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
}

/* ---------- Утилиты ---------- */
const $ = s => document.querySelector(s);
function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function mondayIndex(d){ return (d.getDay() + 6) % 7; } // 0=Пн … 6=Вс
function clampDay(i){ return Math.min(i, 5); }
function weekDates(){
  const now = new Date();
  const mon = new Date(now); mon.setDate(now.getDate() - mondayIndex(now));
  return DAY_NAMES.map((name, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return { name, num: d.getDate() }; });
}
function toMin(t){ const [h,m] = t.split(':').map(Number); return h*60+m; }
function nowMin(){ const n = new Date(); return n.getHours()*60 + n.getMinutes(); }
function isToday(dayIdx){ return mondayIndex(new Date()) === dayIdx; }
function greeting(){ const h = new Date().getHours(); return h < 5 ? 'Доброй ночи,' : h < 12 ? 'Доброе утро,' : h < 18 ? 'Добрый день,' : 'Добрый вечер,'; }
function todayLine(){ const d = new Date(); return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}, ${WEEKDAYS_FULL[d.getDay()]}`; }
function icons(){ if (window.lucide) window.lucide.createIcons(); }
function lessonsOf(dayIdx){ return dayIdx >= 0 && dayIdx <= 5 ? SCHEDULE[dayIdx] : []; }
function findLesson(id){ for (const day of SCHEDULE) for (const l of day) if (l.id === id) return l; return null; }
function unreadCount(){ return NOTIFS.filter(n => !state.readNotifs.includes(n.id)).length; }

/* ---------- Вёрстка: общие блоки ---------- */
function statusBarHTML(){
  const t = new Date();
  const time = `${t.getHours()}:${String(t.getMinutes()).padStart(2,'0')}`;
  return `<span class="sb-time">${time}</span><span class="sb-icons"><i data-lucide="signal"></i><i data-lucide="${navigator.onLine ? 'wifi' : 'wifi-off'}"></i><i data-lucide="battery-full"></i></span>`;
}
function tabbarHTML(active){
  const tabs = [
    { id:'home', icon:'home' },
    { id:'schedule', icon:'notebook-text' },
    { id:'notifications', icon:'bell' },
    { id:'profile', icon:'user' },
  ];
  return tabs.map(t => `
    <button class="tab ${active === t.id ? 'active' : ''}" data-action="nav" data-to="${t.id}">
      <i data-lucide="${t.icon}"></i><span class="tab-dot"></span>
    </button>`).join('');
}
function offlineBannerHTML(){
  if (navigator.onLine) return '';
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `<div class="offline-banner"><i data-lucide="wifi-off"></i><span>Офлайн · показано расписание от ${d.getDate()} ${MONTHS_GEN[d.getMonth()]}</span></div>`;
}

/* ---------- Экраны ---------- */
function renderOnboardingWelcome(){
  return `
  <div style="flex:1;display:flex;flex-direction:column;padding:54px 32px 0;height:100%;">
    <div class="onb-hero">
      <div class="onb-card onb-card--l"></div>
      <div class="onb-card onb-card--r"></div>
      <div class="onb-card onb-card--c">
        <div class="onb-ico"><i data-lucide="calendar-days"></i></div>
        <div><div class="onb-title">Математика</div><div class="onb-time">09:00 — 09:50</div></div>
      </div>
    </div>
    <div style="margin-top:auto;padding-bottom:40px;">
      <div class="h1">Добро пожаловать 👋</div>
      <div class="muted" style="margin-top:10px;line-height:1.5;text-wrap:pretty;">Всё расписание университета — в одном месте. Твои пары, замены и уведомления.</div>
      <button class="btn-primary" style="margin-top:28px;" data-action="setup-next">Продолжить</button>
      <div class="onb-dots"><span class="active"></span><span></span><span></span></div>
    </div>
  </div>`;
}

function renderSetupStep(){
  const progress = `<div class="setup-progress">${[1,2,3,4].map(i => `<span class="${i <= setupStep ? 'done' : ''}"></span>`).join('')}</div>`;
  let title = '', sub = '', body = '';
  if (setupStep === 1) {
    title = 'Выберите университет'; sub = 'Где вы учитесь?';
    body = `<div class="pick-list">${UNIVERSITIES.map(u => `
      <button class="pick-row ${state.setup.university === u ? 'selected' : ''}" data-action="pick" data-field="university" data-value="${esc(u)}">
        <span>${esc(u)}</span>${state.setup.university === u ? '<span class="pick-check"><i data-lucide="check"></i></span>' : ''}
      </button>`).join('')}</div>`;
  } else if (setupStep === 2) {
    title = 'Выберите факультет'; sub = 'На каком факультете вы учитесь?';
    body = `<div class="pick-list">${FACULTIES.map(f => `
      <button class="pick-row ${state.setup.faculty === f ? 'selected' : ''}" data-action="pick" data-field="faculty" data-value="${esc(f)}">
        <span>${esc(f)}</span>${state.setup.faculty === f ? '<span class="pick-check"><i data-lucide="check"></i></span>' : ''}
      </button>`).join('')}</div>`;
  } else if (setupStep === 3) {
    title = 'Выберите курс'; sub = 'Какой курс вы сейчас заканчиваете?';
    body = `<div class="grid-2">${[1,2,3,4].map(c => `
      <button class="pick-card ${state.setup.course === c ? 'selected' : ''}" data-action="pick" data-field="course" data-value="${c}">
        <span class="pick-num">${c}</span><span class="pick-sub">курс</span>
        ${state.setup.course === c ? '<span class="pick-check"><i data-lucide="check"></i></span>' : ''}
      </button>`).join('')}</div>`;
  } else {
    title = 'Выберите группу'; sub = 'Ваша учебная группа';
    body = `<div class="grid-2">${GROUPS.map(g => `
      <button class="pick-card ${state.setup.group === g ? 'selected' : ''}" data-action="pick" data-field="group" data-value="${esc(g)}">
        <span class="pick-num" style="font-size:22px;">${esc(g)}</span><span class="pick-sub">группа</span>
        ${state.setup.group === g ? '<span class="pick-check"><i data-lucide="check"></i></span>' : ''}
      </button>`).join('')}</div>`;
  }
  return `
  <div style="display:flex;flex-direction:column;height:100%;">
    <div style="padding:62px 20px 0;flex:1;">
      <button class="back-link" data-action="setup-back"><i data-lucide="chevron-left"></i>Назад</button>
      ${progress}
      <div class="h2">${title}</div>
      <div class="muted" style="margin-top:8px;">${sub}</div>
      ${body}
    </div>
    <div style="padding:20px;">
      <button class="btn-primary" data-action="setup-next">${setupStep === 4 ? 'Готово' : 'Далее'}</button>
    </div>
  </div>`;
}

function subjectCardHTML(s){
  const bm = state.bookmarks.includes(s.id);
  return `
  <div class="subject-card" data-action="open-subject" data-id="${esc(s.id)}">
    <div class="sc-bg" style="background:${s.color};box-shadow:0 12px 28px ${hexShadow(s.color)};"></div>
    <div class="sc-body">
      <div class="sc-top">
        <div class="sc-icon"><i data-lucide="${esc(s.icon)}"></i></div>
        <button class="sc-bookmark ${bm ? 'on' : ''}" data-action="bookmark" data-id="${esc(s.id)}"><i data-lucide="bookmark"></i></button>
      </div>
      <div class="sc-time" style="color:${s.color};">${esc(s.time)}</div>
      <div class="sc-name">${esc(s.name)}</div>
      <div class="sc-teacher">
        <span class="sc-ava">${esc(s.tInitials)}</span>
        <span><div class="sc-tlabel">Учитель</div><div class="sc-tname">${esc(s.tShort)}</div></span>
      </div>
    </div>
  </div>`;
}
function hexShadow(hex){
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n>>16)&255},${(n>>8)&255},${n&255},.22)`;
}

function renderHome(){
  const subjects = state.showAllSubjects ? state.subjects : state.subjects.slice(0, 4);
  let content = '';
  if (state.chips === 'subjects') {
    content = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin:26px 4px 0;">
      <span style="font:700 19px 'Manrope';">Мои предметы</span>
      <div style="display:flex;align-items:center;gap:10px;">
        <button style="font:600 13px 'Inter';color:#6C4FE0;" data-action="toggle-all">${state.showAllSubjects ? 'Свернуть' : 'Все'}</button>
        <button class="plus-btn" data-action="add-subject"><i data-lucide="plus"></i></button>
      </div>
    </div>
    <div class="subject-grid">${subjects.map(subjectCardHTML).join('')}</div>`;
  } else {
    const meta = state.chips === 'forum'
      ? { icon:'messages-square', title:'Форум группы', sub:'Обсуждения появятся здесь. Раздел скоро откроется.' }
      : { icon:'graduation-cap', title:'Экзамены', sub:'Сессия ещё не началась. Даты экзаменов появятся здесь.' };
    content = `
    <div class="empty-wrap" style="padding-top:60px;">
      <div class="empty-art">
        <div class="ea-l"></div><div class="ea-r"></div>
        <div class="ea-c"><i data-lucide="${meta.icon}"></i></div>
      </div>
      <div class="empty-title">${meta.title}</div>
      <div class="muted" style="margin-top:8px;">${meta.sub}</div>
    </div>`;
  }
  return `
  ${offlineBannerHTML()}
  <div class="screen-pad${navigator.onLine ? '' : ' screen-pad--after-banner'}">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;">
      <div><div class="muted">${greeting()}</div><div class="h1" style="margin-top:2px;">${esc(state.profile.firstName)}</div></div>
      <div style="display:flex;gap:10px;">
        <button class="icon-btn" data-action="nav" data-to="notifications"><i data-lucide="bell"></i>${unreadCount() ? '<span class="badge-dot"></span>' : ''}</button>
        <button class="icon-btn" data-action="search-open"><i data-lucide="search"></i></button>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px;">
      <button class="chip ${state.chips === 'forum' ? 'active' : ''}" data-action="chip" data-chip="forum">Форум</button>
      <button class="chip ${state.chips === 'exams' ? 'active' : ''}" data-action="chip" data-chip="exams">Экзамены</button>
      <button class="chip ${state.chips === 'subjects' ? 'active' : ''}" data-action="chip" data-chip="subjects">Предметы</button>
    </div>
    ${content}
  </div>`;
}

function lessonCardHTML(l, dayIdx){
  const today = isToday(dayIdx);
  const now = today && !l.cancelled && nowMin() >= toMin(l.start) && nowMin() < toMin(l.end);
  const tagColor = l.color;
  const tag = l.cancelled
    ? `<span class="lc-tag">Отменена</span>`
    : (l.tag ? `<span class="lc-tag" style="color:${tagColor};background:${hexShadow(tagColor).replace('.22','.12')};">${esc(l.tag)}</span>` : '');
  return `
  <button class="lesson-card ${now ? 'now' : ''} ${l.cancelled ? 'cancelled' : ''}" data-action="open-lesson" data-id="${esc(l.id)}">
    ${now ? '<span class="now-flag"><span class="nf-dot"></span><span class="nf-label">сейчас</span></span>' : ''}
    <div class="lc-time" style="background:${l.color};"><span class="t1">${l.start}</span><span class="t2">${l.end}</span></div>
    <div class="lc-main">
      <div class="lc-name" ${now ? 'style="padding-right:92px;"' : ''}>${esc(l.name)}</div>
      <div class="lc-meta"><span class="lc-sub">ауд. ${esc(l.room)} · ${esc(l.teacher)}</span>${tag}</div>
    </div>
  </button>`;
}

function renderSchedule(){
  const days = weekDates();
  const lessons = lessonsOf(selectedDay);
  const todayIdx = mondayIndex(new Date());
  const active = lessons.filter(l => !l.cancelled);
  const countLine = active.length
    ? `${active.length} ${plural(active.length, 'пара','пары','пар')} · ${active[0].start} — ${active[active.length-1].end}`
    : '';
  let list;
  if (lessons.length) {
    list = `<div class="lesson-list">${lessons.map(l => lessonCardHTML(l, selectedDay)).join('')}</div>`;
  } else {
    list = `
    <div class="empty-wrap" style="padding-top:40px;">
      <div class="empty-art">
        <div class="ea-l"></div><div class="ea-r"></div>
        <div class="ea-c"><i data-lucide="coffee"></i></div>
      </div>
      <div class="empty-title">В этот день пар нет</div>
      <div class="muted" style="margin-top:8px;">Отдыхай. Следующая пара — завтра в 09:00.</div>
    </div>`;
  }
  return `
  ${offlineBannerHTML()}
  <div class="screen-pad${navigator.onLine ? '' : ' screen-pad--after-banner'}">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span class="h2">Расписание</span>
      <button class="icon-btn" data-action="search-open"><i data-lucide="search"></i></button>
    </div>
    <div class="day-row">
      ${days.map((d, i) => `
        <button class="day-pill ${i === todayIdx ? 'today' : ''} ${i === selectedDay ? 'selected' : ''}" data-action="day" data-day="${i}">
          <span class="dp-name">${d.name}</span><span class="dp-num">${d.num}</span>
        </button>`).join('')}
    </div>
    ${countLine ? `<div class="count-line">${countLine}</div>` : '<div style="height:22px;"></div>'}
    ${list}
  </div>`;
}

function plural(n, one, few, many){
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function renderLesson(id){
  const l = findLesson(id) || SCHEDULE[1][0];
  const dateLabel = 'Сегодня';
  const badge = l.badge ? esc(l.badge) : `<i data-lucide="${esc(l.icon || 'book-open')}"></i>`;
  return `
  <div class="detail-head" style="background:${l.color};padding-top:54px;height:180px;">
    <div class="dh-row">
      <button class="dh-back" data-action="back-schedule"><i data-lucide="chevron-left"></i></button>
      <div class="dh-badge">${badge}</div>
    </div>
    <div class="dh-title">
      <div class="t">${esc(l.name)}</div>
      <div class="s">${dateLabel}, ${l.start} — ${l.end}</div>
    </div>
  </div>
  <div style="padding:20px 20px 40px;">
    <div class="info-card">
      <div class="info-row"><span class="k">Аудитория</span><span class="v">${esc(l.room)}</span></div>
      <div class="info-row"><span class="k">Корпус</span><span class="v">${esc(l.building || 'Главный, А')}</span></div>
      <div class="info-row"><span class="k">Преподаватель</span><span style="display:flex;align-items:center;gap:8px;"><span class="mini-ava" style="background:${l.color};">${esc(l.tInitials || '·')}</span><span class="v">${esc(l.teacher)}</span></span></div>
      <div class="info-row"><span class="k">Тип занятия</span><span class="v">${esc(l.cancelled ? 'Отменена' : (l.type || 'Лекция'))}</span></div>
      <div class="info-row"><span class="k">Группа</span><span class="v">${esc(state.setup.group)}</span></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:12px;">
      ${[['paperclip','Материалы'],['book-open','Домашнее задание'],['pencil','Заметки']].map(([ic, t]) => `
      <button class="list-row" data-action="soon">
        <span class="lr-left"><i data-lucide="${ic}"></i><span><div class="lr-title">${t}</div><div class="lr-sub">Пока ничего нет</div></span></span>
        <span class="lr-soon">Скоро</span>
      </button>`).join('')}
    </div>
  </div>`;
}

function renderNotifications(){
  return `
  <div class="screen-pad">
    <div class="h2">Уведомления</div>
    <button style="font:600 13px 'Inter';color:#6C4FE0;margin-top:10px;display:block;" data-action="read-all">Отметить все прочитанными</button>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px;">
      ${NOTIFS.map(n => {
        const read = state.readNotifs.includes(n.id);
        return `
        <div class="notif ${read ? 'read' : ''}" style="background:${n.bg};">
          <div class="nt-ico" style="background:${n.color};"><i data-lucide="${n.icon}"></i></div>
          <div style="flex:1;"><div class="nt-text">${n.html}</div><div class="nt-when">${n.when}</div></div>
          <span class="nt-dot" style="background:${n.color};"></span>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}

function renderProfile(){
  const p = state.profile, s = state.setup;
  return `
  <div class="screen-pad">
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;margin-top:8px;">
      <div class="avatar-xl">${esc(p.initials)}</div>
      <div style="text-align:center;">
        <div class="h2">${esc(p.firstName)} ${esc(p.lastName)}</div>
        <div class="muted" style="font-size:14px;margin-top:2px;">${esc(s.group)} · ${s.course} курс</div>
      </div>
    </div>
    <div class="info-card" style="margin-top:24px;">
      <div style="padding:12px 0;border-bottom:1px solid #E6E7EC;"><div style="font:400 12px 'Inter';color:#8A8D99;">Университет</div><div style="font:600 15px 'Inter';margin-top:3px;">${esc(s.university)}</div></div>
      <div style="padding:12px 0;border-bottom:1px solid #E6E7EC;"><div style="font:400 12px 'Inter';color:#8A8D99;">Факультет</div><div style="font:600 15px 'Inter';margin-top:3px;">${esc(s.faculty)}</div></div>
      <div style="display:flex;gap:12px;">
        <div style="flex:1;padding:12px 0;"><div style="font:400 12px 'Inter';color:#8A8D99;">Курс</div><div style="font:600 15px 'Inter';margin-top:3px;">${s.course} курс</div></div>
        <div style="flex:1;padding:12px 0;"><div style="font:400 12px 'Inter';color:#8A8D99;">Группа</div><div style="font:600 15px 'Inter';margin-top:3px;">${esc(s.group)}</div></div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px;">
      <button class="list-row accent" data-action="nav" data-to="settings">
        <span class="lr-left"><i data-lucide="settings"></i><span class="lr-title">Настройки</span></span><i data-lucide="chevron-right" class="lr-chev"></i>
      </button>
      <button class="list-row accent" data-action="nav" data-to="notifications">
        <span class="lr-left"><i data-lucide="bell"></i><span class="lr-title">Уведомления</span></span><i data-lucide="chevron-right" class="lr-chev"></i>
      </button>
      <button class="list-row accent" data-action="soon">
        <span class="lr-left"><i data-lucide="moon"></i><span class="lr-title">Тема оформления</span></span><i data-lucide="chevron-right" class="lr-chev"></i>
      </button>
    </div>
  </div>`;
}

function renderSettings(){
  const syncLabel = state.lastSync ? syncAgo() : 'Обновлено 5 минут назад';
  return `
  <div class="screen-pad screen-pad--flow">
    <div style="display:flex;align-items:center;gap:8px;">
      <button class="icon-btn" data-action="nav" data-to="profile"><i data-lucide="chevron-left" style="width:20px;height:20px;"></i></button>
      <span class="h2">Настройки</span>
    </div>

    <div class="section-label">Уведомления</div>
    <div class="card" style="padding:4px 18px;border-radius:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;border-bottom:1px solid #E6E7EC;">
        <span style="font:500 15px 'Inter';">Предупреждать о паре</span>
        <button class="settings-link" data-action="cycle-remind">за ${state.remindBefore} минут <i data-lucide="chevron-right"></i></button>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 0;">
        <span style="font:500 15px 'Inter';">Уведомления об изменениях</span>
        <button class="switch ${state.notifChangesOn ? 'on' : ''}" data-action="toggle-changes"></button>
      </div>
    </div>

    <div class="section-label">Оформление</div>
    <div class="card" style="padding:14px 16px;border-radius:20px;">
      <div class="seg">
        <button class="${state.theme === 'light' ? 'active' : ''}" data-action="theme" data-theme="light">Светлая</button>
        <button data-action="soon">Тёмная</button>
        <button data-action="soon">Система</button>
      </div>
    </div>

    <div class="section-label">Язык</div>
    <div class="card" style="padding:4px 18px;border-radius:20px;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid #E6E7EC;"><span style="font:500 15px 'Inter';">Русский</span><i data-lucide="check" style="width:18px;height:18px;color:#6C4FE0;"></i></div>
      <button style="display:flex;align-items:center;justify-content:space-between;padding:13px 0;border-bottom:1px solid #E6E7EC;width:100%;" data-action="soon"><span style="font:500 15px 'Inter';color:#8A8D99;">Қазақша</span></button>
      <button style="display:flex;align-items:center;justify-content:space-between;padding:13px 0;width:100%;" data-action="soon"><span style="font:500 15px 'Inter';color:#8A8D99;">English</span></button>
    </div>

    <div class="section-label">Синхронизация</div>
    <div class="card" style="padding:14px 18px;border-radius:20px;display:flex;align-items:center;justify-content:space-between;">
      <span style="font:400 13px 'Inter';color:#8A8D99;" id="sync-label">${syncLabel}</span>
      <button style="font:600 14px 'Inter';color:#6C4FE0;" data-action="sync">Обновить сейчас</button>
    </div>
  </div>`;
}
function syncAgo(){
  const diff = Math.round((Date.now() - state.lastSync) / 60000);
  if (diff < 1) return 'Обновлено только что';
  return `Обновлено ${diff} ${plural(diff,'минуту','минуты','минут')} назад`;
}

function renderLoading(){
  return `
  <div class="screen-pad">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <div><span class="skel" style="display:block;width:110px;height:14px;"></span><span class="skel" style="display:block;width:90px;height:26px;margin-top:8px;"></span></div>
      <div style="display:flex;gap:10px;"><span class="skel" style="width:40px;height:40px;border-radius:999px;"></span><span class="skel" style="width:40px;height:40px;border-radius:999px;"></span></div>
    </div>
    <div class="skel" style="height:150px;border-radius:24px;margin-top:22px;"></div>
    <span class="skel" style="display:block;width:120px;height:20px;margin:24px 0 12px;"></span>
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div class="skel" style="height:84px;border-radius:20px;"></div>
      <div class="skel" style="height:84px;border-radius:20px;"></div>
      <div class="skel" style="height:84px;border-radius:20px;"></div>
      <div class="skel" style="height:84px;border-radius:20px;"></div>
    </div>
  </div>`;
}

function renderSearch(){
  const q = searchQuery.trim().toLowerCase();
  let results = '';
  if (q) {
    const found = [];
    SCHEDULE.forEach((day, di) => day.forEach(l => {
      if (l.name.toLowerCase().includes(q) || l.teacher.toLowerCase().includes(q)) found.push({ l, di });
    }));
    results = found.length
      ? `<div class="lesson-list" style="margin-top:18px;">${found.map(({l, di}) => `
          <div>
            <div style="font:600 12px 'Inter';color:#8A8D99;margin:0 4px 6px;">${DAY_NAMES[di]}</div>
            ${lessonCardHTML(l, di)}
          </div>`).join('')}</div>`
      : `<div class="muted" style="text-align:center;margin-top:60px;">Ничего не найдено</div>`;
  } else {
    results = `<div class="muted" style="text-align:center;margin-top:60px;">Введите название предмета<br>или имя преподавателя</div>`;
  }
  return `
  <div class="screen-pad">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span class="h2">Поиск</span>
      <button style="font:600 15px 'Inter';color:#6C4FE0;" data-action="search-close">Закрыть</button>
    </div>
    <div class="search-bar">
      <i data-lucide="search"></i>
      <input id="search-input" type="text" placeholder="Предмет или преподаватель" value="${esc(searchQuery)}">
    </div>
    ${results}
  </div>`;
}

/* ---------- Bottom sheet: добавление предмета ---------- */
function renderSheet(){
  if (!sheetOpen || !draft) return '';
  return `
  <div class="sheet-backdrop" data-action="sheet-close"></div>
  <div class="sheet">
    <div class="sheet-grab"></div>
    <h3>Новый предмет</h3>
    <div class="field"><label>Название</label><input id="f-name" type="text" placeholder="Например, Философия" value="${esc(draft.name)}"></div>
    <div class="field"><label>Время</label><input id="f-time" type="time" value="${esc(draft.time)}"></div>
    <div class="field"><label>Преподаватель</label><input id="f-teacher" type="text" placeholder="Имя преподавателя" value="${esc(draft.teacher)}"></div>
    <div class="field"><label>Цвет</label>
      <div class="swatches">${Object.values(COLORS).map(c => `<button class="swatch ${draft.color === c ? 'selected' : ''}" style="background:${c};" data-action="draft-color" data-color="${c}"></button>`).join('')}</div>
    </div>
    <div class="field"><label>Иконка</label>
      <div class="icon-pick">${PICK_ICONS.map(ic => `<button class="${draft.icon === ic ? 'selected' : ''}" data-action="draft-icon" data-icon="${ic}"><i data-lucide="${ic}"></i></button>`).join('')}</div>
    </div>
    <button class="btn-primary" style="margin-top:8px;" data-action="sheet-save">Добавить предмет</button>
  </div>`;
}

/* ---------- Рендер ---------- */
function render(){
  const app = $('#screen');
  const statusbar = $('#statusbar');
  const tabbar = $('#tabbar');

  let html = '';
  let tab = null;
  let colored = false;

  switch (route.name) {
    case 'onboarding':
      html = setupStep === 0 ? renderOnboardingWelcome() : renderSetupStep();
      break;
    case 'loading': html = renderLoading(); tab = 'home'; break;
    case 'home': html = renderHome(); tab = 'home'; break;
    case 'schedule': html = renderSchedule(); tab = 'schedule'; break;
    case 'lesson': html = renderLesson(route.id); colored = true; break;
    case 'notifications': html = renderNotifications(); tab = 'notifications'; break;
    case 'profile': html = renderProfile(); tab = 'profile'; break;
    case 'settings': html = renderSettings(); break;
    case 'search': html = renderSearch(); break;
    default: html = renderHome(); tab = 'home';
  }

  app.innerHTML = html + renderSheet();
  statusbar.innerHTML = statusBarHTML();
  statusbar.classList.toggle('on-color', colored);
  if (tab) { tabbar.classList.remove('hidden'); tabbar.innerHTML = tabbarHTML(tab); }
  else tabbar.classList.add('hidden');
  icons();

  const si = $('#search-input');
  if (si) {
    si.focus();
    si.setSelectionRange(si.value.length, si.value.length);
    si.oninput = () => { searchQuery = si.value; renderSearchResultsOnly(); };
  }
  bindDraftInputs();
}

function renderSearchResultsOnly(){ render(); }

function bindDraftInputs(){
  const n = $('#f-name'), t = $('#f-time'), p = $('#f-teacher');
  if (n) n.oninput = () => { draft.name = n.value; };
  if (t) t.oninput = () => { draft.time = t.value; };
  if (p) p.oninput = () => { draft.teacher = p.value; };
}

/* ---------- Тосты ---------- */
let toastTimer = null;
function toast(msg){
  const old = $('.toast'); if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  $('#phone').appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2200);
}

/* ---------- Действия ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;

  switch (a) {
    case 'nav': route = { name: el.dataset.to }; render(); break;

    case 'setup-next':
      if (setupStep < 4) { setupStep++; }
      else { state.onboarded = true; saveState(); route = { name:'loading' }; render(); setTimeout(() => { route = { name:'home' }; render(); }, 900); return; }
      render(); break;

    case 'setup-back':
      if (setupStep > 0) setupStep--;
      render(); break;

    case 'pick': {
      const f = el.dataset.field;
      state.setup[f] = f === 'course' ? Number(el.dataset.value) : el.dataset.value;
      saveState(); render(); break;
    }

    case 'chip': state.chips = el.dataset.chip; saveState(); render(); break;
    case 'toggle-all': state.showAllSubjects = !state.showAllSubjects; saveState(); render(); break;

    case 'bookmark': {
      e.stopPropagation();
      const id = el.dataset.id;
      const i = state.bookmarks.indexOf(id);
      if (i >= 0) state.bookmarks.splice(i, 1); else state.bookmarks.push(id);
      saveState(); render(); break;
    }

    case 'open-subject': {
      if (e.target.closest('[data-action="bookmark"]')) return;
      const s = state.subjects.find(x => x.id === el.dataset.id);
      const lesson = s && SCHEDULE.flat().find(l => l.name === s.name);
      if (lesson) { route = { name:'lesson', id: lesson.id }; render(); }
      else toast('Занятий по этому предмету нет на этой неделе');
      break;
    }

    case 'day': selectedDay = Number(el.dataset.day); render(); break;
    case 'open-lesson': route = { name:'lesson', id: el.dataset.id }; render(); break;
    case 'back-schedule': route = { name:'schedule' }; render(); break;

    case 'read-all':
      state.readNotifs = NOTIFS.map(n => n.id);
      saveState(); render(); break;

    case 'cycle-remind': {
      const opts = [5, 10, 15, 30];
      state.remindBefore = opts[(opts.indexOf(state.remindBefore) + 1) % opts.length];
      saveState(); render(); break;
    }
    case 'toggle-changes': state.notifChangesOn = !state.notifChangesOn; saveState(); render(); break;
    case 'theme': render(); break;

    case 'sync': {
      const prev = route;
      route = { name:'loading' }; render();
      setTimeout(() => {
        state.lastSync = Date.now(); saveState();
        route = prev; render();
        toast('Расписание обновлено');
      }, 1100);
      break;
    }

    case 'search-open': searchQuery = ''; route = { name:'search' }; render(); break;
    case 'search-close': route = { name:'schedule' }; render(); break;

    case 'add-subject':
      draft = { name:'', time:'08:00', teacher:'', color:COLORS.purple, icon:'book-open' };
      sheetOpen = true; render(); break;
    case 'sheet-close': sheetOpen = false; draft = null; render(); break;
    case 'draft-color': draft.color = el.dataset.color; render(); break;
    case 'draft-icon': draft.icon = el.dataset.icon; render(); break;
    case 'sheet-save': {
      if (!draft.name.trim()) { toast('Введите название предмета'); return; }
      const teacher = draft.teacher.trim() || 'Преподаватель';
      const parts = teacher.split(/\s+/);
      const initials = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
      state.subjects.push({
        id: 'custom-' + Date.now(),
        name: draft.name.trim(),
        color: draft.color, icon: draft.icon, time: draft.time,
        tInitials: initials,
        tShort: parts[1] ? `${parts[0]} ${parts[1][0]}.` : parts[0],
        tFull: teacher,
      });
      state.showAllSubjects = true;
      sheetOpen = false; draft = null;
      saveState(); render();
      toast('Предмет добавлен');
      break;
    }

    case 'soon': toast('Скоро в следующей версии'); break;
  }
});

/* ---------- Часы, онлайн/офлайн ---------- */
setInterval(() => { const sb = $('#statusbar'); if (sb) sb.innerHTML = statusBarHTML(); icons(); }, 30000);
window.addEventListener('online', render);
window.addEventListener('offline', render);

/* ---------- Старт ---------- */
window.__go = (name, id) => { route = { name, id }; render(); };
(function start(){
  const jump = new URLSearchParams(location.search).get('screen');
  if (jump) {
    const [name, id] = jump.split(':');
    if (name === 'onboarding') { setupStep = Number(id) || 0; route = { name:'onboarding' }; }
    else route = { name, id };
    render();
    return;
  }
  if (state.onboarded) {
    route = { name:'loading' };
    render();
    setTimeout(() => { route = { name:'home' }; render(); }, 900);
  } else {
    render();
  }
})();
