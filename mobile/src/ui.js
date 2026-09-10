import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, Animated, Easing, StyleSheet, Platform, RefreshControl, PanResponder, Dimensions } from 'react-native';
import {
  Calculator, Landmark, Atom, Languages, FlaskConical, Code, BookOpen, Music, Palette, Dumbbell,
  Home, NotebookText, Bell, User, Search, Plus, Bookmark, ChevronLeft, ChevronRight, Check,
  Clock, RefreshCw, TriangleAlert, Settings, Moon, Paperclip, Pencil, Coffee, WifiOff,
  CalendarDays, MessagesSquare, GraduationCap, Ticket, Megaphone, Briefcase, Sparkles, Send, MapPin,
  Radar, Wifi, Bluetooth, LogOut, Shield, Trash2, Users, Share2, ScanLine, Camera, QrCode, ClipboardList, UserMinus,
} from 'lucide-react-native';
import { C, man, int, sh, cardShadow, hexRgba, onThemeChange } from './theme';
import { t } from './i18n';

const ICONS = {
  calculator: Calculator, landmark: Landmark, atom: Atom, languages: Languages,
  'flask-conical': FlaskConical, code: Code, 'book-open': BookOpen, music: Music,
  palette: Palette, dumbbell: Dumbbell, home: Home, 'notebook-text': NotebookText,
  bell: Bell, user: User, search: Search, plus: Plus, bookmark: Bookmark,
  'chevron-left': ChevronLeft, 'chevron-right': ChevronRight, check: Check,
  clock: Clock, 'refresh-cw': RefreshCw, 'triangle-alert': TriangleAlert,
  settings: Settings, moon: Moon, paperclip: Paperclip, pencil: Pencil,
  coffee: Coffee, 'wifi-off': WifiOff, 'calendar-days': CalendarDays,
  'messages-square': MessagesSquare, 'graduation-cap': GraduationCap,
  ticket: Ticket, megaphone: Megaphone, briefcase: Briefcase, sparkles: Sparkles,
  send: Send, 'map-pin': MapPin, radar: Radar, wifi: Wifi, bluetooth: Bluetooth,
  'log-out': LogOut, shield: Shield, 'trash-2': Trash2, users: Users, 'share-2': Share2,
  'scan-line': ScanLine, camera: Camera, 'qr-code': QrCode, 'clipboard-list': ClipboardList, 'user-minus': UserMinus,
};

export function Icon({ name, size = 20, color = C.ink, fill = 'none', strokeWidth = 2 }) {
  const Cmp = ICONS[name] || BookOpen;
  return <Cmp size={size} color={color} fill={fill} strokeWidth={strokeWidth} />;
}

/**
 * Свайп от левого края — «назад», как в iOS.
 * Жест ловим только в 28 px от края и только на горизонтальном движении,
 * чтобы не мешать вертикальным спискам и каруселям внутри экранов.
 */
export function SwipeBack({ onBack, enabled = true, children }) {
  const dx = React.useRef(new Animated.Value(0)).current;
  const width = Dimensions.get('window').width;

  const pan = React.useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (e, g) => (
      enabled
      && e.nativeEvent.pageX - g.dx < 28      // палец начал у самого края
      && g.dx > 8
      && Math.abs(g.dx) > Math.abs(g.dy) * 1.6
    ),
    onPanResponderMove: (e, g) => { if (g.dx > 0) dx.setValue(Math.min(g.dx, width)); },
    onPanResponderRelease: (e, g) => {
      const go = g.dx > width * 0.32 || g.vx > 0.5;
      if (go) {
        Animated.timing(dx, { toValue: width, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: true })
          .start(() => { dx.setValue(0); onBack && onBack(); });
      } else {
        Animated.spring(dx, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
      }
    },
    onPanResponderTerminate: () => { Animated.spring(dx, { toValue: 0, useNativeDriver: true, bounciness: 0, speed: 18 }).start(); },
  }), [enabled, width, onBack, dx]);

  if (!enabled) return <View style={{ flex: 1 }}>{children}</View>;
  return (
    <Animated.View style={{ flex: 1, transform: [{ translateX: dx }] }} {...pan.panHandlers}>
      {children}
    </Animated.View>
  );
}

export function IconBtn({ icon, onPress, badge, style }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.iconBtn, cardShadow, pressed && { transform: [{ scale: 0.92 }] }, style]}>
      <Icon name={icon} size={19} color={C.ink} />
      {badge ? <View style={st.badgeDot} /> : null}
    </Pressable>
  );
}

export function Chip({ label, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={[st.chip, cardShadow, active && { backgroundColor: C.purple, ...sh(C.purple, 0.3, 24, 10, 5) }]}>
      <Text style={int(600, 14, active ? { color: '#fff' } : {})}>{label}</Text>
    </Pressable>
  );
}

export function PrimaryButton({ label, onPress, style }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [st.btnPrimary, sh(C.purple, 0.35, 28, 12, 6), pressed && { backgroundColor: C.purpleDark, transform: [{ scale: 0.98 }] }, style]}>
      <Text style={man(700, 16, { color: '#fff' })}>{label}</Text>
    </Pressable>
  );
}

export function TabBar({ active, onNav, bottom, teacher }) {
  // У преподавателя свои вкладки: афиша и ИИ-помощник — студенческие экраны,
  // вместо них журнал, студенты и отчёты.
  const tabs = teacher ? [
    { id: 'home', icon: 'home' },
    { id: 'students', icon: 'users' },
    { id: 'reports', icon: 'clipboard-list' },
    { id: 'profile', icon: 'user' },
  ] : [
    { id: 'home', icon: 'home' },
    { id: 'afisha', icon: 'ticket' },
    { id: 'ai', icon: 'sparkles' },
    { id: 'profile', icon: 'user' },
  ];
  return (
    <View style={[st.tabbar, sh(C.purple, 0.4, 30, 14, 8), { bottom }]}>
      {tabs.map(t => (
        <Pressable key={t.id} onPress={() => onNav(t.id)} style={st.tab}>
          <Icon name={t.icon} size={24} color={active === t.id ? '#fff' : 'rgba(255,255,255,.6)'} />
          <View style={[st.tabDot, active === t.id && { backgroundColor: '#fff' }]} />
        </Pressable>
      ))}
    </View>
  );
}

export function SubjectCard({ s, bookmarked, onPress, onBookmark, onLongPress }) {
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} style={[st.subjectCard, { backgroundColor: s.color }, sh(s.color, 0.22, 28, 12, 6)]}>
      {/* вырез под кнопку-закладку, как маска в макете */}
      <View style={st.notch} />
      <View style={st.scTop}>
        <View style={st.scIcon}><Icon name={s.icon} size={22} color="#fff" /></View>
        <Pressable onPress={onBookmark} hitSlop={8} style={st.scBookmark}>
          <Icon name="bookmark" size={16} color="#fff" fill={bookmarked ? '#fff' : 'none'} />
        </Pressable>
      </View>
      <View style={[st.scTime, sh(C.ink, 0.14, 16, 6, 3)]}>
        <Text style={[int(700, 15, { color: s.color }), { fontVariant: ['tabular-nums'] }]}>{s.time}</Text>
      </View>
      <View style={st.scBottom}>
        <Text style={man(800, 20, { color: '#fff', lineHeight: 23 })} numberOfLines={2}>{s.name}</Text>
        <View style={st.scTeacher}>
          <View style={st.scAva}><Text style={man(700, 10, { color: '#fff' })}>{s.tInitials}</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={int(400, 10, { color: 'rgba(255,255,255,.7)' })}>{t('teacher')}</Text>
            <Text style={int(600, 12, { color: '#fff' })} numberOfLines={1}>{s.tShort}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function PulseDot() {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [a]);
  const scale = a.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 2.4, 2.4] });
  const opacity = a.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0, 0] });
  return (
    <View style={{ width: 8, height: 8 }}>
      <View style={st.pulseCore} />
      <Animated.View style={[st.pulseCore, { transform: [{ scale }], opacity }]} />
    </View>
  );
}

export function LessonCard({ l, now, onPress }) {
  return (
    <Pressable onPress={onPress} style={[st.lessonCard, cardShadow, now && { borderColor: C.purple, paddingVertical: 10 }]}>
      {now && (
        <View style={st.nowFlag}>
          <PulseDot />
          <Text style={int(600, 11, { color: C.purple })}>{t('now')}</Text>
        </View>
      )}
      <View style={[st.lcTime, { backgroundColor: l.cancelled ? C.border : l.color }]}>
        <Text style={[int(600, 15, { color: l.cancelled ? C.muted : '#fff', textDecorationLine: l.cancelled ? 'line-through' : 'none' }), { fontVariant: ['tabular-nums'] }]}>{l.start}</Text>
        <Text style={[int(400, 13, { color: l.cancelled ? C.muted : 'rgba(255,255,255,.8)', textDecorationLine: l.cancelled ? 'line-through' : 'none' }), { fontVariant: ['tabular-nums'] }]}>{l.end}</Text>
      </View>
      <View style={st.lcMain}>
        <Text style={int(600, 17, { color: l.cancelled ? C.muted : C.ink, paddingRight: now ? 92 : 0 })} numberOfLines={1}>{l.name}</Text>
        <View style={st.lcMeta}>
          <Text style={int(400, 13, { color: C.muted, flex: 1 })} numberOfLines={1}>ауд. {l.room} · {l.teacher}</Text>
          {l.tag ? (
            <View style={[st.lcTag, { backgroundColor: l.cancelled ? C.chipBg : hexRgba(l.color, 0.12) }]}>
              <Text style={int(600, 11, { color: l.cancelled ? C.muted : l.color })}>{l.tag}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export function EmptyArt({ icon = 'coffee' }) {
  return (
    <View style={st.emptyArt}>
      <View style={st.eaL} />
      <View style={st.eaR} />
      <View style={[st.eaC, sh(C.purple, 0.3, 28, 12, 6)]}><Icon name={icon} size={34} color="#fff" /></View>
    </View>
  );
}

/* ============ Глаза миньона для pull-to-refresh ============ */
function MinionEye({ look, style }) {
  const tx = look.interpolate({ inputRange: [-1, 1], outputRange: [-5, 5] });
  const ty = look.interpolate({ inputRange: [-1, 0, 1], outputRange: [1, 0, 1] });
  return (
    <View style={[eye.socket, style]}>
      <View style={eye.rim} />
      <View style={eye.ball}>
        <Animated.View style={[eye.iris, { transform: [{ translateX: tx }, { translateY: ty }] }]}>
          <View style={eye.pupil} />
          <View style={eye.glint} />
        </Animated.View>
        <View style={eye.ballShade} />
      </View>
    </View>
  );
}

export function MinionEyes() {
  const look = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    const dart = () => {
      if (!alive) return;
      const to = [-1, 1, 0.55, -0.55, 0, 1, -1][Math.floor(Math.random() * 7)];
      Animated.sequence([
        Animated.timing(look, { toValue: to, duration: 110 + Math.random() * 80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(180 + Math.random() * 420),
      ]).start(({ finished }) => finished && dart());
    };
    dart();
    return () => { alive = false; look.stopAnimation(); };
  }, [look]);
  return (
    <View style={eye.goggles}>
      <MinionEye look={look} />
      <MinionEye look={look} style={{ marginLeft: -4 }} />
    </View>
  );
}

/* ScrollView с кастомным pull-to-refresh (глаза миньона вместо спиннера).
   Пока палец тянет — глаза стоят на месте; после отпускания короткое
   обновление (~0.6 c) и плавное затухание. */
export function PullScroll({ onRefresh, topInset = 0, contentContainerStyle, children, ...rest }) {
  const scrollY = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;      // затухание после обновления
  const spacerH = useRef(new Animated.Value(0)).current;   // место под глаза во время обновления
  const [refreshing, setRefreshing] = React.useState(false);
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const eyesOpacity = scrollY.interpolate({ inputRange: [-70, -14, 0], outputRange: [1, 0.1, 0], extrapolate: 'clamp' });
  const eyesScale = scrollY.interpolate({ inputRange: [-100, -20, 0], outputRange: [1.05, 0.55, 0.35], extrapolate: 'clamp' });
  const hideEyes = () => {
    Animated.timing(fade, { toValue: 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    Animated.timing(spacerH, { toValue: 0, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: false }).start(() => setRefreshing(false));
  };
  const onEnd = e => {
    if (refreshing) return;
    if (e.nativeEvent.contentOffset.y <= -70) {
      setRefreshing(true);
      fade.setValue(1);
      spacerH.setValue(54);
      onRefresh && onRefresh(); // реальное обновление данных сразу
      timers.current.push(setTimeout(hideEyes, 420)); // видны ~0.4 c, затем затухание
      // страховка: что бы ни случилось, через 1 секунду глаз нет
      timers.current.push(setTimeout(() => {
        fade.setValue(0);
        spacerH.setValue(0);
        setRefreshing(false);
      }, 1000));
    }
  };
  // На Android ScrollView не «баунсится» — используем системный RefreshControl
  if (Platform.OS === 'android') {
    return (
      <Animated.ScrollView
        {...rest}
        style={{ flex: 1 }}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            colors={[C.purple]}
            tintColor={C.purple}
            onRefresh={() => {
              setRefreshing(true);
              onRefresh && onRefresh();
              timers.current.push(setTimeout(() => setRefreshing(false), 700));
            }}
          />
        }>
        {children}
      </Animated.ScrollView>
    );
  }
  return (
    <View style={{ flex: 1 }}>
      <Animated.View pointerEvents="none" style={{
        position: 'absolute', top: topInset + 10, alignSelf: 'center', zIndex: 1,
        opacity: refreshing ? fade : eyesOpacity,
        transform: [{ scale: refreshing ? 1 : eyesScale }],
      }}>
        <MinionEyes />
      </Animated.View>
      <Animated.ScrollView
        {...rest}
        style={{ flex: 1 }}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
        onScrollEndDrag={onEnd}>
        <Animated.View style={{ height: spacerH }} />
        {children}
      </Animated.ScrollView>
    </View>
  );
}

const eye = StyleSheet.create({
  goggles: { flexDirection: 'row', alignItems: 'center' },
  socket: { width: 38, height: 38, borderRadius: 999, backgroundColor: '#AEB3BD', alignItems: 'center', justifyContent: 'center', shadowColor: '#14161C', shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 4 },
  rim: { position: 'absolute', width: 38, height: 38, borderRadius: 999, borderWidth: 1.5, borderColor: '#8A8F9A' },
  ball: { width: 29, height: 29, borderRadius: 999, backgroundColor: '#FDFDFD', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: '#E4C86A' },
  ballShade: { position: 'absolute', top: 0, left: 3, width: 23, height: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.85)' },
  iris: { width: 15, height: 15, borderRadius: 999, backgroundColor: '#8A5A2B', borderWidth: 1.5, borderColor: '#5C3A18', alignItems: 'center', justifyContent: 'center' },
  pupil: { width: 6, height: 6, borderRadius: 999, backgroundColor: '#14161C' },
  glint: { position: 'absolute', top: 1.5, left: 2, width: 3.5, height: 3.5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.95)' },
});

export function Skel({ w, h, r = 12, style }) {
  const a = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(a, { toValue: 0.55, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [a]);
  return <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: C.border, opacity: a }, style]} />;
}

export function Switch({ on, onPress }) {
  return (
    <Pressable onPress={onPress} style={[st.switch, on && { backgroundColor: C.purple }]}>
      <View style={[st.switchKnob, on && { left: 21 }]} />
    </Pressable>
  );
}

export function InfoRow({ k, children, last }) {
  return (
    <View style={[st.infoRow, last && { borderBottomWidth: 0 }]}>
      <Text style={int(400, 14, { color: C.muted })}>{k}</Text>
      {children}
    </View>
  );
}

export function ListRow({ icon, title, sub, right, accent, onPress }) {
  return (
    <Pressable onPress={onPress} style={[st.listRow, cardShadow]}>
      <View style={st.lrLeft}>
        <Icon name={icon} size={20} color={accent ? C.purple : C.muted} />
        <View style={{ flexShrink: 1 }}>
          <Text style={int(600, 15)}>{title}</Text>
          {sub ? <Text style={int(400, 13, { color: C.muted })} numberOfLines={1}>{sub}</Text> : null}
        </View>
      </View>
      {right}
    </Pressable>
  );
}

const makeSt = () => StyleSheet.create({
  iconBtn: { width: 40, height: 40, borderRadius: 999, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  badgeDot: { position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 999, backgroundColor: C.red, borderWidth: 2, borderColor: C.card },
  chip: { paddingVertical: 11, paddingHorizontal: 20, borderRadius: 999, backgroundColor: C.card },
  btnPrimary: { height: 56, backgroundColor: C.purple, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tabbar: { position: 'absolute', left: 16, right: 16, height: 64, backgroundColor: C.purple, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 22 },
  tab: { alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 10 },
  tabDot: { width: 5, height: 5, borderRadius: 999, backgroundColor: 'transparent' },

  subjectCard: { height: 210, borderRadius: 24, padding: 18, overflow: 'hidden' },
  notch: { position: 'absolute', right: -30, top: 210 * 0.34 - 30, width: 60, height: 60, borderRadius: 999, backgroundColor: C.bg },
  scTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  scIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center' },
  scBookmark: { width: 32, height: 32, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.18)', alignItems: 'center', justifyContent: 'center' },
  scTime: { alignSelf: 'center', backgroundColor: '#fff', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 15, marginVertical: 14 },
  scBottom: { position: 'absolute', left: 18, right: 18, bottom: 18 },
  scTeacher: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  scAva: { width: 24, height: 24, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.25)', alignItems: 'center', justifyContent: 'center' },

  lessonCard: { minHeight: 84, backgroundColor: C.card, borderRadius: 20, padding: 12, flexDirection: 'row', gap: 12, borderWidth: 2, borderColor: 'transparent' },
  lcTime: { width: 64, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  lcMain: { flex: 1, justifyContent: 'space-between', paddingVertical: 1 },
  lcMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  lcTag: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },
  nowFlag: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 5, zIndex: 2 },
  pulseCore: { position: 'absolute', width: 8, height: 8, borderRadius: 999, backgroundColor: C.purple },

  emptyArt: { width: 150, height: 120, marginBottom: 28 },
  eaL: { position: 'absolute', left: 8, top: 20, width: 70, height: 88, backgroundColor: C.green, borderRadius: 18, transform: [{ rotate: '-9deg' }], opacity: 0.9 },
  eaR: { position: 'absolute', right: 8, top: 10, width: 70, height: 88, backgroundColor: C.yellow, borderRadius: 18, transform: [{ rotate: '9deg' }], opacity: 0.9 },
  eaC: { position: 'absolute', left: 36, top: 0, width: 78, height: 100, backgroundColor: C.purple, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },

  switch: { width: 46, height: 28, borderRadius: 999, backgroundColor: C.dot },
  switchKnob: { position: 'absolute', top: 3, left: 3, width: 22, height: 22, borderRadius: 999, backgroundColor: '#fff' },

  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.border },
  listRow: { backgroundColor: C.card, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  lrLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
});

export let st = makeSt();
onThemeChange(() => { st = makeSt(); });
