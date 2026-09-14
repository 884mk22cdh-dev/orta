import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, Pressable, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, StyleSheet, Appearance, Alert, Share, Keyboard, Image, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';

import { ErrorBoundary, setCrashScreen } from './src/crash';
import { onNetChange, isOnline, probe } from './src/net';
import { checkPost } from './src/moderation';
import { C, man, int, sh, cardShadow, applyTheme, onThemeChange, themeMode } from './src/theme';
import { setLang, t } from './src/i18n';
import { tr } from './src/tr';
import { Icon, TabBar, PrimaryButton, SwipeBack } from './src/ui';
import { DEFAULT_STATE, SCHEDULE, NOTIFS, PICK_ICONS, EVENT_ICONS, EMPTY_SCHEDULE, mondayIndex, clampDay, setSchedule, toMin, formatPhoneKz, isPhoneValid } from './src/data';
import { findInstitution } from './src/universities';
import { aiAnswer, buildAiContext, adminAnswer, buildAdminContext } from './src/ai';
import {
  BACKEND_ENABLED, supabase, ensureAuth, pushProfile, pushSchedule, pullSchedule,
  fetchForum, sendForumPost, deleteForumPostServer, renameGroup, setGroupCourse,
  fetchGroupTasks, addGroupTask, deleteGroupTask as deleteGroupTaskServer,
  becomeTeacher, myRole, openAttendSession, markByCode, sessionRoster, mySessions, teacherStats, myStudents, studentCard, gradeStudent, teacherReport, excludeStudent, includeStudent, excludedStudents, deleteGrade, deleteSession, setMark as setMarkServer, giveGrade, myGrades, myTeacherMarks,
  fetchEvents, addEventServer, deleteEventServer,
  createGroup, joinGroup, myGroup, leaveGroupServer, getGroupSchedule, getPublicProfile, askAI,
  crashList, deleteMyAccount, adminCheck, adminLoad, adminPublishEvent, adminDeleteEvent, adminGetSchedule,
  coinsState, coinsClaimDaily, coinsClaimTask, coinsClaimReferral, coinsClaimOwnerBonus,
  savePushToken, sendPushToAll, uploadEventPhoto,
  FAILED, sendEmailCode, verifyEmailCode, attachEmail, verifyAttachedEmail, setPassword, signInPassword, myEmail, fetchMyProfile,
} from './src/backend';
import * as Notifications from 'expo-notifications';
import { rescheduleLessonReminders, registerPushToken, ATTEND_PRESENT, ATTEND_ABSENT } from './src/notifications';
import * as ATT from './src/attendance';
import { now as tzNow } from './src/time';
import { updateWidget } from './src/widget';
import * as ImagePicker from 'expo-image-picker';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import {
  WelcomeScreen, SetupScreen, HomeScreen, LessonScreen, AfishaScreen, AiScreen,
  NotificationsScreen, ProfileScreen, SettingsScreen, SearchScreen, LoadingScreen, CoinsScreen, PrivacyScreen, IntroSplash,
  FavoritesScreen, MyPostsScreen, MyNotesScreen, CalendarScreen, TasksScreen, StartScreen, GroupScreen, GroupScanScreen, TeacherScreen, TeacherProfileScreen, TeacherStudentsScreen, TeacherStudentScreen, TeacherReportsScreen, SessionScreen, GradesScreen, AttendanceScreen, PublicProfileScreen, AdminScreen, LoginScreen, AdminStudentScreen, EventScreen,
} from './src/screens';

const LESSON_TYPES = ['Лекция', 'Практика', 'Лаба', 'Семинар'];
const RESEND_DEFAULT = 30; // секунд до кнопки «отправить ещё раз» (сервер пускает через 20)

/* Ссылки наружу: в группу (она же содержимое QR старосты) и «пригласи друга».
   В собранном приложении это https://orta-app.vercel.app/g/КОД и /i/ID — такую
   ссылку мессенджеры делают кликабельной, iOS открывает ORTA сразу (universal
   link), а у кого приложения нет — страница ведёт в App Store. Раньше здесь
   было orta://…, и без приложения ссылка не вела никуда.
   В Expo Go universal links не работают, там остаётся exp://…/--/group/КОД. */
const WEB_URL = 'https://orta-app.vercel.app';
const IN_EXPO_GO = Linking.createURL('/').startsWith('exp');
const groupLink = code => (IN_EXPO_GO
  ? Linking.createURL('group/' + String(code || '').toUpperCase())
  : WEB_URL + '/g/' + String(code || '').toUpperCase());
const inviteLink = id => (IN_EXPO_GO ? Linking.createURL('invite/' + id) : WEB_URL + '/i/' + id);

/* Разбор отсканированного QR: это может быть группа или отметка на паре.
   Код пары — 8 знаков, код группы — 6, поэтому голый код различаем по длине. */
function parseQr(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  const mk = s.match(/mark\/([A-Za-z0-9]{6,12})/);
  if (mk) return { kind: 'mark', code: mk[1].toUpperCase() };
  const gr = s.match(/(?:group|\/g)\/([A-Za-z0-9]{4,12})/);
  if (gr) return { kind: 'group', code: gr[1].toUpperCase() };
  if (/^[A-Za-z0-9]{8}$/.test(s)) return { kind: 'mark', code: s.toUpperCase() };
  if (/^[A-Za-z0-9]{4,12}$/.test(s)) return { kind: 'group', code: s.toUpperCase() };
  return null;
}

const resolveTheme = pref => (pref === 'system'
  ? (Appearance.getColorScheme() === 'dark' ? 'dark' : 'light')
  : (pref === 'dark' ? 'dark' : 'light'));

const LS_KEY = 'student-schedule-state-v1';
const SWATCHES = [C.purple, C.red, C.yellow, C.green, C.blue, C.teal];

function Root() {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState(null); // null = ещё грузим из хранилища
  const [route, setRoute] = useState({ name: 'loading' });
  const [online, setOnline] = useState(true);
  // запоминаем экран, чтобы в отчёте о падении было видно, где это случилось
  useEffect(() => { setCrashScreen(route.name); }, [route.name]);
  useEffect(() => {
    setOnline(isOnline());
    return onNetChange(setOnline);
  }, []);
  const [setupStep, setSetupStep] = useState(0);
  const [selectedDay, setSelectedDay] = useState(clampDay(mondayIndex(tzNow())));
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState(null);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState(null);
  const [eventSheet, setEventSheet] = useState(false);
  const [eventDraft, setEventDraft] = useState(null);
  const [examSheet, setExamSheet] = useState(false);
  const [examDraft, setExamDraft] = useState(null);
  const [profileSheet, setProfileSheet] = useState(false);
  const [profileDraft, setProfileDraft] = useState(null);
  const [sessionSheet, setSessionSheet] = useState(false);
  const [sessionDraft, setSessionDraft] = useState(null);
  const [gradeSheet, setGradeSheet] = useState(false);
  const [gradeDraft, setGradeDraft] = useState(null);
  const [studentGrade, setStudentGrade] = useState(null);
  const [roster, setRoster] = useState([]);
  const [passSheet, setPassSheet] = useState(false);
  const [passDraft, setPassDraft] = useState('');
  const [groupTaskSheet, setGroupTaskSheet] = useState(false);
  const [groupTaskDraft, setGroupTaskDraft] = useState(null);
  const [fieldEdit, setFieldEdit] = useState(null); // { lessonId, field, label, value }
  const [lessonSheet, setLessonSheet] = useState(null); // { dayIdx, existing }
  const [taskSheet, setTaskSheet] = useState(false);
  const [taskDraft, setTaskDraft] = useState(null);
  const [busyGroup, setBusyGroup] = useState(false);
  const [adminData, setAdminData] = useState(null);
  const [crashes, setCrashes] = useState([]);
  const [adminBusy, setAdminBusy] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginSent, setLoginSent] = useState(null); // почта, на которую ушёл код
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupSentTo, setSetupSentTo] = useState(null);
  const [setupCode, setSetupCode] = useState('');
  const [setupPass, setSetupPass] = useState('');
  const [sentAt, setSentAt] = useState(0);      // метка отправки — по ней перезапускается отсчёт
  const [resendIn, setResendIn] = useState(0); // сколько секунд до следующего письма (говорит сервер)
  const [setupMode, setSetupMode] = useState('attach'); // attach — новая почта, login — почта уже занята
  const [streak, setStreak] = useState(0);
  const [lessonDraft, setLessonDraft] = useState(null);
  const [aiMessages, setAiMessages] = useState([]);
  const [aiThinking, setAiThinking] = useState(false);
  const [intro, setIntro] = useState(true);
  const [, forceRender] = useState(0);
  const rerender = useCallback(() => forceRender(x => x + 1), []);
  const [kbOpen, setKbOpen] = useState(false);
  const [photoView, setPhotoView] = useState(null);
  useEffect(() => {
    const a = Keyboard.addListener('keyboardWillShow', () => setKbOpen(true));
    const b = Keyboard.addListener('keyboardWillHide', () => setKbOpen(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  const toastTimer = useRef(null);
  const stateRef = useRef(null);
  stateRef.current = state;

  // Загрузка состояния
  useEffect(() => {
    (async () => {
      let loaded = { ...DEFAULT_STATE };
      try {
        const raw = await AsyncStorage.getItem(LS_KEY);
        if (raw) loaded = { ...DEFAULT_STATE, ...JSON.parse(raw) };
      } catch (e) {}
      setLang(loaded.lang || 'ru');
      applyTheme(resolveTheme(loaded.theme || 'light'));
      setSchedule(loaded.schedule || DEFAULT_STATE.schedule);
      setState(loaded);
      setTimeout(() => {
        setRoute(r => (r && r.name !== 'loading' ? r : { name: loaded.onboarded ? 'home' : 'onboarding' }));
      }, 900);
    })();
  }, []);

  // Первичная синхронизация с облаком (если бэкенд подключён)
  const didSync = useRef(false);
  const uidRef = useRef(null);
  const [cloudReady, setCloudReady] = useState(false);
  useEffect(() => {
    if (!state || !BACKEND_ENABLED || didSync.current) return;
    didSync.current = true;
    (async () => {
      const user = await ensureAuth();
      if (!user) return;
      uidRef.current = user.id;
      pushProfile(state.profile, state.setup);
      const serverSched = await pullSchedule();
      if (serverSched === FAILED) {
        // сервер не ответил — ничего не трогаем, иначе затрём облако локальным
      } else if (serverSched) {
        setSchedule(serverSched);
        patch({ schedule: serverSched });
      } else {
        pushSchedule(state.schedule || DEFAULT_STATE.schedule);
      }
      const posts = await fetchForum(state.setup, state.group);
      if (posts !== FAILED && posts) patch({ forum: posts });
      const evs = await fetchEvents();
      if (evs && evs.length) patch({ events: evs });
      // Почта аккаунта — показываем её в профиле, чтобы было видно, куда вошёл
      // Роль решает, что показывать: преподавателю — журнал, студенту — расписание
      const role = await myRole();
      if (role === 'teacher') {
        patch({ isTeacher: true });
        const ses = await mySessions();
        if (ses?.sessions) patch({ teacherSessions: ses.sessions });
        const tst = await teacherStats();
        if (tst) patch({ teacherStats: tst });
        // на 'home' у преподавателя рисуется журнал — уводить никуда не надо
      } else {
        patch({ isTeacher: false });
        const g = await myGrades();
        if (g) patch({ grades: g });
        const tm = await myTeacherMarks();
        if (tm) patch({ teacherMarks: tm });
      }
      const mail = await myEmail();
      const cur = stateRef.current;
      if (mail && cur?.profile && mail !== cur.profile.email) {
        patch({ profile: { ...cur.profile, email: mail } });
      }
      const g = await myGroup();
      if (g === FAILED) {
        // сеть подвела — оставляем группу как есть, а не «вы больше не в группе»
      } else if (g) {
        patch({ group: g });
        if (g.role === 'member') {
          const gs = await getGroupSchedule();
          if (gs) { setSchedule(gs); patch({ schedule: gs }); }
        }
        const gts = await fetchGroupTasks();
        if (gts) patch({ groupTasks: gts });
      } else if (stateRef.current?.group) {
        patch({ group: null, groupTasks: [], groupTaskDone: {} });
      }
      // O-COIN: ежедневный вход, серия, бонус старосте
      const daily = await coinsClaimDaily();
      if (daily) {
        setStreak(daily.streak || 0);
        if (typeof daily.balance === 'number') patch({ coins: daily.balance });
        if (daily.ok && daily.earned) {
          showToast(daily.week_bonus
            ? `Серия ${daily.streak} дней! +${daily.earned} O-COIN 🔥`
            : `+${daily.earned} за вход · серия ${daily.streak} 🔥`);
        }
      } else {
        const cs = await coinsState();
        if (cs) { setStreak(cs.streak || 0); patch({ coins: cs.balance }); }
      }
      if (g && g.role === 'owner') {
        const ob = await coinsClaimOwnerBonus();
        if (ob?.earned) {
          patch({ coins: ob.balance });
          showToast(`Бонус старосты: +${ob.earned} O-COIN 👑`);
        }
      }
      // пуш-уведомления: регистрируем устройство (только после регистрации —
      // до неё системный запрос перекрывает экран приветствия)
      try {
        if (!stateRef.current?.onboarded) throw new Error('skip');
        const pid = Constants?.expoConfig?.extra?.eas?.projectId;
        const tok = await registerPushToken(pid);
        if (tok) savePushToken(tok);
      } catch (e) {}
      const isAdm = await adminCheck();
      if (isAdm && !stateRef.current?.isAdmin) patch({ isAdmin: true });
      if (isAdm) {
        const d = await adminLoad();
        if (d) setAdminData(d);
      }
      setCloudReady(true);
    })();
  }, [state]);

  // Живой форум: новые посты группы прилетают сами
  useEffect(() => {
    if (!BACKEND_ENABLED || !cloudReady || !stateRef.current?.onboarded) return;
    // Посты сохраняются под КОДОМ группы (backend.groupKey), поэтому и слушать
    // надо его же — иначе живые сообщения не приходят никогда.
    const su = stateRef.current?.setup || {};
    const grp = stateRef.current?.group;
    const key = grp?.code ? grp.code : `${su.university || ''}|${su.group || ''}`;
    const ch = supabase
      .channel('forum-' + key)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'forum_posts', filter: `group_key=eq.${key}` }, payload => {
        const r = payload.new;
        if (!r || r.user_id === uidRef.current) return; // свои уже показаны оптимистично
        setState(prev => {
          if (!prev || (prev.forum || []).some(p => p.id === r.id)) return prev;
          return {
            ...prev,
            forum: [...(prev.forum || []), {
              id: r.id, author: r.author, text: r.body,
              when: new Date(r.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              mine: false,
            }],
          };
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [cloudReady, state?.group?.code, state?.onboarded]);

  // Живое расписание группы: правки старосты прилетают участникам
  const groupRefetchTimer = useRef(null);
  useEffect(() => {
    const g = stateRef.current?.group;
    if (!BACKEND_ENABLED || !cloudReady || !g || g.role !== 'member') return;
    const ch = supabase
      .channel('group-lessons-' + g.code)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lessons', filter: `user_id=eq.${g.owner_id}` }, () => {
        clearTimeout(groupRefetchTimer.current);
        groupRefetchTimer.current = setTimeout(async () => {
          const gs = await getGroupSchedule();
          if (gs) { setSchedule(gs); patch({ schedule: gs }); showToast('Староста обновил расписание'); }
        }, 800);
      })
      .subscribe();
    return () => { clearTimeout(groupRefetchTimer.current); supabase.removeChannel(ch); };
  }, [cloudReady, state?.group?.code]);

  // Входящие ссылки: https://orta-app.vercel.app/g/КОД и /i/ID (universal links),
  // старые orta://group/КОД и orta://invite/ID, в Expo Go — exp://…/--/…
  const actionsRef = useRef(null);
  const routeRef = useRef(null);
  const handleUrl = useCallback(async url => {
    if (!url) return;
    try {
      const parsed = Linking.parse(url);
      const parts = String(parsed.path || '').split('/').filter(Boolean);
      if ((parts[0] === 'group' || parts[0] === 'g') && parts[1]) {
        const code = parts[1].toUpperCase();
        Alert.alert(t('inviteTitle'), `${t('joinThisGroup')}?`, [
          { text: t('cancel'), style: 'cancel' },
          { text: t('joinThisGroup'), onPress: () => actionsRef.current && actionsRef.current.groupJoin(code) },
        ]);
      } else if (parts[0] === 'mark' && parts[1]) {
        const r = await markByCode(parts[1].toUpperCase());
        showToast(r?.ok ? `${t('scanTeacher')}: ${r.subject || ''}`
          : r?.error === 'expired' ? t('scanExpired') : t('groupScanBad'));
        if (r?.ok) setRoute({ name: 'attendance' });
      } else if ((parts[0] === 'profile' || parts[0] === 'invite' || parts[0] === 'i') && parts[1]) {
        const inviter = parts[1];
        const r = await coinsClaimReferral(inviter);
        if (r?.ok) {
          patch({ coins: r.balance });
          showToast('+100 O-COIN за приглашение 🎉');
        }
        const data = await getPublicProfile(inviter);
        if (data) setRoute({ name: 'publicProfile', data });
        else if (!r?.ok) showToast('Профиль не найден');
      }
    } catch (e) {}
  }, []);
  useEffect(() => {
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', e => handleUrl(e.url));
    return () => sub.remove();
  }, [handleUrl]);

  // Виджет: обновляем при возврате в приложение
  useEffect(() => {
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active' && stateRef.current) {
        updateWidget(stateRef.current?.schedule || DEFAULT_STATE.schedule);
      }
    });
    return () => sub.remove();
  }, []);

  // Напоминания о парах: пересобираем при смене расписания, интервала или опроса о посещаемости.
  // Разрешение на уведомления просим ТОЛЬКО после регистрации — на экране приветствия
  // системный запрос выглядит навязчиво и перекрывает кнопку «Продолжить».
  useEffect(() => {
    if (!state) return;
    const sched = state.schedule || DEFAULT_STATE.schedule;
    updateWidget(sched);
    if (!state.onboarded) return;
    rescheduleLessonReminders(sched, state.remindBefore, state.attendAsk !== false);
  }, [state?.onboarded, state?.schedule, state?.remindBefore, state?.attendAsk]);

  // Ответ на уведомление о посещаемости: кнопки «Пришёл» / «Не был» прямо в шторке
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(res => {
      const data = res?.notification?.request?.content?.data || {};
      if (data.kind !== 'attendance' || !data.lessonId) return;
      const act = res.actionIdentifier;
      const status = act === ATTEND_PRESENT ? ATT.PRESENT : act === ATTEND_ABSENT ? ATT.ABSENT : null;
      if (!status) { setRoute({ name: 'attendance' }); return; } // тап по самому уведомлению
      const cur = stateRef.current;
      if (!cur) return;
      // Дата берётся из самого уведомления, а не из «сейчас»: если студент нажал
      // кнопку в понедельник, а приложение открыл в среду, отметка должна лечь на понедельник.
      let when = res?.notification?.date;
      if (typeof when === 'number' && when > 0) when = new Date(when < 1e12 ? when * 1000 : when);
      else when = tzNow();
      const next = ATT.setMark(cur.attendance, ATT.dayKey(when), data.lessonId, status, { name: data.lessonName });
      patch({ attendance: next });
      showToast(status === ATT.PRESENT ? t('attendMarked') : t('attendMarkedAbsent'));
    });
    return () => sub.remove();
  }, []);

  // Системная тема
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      if (stateRef.current?.theme === 'system') {
        applyTheme(colorScheme === 'dark' ? 'dark' : 'light');
        rerender();
      }
    });
    return () => sub.remove();
  }, [rerender]);

  const patch = useCallback(p => {
    setState(prev => {
      const next = { ...prev, ...p };
      AsyncStorage.setItem(LS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // Перевод здесь, а не в каждом из 57 мест вызова: строка сама себе ключ.
  const showToast = useCallback(msg => {
    setToast(tr(msg));
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const actions = {
    nav: name => {
      if (name === 'search') setQuery('');
      // профиль преподавателя — это сводка, она должна быть свежей при каждом заходе
      if (name === 'profile' && stateRef.current?.isTeacher) actionsRef.current.teacherRefresh();
      if (name === 'students') actionsRef.current.studentsRefresh();
      if (name === 'reports') actionsRef.current.reportRefresh();
      if (name === 'admin' && state?.isAdmin && !adminData) {
        adminLoad().then(d => d && setAdminData(d));
        crashList().then(c => c && setCrashes(c));
      }
      // повторный тап по «домику» на главной — возврат к основному виду
      if (name === 'home' && route.name === 'home') {
        patch({ chips: 'subjects' });
        setSelectedDay(clampDay(mondayIndex(tzNow())));
        return;
      }
      setRoute({ name });
    },
    setChips: chips => patch({ chips }),
    bookmark: id => {
      const b = state.bookmarks.includes(id) ? state.bookmarks.filter(x => x !== id) : [...state.bookmarks, id];
      patch({ bookmarks: b });
    },
    openSubject: sub => {
      const lesson = SCHEDULE.flat().find(l => l.name === sub.name);
      if (lesson) setRoute({ name: 'lesson', id: lesson.id });
      else showToast('Занятий по этому предмету нет на этой неделе');
    },
    selectDay: setSelectedDay,
    openLesson: id => setRoute({ name: 'lesson', id }),
    readAll: () => patch({ readNotifs: NOTIFS.map(n => n.id) }),
    cycleRemind: () => {
      const opts = [5, 10, 15, 30];
      patch({ remindBefore: opts[(opts.indexOf(state.remindBefore) + 1) % opts.length] });
    },
    toggleChanges: () => patch({ notifChangesOn: !state.notifChangesOn }),
    toggleAttendAsk: () => patch({ attendAsk: state.attendAsk === false }),
    openPassSheet: () => { setPassDraft(''); setPassSheet(true); },
    savePassword: async () => {
      if (passDraft.length < 6) { showToast('Пароль минимум 6 символов'); return; }
      setLoginBusy(true);
      const r = await setPassword(passDraft);
      setLoginBusy(false);
      if (r.error) { showToast(r.error); return; }
      setPassSheet(false); setPassDraft('');
      showToast(t('passSaved'));
    },
    sync: async () => {
      const prev = route;
      setRoute({ name: 'loading' });
      let ok = true;
      if (BACKEND_ENABLED) {
        // раньше кнопка просто ждала секунду и рапортовала об успехе
        const g = stateRef.current?.group;
        const sched = g && g.role === 'member' ? await getGroupSchedule() : await pullSchedule();
        if (sched === FAILED) ok = false;
        else if (sched) { setSchedule(sched); patch({ schedule: sched }); }

        const evs = await fetchEvents();
        if (evs && evs.length) patch({ events: evs });
        const posts = await fetchForum(stateRef.current?.setup || {}, g);
        if (posts !== FAILED && posts) patch({ forum: posts });
        if (g) { const gts = await fetchGroupTasks(); if (gts) patch({ groupTasks: gts }); }
      }
      patch({ lastSync: Date.now() });
      setRoute(prev);
      showToast(ok ? 'Расписание обновлено' : 'Нет связи с сервером — показываем сохранённое');
    },
    openSheet: () => {
      setDraft({ name: '', time: '08:00', teacher: '', color: C.purple, icon: 'book-open' });
      setSheet(true);
    },
    openEventSheet: () => {
      setEventDraft({ title: '', date: '', place: '', color: C.purple, icon: 'ticket' });
      setEventSheet(true);
    },
    deleteEvent: id => {
      patch({ events: state.events.filter(e => e.id !== id) });
      if (BACKEND_ENABLED && /^[0-9a-f-]{36}$/.test(String(id))) deleteEventServer(id);
      showToast('Событие убрано');
    },
    setTheme: mode => {
      applyTheme(resolveTheme(mode));
      patch({ theme: mode });
    },
    setLang: code => {
      setLang(code);
      patch({ lang: code });
    },
    editLessonField: (lessonId, field, label, value, photos) => setFieldEdit({ lessonId, field, label, value, photos: photos || [] }),
    addForumPost: text => {
      // Правило App Store 1.2: явную брань не пропускаем, иначе приложение
      // с чатом не примут. Всё остальное разбирается жалобами.
      const why = checkPost(text);
      if (why) { showToast(t(why)); return; }
      patch({ forum: [...(state.forum || []), { id: 'f-' + Date.now(), author: state.profile.firstName, text, when: 'только что', mine: true }] });
      if (BACKEND_ENABLED) {
        sendForumPost(state.setup, state.group, state.profile.firstName, text).then(ok => {
          if (!ok) showToast('Пост не отправился — нет соединения');
        });
      }
    },
    deleteForumPost: id => {
      patch({ forum: (state.forum || []).filter(p => p.id !== id) });
      if (BACKEND_ENABLED && /^[0-9a-f-]{36}$/.test(String(id))) deleteForumPostServer(id);
      showToast('Пост удалён');
    },
    openExamSheet: () => {
      setExamDraft({ subject: '', date: '', time: '09:00', room: '', note: '' });
      setExamSheet(true);
    },
    deleteExam: id => {
      patch({ exams: (state.exams || []).filter(x => x.id !== id) });
      showToast('Экзамен убран');
    },
    openProfileSheet: () => {
      setProfileDraft({ ...state.profile, ...state.setup });
      setProfileSheet(true);
    },
    removeSubject: sub => {
      if (String(sub.id).startsWith('custom-')) {
        patch({ subjects: state.subjects.filter(x => x.id !== sub.id) });
        showToast('Предмет удалён');
      } else {
        showToast('Базовые предметы удалить нельзя');
      }
    },
    refreshed: () => {
      // тихое реальное обновление: данные, метки «сейчас», форум и афиша из облака
      patch({ lastSync: Date.now() });
      if (BACKEND_ENABLED) {
        fetchForum(state.setup, state.group).then(posts => {
          if (posts !== FAILED && posts) patch({ forum: posts });
        });
        fetchEvents().then(evs => {
          if (evs && evs.length) patch({ events: evs });
        });
        // ДЗ от старосты: список может измениться в любой момент
        if (state.group) fetchGroupTasks().then(gts => { if (gts) patch({ groupTasks: gts }); });
        // расписание группы ведёт староста — участнику подтягиваем свежее
        if (state.group?.role === 'member') {
          getGroupSchedule().then(gs => { if (gs) { setSchedule(gs); patch({ schedule: gs }); } });
        }
      }
    },
    toast: showToast,
    openLessonEditor: (dayIdx, existing) => {
      if (state.group && state.group.role === 'member') { showToast(t('groupEditBlocked')); return; }
      setLessonSheet({ dayIdx, existing });
      setLessonDraft(existing
        ? { name: existing.name, start: existing.start, end: existing.end, room: existing.room, teacher: existing.teacher, type: existing.type === 'Лабораторная' ? 'Лаба' : (LESSON_TYPES.includes(existing.type) ? existing.type : 'Лекция'), color: existing.color, cancelled: !!existing.cancelled }
        : { name: '', start: '09:00', end: '10:30', room: '', teacher: '', type: 'Лекция', color: C.purple, cancelled: false });
    },
    logout: () => {
      Alert.alert(tr('Выйти из аккаунта?'), 'Данные этого аккаунта уберутся с телефона — они останутся на сервере и вернутся при следующем входе.', [
        { text: tr('Отмена'), style: 'cancel' },
        {
          text: 'Выйти', style: 'destructive',
          onPress: async () => {
            if (BACKEND_ENABLED && supabase) { try { await supabase.auth.signOut(); } catch (e) {} }
            uidRef.current = null;
            didSync.current = false;
            // Чистим всё личное: иначе следующий человек на этом телефоне
            // увидит чужое расписание, монеты и оценки.
            setSchedule(EMPTY_SCHEDULE());
            setStreak(0); setRoster([]); setAdminData(null); setAiMessages([]);
            patch({
              setup: { ...DEFAULT_STATE.setup, city: '', university: '', faculty: '', group: '', role: 'student' },
              onboarded: false, isAdmin: false, isTeacher: false, group: null,
              schedule: EMPTY_SCHEDULE(), subjects: [], events: [], tasks: [], exams: [],
              lessonData: {}, bookmarks: [], attendance: {}, forum: [],
              groupTasks: [], groupTaskDone: {}, grades: [], teacherSessions: [], teacherStats: null, students: [], excluded: [], report: null, coins: 0,
              profile: { ...DEFAULT_STATE.profile, firstName: '', lastName: '', initials: '', phone: '', email: '' },
            });
            setSetupStep(0);
            setRoute({ name: 'onboarding' });
          },
        },
      ]);
    },
    // Правило App Store 5.1.1(v): удаление аккаунта должно быть в приложении.
    // Спрашиваем дважды — действие необратимое, и данные уходят с сервера тоже.
    deleteAccount: () => {
      Alert.alert(t('delAccount') + '?', t('delAccountWarn'), [
        { text: tr('Отмена'), style: 'cancel' },
        {
          text: t('delAccountGo'), style: 'destructive',
          onPress: () => Alert.alert(t('delAccountSure'), t('delAccountSureSub'), [
            { text: tr('Отмена'), style: 'cancel' },
            {
              text: t('delAccountGo'), style: 'destructive',
              onPress: async () => {
                setBusyGroup(true);
                const r = await deleteMyAccount();
                setBusyGroup(false);
                if (!r || r.error) { showToast(t('delAccountFail')); return; }
                // на телефоне тоже ничего не оставляем
                try { await AsyncStorage.removeItem(LS_KEY); } catch (e) {}
                const fresh = JSON.parse(JSON.stringify(DEFAULT_STATE));
                setSchedule(fresh.schedule);
                setAiMessages([]);
                setState(fresh);
                setSetupStep(0);
                setRoute({ name: 'onboarding' });
                showToast(t('delAccountDone'));
              },
            },
          ]),
        },
      ]);
    },
    clearData: () => {
      Alert.alert(tr('Очистить все данные?'), 'Профиль, предметы, заметки и настройки будут удалены. Это действие нельзя отменить.', [
        { text: tr('Отмена'), style: 'cancel' },
        {
          text: 'Очистить', style: 'destructive',
          onPress: async () => {
            try { await AsyncStorage.removeItem(LS_KEY); } catch (e) {}
            const fresh = JSON.parse(JSON.stringify(DEFAULT_STATE));
            setLang('ru');
            applyTheme('light');
            setSchedule(fresh.schedule);
            setAiMessages([]);
            setState(fresh);
            setSetupStep(0);
            setRoute({ name: 'onboarding' });
            showToast('Данные очищены');
          },
        },
      ]);
    },
    reportPost: p => {
      Alert.alert(tr('Сообщение от ') + p.author, 'Что сделать?', [
        { text: tr('Отмена'), style: 'cancel' },
        {
          text: 'Пожаловаться', style: 'destructive',
          onPress: () => {
            patch({ forum: (state.forum || []).filter(x => x.id !== p.id) });
            if (BACKEND_ENABLED && /^[0-9a-f-]{36}$/.test(String(p.id))) deleteForumPostServer(p.id).catch(() => {});
            Linking.openURL('mailto:oscaraltyn@gmail.com?subject=' + encodeURIComponent('Жалоба на сообщение в ORTA') +
              '&body=' + encodeURIComponent('Автор: ' + p.author + '\nТекст: ' + p.text + '\nID: ' + p.id)).catch(() => {});
            showToast('Жалоба отправлена, сообщение скрыто');
          },
        },
        {
          text: 'Скрыть автора',
          onPress: () => {
            patch({ blocked: [...(state.blocked || []), p.author] });
            showToast('Сообщения этого автора скрыты');
          },
        },
      ]);
    },
    toggleTask: async id => {
      const task = (state.tasks || []).find(x => x.id === id);
      if (!task) return;
      const nowDone = !task.done;
      patch({ tasks: state.tasks.map(x => x.id === id ? { ...x, done: nowDone } : x) });
      if (!nowDone) return;                     // снятие галочки монеты не отнимает
      if (BACKEND_ENABLED) {
        const r = await coinsClaimTask(id);
        if (r) {
          patch({ coins: r.balance });
          if (r.ok) showToast(`+10 O-COIN${r.left_today > 0 ? ` · сегодня ещё ${r.left_today}` : ''}`);
          else if (r.reason === 'daily_limit') showToast(t('coinsDailyLimit').replace('{n}', r.limit || 5));
        }
        return;
      }
      patch({ coins: (state.coins ?? 0) + 10 });
      showToast('+10 O-COIN');
    },
    deleteTask: id => {
      patch({ tasks: (state.tasks || []).filter(x => x.id !== id) });
      showToast(t('taskDeleted'));
    },
    openTaskSheet: () => {
      setTaskDraft({ title: '', due: '', subject: '' });
      setTaskSheet(true);
    },
    groupCreate: async () => {
      if (busyGroup) return;
      setBusyGroup(true);
      await pushSchedule(state.schedule || DEFAULT_STATE.schedule);
      const g = await createGroup(state.setup.group || 'Моя группа', state.setup.university || '');
      setBusyGroup(false);
      if (!g) { showToast('Нет соединения с сервером'); return; }
      patch({ group: g });
      showToast(t('groupCreated'));
    },
    // ДЗ от старосты: своя отметка «сделано» у каждого, на сервер не уходит
    toggleGroupTask: id => {
      const d = { ...(state.groupTaskDone || {}) };
      if (d[id]) delete d[id]; else d[id] = true;
      patch({ groupTaskDone: d });
    },
    openGroupTaskSheet: () => {
      setGroupTaskDraft({ title: '', subject: '', due: '', note: '', photos: [] });
      setGroupTaskSheet(true);
    },
    deleteGroupTask: task => {
      Alert.alert(tr('Удалить ДЗ?'), task.title, [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: async () => {
            const doneLeft = { ...(state.groupTaskDone || {}) };
            delete doneLeft[task.id];
            patch({ groupTasks: (state.groupTasks || []).filter(x => x.id !== task.id), groupTaskDone: doneLeft });
            const ok = await deleteGroupTaskServer(task.id);
            if (!ok) { showToast('Не удалось удалить — обновите список'); return; }
            showToast('ДЗ удалено у всей группы');
          },
        },
      ]);
    },
    publishGroupTask: async () => {
      const d = groupTaskDraft;
      if (!d || !d.title.trim()) { showToast('Что задали? Впишите задание'); return; }
      setBusyGroup(true);
      const urls = [];
      let photoErr = null;
      for (const uri of (d.photos || [])) {
        const r = await uploadEventPhoto(uri);
        if (r && r.url) urls.push(r.url); else photoErr = (r && r.error) || 'неизвестно';
      }
      const res = await addGroupTask({ ...d, title: d.title.trim(), photos: urls });
      setBusyGroup(false);
      if (res.error) {
        showToast(res.error === 'not_owner' ? 'Публиковать ДЗ может только староста'
          : res.error === 'empty' ? 'Впишите задание' : 'Не удалось опубликовать: ' + res.error);
        return;
      }
      patch({ groupTasks: [res.task, ...(state.groupTasks || [])] });
      setGroupTaskSheet(false); setGroupTaskDraft(null);
      showToast(photoErr ? 'ДЗ опубликовано, но фото не загрузились: ' + photoErr : 'ДЗ появилось у всей группы');
    },
    /* ---------- Преподаватель ---------- */
    teacherRefresh: async () => {
      const r = await mySessions();
      if (r?.sessions) patch({ teacherSessions: r.sessions });
      const tst = await teacherStats();
      if (tst) patch({ teacherStats: tst });
    },
    studentsRefresh: async () => {
      const r = await myStudents();
      if (r) patch({ students: r });
      const ex = await excludedStudents();
      if (ex) patch({ excluded: ex });
    },
    reportRefresh: async () => {
      const r = await teacherReport();
      if (r) patch({ report: r });
    },
    openStudent: async st => {
      // показываем то, что уже знаем из списка, а карточку подтягиваем следом —
      // иначе экран висит пустым, пока идёт запрос
      setRoute({ name: 'student', data: { student_id: st.student_id, name: st.name, group_name: st.group_name, course: st.course, marks: [], grades: [] } });
      const card = await studentCard(st.student_id);
      if (card && routeRef.current?.name === 'student') setRoute({ name: 'student', data: card });
    },
    openStudentGrade: card => {
      setStudentGrade({ card, subject: '', value: '', comment: '' });
    },
    // Исключение мягкое: отметки и оценки остаются, студент видит их у себя.
    // Поэтому и спрашиваем спокойно, и вернуть можно одним нажатием.
    excludeStudent: card => {
      Alert.alert(`${t('tsExclude')}?`, `${card.name || ''}\n\n${t('tsExcludeHint')}`, [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('tsExclude'), style: 'destructive',
          onPress: async () => {
            const r = await excludeStudent(card.student_id);
            if (!r || r.error) { showToast(r?.error === 'not_yours' ? 'Это не ваш студент' : 'Не получилось'); return; }
            showToast(t('tsExcluded1'));
            setRoute({ name: 'students' });
            actionsRef.current.studentsRefresh();
            actionsRef.current.teacherRefresh();
          },
        },
      ]);
    },
    includeStudent: async st => {
      const r = await includeStudent(st.student_id);
      if (!r || r.error) { showToast('Не получилось'); return; }
      showToast(t('tsIncluded1'));
      actionsRef.current.studentsRefresh();
      actionsRef.current.teacherRefresh();
    },
    deleteGrade: (g, card) => {
      Alert.alert(`${t('tsDelGrade')}?`, `${g.value}${g.subject ? ` · ${g.subject}` : ''}\n${t('cannotUndo')}`, [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: async () => {
            const r = await deleteGrade(g.id);
            if (!r || r.error) { showToast('Не получилось удалить'); return; }
            showToast(t('tsGradeDeleted'));
            const fresh = await studentCard(card.student_id);
            if (fresh && routeRef.current?.name === 'student') setRoute({ name: 'student', data: fresh });
            actionsRef.current.studentsRefresh();
            actionsRef.current.teacherRefresh();
          },
        },
      ]);
    },
    deleteSession: sess => {
      const n = sess.marks || 0;
      Alert.alert(`${t('tsDelSession')}?`,
        `${sess.subject || t('lessonNoName')}\n${n ? tPlural(n, 'tsMarksN') + ' ' + t('tsWillGo') : t('tsNoMarksYet')}\n${t('cannotUndo')}`, [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('delete'), style: 'destructive',
          onPress: async () => {
            const r = await deleteSession(sess.id);
            if (!r || r.error) { showToast('Не получилось удалить'); return; }
            showToast(t('tsSessionDeleted'));
            actionsRef.current.teacherRefresh();
            actionsRef.current.reportRefresh();
            actionsRef.current.studentsRefresh();
          },
        },
      ]);
    },
    saveStudentGrade: async () => {
      const d = studentGrade;
      if (!d?.value.trim()) { showToast('Впишите оценку'); return; }
      setBusyGroup(true);
      const r = await gradeStudent(d.card.student_id, d.subject.trim(), d.value.trim(), d.comment.trim());
      setBusyGroup(false);
      if (!r || r.error) {
        showToast(r?.error === 'not_yours' ? 'Это не ваш студент' : 'Не удалось поставить оценку');
        return;
      }
      setStudentGrade(null);
      showToast(t('gradeSaved'));
      const card = await studentCard(d.card.student_id);
      if (card && routeRef.current?.name === 'student') setRoute({ name: 'student', data: card });
      actionsRef.current.studentsRefresh();
    },
    openSessionSheet: () => {
      setSessionDraft({ subject: '', room: '', minutes: '10' });
      setSessionSheet(true);
    },
    startSession: async () => {
      const d = sessionDraft;
      if (!d?.subject.trim()) { showToast('Укажите предмет'); return; }
      setBusyGroup(true);
      const r = await openAttendSession(d.subject.trim(), d.room.trim(), parseInt(d.minutes, 10) || 10);
      setBusyGroup(false);
      if (!r || r.error || !r.id) {
        showToast(r?.error === 'not_teacher' ? 'Только для преподавателей' : 'Не удалось открыть отметку');
        return;
      }
      setSessionSheet(false); setSessionDraft(null);
      setRoute({ name: 'session', data: r });
      actionsRef.current.refreshRoster(r.id);
      actionsRef.current.teacherRefresh();
    },
    openSession: sess => {
      setRoute({ name: 'session', data: sess });
      actionsRef.current.refreshRoster(sess.id);
    },
    refreshRoster: async id => {
      const sid = id || routeRef.current?.data?.id;
      if (!sid) return;
      const r = await sessionRoster(sid);
      if (r?.roster) setRoster(r.roster);
    },
    setMark: async (studentId, status) => {
      const sid = routeRef.current?.data?.id;
      if (!sid) return;
      setRoster(prev => prev.map(x => (x.student_id === studentId ? { ...x, status } : x)));
      const r = await setMarkServer(sid, studentId, status);
      if (r?.error) { showToast('Не удалось отметить'); actionsRef.current.refreshRoster(); return; }
      actionsRef.current.refreshRoster();
    },
    openGradeSheet: student => {
      setGradeDraft({ student, value: '', comment: '' });
      setGradeSheet(true);
    },
    saveGrade: async () => {
      const d = gradeDraft;
      if (!d?.value.trim()) { showToast('Впишите оценку'); return; }
      setBusyGroup(true);
      const subject = routeRef.current?.data?.subject || '';
      const r = await giveGrade(d.student.student_id, subject, d.value.trim(), d.comment.trim());
      setBusyGroup(false);
      if (r?.error) { showToast('Не удалось поставить оценку'); return; }
      setGradeSheet(false); setGradeDraft(null);
      showToast(t('gradeSaved'));
    },
    gradesRefresh: async () => {
      const g = await myGrades();
      if (g) patch({ grades: g });
      const tm = await myTeacherMarks();
      if (tm) patch({ teacherMarks: tm });
    },
    // Развилка после регистрации
    startAsOwner: async () => {
      await actionsRef.current.groupCreate();
      setRoute({ name: 'calendar' });
      showToast('Заполните расписание — группа получит его по QR');
    },
    startSolo: () => {
      setRoute({ name: 'calendar' });
      showToast('Добавьте первую пару кнопкой «+»');
    },
    // Отметка посещаемости. status = null снимает отметку.
    attendMark: (date, lesson, status) => {
      const next = ATT.setMark(state.attendance, date, lesson.id, status, { name: lesson.name });
      patch({ attendance: next });
      showToast(status === ATT.PRESENT ? t('attendMarked')
        : status === ATT.LATE ? t('attendMarkedLate')
        : status === ATT.ABSENT ? t('attendMarkedAbsent') : t('attendCleared'));
    },
    // QR отсканирован: достаём код из ссылки orta://group/КОД (или exp://…/--/group/КОД)
    groupScanned: async (raw, release) => {
      const q = parseQr(raw);
      if (!q) { showToast(t('groupScanBad')); setTimeout(() => release && release(), 1500); return; }

      // QR преподавателя: отмечаемся на паре
      if (q.kind === 'mark') {
        const r = await markByCode(q.code);
        if (r?.ok) {
          showToast(`${t('scanTeacher')}: ${r.subject || ''}${r.status === 'late' ? ' · опоздание' : ''}`);
          const tm = await myTeacherMarks();
          if (tm) patch({ teacherMarks: tm });
          setRoute({ name: 'attendance' });
          return;
        }
        const msg = r?.error === 'expired' ? t('scanExpired')
          : r?.error === 'self' ? t('scanSelf') : t('groupScanBad');
        showToast(msg);
        setTimeout(() => release && release(), 1500);
        return;
      }

      actionsRef.current.groupJoin(q.code, ok => {
        // после вступления сразу показываем расписание — ради него всё и затевалось
        if (ok) setRoute({ name: 'home' });
        else setTimeout(() => release && release(), 1500);
      });
    },
    groupJoin: async (code, done) => {
      if (busyGroup) { done && done(false); return; }
      setBusyGroup(true);
      const g = await joinGroup(code);
      // Курс не совпал: четверокурсник не попадёт в группу первого курса
      if (g && g.error === 'course_mismatch') {
        setBusyGroup(false);
        showToast(t('groupWrongCourse').replace('{n}', g.group_course).replace('{my}', g.my_course));
        done && done(false); return;
      }
      if (!g || g.error) { setBusyGroup(false); showToast(t('groupNotFound')); done && done(false); return; }
      const gs = g.role === 'member' ? await getGroupSchedule() : null;
      if (gs) setSchedule(gs);
      patch({
        group: g,
        ...(gs ? { schedule: gs } : {}),
        setup: { ...state.setup, group: g.name || state.setup.group, university: g.university || state.setup.university },
      });
      pushProfile(state.profile, { ...state.setup, group: g.name, university: g.university });
      setBusyGroup(false);
      showToast(t('groupJoined'));
      done && done(true);
      const posts = await fetchForum(state.setup, g);
      if (posts !== FAILED && posts) patch({ forum: posts });
      const gts = await fetchGroupTasks();
      if (gts) patch({ groupTasks: gts });
    },
    groupLeave: () => {
      Alert.alert(t('groupLeave') + '?', '', [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('groupLeave'), style: 'destructive',
          onPress: async () => {
            const ok = await leaveGroupServer();
            patch({ group: null, groupTasks: [], groupTaskDone: {} });
            showToast(ok ? t('groupLeft') : 'Вышли на этом телефоне, но сервер не ответил');
          },
        },
      ]);
    },
    groupShare: () => {
      const g = state.group;
      if (!g) return;
      Share.share({
        message: t('groupShareMsg').replace('{name}', g.name || '') + '\n' + groupLink(g.code),
      }).catch(() => {});
    },
    shareProfile: () => {
      const p = state.profile, su = state.setup;
      const link = uidRef.current ? '\n' + inviteLink(uidRef.current) : '';
      Share.share({
        message: `${p.firstName} ${p.lastName} — ${su.university}${su.faculty ? ', ' + su.faculty : ''}, ${su.course} курс.\nПрисоединяйся к ORTA 🎓 Нам обоим дадут по 100 O-COIN 🪙${link}`,
      }).catch(() => {});
    },
    adminRefresh: async () => {
      setAdminBusy(true);
      const d = await adminLoad();
      if (d) setAdminData(d);
      setAdminBusy(false);
    },
    adminRecheck: async () => {
      setAdminBusy(true);
      const ok = await adminCheck();
      setAdminBusy(false);
      patch({ isAdmin: ok });
      showToast(ok ? 'Доступ подтверждён! 👑' : 'Пока нет доступа — выполните SQL и попробуйте снова');
      if (ok) {
        const d = await adminLoad();
        if (d) setAdminData(d);
      }
    },
    adminCopySql: async () => {
      const uid = uidRef.current;
      if (!uid) { showToast('Нет соединения с сервером'); return; }
      const sql = `-- Активация админа для этого устройства ORTA
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now());
alter table public.admins enable row level security;
drop policy if exists "admins self" on public.admins;
create policy "admins self" on public.admins for select using (auth.uid() = user_id);
create or replace function public.is_admin() returns boolean
language sql security definer set search_path = public as
$$ select exists (select 1 from admins where user_id = auth.uid()) $$;
drop policy if exists "admin read profiles" on public.profiles;
create policy "admin read profiles" on public.profiles for select using (public.is_admin());
drop policy if exists "admin read groups" on public.groups;
create policy "admin read groups" on public.groups for select using (public.is_admin());
drop policy if exists "admin read members" on public.group_members;
create policy "admin read members" on public.group_members for select using (public.is_admin());
drop policy if exists "admin read forum" on public.forum_posts;
create policy "admin read forum" on public.forum_posts for select using (public.is_admin());
drop policy if exists "admin events select" on public.events;
create policy "admin events select" on public.events for select using (public.is_admin());
drop policy if exists "admin events insert" on public.events;
create policy "admin events insert" on public.events for insert with check (public.is_admin());
drop policy if exists "admin events delete" on public.events;
create policy "admin events delete" on public.events for delete using (public.is_admin());
insert into public.admins (user_id) values ('${uid}') on conflict do nothing;`;
      await Clipboard.setStringAsync(sql);
      showToast('SQL скопирован — вставьте в SQL Editor и Run');
    },
    adminPickPhotos: async (current, onDone) => {
      try {
        const left = Math.max(0, 5 - (current || []).length);
        if (!left) { showToast('Максимум 5 фото'); return; }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'], quality: 0.7, allowsMultipleSelection: true, selectionLimit: left,
        });
        if (res.canceled || !res.assets?.length) return;
        onDone([...(current || []), ...res.assets.map(a => a.uri)].slice(0, 5));
      } catch (e) {
        showToast('Не удалось открыть галерею');
      }
    },
    viewPhoto: uri => setPhotoView(uri),
    openPhoto: uri => setPhotoView(uri),
    openEvent: ev => setRoute({ name: 'event', data: ev }),
    shareEvent: ev => {
      Share.share({ message: `${ev.title}\n${ev.date}${ev.place ? ' · ' + ev.place : ''}${ev.description ? '\n\n' + ev.description : ''}\n\nАфиша в ORTA 🎓` }).catch(() => {});
    },
    adminPublish: async ev => {
      setAdminBusy(true);
      const urls = [];
      let lastErr = null;
      for (const uri of (ev.photos || [])) {
        const r = await uploadEventPhoto(uri);
        if (r && r.url) urls.push(r.url); else lastErr = (r && r.error) || 'неизвестно';
      }

      const res = await adminPublishEvent({ ...ev, photos: urls });
      const ok = res && res.ok;
      if (!ok) showToast('Ошибка: ' + ((res && res.error) || 'не удалось опубликовать'));
      if (ok) {
        const n = await sendPushToAll('ORTA · ' + ev.title, `${ev.date}${ev.place ? ' · ' + ev.place : ''}`);
        const d = await adminLoad();
        if (d) setAdminData(d);
        const evs = await fetchEvents();
        if (evs && evs.length) patch({ events: evs });
        showToast(lastErr
          ? `Опубликовано, но фото не загрузилось: ${lastErr}`
          : `Опубликовано! 🎉 Уведомлений отправлено: ${n}`);
      }
      setAdminBusy(false);
      return ok;
    },
    adminOpenStudent: async p => {
      showToast('Загружаем расписание…');
      const sched = await adminGetSchedule(p.id);
      setRoute({ name: 'adminStudent', data: { profile: p, schedule: sched } });
    },
    adminDelete: async id => {
      await adminDeleteEvent(id);
      showToast('Удалено');
      const d = await adminLoad();
      if (d) setAdminData(d);
    },
    refreshWidget: () => {
      const info = updateWidget(state.schedule || DEFAULT_STATE.schedule);
      showToast('Виджет: ' + info);
    },
  };

  actionsRef.current = actions;
  routeRef.current = route;

  const saveTask = () => {
    if (!taskDraft.title.trim()) { showToast(t('taskTitle')); return; }
    patch({
      tasks: [...(state.tasks || []), {
        id: 'task-' + Date.now(),
        title: taskDraft.title.trim(),
        due: taskDraft.due.trim(),
        subject: taskDraft.subject.trim(),
        done: false,
      }],
    });
    setTaskSheet(false); setTaskDraft(null);
    showToast(t('taskAdded'));
  };

  const updateSchedule = sched => {
    setSchedule(sched);
    patch({ schedule: sched });
    if (BACKEND_ENABLED) {
      pushSchedule(sched).then(ok => { if (!ok) showToast('Расписание не сохранилось в облаке'); });
    }
  };

  const saveLesson = () => {
    const d = lessonDraft;
    if (!d.name.trim()) { showToast('Введите название предмета'); return; }
    if (!/^\d{1,2}:\d{2}$/.test(d.start.trim()) || !/^\d{1,2}:\d{2}$/.test(d.end.trim())) {
      showToast('Время в формате 09:00'); return;
    }
    const teacher = d.teacher.trim() || 'Преподаватель';
    const parts = teacher.split(/\s+/);
    const sched = (state.schedule || DEFAULT_STATE.schedule).map(day => day.slice());
    const day = sched[lessonSheet.dayIdx];
    const lesson = {
      id: lessonSheet.existing?.id || 'les-' + Date.now(),
      start: d.start.trim(), end: d.end.trim(),
      name: d.name.trim(),
      room: d.room.trim() || '—',
      teacher,
      tInitials: ((parts[0][0] || '') + (parts[1] ? parts[1][0] : '')).toUpperCase(),
      color: d.color,
      type: d.type === 'Лаба' ? 'Лабораторная' : d.type,
      tag: d.type === 'Лекция' ? null : d.type,
      cancelled: d.cancelled,
      building: lessonSheet.existing?.building || '—',
      icon: lessonSheet.existing?.icon || 'book-open',
      badge: lessonSheet.existing?.badge,
    };
    const i = day.findIndex(l => l.id === lesson.id);
    if (i >= 0) day[i] = lesson; else day.push(lesson);
    day.sort((a, b) => toMin(a.start) - toMin(b.start));
    updateSchedule(sched);
    setLessonSheet(null); setLessonDraft(null);
    showToast(i >= 0 ? 'Пара обновлена' : 'Пара добавлена');
  };

  const deleteLesson = () => {
    const sched = (state.schedule || DEFAULT_STATE.schedule).map(day => day.slice());
    sched[lessonSheet.dayIdx] = sched[lessonSheet.dayIdx].filter(l => l.id !== lessonSheet.existing.id);
    updateSchedule(sched);
    setLessonSheet(null); setLessonDraft(null);
    showToast('Пара удалена');
  };

  const pickFieldPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (res.canceled || !res.assets?.length) return;
      let uri = res.assets[0].uri;
      try {
        const dest = FileSystem.documentDirectory + 'orta-' + Date.now() + '.jpg';
        await FileSystem.copyAsync({ from: uri, to: dest });
        uri = dest;
      } catch (e) {}
      setFieldEdit(f => (f ? { ...f, photos: [...(f.photos || []), uri] } : f));
    } catch (e) {
      showToast('Не удалось открыть галерею');
    }
  };

  const saveFieldEdit = () => {
    const { lessonId, field, value, photos } = fieldEdit;
    const ld = { ...(state.lessonData || {}) };
    ld[lessonId] = { ...(ld[lessonId] || {}), [field]: value.trim(), [field + '_photos']: photos || [] };
    patch({ lessonData: ld });
    setFieldEdit(null);
    showToast('Сохранено');
  };

  const saveExam = () => {
    if (!examDraft.subject.trim()) { showToast('Введите название предмета'); return; }
    const match = state.subjects.find(su => su.name.toLowerCase() === examDraft.subject.trim().toLowerCase());
    patch({
      exams: [...(state.exams || []), {
        id: 'ex-' + Date.now(),
        subject: examDraft.subject.trim(),
        date: examDraft.date.trim() || 'Дата уточняется',
        time: examDraft.time.trim() || '09:00',
        room: examDraft.room.trim() || '—',
        note: (examDraft.note || '').trim(),
        color: match ? match.color : C.purple,
      }],
    });
    setExamSheet(false); setExamDraft(null);
    showToast('Экзамен добавлен');
  };

  const saveProfile = () => {
    const d = profileDraft;
    if (!d.firstName.trim()) { showToast('Введите имя'); return; }
    if ((d.phone || '').trim() && !isPhoneValid(d.phone)) { showToast('Номер: +7 и 10 цифр, например +7 700 700 70 70'); return; }
    const fn = d.firstName.trim(), ln = d.lastName.trim();
    const newProfile = { firstName: fn, lastName: ln, initials: ((fn[0] || '') + (ln[0] || '')).toUpperCase() || 'С', phone: (d.phone || '').trim() };
    const newSetup = state?.isAdmin ? state.setup : {
      ...state.setup,
      university: d.university.trim() || state.setup.university,
      faculty: d.faculty.trim() || state.setup.faculty,
      course: Math.min(4, Math.max(1, parseInt(d.course, 10) || state.setup.course)),
      group: (d.group || '').trim(),
    };
    patch({ profile: newProfile, setup: newSetup });
    if (BACKEND_ENABLED) pushProfile(newProfile, newSetup);

    // Староста переименовал свою группу в профиле — тянем изменение на сервер,
    // иначе на карточке остаётся старое название.
    const g = state.group;
    if (BACKEND_ENABLED && g && g.role === 'owner') {
      const wantName = newSetup.group || g.name;
      (async () => {
        let next = g;
        if (wantName && wantName !== g.name) {
          const r = await renameGroup(wantName);
          if (r) next = r;
        }
        if (newSetup.course !== state.setup.course) {
          await setGroupCourse(newSetup.course);
          next = { ...next, course: newSetup.course };
        }
        if (next !== g) patch({ group: next });
      })();
    }

    setProfileSheet(false); setProfileDraft(null);
    showToast('Профиль обновлён');
  };

  const onAiSend = async msg => {
    setAiMessages(m => [...m, { role: 'user', text: msg }]);
    setAiThinking(true);
    const isAdm = !!state?.isAdmin;
    let answer = null;
    if (BACKEND_ENABLED) {
      answer = await askAI(msg, isAdm ? buildAdminContext(adminData, state) : buildAiContext(state));
    }
    if (!answer) answer = isAdm ? adminAnswer(msg, adminData, state) : aiAnswer(msg, state);
    setAiThinking(false);
    setAiMessages(m => [...m, { role: 'ai', text: answer }]);
  };

  const saveEvent = () => {
    if (!eventDraft.title.trim()) { showToast('Введите название события'); return; }
    const newEvent = {
      id: 'ev-' + Date.now(),
      title: eventDraft.title.trim(),
      date: eventDraft.date.trim() || 'Дата уточняется',
      place: eventDraft.place.trim() || 'Место уточняется',
      color: eventDraft.color, icon: eventDraft.icon, custom: true,
    };
    patch({ events: [...(state.events || []), newEvent] });
    if (BACKEND_ENABLED) addEventServer(newEvent);
    setEventSheet(false); setEventDraft(null);
    showToast('Событие добавлено в афишу');
  };

  const saveDraft = () => {
    if (!draft.name.trim()) { showToast('Введите название предмета'); return; }
    const teacher = draft.teacher.trim() || 'Преподаватель';
    const parts = teacher.split(/\s+/);
    const initials = (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
    patch({
      subjects: [...state.subjects, {
        id: 'custom-' + Date.now(),
        name: draft.name.trim(),
        color: draft.color, icon: draft.icon, time: draft.time,
        tInitials: initials,
        tShort: parts[1] ? `${parts[0]} ${parts[1][0]}.` : parts[0],
        tFull: teacher,
      }],
      showAllSubjects: true,
    });
    setSheet(false); setDraft(null);
    showToast('Предмет добавлен');
  };

  // Вход по коду из письма: код проверяет Supabase, подобрать нельзя
  const sendCode = async (mail, waitSecs) => {
    if (waitSecs > 0) { showToast(`Новый код можно запросить через ${waitSecs} с`); return; }
    setLoginBusy(true);
    const res = await sendEmailCode(mail);
    setLoginBusy(false);
    if (res.error) {
      const wait = res.retryAfter;
      setLoginSent(mail); setSentAt(Date.now()); setResendIn(wait || RESEND_DEFAULT);
      showToast(wait ? `Код уже отправлен. Новый — через ${wait} с` : res.error);
      return;
    }
    setLoginSent(mail); setSentAt(Date.now()); setResendIn(RESEND_DEFAULT);
    showToast('Код отправлен на ' + mail);
  };

  const loginWithPassword = async (mail, pass) => {
    setLoginBusy(true);
    const res = await signInPassword(mail, pass);
    if (res.error) { setLoginBusy(false); showToast(res.error); return; }
    await pullAccountInto(res.user, mail);
  };

  const verifyCode = async (mail, code) => {
    setLoginBusy(true);
    const res = await verifyEmailCode(mail, code);
    if (res.error) { setLoginBusy(false); showToast(res.error); return; }
    await pullAccountInto(res.user, mail);
  };

  // Всё, что закреплено за аккаунтом: профиль, расписание, группа, ДЗ, монеты
  const pullAccountInto = async (user, mail) => {
    const prevUid = uidRef.current;
    const nextUid = user?.id || null;
    uidRef.current = nextUid;

    // СМЕНА АККАУНТА. Всё, что принадлежит человеку, живёт ещё и локально —
    // расписание, монеты, посещаемость, задачи, оценки. Если это не стереть,
    // новый вход увидит чужие данные: именно так «чужие» 130 монет и всплыли.
    const patchObj = {};
    if (prevUid && nextUid && prevUid !== nextUid) {
      setSchedule(EMPTY_SCHEDULE());
      Object.assign(patchObj, {
        schedule: EMPTY_SCHEDULE(), subjects: [], events: [], tasks: [], exams: [],
        lessonData: {}, bookmarks: [], attendance: {}, forum: [],
        groupTasks: [], groupTaskDone: {}, grades: [], teacherSessions: [], teacherStats: null, students: [], excluded: [], report: null,
        group: null, coins: 0, isAdmin: false, isTeacher: false,
      });
      setStreak(0);
      setRoster([]);
      setAdminData(null);
      setAiMessages([]);   // переписка прошлого владельца не должна оставаться
    }

    const prof = await fetchMyProfile();
    if (prof) {
      const fn = prof.first_name || '', ln = prof.last_name || '';
      patchObj.profile = { firstName: fn || 'Студент', lastName: ln, initials: ((fn[0] || '') + (ln[0] || '')).toUpperCase() || 'С', phone: prof.phone || '', email: mail };
      patchObj.setup = {
        ...state.setup,
        city: prof.city || state.setup.city,
        university: prof.university || state.setup.university,
        faculty: prof.faculty || state.setup.faculty,
        course: prof.course || state.setup.course,
        group: prof.group_name || '',
      };
      patchObj.onboarded = true;
    }
    const sched = await pullSchedule();
    if (sched && sched !== FAILED) { setSchedule(sched); patchObj.schedule = sched; }
    const gRaw = await myGroup();
    const g = gRaw === FAILED ? null : gRaw;
    patchObj.group = g;
    if (g) {
      if (g.role === 'member') {
        const gs = await getGroupSchedule();
        if (gs) { setSchedule(gs); patchObj.schedule = gs; }
      }
      const gts = await fetchGroupTasks();
      if (gts) patchObj.groupTasks = gts;
    } else {
      patchObj.groupTasks = [];
    }
    const cs = await coinsState();
    // молчание сервера не должно оставлять чужой баланс на экране
    setStreak(cs?.streak || 0);
    patchObj.coins = typeof cs?.balance === 'number' ? cs.balance : 0;
    const isAdm = await adminCheck();
    patchObj.isAdmin = isAdm;

    // Роль — с сервера. От неё зависит, какой экран человек увидит.
    const role = await myRole();
    const isTeacher = role === 'teacher';
    patchObj.isTeacher = isTeacher;
    if (isTeacher) {
      const ses = await mySessions();
      if (ses?.sessions) patchObj.teacherSessions = ses.sessions;
      const tst = await teacherStats();
      if (tst) patchObj.teacherStats = tst;
    } else {
      const g = await myGrades();
      if (g) patchObj.grades = g;
    }

    patch(patchObj);
    setLoginBusy(false);
    setLoginSent(null);

    if (prof) {
      setRoute({ name: 'home' });
      showToast(isAdm ? 'С возвращением, админ! 👑' : t('loginWelcome'));
    } else {
      // Почта новая — профиля за ней нет, проводим через онбординг
      setSetupStep(1);
      setRoute({ name: 'onboarding' });
      showToast(t('loginNoAccount'));
    }
  };

  const onSetupNext = () => {
    const su = state.setup;
    if (setupStep === 1 && !su.city) { showToast('Выберите город'); return; }
    // заведение может быть вписано вручную — проверяем только что оно вообще указано
    if (setupStep === 2 && !String(su.university || '').trim()) {
      showToast('Выберите вуз или колледж'); return;
    }
    if (setupStep === 3 && !String(su.faculty || '').trim()) {
      showToast(su.eduKind === 'college' ? 'Выберите специальность' : 'Выберите факультет'); return;
    }
    // Преподавателю факультет и курс не нужны — со второго шага сразу к данным о себе
    if (setupStep === 2 && su.role === 'teacher') { setSetupStep(5); return; }
    if (setupStep === 5) {
      const p = state.profile;
      if (!p.firstName.trim()) { showToast('Введите имя'); return; }
      if (!p.lastName.trim()) { showToast('Введите фамилию'); return; }
      if (!isPhoneValid(p.phone)) { showToast('Номер: +7 и 10 цифр, например +7 700 700 70 70'); return; }
      const mail = String(p.email || '').trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) { showToast('Введите почту — по ней вы войдёте с другого телефона'); return; }
      // Переходим к вводу кода сразу — письмо догонит. Человек не должен
      // ждать сеть на предыдущем экране и тем более жать кнопку повторно.
      setSetupStep(6);
      if (setupSentTo !== mail) { setSetupMode('attach'); sendSetupCode(mail); }
      return;
    }
    if (setupStep === 6) { finishSetup(); return; }
    setSetupStep(setupStep + 1);
  };

  // Регистрация: код на почту привязывается к текущему аккаунту, ничего не теряется
  const sendSetupCode = async mail => {
    setSetupSentTo(mail);
    setSetupBusy(true);
    const res = await attachEmail(mail);
    setSetupBusy(false);

    // Почта уже зарегистрирована — значит это возврат в свой аккаунт, а не новая
    // регистрация. Не выбрасываем назад: молча переключаемся на вход по коду.
    if (res.error === 'taken') {
      setSetupMode('login');
      const li = await sendEmailCode(mail);
      if (li.error) {
        const w = li.retryAfter;
        setSentAt(Date.now()); setResendIn(w || RESEND_DEFAULT);
        showToast(w ? `Код уже отправлен. Новый — через ${w} с` : li.error);
        return;
      }
      setSentAt(Date.now()); setResendIn(RESEND_DEFAULT);
      showToast('Эта почта уже зарегистрирована — входим в ваш аккаунт');
      return;
    }
    setSetupMode('attach');
    if (res.error) {
      // Сервер не шлёт на один адрес чаще раза в 20 секунд и сам говорит,
      // сколько осталось — заводим отсчёт ровно на столько.
      const wait = res.retryAfter;
      if (wait) { setSentAt(Date.now()); setResendIn(wait); showToast(`Код уже отправлен. Новый — через ${wait} с`); return; }
      showToast(res.error);
      setSentAt(Date.now()); setResendIn(RESEND_DEFAULT);
      return;
    }
    setSetupCode('');   // новый код пришёл — старый ввод больше не нужен
    setSentAt(Date.now()); setResendIn(RESEND_DEFAULT);
    showToast('Код отправлен на ' + mail);
  };

  const finishSetup = async () => {
    const p = state.profile;
    const mail = setupSentTo || String(p.email || '').trim().toLowerCase();
    if (setupCode.length !== 6) { showToast('Введите код из письма — 6 цифр'); return; }

    // Почта уже была за аккаунтом — просто входим в него, всё своё вернётся
    if (setupMode === 'login') {
      if (setupPass.length < 6) { showToast('Придумайте пароль — минимум 6 символов'); return; }
      setSetupBusy(true);
      const r = await verifyEmailCode(mail, setupCode);
      if (r.error) { setSetupBusy(false); showToast(r.error); return; }
      // Пароль задаём и здесь — чтобы в следующий раз входить без письма
      const pw = await setPassword(setupPass);
      setSetupBusy(false);
      if (pw.error) showToast('Вошли, но пароль не сохранился: ' + pw.error);
      setSetupSentTo(null); setSetupCode(''); setSetupPass(''); setSetupMode('attach');
      // Человек пришёл по ссылке «Я преподаватель» — включаем роль и на его аккаунте
      if (state.setup.role === 'teacher') await becomeTeacher(p.firstName.trim(), p.lastName.trim());
      await pullAccountInto(r.user, mail);
      return;
    }

    if (setupPass.length < 6) { showToast('Придумайте пароль — минимум 6 символов'); return; }
    setSetupBusy(true);
    const res = await verifyAttachedEmail(mail, setupCode);
    if (res.error) { setSetupBusy(false); showToast(res.error); return; }
    // пароль ставим сразу после подтверждения — дальше вход без письма
    const pw = await setPassword(setupPass);
    setSetupBusy(false);
    if (pw.error) { showToast('Почта подтверждена, но пароль не сохранился: ' + pw.error); }

    const fn = p.firstName.trim(), ln = p.lastName.trim();
    const newProfile = { ...p, email: mail, firstName: fn, lastName: ln, initials: ((fn[0] || '') + (ln[0] || '')).toUpperCase() };
    // Новый студент начинает с чистого листа: демо-расписание и демо-предметы убираем,
    // он заводит свои пары сам. Если он вошёл в существующий аккаунт (onboarded уже true) —
    // ничего не трогаем, иначе затрём его настоящее расписание.
    const fresh = state.onboarded ? {} : {
      schedule: EMPTY_SCHEDULE(), subjects: [], events: [], tasks: [],
      lessonData: {}, bookmarks: [], attendance: {}, exams: [], forum: [],
    };
    if (!state.onboarded) setSchedule(fresh.schedule);
    patch({ profile: newProfile, onboarded: true, ...fresh });
    if (BACKEND_ENABLED) pushProfile(newProfile, state.setup);
    setSetupSentTo(null); setSetupCode(''); setSetupPass('');
    setRoute({ name: 'loading' });
    await applyRole(state.setup.role === 'teacher', !state.onboarded);
  };

  /**
   * Роль решает всё, что человек увидит дальше. Закрепляем её на сервере
   * и ТОЛЬКО потом перекидываем — иначе преподаватель попадает на экран студента.
   */
  const applyRole = async (wantTeacher, isFresh) => {
    if (wantTeacher) {
      const p = stateRef.current?.profile || {};
      const r = await becomeTeacher(p.firstName, p.lastName);
      if (r?.error) {
        showToast('Не удалось включить режим преподавателя: ' + r.error);
        patch({ isTeacher: false });
        setTimeout(() => setRoute({ name: 'home' }), 600);
        return;
      }
      // сверяемся с сервером, а не верим на слово
      const role = await myRole();
      const ok = role === 'teacher';
      patch({ isTeacher: ok });
      if (!ok) { showToast('Роль не сохранилась — попробуйте ещё раз'); setRoute({ name: 'home' }); return; }
      const ses = await mySessions();
      if (ses?.sessions) patch({ teacherSessions: ses.sessions });
      setTimeout(() => setRoute({ name: 'home' }), 700);
      return;
    }
    patch({ isTeacher: false });
    setTimeout(() => setRoute({ name: isFresh ? 'start' : 'home' }), 700);
  };

  const onSetupPick = (f, v) => {
    const next = { ...state.setup, [f]: v };
    if (f === 'city' && v !== state.setup.city) { next.university = ''; next.faculty = ''; next.eduKind = ''; }
    if (f === 'university' && v !== state.setup.university) {
      next.faculty = '';
      // вуз или колледж — нужно для подписей («факультет» против «специальность»)
      next.eduKind = findInstitution(v, next.city)?.kind || '';
    }
    patch({ setup: next });
  };

  let screen = null;
  const top = insets.top;
  const showTab = ['home', 'afisha', 'ai', 'notifications', 'profile', 'students', 'reports'].includes(route.name);

  // Куда возвращает свайп от левого края (как «назад» в iOS)
  const BACK_TO = {
    lesson: 'home', calendar: 'home', tasks: 'home', search: 'home', publicProfile: 'home',
    group: 'profile', attendance: 'profile', coins: 'profile', settings: 'profile',
    favorites: 'profile', myposts: 'profile', mynotes: 'profile', admin: 'profile',
    groupScan: 'group', start: 'home', session: 'teacher', student: 'students', students: 'home', reports: 'home', grades: 'profile', teacher: 'home', privacy: 'settings', event: 'afisha', adminStudent: 'admin',
  };
  const backTo = BACK_TO[route.name];
  const goBack = () => {
    if (route.name === 'onboarding') { if (setupStep > 0) setSetupStep(setupStep - 1); return; }
    if (route.name === 'login') {
      if (loginSent) { setLoginSent(null); return; }  // свайп с экрана кода — назад к вводу почты
      setSetupStep(0); setRoute({ name: 'onboarding' }); return;
    }
    if (backTo) setRoute({ name: backTo });
  };
  const canSwipeBack = !!backTo || route.name === 'login' || (route.name === 'onboarding' && setupStep > 0);
  const lessonScreen = route.name === 'lesson';
  const scanScreen = route.name === 'groupScan';
  const barStyle = intro || lessonScreen || scanScreen ? 'light' : (themeMode === 'dark' ? 'light' : 'dark');

  if (!state || route.name === 'loading') screen = <LoadingScreen topInset={top} />;
  else if (route.name === 'onboarding') {
    screen = setupStep === 0
      ? <WelcomeScreen onNext={onSetupNext}
          onLogin={() => setRoute({ name: 'login' })}
          onTeacher={() => { patch({ setup: { ...state.setup, role: 'teacher' } }); setSetupStep(1); }}
          topInset={top} />
      : <SetupScreen step={setupStep} setup={state.setup} person={state.profile} topInset={top}
          onPick={onSetupPick}
          onPerson={(f, v) => patch({ profile: { ...state.profile, [f]: v } })}
          onNext={onSetupNext}
          busy={setupBusy} codeSentTo={setupSentTo} sentAt={sentAt} resendIn={resendIn} mode={setupMode} code={setupCode} setCode={setSetupCode}
          pass={setupPass} setPass={setSetupPass}
          onResend={secs => {
            if (secs > 0) { showToast(`Новый код можно запросить через ${secs} с`); return; }
            sendSetupCode(setupSentTo || String(state.profile.email || '').trim().toLowerCase());
          }}
          onBack={() => setSetupStep(state.setup.role === 'teacher' && setupStep === 5 ? 2 : Math.max(0, setupStep - 1))} />;
  }
  else if (route.name === 'home' && state?.isTeacher) screen = <TeacherScreen state={state} busy={busyGroup} asHome topInset={top} actions={actions} />;
  else if (route.name === 'home') screen = state?.isAdmin
    ? <AdminScreen isAdmin asHome deviceId={uidRef.current} data={adminData} crashes={crashes} busy={adminBusy} topInset={top} actions={actions} />
    : <HomeScreen state={state} selectedDay={selectedDay} topInset={top} actions={actions} />;
  else if (route.name === 'afisha') screen = <AfishaScreen events={state.events || []} isAdmin={!!state?.isAdmin} topInset={top} actions={actions} />;
  else if (route.name === 'ai') screen = <AiScreen messages={aiMessages} thinking={aiThinking} onSend={onAiSend} isAdmin={!!state?.isAdmin} topInset={top} bottomInset={insets.bottom} />;
  else if (route.name === 'lesson') screen = <LessonScreen id={route.id} group={state.setup.group || '—'} lessonData={state.lessonData} topInset={top} actions={actions} />;
  else if (route.name === 'teacher') screen = <TeacherScreen state={state} busy={busyGroup} topInset={top} actions={actions} />;
  else if (route.name === 'session') screen = <SessionScreen session={route.data} roster={roster}
    link={route.data ? Linking.createURL('mark/' + route.data.code) : ''} busy={busyGroup} topInset={top} actions={actions} />;
  else if (route.name === 'grades') screen = <GradesScreen grades={state.grades || []} topInset={top} actions={actions} />;
  else if (route.name === 'coins') screen = <CoinsScreen coins={state.coins} streak={streak} topInset={top} actions={actions} />;
  else if (route.name === 'privacy') screen = <PrivacyScreen privacy={state.privacy} topInset={top} actions={actions} />;
  else if (route.name === 'favorites') screen = <FavoritesScreen state={state} topInset={top} actions={actions} />;
  else if (route.name === 'myposts') screen = <MyPostsScreen state={state} topInset={top} actions={actions} />;
  else if (route.name === 'mynotes') screen = <MyNotesScreen state={state} topInset={top} actions={actions} />;
  else if (route.name === 'calendar') screen = <CalendarScreen schedule={state.schedule || SCHEDULE} topInset={top} actions={actions} />;
  else if (route.name === 'tasks') screen = <TasksScreen tasks={state.tasks} groupTasks={state.groupTasks || []}
    groupTaskDone={state.groupTaskDone || {}} isOwner={state.group?.role === 'owner'} inGroup={!!state.group}
    topInset={top} actions={actions} />;
  else if (route.name === 'group') screen = <GroupScreen group={state.group} groupLink={state.group ? groupLink(state.group.code) : ''} backendEnabled={BACKEND_ENABLED} busyGroup={busyGroup} topInset={top} actions={actions} />;
  else if (route.name === 'start') screen = <StartScreen busy={busyGroup} topInset={top} actions={actions} />;
  else if (route.name === 'groupScan') screen = <GroupScanScreen busyGroup={busyGroup} topInset={top} actions={actions} />;
  else if (route.name === 'attendance') screen = <AttendanceScreen attendance={state.attendance || {}} teacherMarks={state.teacherMarks || []} schedule={state.schedule || SCHEDULE} topInset={top} actions={actions} />;
  else if (route.name === 'publicProfile') screen = <PublicProfileScreen data={route.data} topInset={top} actions={actions} />;
  else if (route.name === 'login') screen = <LoginScreen busy={loginBusy} sentTo={loginSent} sentAt={sentAt} resendIn={resendIn}
    onSendCode={sendCode} onVerify={verifyCode} onPassword={loginWithPassword}
    onBack={() => { if (loginSent) { setLoginSent(null); return; } setSetupStep(0); setRoute({ name: 'onboarding' }); }} topInset={top} />;
  else if (route.name === 'admin') screen = <AdminScreen isAdmin={!!state?.isAdmin} deviceId={uidRef.current} data={adminData} crashes={crashes} busy={adminBusy} topInset={top} actions={actions} />;
  else if (route.name === 'adminStudent') screen = <AdminStudentScreen data={route.data} topInset={top} actions={actions} />;
  else if (route.name === 'event') screen = <EventScreen event={route.data} topInset={top} actions={actions} />;
  else if (route.name === 'notifications') screen = <NotificationsScreen state={state} adminData={adminData} topInset={top} actions={actions} />;
  else if (route.name === 'students') screen = <TeacherStudentsScreen students={state.students || []} excluded={state.excluded || []} topInset={top} actions={actions} />;
  else if (route.name === 'reports') screen = <TeacherReportsScreen report={state.report} topInset={top} actions={actions} />;
  else if (route.name === 'student') screen = <TeacherStudentScreen card={route.data} busy={busyGroup} topInset={top} actions={actions} />;
  else if (route.name === 'profile' && state?.isTeacher) screen = <TeacherProfileScreen state={state} streak={streak} topInset={top} actions={actions} />;
  else if (route.name === 'profile') screen = <ProfileScreen state={state} streak={streak} topInset={top} actions={actions} />;
  else if (route.name === 'settings') screen = <SettingsScreen state={state} topInset={top} actions={actions} />;
  else if (route.name === 'search') screen = <SearchScreen query={query} setQuery={setQuery} topInset={top} actions={actions} />;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar style={barStyle} />
      <SwipeBack enabled={canSwipeBack} onBack={goBack}>{screen}</SwipeBack>
      {showTab && <TabBar active={route.name} onNav={actions.nav} teacher={!!state?.isTeacher} bottom={16 + insets.bottom} />}

      {/* Bottom sheet: новый предмет */}
      <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => setSheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={ss.backdrop} onPress={() => setSheet(false)} />
          <View style={[ss.sheet, { paddingBottom: kbOpen ? 12 : 24 + insets.bottom }]}>
            <View style={ss.grab} />
            <Text style={man(800, 20, { marginBottom: 16 })}>{tr('Новый предмет')}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={ss.label}>{tr('Название')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholder={tr('Например, Философия')} placeholderTextColor={C.dot}
                value={draft?.name ?? ''} onChangeText={v => setDraft(d => ({ ...d, name: v }))} />
              <Text style={ss.label}>{tr('Время')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholder="08:00" placeholderTextColor={C.dot}
                value={draft?.time ?? ''} onChangeText={v => setDraft(d => ({ ...d, time: v }))} />
              <Text style={ss.label}>{tr('Преподаватель')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholder={tr('Имя преподавателя')} placeholderTextColor={C.dot}
                value={draft?.teacher ?? ''} onChangeText={v => setDraft(d => ({ ...d, teacher: v }))} />
              <Text style={ss.label}>{tr('Цвет')}</Text>
              <View style={ss.rowWrap}>
                {SWATCHES.map(c => (
                  <Pressable key={c} onPress={() => setDraft(d => ({ ...d, color: c }))}
                    style={[ss.swatch, { backgroundColor: c }, draft?.color === c && ss.swatchSel]} />
                ))}
              </View>
              <Text style={ss.label}>{tr('Иконка')}</Text>
              <View style={ss.rowWrap}>
                {PICK_ICONS.map(ic => (
                  <Pressable key={ic} onPress={() => setDraft(d => ({ ...d, icon: ic }))}
                    style={[ss.iconPick, cardShadow, draft?.icon === ic && { borderColor: C.purple }]}>
                    <Icon name={ic} size={20} color={draft?.icon === ic ? C.purple : C.ink} />
                  </Pressable>
                ))}
              </View>
              <PrimaryButton label={tr('Добавить предмет')} onPress={saveDraft} style={{ marginTop: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom sheet: открыть отметку на паре */}
      <Modal visible={sessionSheet} transparent animationType="slide" onRequestClose={() => setSessionSheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={ss.backdrop} onPress={() => setSessionSheet(false)} />
          <View style={[ss.sheet, { paddingBottom: kbOpen ? 12 : 24 + insets.bottom }]}>
            <View style={ss.grab} />
            <Text style={man(800, 20, { marginBottom: 14 })}>{t('newSession')}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={ss.label}>{t('sessionSubject')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholder={tr('Математический анализ')} placeholderTextColor={C.dot}
                value={sessionDraft?.subject ?? ''} onChangeText={v => setSessionDraft(d => ({ ...d, subject: v }))} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={ss.label}>{t('sessionRoom')}</Text>
                  <TextInput style={[ss.input, cardShadow]} placeholder="214" placeholderTextColor={C.dot}
                    value={sessionDraft?.room ?? ''} onChangeText={v => setSessionDraft(d => ({ ...d, room: v }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.label}>{t('sessionMinutes')}</Text>
                  <TextInput style={[ss.input, cardShadow]} placeholder="10" placeholderTextColor={C.dot}
                    keyboardType="number-pad" maxLength={2}
                    value={sessionDraft?.minutes ?? ''} onChangeText={v => setSessionDraft(d => ({ ...d, minutes: v.replace(/\D/g, '') }))} />
                </View>
              </View>
              <PrimaryButton label={busyGroup ? '…' : t('sessionStart')} onPress={() => !busyGroup && actions.startSession()} style={{ marginTop: 18 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom sheet: оценка студенту */}
      <Modal visible={gradeSheet} transparent animationType="slide" onRequestClose={() => setGradeSheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={ss.backdrop} onPress={() => setGradeSheet(false)} />
          <View style={[ss.sheet, { paddingBottom: kbOpen ? 12 : 24 + insets.bottom }]}>
            <View style={ss.grab} />
            <Text style={man(800, 20, { marginBottom: 4 })}>{t('gradeTitle')}</Text>
            <Text style={int(400, 13, { color: C.muted, marginBottom: 14 })} numberOfLines={1}>
              {gradeDraft?.student?.name || t('teacherNoName')}
              {gradeDraft?.student?.group_name ? ` · ${gradeDraft.student.group_name}` : ''}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={ss.label}>{t('gradeValue')}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                {['5', '4', '3', '2', 'зачёт'].map(v => (
                  <Pressable key={v} onPress={() => setGradeDraft(d => ({ ...d, value: v }))}
                    style={({ pressed }) => [ss.gradeChip, gradeDraft?.value === v && { backgroundColor: C.purple, borderColor: C.purple }, pressed && { opacity: 0.8 }]}>
                    <Text style={int(700, 14, gradeDraft?.value === v ? { color: '#fff' } : {})}>{v}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput style={[ss.input, cardShadow]} placeholder={tr('или впишите свою')} placeholderTextColor={C.dot}
                value={gradeDraft?.value ?? ''} onChangeText={v => setGradeDraft(d => ({ ...d, value: v }))} />
              <Text style={ss.label}>{t('gradeComment')}</Text>
              <TextInput style={[ss.input, cardShadow, { height: 88, paddingTop: 12, textAlignVertical: 'top' }]}
                placeholder={tr('За что оценка, что подтянуть…')} placeholderTextColor={C.dot}
                multiline value={gradeDraft?.comment ?? ''} onChangeText={v => setGradeDraft(d => ({ ...d, comment: v }))} />
              <PrimaryButton label={busyGroup ? '…' : t('gradeSave')} onPress={() => !busyGroup && actions.saveGrade()} style={{ marginTop: 16 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom sheet: оценка из карточки студента. Предмет вводится вручную —
          оценку ставят вне пары, брать его из открытой сессии неоткуда */}
      <Modal visible={!!studentGrade} transparent animationType="slide" onRequestClose={() => setStudentGrade(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={ss.backdrop} onPress={() => setStudentGrade(null)} />
          <View style={[ss.sheet, { paddingBottom: kbOpen ? 12 : 24 + insets.bottom }]}>
            <View style={ss.grab} />
            <Text style={man(800, 20, { marginBottom: 4 })}>{t('gradeTitle')}</Text>
            <Text style={int(400, 13, { color: C.muted, marginBottom: 14 })} numberOfLines={1}>
              {studentGrade?.card?.name || t('teacherNoName')}
              {studentGrade?.card?.group_name ? ` · ${studentGrade.card.group_name}` : ''}
            </Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={ss.label}>{t('gradeSubject')}</Text>
              {/* предметы, которые преподаватель уже вёл — чтобы не набирать заново */}
              {!!(state?.teacherStats?.subjects || []).length && (
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  {state?.teacherStats?.subjects?.map(x => (
                    <Pressable key={x.subject} onPress={() => setStudentGrade(d => ({ ...d, subject: x.subject }))}
                      style={({ pressed }) => [ss.gradeChip, studentGrade?.subject === x.subject && { backgroundColor: C.purple, borderColor: C.purple }, pressed && { opacity: 0.8 }]}>
                      <Text style={int(700, 13, studentGrade?.subject === x.subject ? { color: '#fff' } : {})}>{x.subject}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <TextInput style={[ss.input, cardShadow]} placeholder={tr('Например, Матанализ')} placeholderTextColor={C.dot}
                value={studentGrade?.subject ?? ''} onChangeText={v => setStudentGrade(d => ({ ...d, subject: v }))} />
              <Text style={ss.label}>{t('gradeValue')}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 6 }}>
                {['5', '4', '3', '2', 'зачёт'].map(v => (
                  <Pressable key={v} onPress={() => setStudentGrade(d => ({ ...d, value: v }))}
                    style={({ pressed }) => [ss.gradeChip, studentGrade?.value === v && { backgroundColor: C.purple, borderColor: C.purple }, pressed && { opacity: 0.8 }]}>
                    <Text style={int(700, 14, studentGrade?.value === v ? { color: '#fff' } : {})}>{v}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput style={[ss.input, cardShadow]} placeholder={tr('или впишите свою')} placeholderTextColor={C.dot}
                value={studentGrade?.value ?? ''} onChangeText={v => setStudentGrade(d => ({ ...d, value: v }))} />
              <Text style={ss.label}>{t('gradeComment')}</Text>
              <TextInput style={[ss.input, cardShadow, { height: 88, paddingTop: 12, textAlignVertical: 'top' }]}
                placeholder={tr('За что оценка, что подтянуть…')} placeholderTextColor={C.dot}
                multiline value={studentGrade?.comment ?? ''} onChangeText={v => setStudentGrade(d => ({ ...d, comment: v }))} />
              <PrimaryButton label={busyGroup ? '…' : t('gradeSave')} onPress={() => !busyGroup && actions.saveStudentGrade()} style={{ marginTop: 16 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom sheet: смена пароля */}
      <Modal visible={passSheet} transparent animationType="slide" onRequestClose={() => setPassSheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={ss.backdrop} onPress={() => setPassSheet(false)} />
          <View style={[ss.sheet, { paddingBottom: kbOpen ? 12 : 24 + insets.bottom }]}>
            <View style={ss.grab} />
            <Text style={man(800, 20, { marginBottom: 4 })}>{t('passChange')}</Text>
            <Text style={int(400, 13, { color: C.muted, marginBottom: 14 })} numberOfLines={1}>{state?.profile?.email}</Text>
            <Text style={ss.label}>{t('passNew')}</Text>
            <TextInput style={[ss.input, cardShadow]} placeholder={tr('минимум 6 символов')} placeholderTextColor={C.dot}
              secureTextEntry autoComplete="new-password" textContentType="newPassword"
              value={passDraft} onChangeText={setPassDraft} />
            <PrimaryButton label={loginBusy ? '…' : t('save')} onPress={() => !loginBusy && actions.savePassword()} style={{ marginTop: 16 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom sheet: ДЗ от старосты на всю группу */}
      <Modal visible={groupTaskSheet} transparent animationType="slide" onRequestClose={() => setGroupTaskSheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={ss.backdrop} onPress={() => setGroupTaskSheet(false)} />
          <View style={[ss.sheet, { paddingBottom: kbOpen ? 12 : 24 + insets.bottom }]}>
            <View style={ss.grab} />
            <Text style={man(800, 20, { marginBottom: 4 })}>{tr('Задать ДЗ группе')}</Text>
            <Text style={int(400, 13, { color: C.muted, marginBottom: 14 })}>{tr('Увидят все, кто в вашей группе')}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={ss.label}>{tr('Что задали')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholder={tr('Например, Матан: №12–18')} placeholderTextColor={C.dot}
                value={groupTaskDraft?.title ?? ''} onChangeText={v => setGroupTaskDraft(d => ({ ...d, title: v }))} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={ss.label}>{tr('Предмет')}</Text>
                  <TextInput style={[ss.input, cardShadow]} placeholder={tr('Математика')} placeholderTextColor={C.dot}
                    value={groupTaskDraft?.subject ?? ''} onChangeText={v => setGroupTaskDraft(d => ({ ...d, subject: v }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.label}>{tr('Срок')}</Text>
                  <TextInput style={[ss.input, cardShadow]} placeholder={tr('5 сентября')} placeholderTextColor={C.dot}
                    value={groupTaskDraft?.due ?? ''} onChangeText={v => setGroupTaskDraft(d => ({ ...d, due: v }))} />
                </View>
              </View>
              <Text style={ss.label}>{tr('Пояснение (необязательно)')}</Text>
              <TextInput style={[ss.input, cardShadow, { height: 88, paddingTop: 12, textAlignVertical: 'top' }]}
                placeholder={tr('Что именно решать, где взять методичку…')} placeholderTextColor={C.dot}
                multiline value={groupTaskDraft?.note ?? ''} onChangeText={v => setGroupTaskDraft(d => ({ ...d, note: v }))} />

              <Text style={ss.label}>Материалы — фото ({(groupTaskDraft?.photos || []).length}/5)</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {(groupTaskDraft?.photos || []).map(uri => (
                  <Pressable key={uri} onLongPress={() => setGroupTaskDraft(d => ({ ...d, photos: (d.photos || []).filter(x => x !== uri) }))}>
                    <Image source={{ uri }} style={{ width: 74, height: 74, borderRadius: 12 }} />
                  </Pressable>
                ))}
                {(groupTaskDraft?.photos || []).length < 5 && (
                  <Pressable onPress={() => actions.adminPickPhotos(groupTaskDraft?.photos || [], ph => setGroupTaskDraft(d => ({ ...d, photos: ph })))}
                    style={({ pressed }) => [{ width: 74, height: 74, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', borderColor: C.dot, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
                    <Icon name="plus" size={20} color={C.dot} />
                  </Pressable>
                )}
              </View>
              <Text style={int(400, 11.5, { color: C.muted, marginTop: 6 })}>{tr('Долгое нажатие на фото — убрать')}</Text>

              <PrimaryButton label={busyGroup ? '…' : 'Опубликовать группе'} onPress={() => !busyGroup && actions.publishGroupTask()} style={{ marginTop: 18 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom sheet: новое событие в афише */}
      <Modal visible={eventSheet} transparent animationType="slide" onRequestClose={() => setEventSheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={ss.backdrop} onPress={() => setEventSheet(false)} />
          <View style={[ss.sheet, { paddingBottom: kbOpen ? 12 : 24 + insets.bottom }]}>
            <View style={ss.grab} />
            <Text style={man(800, 20, { marginBottom: 16 })}>{tr('Новое событие')}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={ss.label}>{tr('Название')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholder={tr('Например, День открытых дверей')} placeholderTextColor={C.dot}
                value={eventDraft?.title ?? ''} onChangeText={v => setEventDraft(d => ({ ...d, title: v }))} />
              <Text style={ss.label}>{tr('Дата и время')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholder={tr('10 сентября, 15:00')} placeholderTextColor={C.dot}
                value={eventDraft?.date ?? ''} onChangeText={v => setEventDraft(d => ({ ...d, date: v }))} />
              <Text style={ss.label}>{tr('Место')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholder={tr('Актовый зал')} placeholderTextColor={C.dot}
                value={eventDraft?.place ?? ''} onChangeText={v => setEventDraft(d => ({ ...d, place: v }))} />
              <Text style={ss.label}>{tr('Цвет')}</Text>
              <View style={ss.rowWrap}>
                {SWATCHES.map(c => (
                  <Pressable key={c} onPress={() => setEventDraft(d => ({ ...d, color: c }))}
                    style={[ss.swatch, { backgroundColor: c }, eventDraft?.color === c && ss.swatchSel]} />
                ))}
              </View>
              <Text style={ss.label}>{tr('Иконка')}</Text>
              <View style={ss.rowWrap}>
                {EVENT_ICONS.map(ic => (
                  <Pressable key={ic} onPress={() => setEventDraft(d => ({ ...d, icon: ic }))}
                    style={[ss.iconPick, cardShadow, eventDraft?.icon === ic && { borderColor: C.purple }]}>
                    <Icon name={ic} size={20} color={eventDraft?.icon === ic ? C.purple : C.ink} />
                  </Pressable>
                ))}
              </View>
              <PrimaryButton label={tr('Добавить в афишу')} onPress={saveEvent} style={{ marginTop: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom sheet: редактирование профиля */}
      <Modal visible={profileSheet} transparent animationType="slide" onRequestClose={() => setProfileSheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={ss.backdrop} onPress={() => setProfileSheet(false)} />
          <View style={[ss.sheet, { paddingBottom: kbOpen ? 12 : 24 + insets.bottom }]}>
            <View style={ss.grab} />
            <Text style={man(800, 20, { marginBottom: 16 })}>{tr('Редактировать профиль')}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={ss.label}>{tr('Имя')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholderTextColor={C.dot}
                value={profileDraft?.firstName ?? ''} onChangeText={v => setProfileDraft(d => ({ ...d, firstName: v }))} />
              <Text style={ss.label}>{tr('Фамилия')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholderTextColor={C.dot}
                value={profileDraft?.lastName ?? ''} onChangeText={v => setProfileDraft(d => ({ ...d, lastName: v }))} />
              <Text style={ss.label}>{tr('Номер телефона')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholder="+7 700 700 70 70" placeholderTextColor={C.dot} keyboardType="phone-pad" maxLength={16}
                value={profileDraft?.phone ?? ''} onChangeText={v => setProfileDraft(d => ({ ...d, phone: formatPhoneKz(v) }))}
                onFocus={() => setProfileDraft(d => (d.phone ? d : { ...d, phone: '+7 ' }))} />
              {!state?.isAdmin && (
                <>
                  <Text style={ss.label}>{tr('Университет')}</Text>
                  <TextInput style={[ss.input, cardShadow]} placeholderTextColor={C.dot}
                    value={profileDraft?.university ?? ''} onChangeText={v => setProfileDraft(d => ({ ...d, university: v }))} />
                  <Text style={ss.label}>{tr('Факультет')}</Text>
                  <TextInput style={[ss.input, cardShadow]} placeholderTextColor={C.dot}
                    value={profileDraft?.faculty ?? ''} onChangeText={v => setProfileDraft(d => ({ ...d, faculty: v }))} />
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={ss.label}>{tr('Курс (1–4)')}</Text>
                      <TextInput style={[ss.input, cardShadow]} keyboardType="number-pad" placeholderTextColor={C.dot}
                        value={String(profileDraft?.course ?? '')} onChangeText={v => setProfileDraft(d => ({ ...d, course: v }))} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={ss.label}>{tr('Группа')}</Text>
                      <TextInput style={[ss.input, cardShadow]} placeholderTextColor={C.dot}
                        value={profileDraft?.group ?? ''} onChangeText={v => setProfileDraft(d => ({ ...d, group: v }))} />
                    </View>
                  </View>
                </>
              )}
              <PrimaryButton label={tr('Сохранить')} onPress={saveProfile} style={{ marginTop: 16 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom sheet: новый экзамен */}
      <Modal visible={examSheet} transparent animationType="slide" onRequestClose={() => setExamSheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={ss.backdrop} onPress={() => setExamSheet(false)} />
          <View style={[ss.sheet, { paddingBottom: kbOpen ? 12 : 24 + insets.bottom }]}>
            <View style={ss.grab} />
            <Text style={man(800, 20, { marginBottom: 16 })}>{tr('Новый экзамен')}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={ss.label}>{tr('Предмет')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholder={tr('Математика')} placeholderTextColor={C.dot}
                value={examDraft?.subject ?? ''} onChangeText={v => setExamDraft(d => ({ ...d, subject: v }))} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={ss.label}>{tr('Дата')}</Text>
                  <TextInput style={[ss.input, cardShadow]} placeholder={tr('24 января')} placeholderTextColor={C.dot}
                    value={examDraft?.date ?? ''} onChangeText={v => setExamDraft(d => ({ ...d, date: v }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.label}>{tr('Время')}</Text>
                  <TextInput style={[ss.input, cardShadow]} placeholder="09:00" placeholderTextColor={C.dot}
                    value={examDraft?.time ?? ''} onChangeText={v => setExamDraft(d => ({ ...d, time: v }))} />
                </View>
              </View>
              <Text style={ss.label}>{tr('Аудитория')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholder="214" placeholderTextColor={C.dot}
                value={examDraft?.room ?? ''} onChangeText={v => setExamDraft(d => ({ ...d, room: v }))} />
              <Text style={ss.label}>{tr('Описание (необязательно)')}</Text>
              <TextInput style={[ss.input, cardShadow, { height: 92, paddingTop: 12, textAlignVertical: 'top' }]}
                placeholder={tr('Что взять с собой, какие темы, устно или письменно…')} placeholderTextColor={C.dot}
                multiline value={examDraft?.note ?? ''} onChangeText={v => setExamDraft(d => ({ ...d, note: v }))} />
              <PrimaryButton label={tr('Добавить экзамен')} onPress={saveExam} style={{ marginTop: 16 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom sheet: добавление/редактирование пары в календаре */}
      <Modal visible={!!lessonSheet} transparent animationType="slide" onRequestClose={() => setLessonSheet(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={ss.backdrop} onPress={() => setLessonSheet(null)} />
          <View style={[ss.sheet, { paddingBottom: kbOpen ? 12 : 24 + insets.bottom }]}>
            <View style={ss.grab} />
            <Text style={man(800, 20, { marginBottom: 16 })}>{lessonSheet?.existing ? 'Изменить пару' : 'Новая пара'}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={ss.label}>{tr('Предмет')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholder={tr('Математика')} placeholderTextColor={C.dot}
                value={lessonDraft?.name ?? ''} onChangeText={v => setLessonDraft(d => ({ ...d, name: v }))} />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={ss.label}>{tr('Начало')}</Text>
                  <TextInput style={[ss.input, cardShadow]} placeholder="09:00" placeholderTextColor={C.dot}
                    value={lessonDraft?.start ?? ''} onChangeText={v => setLessonDraft(d => ({ ...d, start: v }))} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ss.label}>{tr('Конец')}</Text>
                  <TextInput style={[ss.input, cardShadow]} placeholder="10:30" placeholderTextColor={C.dot}
                    value={lessonDraft?.end ?? ''} onChangeText={v => setLessonDraft(d => ({ ...d, end: v }))} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={ss.label}>{tr('Аудитория')}</Text>
                  <TextInput style={[ss.input, cardShadow]} placeholder="214" placeholderTextColor={C.dot}
                    value={lessonDraft?.room ?? ''} onChangeText={v => setLessonDraft(d => ({ ...d, room: v }))} />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={ss.label}>{tr('Преподаватель')}</Text>
                  <TextInput style={[ss.input, cardShadow]} placeholder={tr('Имя преподавателя')} placeholderTextColor={C.dot}
                    value={lessonDraft?.teacher ?? ''} onChangeText={v => setLessonDraft(d => ({ ...d, teacher: v }))} />
                </View>
              </View>
              <Text style={ss.label}>{tr('Тип занятия')}</Text>
              <View style={ss.rowWrap}>
                {LESSON_TYPES.map(tp => {
                  const sel = lessonDraft?.type === tp;
                  return (
                    <Pressable key={tp} onPress={() => setLessonDraft(d => ({ ...d, type: tp }))}
                      style={[ss.typeChip, cardShadow, sel && { backgroundColor: C.purple }]}>
                      <Text style={int(600, 13, { color: sel ? '#fff' : C.ink })}>{tp}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={ss.label}>{tr('Цвет')}</Text>
              <View style={ss.rowWrap}>
                {SWATCHES.map(c => (
                  <Pressable key={c} onPress={() => setLessonDraft(d => ({ ...d, color: c }))}
                    style={[ss.swatch, { backgroundColor: c }, lessonDraft?.color === c && ss.swatchSel]} />
                ))}
              </View>
              {lessonSheet?.existing && (
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginHorizontal: 4 }}>
                  <Text style={int(500, 15)}>{tr('Пара отменена')}</Text>
                  <Pressable onPress={() => setLessonDraft(d => ({ ...d, cancelled: !d.cancelled }))}
                    style={[ss.switchBase, lessonDraft?.cancelled && { backgroundColor: C.red }]}>
                    <View style={[ss.switchKnob, lessonDraft?.cancelled && { left: 21 }]} />
                  </Pressable>
                </View>
              )}
              <PrimaryButton label={lessonSheet?.existing ? 'Сохранить' : 'Добавить пару'} onPress={saveLesson} style={{ marginTop: 16 }} />
              {lessonSheet?.existing && (
                <Pressable onPress={deleteLesson} style={{ alignItems: 'center', paddingVertical: 14 }}>
                  <Text style={int(600, 15, { color: C.red })}>{tr('Удалить пару')}</Text>
                </Pressable>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom sheet: новая задача */}
      <Modal visible={taskSheet} transparent animationType="slide" onRequestClose={() => setTaskSheet(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={ss.backdrop} onPress={() => setTaskSheet(false)} />
          <View style={[ss.sheet, { paddingBottom: kbOpen ? 12 : 24 + insets.bottom }]}>
            <View style={ss.grab} />
            <Text style={man(800, 20, { marginBottom: 16 })}>{t('newTask')}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={ss.label}>{t('taskTitle')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholderTextColor={C.dot}
                value={taskDraft?.title ?? ''} onChangeText={v => setTaskDraft(d => ({ ...d, title: v }))} />
              <Text style={ss.label}>{t('taskDue')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholderTextColor={C.dot}
                value={taskDraft?.due ?? ''} onChangeText={v => setTaskDraft(d => ({ ...d, due: v }))} />
              <Text style={ss.label}>{t('taskSubject')}</Text>
              <TextInput style={[ss.input, cardShadow]} placeholderTextColor={C.dot}
                value={taskDraft?.subject ?? ''} onChangeText={v => setTaskDraft(d => ({ ...d, subject: v }))} />
              <PrimaryButton label={t('addTask')} onPress={saveTask} style={{ marginTop: 16 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Bottom sheet: материалы / ДЗ / заметки к паре */}
      <Modal visible={!!fieldEdit} transparent animationType="slide" onRequestClose={() => setFieldEdit(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={ss.backdrop} onPress={() => setFieldEdit(null)} />
          <View style={[ss.sheet, { paddingBottom: kbOpen ? 12 : 24 + insets.bottom }]}>
            <View style={ss.grab} />
            <Text style={man(800, 20, { marginBottom: 16 })}>{fieldEdit?.label}</Text>
            <TextInput
              style={[ss.input, cardShadow, { height: 120, paddingTop: 14, textAlignVertical: 'top' }]}
              placeholder={tr('Запиши сюда всё важное…')}
              placeholderTextColor={C.dot}
              multiline
              value={fieldEdit?.value ?? ''}
              onChangeText={v => setFieldEdit(f => ({ ...f, value: v }))}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 10 }}>
              {(fieldEdit?.photos || []).map((uri, i) => (
                <Pressable key={uri + i} onPress={() => setPhotoView(uri)}
                  onLongPress={() => setFieldEdit(f => ({ ...f, photos: f.photos.filter((_, j) => j !== i) }))}>
                  <Image source={{ uri }} style={{ width: 74, height: 74, borderRadius: 14 }} />
                </Pressable>
              ))}
              <Pressable onPress={pickFieldPhoto} style={[ss.addPhoto, cardShadow]}>
                <Icon name="plus" size={22} color={C.purple} />
              </Pressable>
            </ScrollView>
            <Text style={int(400, 11, { color: C.muted, marginTop: 6, marginLeft: 4 })}>{tr('Тап — открыть, долгое нажатие — удалить фото')}</Text>
            <PrimaryButton label={tr('Сохранить')} onPress={saveFieldEdit} style={{ marginTop: 12 }} />
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Просмотр фото */}
      <Modal visible={!!photoView} transparent animationType="fade" onRequestClose={() => setPhotoView(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,.92)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setPhotoView(null)}>
          {photoView && <Image source={{ uri: photoView }} style={{ width: '94%', height: '80%' }} resizeMode="contain" />}
        </Pressable>
      </Modal>

      {/* Нет связи — говорим об этом прямо, а не молчим.
          Расписание при этом на месте: оно хранится на телефоне. */}
      {!online && !intro && (
        <Pressable onPress={() => probe()}
          style={[ss.offline, { top: insets.top + 6 }]}>
          <Icon name="wifi-off" size={14} color="#fff" />
          <Text style={int(600, 12.5, { color: '#fff' })}>{t('offlineBanner')}</Text>
        </Pressable>
      )}

      {/* Тост */}
      {toast && (
        <View style={[ss.toast, { bottom: 96 + insets.bottom }, sh(C.ink, 0.3, 24, 10, 8)]}>
          <Text style={int(500, 13, { color: '#fff' })}>{toast}</Text>
        </View>
      )}

      {/* Заставка ORTA */}
      {intro && <IntroSplash onDone={() => setIntro(false)} />}
    </View>
  );
}

function AppInner() {
  const [fontsLoaded] = useFonts({
    Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold,
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
  });
  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  return (
    <SafeAreaProvider>
      <Root />
    </SafeAreaProvider>
  );
}

const makeSS = () => StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,.45)' },
  sheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, maxHeight: '86%' },
  gradeChip: { minWidth: 52, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.card },
  grab: { width: 44, height: 5, borderRadius: 999, backgroundColor: C.dot, alignSelf: 'center', marginBottom: 16 },
  label: { ...int(600, 13, { color: C.muted }), marginBottom: 8, marginLeft: 4, marginTop: 6 },
  input: { height: 52, backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, ...int(500, 15), borderWidth: 2, borderColor: 'transparent', marginBottom: 8 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 8 },
  swatch: { width: 40, height: 40, borderRadius: 999, borderWidth: 3, borderColor: 'transparent' },
  swatchSel: { borderColor: C.card, transform: [{ scale: 1.08 }], ...sh(C.purple, 0.4, 10, 2, 3) },
  iconPick: { width: 44, height: 44, borderRadius: 14, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  typeChip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, backgroundColor: C.card },
  switchBase: { width: 46, height: 28, borderRadius: 999, backgroundColor: C.dot },
  switchKnob: { position: 'absolute', top: 3, left: 3, width: 22, height: 22, borderRadius: 999, backgroundColor: '#fff' },
  addPhoto: { width: 74, height: 74, borderRadius: 14, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  offline: { position: 'absolute', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#C0392B', borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, zIndex: 50 },
  toast: { position: 'absolute', alignSelf: 'center', backgroundColor: '#14161C', borderRadius: 999, paddingVertical: 10, paddingHorizontal: 18 },
});

let ss = makeSS();
onThemeChange(() => { ss = makeSS(); });


// Оболочка снаружи всего: если что-то упадёт при отрисовке, человек увидит
// понятную страницу с кнопкой, а мы получим отчёт — вместо белого экрана.
export default function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}
