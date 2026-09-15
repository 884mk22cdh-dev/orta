import React from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet, Animated, Easing, KeyboardAvoidingView, Platform, Image, Keyboard, useWindowDimensions } from 'react-native';
import { C, man, int, sh, cardShadow, hexRgba, onThemeChange, themeMode } from './theme';
import { tr } from './tr';
import { t, tGreeting, tPlural, tMonthsNom, tMonthsGen, tDaysShort, tDaysFull } from './i18n';
import {
  Icon, IconBtn, Chip, PrimaryButton, SubjectCard, LessonCard, EmptyArt, Skel, Switch, InfoRow, ListRow, PullScroll,
} from './ui';
import {
  SCHEDULE, NOTIFS, DAY_NAMES,
  weekDates, mondayIndex, toMin, nowMin, isToday, plural, findLesson, findLessonBySubject, subjectKey, lessonFields, daysToFirstExam, formatPhoneKz,
} from './data';
import { CITIES, institutionsOfCity, findInstitution } from './universities';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ATT from './attendance';
import { now as tzNow } from './time';
import { AI_SUGGESTIONS, AI_SUGGESTIONS_ADMIN } from './ai';

const PAD_BOTTOM = 120;

/* ============ Заставка ORTA: три фигуры слетаются в логотип ============ */
const ORTA_BG = '#5324B0';
const ORTA_PIECES = [
  { src: require('../assets/orta-p1.png'), x: 160, y: 166, w: 300, h: 460, fly: { x: -243, y: -139 } },
  { src: require('../assets/orta-p2.png'), x: 564, y: 166, w: 298, h: 460, fly: { x: 241, y: -139 } },
  { src: require('../assets/orta-p3.png'), x: 248, y: 682, w: 528, h: 176, fly: { x: 0, y: 300 } },
];

export function IntroSplash({ onDone }) {
  const conv = React.useRef(new Animated.Value(0)).current;   // слёт фигур к центру
  const spin = React.useRef(new Animated.Value(0)).current;   // вращение «урагана»
  const pulse = React.useRef(new Animated.Value(1)).current;  // финальный толчок
  const word = React.useRef(new Animated.Value(0)).current;   // надпись ORTA
  const out = React.useRef(new Animated.Value(1)).current;    // растворение заставки
  React.useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(conv, { toValue: 1, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(spin, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(1000),
          Animated.timing(word, { toValue: 1, duration: 450, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ]),
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.07, duration: 140, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]),
      Animated.delay(320),
      Animated.timing(out, { toValue: 0, duration: 380, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => onDone && onDone());
  }, []);
  const S = 240 / 1024;
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['420deg', '0deg'] });
  const opacity = conv.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] });
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: ORTA_BG, alignItems: 'center', justifyContent: 'center', zIndex: 100, opacity: out }}>
      <Animated.View style={{ width: 240, height: 240, transform: [{ rotate }, { scale: pulse }] }}>
        {ORTA_PIECES.map((p, i) => {
          const tx = conv.interpolate({ inputRange: [0, 1], outputRange: [p.fly.x, 0] });
          const ty = conv.interpolate({ inputRange: [0, 1], outputRange: [p.fly.y, 0] });
          return (
            <Animated.View key={i} style={{ position: 'absolute', left: p.x * S, top: p.y * S, opacity, transform: [{ translateX: tx }, { translateY: ty }] }}>
              <Image source={p.src} style={{ width: p.w * S, height: p.h * S }} />
            </Animated.View>
          );
        })}
      </Animated.View>
      <Animated.Text style={[man(800, 34, { color: '#EDECF3', letterSpacing: 10, marginTop: 26 }), { opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
        ORTA
      </Animated.Text>
    </Animated.View>
  );
}

/* ============ Онбординг: приветствие ============ */
function FloatCard({ delay = 0, fromX = 0, fromY = 0, rotate = '0deg', bobDur = 3000, style, children }) {
  const inA = React.useRef(new Animated.Value(0)).current;
  const bob = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    let loop = null;
    const spring = Animated.spring(inA, { toValue: 1, delay, friction: 7, tension: 46, useNativeDriver: true });
    spring.start(({ finished }) => {
      if (!finished) return;
      loop = Animated.loop(Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: bobDur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: bobDur, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]));
      loop.start();
    });
    return () => { spring.stop(); if (loop) loop.stop(); };
  }, []);
  const tx = inA.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] });
  const ty = Animated.add(
    inA.interpolate({ inputRange: [0, 1], outputRange: [fromY, 0] }),
    bob.interpolate({ inputRange: [0, 1], outputRange: [0, -7] })
  );
  return (
    <Animated.View style={[style, { opacity: inA, transform: [{ rotate }, { translateX: tx }, { translateY: ty }] }]}>
      {children}
    </Animated.View>
  );
}

function SpinLogo() {
  const inA = React.useRef(new Animated.Value(0)).current;
  const spin = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    const spring = Animated.spring(inA, { toValue: 1, delay: 420, friction: 6, tension: 60, useNativeDriver: true });
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 14000, easing: Easing.linear, useNativeDriver: true }));
    spring.start();
    loop.start();
    return () => { spring.stop(); loop.stop(); };
  }, []);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rotIn = inA.interpolate({ inputRange: [0, 1], outputRange: ['-140deg', '0deg'] });
  return (
    <Animated.View style={{ opacity: inA, transform: [{ scale: inA }, { rotate: rotIn }, { rotate }] }}>
      <Image source={require('../assets/orta-glyphs.png')} style={[s.heroLogo, { tintColor: themeMode === 'dark' ? '#EDECF3' : '#5324B0' }]} resizeMode="contain" />
    </Animated.View>
  );
}

function HeroMiniCard({ color, icon, name, time }) {
  return (
    <View style={[s.onbMini, { backgroundColor: color }, sh(color, 0.28, 24, 10, 5)]}>
      <View style={s.onbMiniIco}><Icon name={icon} size={20} color="#fff" /></View>
      <View>
        <Text style={man(700, 17, { color: '#fff' })}>{name}</Text>
        <Text style={[int(600, 12, { color: 'rgba(255,255,255,.8)', marginTop: 3 }), { fontVariant: ['tabular-nums'] }]}>{time}</Text>
      </View>
    </View>
  );
}

export function WelcomeScreen({ onNext, onLogin, onTeacher, topInset }) {
  // Экран должен помещаться в любое окно: на iPhone SE и в окне iPhone-приложения
  // на iPadOS высота меньше, чем нужно иллюстрации в полный рост. Поэтому
  // картинка ужимается по высоте окна, а всё вместе умеет прокручиваться —
  // кнопка «Продолжить» обязана быть достижима всегда.
  const { height } = useWindowDimensions();
  const short = height < 760;
  // Apple тестировала в окне ~236×418 pt — меньше любого iPhone. Там иллюстрацию
  // убираем совсем, иначе кнопка не влезает и её приходится искать прокруткой.
  const tiny = height < 580;
  const heroH = Math.max(120, Math.min(285, Math.round(height * 0.33)));

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 32, paddingTop: topInset + 8, paddingBottom: 16 }}
      showsVerticalScrollIndicator={false}
      bounces={false}>
      {!tiny && <View style={[s.onbHero, { height: heroH }]}>
        <FloatCard delay={0} fromX={-280} rotate="-9deg" bobDur={2900} style={{ position: 'absolute', left: 0, top: 8 }}>
          <HeroMiniCard color={C.yellow} icon="atom" name="Физика" time="13:00 — 14:30" />
        </FloatCard>
        <FloatCard delay={130} fromX={280} rotate="8deg" bobDur={3400} style={{ position: 'absolute', right: 0, top: 0 }}>
          <HeroMiniCard color={C.green} icon="languages" name="Английский" time="15:00 — 16:30" />
        </FloatCard>
        <FloatCard delay={260} fromY={300} rotate="-2deg" bobDur={3100} style={{ position: 'absolute', left: '50%', marginLeft: -75, top: heroH * 0.35, zIndex: 2 }}>
          <HeroMiniCard color={C.purple} icon="calculator" name="Математика" time="09:00 — 09:50" />
        </FloatCard>
      </View>}

      {!short && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 18, marginBottom: 14, minHeight: 96 }}>
          <SpinLogo />
        </View>
      )}

      <View style={{ paddingBottom: tiny ? 8 : 24, marginTop: tiny ? 'auto' : short ? 20 : 0 }}>
        <Text style={man(800, tiny ? 20 : short ? 23 : 26, { letterSpacing: -0.5 })}>{tr('Добро пожаловать в ORTA 👋')}</Text>
        <Text style={int(400, tiny ? 13.5 : 15, { color: C.muted, marginTop: tiny ? 6 : 10, lineHeight: tiny ? 19 : 22 })}>
          Всё расписание университета — в одном месте. Твои пары, замены и уведомления.
        </Text>
        <PrimaryButton label={t('cont')} onPress={onNext} style={{ marginTop: tiny ? 14 : short ? 20 : 28 }} />
        <View style={[s.onbDots, tiny && { marginTop: 10, marginBottom: 4 }]}>
          <View style={[s.onbDot, { width: 22, backgroundColor: C.purple }]} />
          <View style={s.onbDot} />
          <View style={s.onbDot} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14, marginTop: tiny ? 8 : 16 }}>
          <Pressable onPress={onLogin} hitSlop={10}>
            <Text style={int(600, 14, { color: C.purple })}>{t('haveAccount')}</Text>
          </Pressable>
          <View style={{ width: 1, height: 14, backgroundColor: C.border }} />
          <Pressable onPress={onTeacher} hitSlop={10}>
            <Text style={int(600, 14, { color: C.teal })}>{t('iAmTeacher')}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

/* ============ Вход по email ============ */
const RESEND_AFTER = 30; // секунд до кнопки «отправить ещё раз»; сервер пускает через 20, код живёт 10 минут

export function LoginScreen({ busy, sentTo, sentAt, resendIn, onSendCode, onVerify, onPassword, onBack, topInset }) {
  const [mode, setMode] = React.useState('pass');   // pass | code
  const [email, setEmail] = React.useState('');
  const [pass, setPass] = React.useState('');
  const [code, setCode] = React.useState('');
  const [left, setLeft] = React.useState(0);
  const codeRef = React.useRef(null);

  React.useEffect(() => {
    if (!sentTo) { setLeft(0); return; }
    setCode('');
    setLeft(resendIn || RESEND_AFTER);
    const focus = setTimeout(() => codeRef.current?.focus(), 350);
    const id = setInterval(() => setLeft(v => (v <= 1 ? 0 : v - 1)), 1000);
    return () => { clearInterval(id); clearTimeout(focus); };
  }, [sentTo, sentAt, resendIn]);

  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  const mail = email.trim().toLowerCase();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, paddingTop: topInset + 8 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Pressable onPress={onBack} style={s.backLink}>
          <Icon name="chevron-left" size={18} color={C.muted} />
          <Text style={int(600, 15, { color: C.muted })}>{t('back')}</Text>
        </Pressable>
        <Text style={man(800, 26, { marginTop: 20 })}>{t('loginTitle')}</Text>
        <Text style={int(400, 14, { color: C.muted, marginTop: 6, lineHeight: 20 })}>
          {sentTo ? t('loginCodeSent').replace('{email}', sentTo) : mode === 'pass' ? t('loginPassHint') : t('loginEmailHint')}
        </Text>

        <Text style={s.formLabel}>Email</Text>
        <TextInput style={[s.formInput, cardShadow, int(500, 15), !!sentTo && { opacity: 0.6 }]}
          placeholder="you@mail.com" placeholderTextColor={C.dot}
          autoCapitalize="none" keyboardType="email-address" autoComplete="email" autoCorrect={false}
          editable={!sentTo && !busy}
          value={email} onChangeText={setEmail} />

        {sentTo ? (
          <>
            <Text style={s.formLabel}>{t('loginCodeLbl')}</Text>
            <TextInput ref={codeRef}
              style={[s.formInput, cardShadow, man(800, 26), { textAlign: 'center', letterSpacing: 10 }]}
              placeholder="000000" placeholderTextColor={C.dot}
              keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode"
              editable={!busy}
              value={code}
              onChangeText={v => {
                const digits = v.replace(/\D/g, '').slice(0, 6);
                setCode(digits);
                if (digits.length === 6 && !busy) { Keyboard.dismiss(); onVerify(sentTo, digits); }
              }} />
            <PrimaryButton label={busy ? '…' : t('loginEnter')} style={{ marginTop: 18 }}
              onPress={() => { if (!busy && code.length === 6) onVerify(sentTo, code); }} />
            <Pressable onPress={() => { if (!busy) onSendCode(sentTo, left); }}
              style={({ pressed }) => [{ alignItems: 'center', paddingVertical: 16 }, pressed && { opacity: 0.7 }]}>
              <Text style={int(600, 14, { color: left === 0 ? C.purple : C.dot })}>
                {left === 0 ? t('loginResend') : t('loginResendIn').replace('{t}', mmss)}
              </Text>
            </Pressable>
            <Text style={int(400, 12.5, { color: C.muted, textAlign: 'center', lineHeight: 18 })}>{t('loginMailFrom')}</Text>
          </>
        ) : mode === 'pass' ? (
          <>
            <Text style={s.formLabel}>{t('passLoginLbl')}</Text>
            <TextInput style={[s.formInput, cardShadow, int(500, 15)]}
              placeholder="••••••••" placeholderTextColor={C.dot}
              secureTextEntry autoComplete="current-password" textContentType="password"
              editable={!busy} value={pass} onChangeText={setPass} />
            <PrimaryButton label={busy ? '…' : t('loginEnter')} style={{ marginTop: 22 }}
              onPress={() => { if (!busy && emailOk && pass.length >= 6) { Keyboard.dismiss(); onPassword(mail, pass); } }} />
            <Pressable onPress={() => setMode('code')} style={{ alignItems: 'center', paddingVertical: 18 }}>
              <Text style={int(600, 14, { color: C.purple })}>{t('loginNoPass')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <PrimaryButton label={busy ? '…' : t('loginSendCode')} style={{ marginTop: 22 }}
              onPress={() => { if (!busy && emailOk) { Keyboard.dismiss(); onSendCode(mail); } }} />
            {!!email.trim() && !emailOk && (
              <Text style={int(400, 12.5, { color: C.red, textAlign: 'center', marginTop: 10 })}>{t('loginBadEmail')}</Text>
            )}
            <Pressable onPress={() => setMode('pass')} style={{ alignItems: 'center', paddingVertical: 18 }}>
              <Text style={int(600, 14, { color: C.purple })}>{t('loginByPass')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/* Шаг 6 онбординга: код с почты и пароль на будущее.
   Таймер отсчитывает не жизнь кода (он живёт 10 минут), а момент, когда
   можно попросить письмо заново — Supabase не шлёт чаще раза в минуту. */
function SetupCodeStep({ email, sentAt, resendIn, mode, busy, code, setCode, pass, setPass, onResend }) {
  const [left, setLeft] = React.useState(resendIn || RESEND_AFTER);
  const ref = React.useRef(null);

  React.useEffect(() => {
    setLeft(resendIn || RESEND_AFTER);
    const focus = setTimeout(() => ref.current?.focus(), 350);
    const id = setInterval(() => setLeft(v => (v <= 1 ? 0 : v - 1)), 1000);
    return () => { clearInterval(id); clearTimeout(focus); };
  }, [email, sentAt, resendIn]);

  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
  return (
    <ScrollView style={{ flex: 1, marginTop: 20 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={[s.formLabel, { marginTop: 0 }]}>{t('loginCodeLbl')}</Text>
      <TextInput ref={ref}
        style={[s.formInput, cardShadow, man(800, 26), { textAlign: 'center', letterSpacing: 10 }]}
        placeholder="000000" placeholderTextColor={C.dot}
        keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" textContentType="oneTimeCode"
        editable={!busy}
        value={code}
        onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))} />

      {mode === 'login' && (
        <Text style={int(400, 13.5, { color: C.muted, marginTop: 14, lineHeight: 20 })}>{t('loginExisting')}</Text>
      )}
      <Text style={s.formLabel}>{t('passNew')}</Text>
      <TextInput style={[s.formInput, cardShadow, int(500, 15)]}
        placeholder={tr('минимум 6 символов')} placeholderTextColor={C.dot}
        secureTextEntry autoComplete="new-password" textContentType="newPassword"
        editable={!busy} value={pass} onChangeText={setPass} />
      <Text style={int(400, 12.5, { color: C.muted, marginTop: 8, lineHeight: 18 })}>{t('passNewHint')}</Text>

      <Pressable onPress={() => { if (!busy) onResend(left); }}
        style={({ pressed }) => [{ alignItems: 'center', paddingVertical: 18 }, pressed && { opacity: 0.7 }]}>
        <Text style={int(600, 14, { color: left === 0 ? C.purple : C.dot })}>
          {left === 0 ? t('loginResend') : t('loginResendIn').replace('{t}', mmss)}
        </Text>
      </Pressable>

      <Text style={int(400, 12.5, { color: C.muted, textAlign: 'center', lineHeight: 18 })}>
        {t('loginMailFrom')}
      </Text>
    </ScrollView>
  );
}

/* ============ Сразу после регистрации: откуда взять расписание ============ */
export function StartScreen({ busy, topInset, actions }) {
  return (
    <ScrollView style={{ flex: 1 }} bounces={false} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ flexGrow: 1, paddingTop: topInset + 24, paddingHorizontal: 20, paddingBottom: 16 }}>
      <Text style={man(800, 28, { letterSpacing: -0.4 })}>{t('startTitle')}</Text>
      <Text style={int(400, 15, { color: C.muted, marginTop: 10, lineHeight: 21 })}>{t('startSub')}</Text>

      <Pressable onPress={() => actions.nav('groupScan')} disabled={busy}
        style={({ pressed }) => [s.startCard, sh(C.teal, 0.3, 28, 12, 6), pressed && { transform: [{ scale: 0.98 }] }]}>
        <View style={s.roundIcon}><Icon name="scan-line" size={24} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={man(800, 17, { color: '#fff' })}>{t('startScan')}</Text>
          <Text style={int(400, 12.5, { color: 'rgba(255,255,255,.85)', marginTop: 3 })}>{t('startScanSub')}</Text>
        </View>
        <Icon name="chevron-right" size={20} color="rgba(255,255,255,.8)" />
      </Pressable>

      <Pressable onPress={actions.startAsOwner} disabled={busy}
        style={({ pressed }) => [s.startCard, { backgroundColor: C.card, marginTop: 12 }, cardShadow, pressed && { transform: [{ scale: 0.98 }] }]}>
        <View style={[s.roundIcon, { backgroundColor: hexRgba(C.purple, 0.12) }]}>
          <Icon name="megaphone" size={22} color={C.purple} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={man(800, 17)}>{t('startOwner')}</Text>
          <Text style={int(400, 12.5, { color: C.muted, marginTop: 3 })}>{t('startOwnerSub')}</Text>
        </View>
        <Icon name="chevron-right" size={20} color={C.dot} />
      </Pressable>

      <Pressable onPress={() => actions.startSolo()} disabled={busy}
        style={({ pressed }) => [{ alignItems: 'center', paddingVertical: 20, marginTop: 6 }, pressed && { opacity: 0.7 }]}>
        <Text style={int(600, 15, { color: C.muted })}>{t('startSolo')}</Text>
      </Pressable>

      <Text style={int(400, 12.5, { color: C.dot, textAlign: 'center', marginTop: 'auto', marginBottom: 24, lineHeight: 18 })}>
        {t('startHint')}
      </Text>
    </ScrollView>
  );
}

/* ============ Онбординг: шаги настройки ============ */
export function SetupScreen({ step, setup, person, onPerson, onPick, onNext, onBack, topInset, busy, codeSentTo, sentAt, resendIn, mode, code, setCode, pass, setPass, onResend }) {
  const [q, setQ] = React.useState('');
  const searchRef = React.useRef(null);
  React.useEffect(() => { setQ(''); }, [step]);

  const [eduFilter, setEduFilter] = React.useState('all'); // all | uni | college
  React.useEffect(() => { if (step === 2) setEduFilter('all'); }, [step]);

  const allOfCity = institutionsOfCity(setup.city);
  const uniCount = allOfCity.filter(i => i.kind === 'uni').length;
  const colCount = allOfCity.length - uniCount;
  const selectedInst = findInstitution(setup.university, setup.city);
  const isCollege = selectedInst?.kind === 'college';

  const teacher = setup.role === 'teacher';
  const titles = {
    1: ['Выберите город', teacher ? 'В каком городе вы преподаёте?' : 'В каком городе вы учитесь?'],
    2: [teacher ? 'Где вы преподаёте' : 'Где вы учитесь', setup.city
      ? `${uniCount} ${plural(uniCount, 'вуз', 'вуза', 'вузов')} и ${colCount} ${plural(colCount, 'колледж', 'колледжа', 'колледжей')} · ${setup.city}`
      : 'Сначала выберите город'],
    3: [isCollege ? 'Выберите специальность' : 'Выберите факультет',
      selectedInst ? selectedInst.name : (setup.university || 'Сначала выберите заведение')],
    4: ['Выберите курс', 'Какой курс вы сейчас заканчиваете?'],
    5: [teacher ? 'О преподавателе' : 'О себе', 'Как вас зовут и как с вами связаться?'],
    6: [mode === 'login' ? 'Вход в ваш аккаунт' : 'Подтвердите почту',
        busy ? 'Отправляем код…' : codeSentTo ? `Код отправлен на ${codeSentTo}` : 'Введите код из письма'],
    7: ['', ''],
  };
  const [title, sub] = titles[step];
  const ql = q.trim().toLowerCase();

  let body = null;
  if (step <= 3) {
    const field = step === 1 ? 'city' : step === 2 ? 'university' : 'faculty';
    // на шаге 2 работаем с объектами (нужен значок «Колледж»), на остальных — со строками
    const items = step === 1
      ? CITIES.map(c => ({ name: c }))
      : step === 2
        ? allOfCity.filter(i => eduFilter === 'all' || i.kind === eduFilter)
        : (selectedInst ? selectedInst.faculties : []).map(f => ({ name: f }));
    let filtered = ql ? items.filter(x => x.name.toLowerCase().includes(ql)) : items;

    // Вписанное вручную значение показываем первой строкой — иначе выбор не виден
    const own = String(setup[field] || '').trim();
    const ownIsCustom = step > 1 && !!own && !items.some(x => x.name === own);
    if (ownIsCustom && (!ql || own.toLowerCase().includes(ql))) {
      filtered = [{ name: own, custom: true }, ...filtered];
    }

    // Своё заведение / свою специальность можно вписать вручную — никто не остаётся заблокированным.
    // Кнопка видна всегда: пустая — фокусирует поиск, с текстом — добавляет.
    const typed = q.trim();
    const alreadyThere = items.some(x => x.name.toLowerCase() === ql) || own.toLowerCase() === ql;
    const canAddOwn = step > 1 && !(typed && alreadyThere);

    body = (
      <View style={{ flex: 1 }}>
        <View style={[s.searchBar, cardShadow, { marginTop: 18 }]}>
          <Icon name="search" size={18} color={C.muted} />
          <TextInput
            ref={searchRef}
            style={[int(500, 15), { flex: 1, paddingVertical: 0 }]}
            placeholder={step === 1 ? 'Найти город…' : step === 2 ? 'Вуз или колледж…' : (isCollege ? 'Найти специальность…' : 'Найти факультет…')}
            placeholderTextColor={C.dot}
            value={q}
            onChangeText={setQ}
          />
        </View>

        {step === 2 && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {[['all', 'Все'], ['uni', 'Вузы'], ['college', 'Колледжи']].map(([k, lbl]) => (
              <Chip key={k} label={lbl} active={eduFilter === k} onPress={() => setEduFilter(k)} />
            ))}
          </View>
        )}

        <ScrollView style={{ flex: 1, marginTop: 14 }} contentContainerStyle={{ gap: 10, paddingBottom: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {filtered.map(o => {
            const sel = setup[field] === o.name;
            return (
              <Pressable key={(o.custom ? 'own' : o.kind || '') + o.name} onPress={() => onPick(field, o.name)}
                style={[s.pickRow, cardShadow, sel && { borderColor: C.purple }]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={int(600, 15, sel ? { color: C.purple } : {})}>{o.name}</Text>
                  {o.kind === 'college' && (
                    <Text style={int(500, 11.5, { color: C.muted, marginTop: 3 })}>{tr('Колледж')}</Text>
                  )}
                  {o.custom && (
                    <Text style={int(500, 11.5, { color: C.muted, marginTop: 3 })}>{tr('Добавлено вами')}</Text>
                  )}
                </View>
                {sel && <View style={s.pickCheck}><Icon name="check" size={14} color="#fff" /></View>}
              </Pressable>
            );
          })}

          {canAddOwn && (
            <Pressable
              onPress={() => {
                if (typed) { onPick(field, typed); setQ(''); Keyboard.dismiss(); }
                else searchRef.current?.focus();
              }}
              style={({ pressed }) => [s.pickRow, cardShadow, { borderStyle: 'dashed', borderColor: C.purple }, pressed && { opacity: 0.75 }]}>
              <View style={[s.pickCheck, { backgroundColor: C.purple }]}><Icon name="plus" size={14} color="#fff" /></View>
              <View style={{ flex: 1, paddingLeft: 10 }}>
                <Text style={int(600, 15, { color: C.purple })} numberOfLines={2}>
                  {typed
                    ? `${step === 2 ? 'Добавить' : isCollege ? 'Добавить специальность' : 'Добавить факультет'} «${typed}»`
                    : (step === 2 ? 'Добавить свой вуз или колледж'
                       : isCollege ? 'Добавить свою специальность' : 'Добавить свой факультет')}
                </Text>
                <Text style={int(400, 11.5, { color: C.muted, marginTop: 3 })}>
                  {typed
                    ? (step === 2 ? 'Своего вуза или колледжа нет в списке'
                       : isCollege ? 'Своей специальности нет в списке' : 'Своего факультета нет в списке')
                    : 'Впишите название в поиск сверху'}
                </Text>
              </View>
            </Pressable>
          )}

          {!filtered.length && !canAddOwn && (
            <Text style={int(400, 15, { color: C.muted, textAlign: 'center', marginTop: 40 })}>{t('nothingFound')}</Text>
          )}
        </ScrollView>
      </View>
    );
  } else if (step === 4) {
    body = (
      <View style={s.grid2}>
        {[1, 2, 3, 4].map(o => {
          const sel = setup.course === o;
          return (
            <Pressable key={String(o)} onPress={() => onPick('course', o)}
              style={[s.pickCard, cardShadow, sel && { borderColor: C.purple, ...sh(C.purple, 0.14, 24, 8, 4) }]}>
              <Text style={man(800, 30, sel ? { color: C.purple } : {})}>{o}</Text>
              <Text style={int(400, 13, { color: sel ? C.purple : C.muted })}>{tr('курс')}</Text>
              {sel && <View style={[s.pickCheck, { position: 'absolute', top: 10, right: 10 }]}><Icon name="check" size={14} color="#fff" /></View>}
            </Pressable>
          );
        })}
      </View>
    );
  } else if (step === 5) {
    body = (
      <ScrollView style={{ flex: 1, marginTop: 20 }} contentContainerStyle={{ gap: 4 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={s.formLabel}>{tr('Имя')}</Text>
        <TextInput style={[s.formInput, cardShadow, int(500, 15)]}
          placeholder={teacher ? 'Айгүль' : 'Илон'} placeholderTextColor={C.dot}
          value={person.firstName} onChangeText={v => onPerson('firstName', v)} />
        <Text style={s.formLabel}>{tr('Фамилия')}</Text>
        <TextInput style={[s.formInput, cardShadow, int(500, 15)]} placeholder={tr('Маск')} placeholderTextColor={C.dot}
          value={person.lastName} onChangeText={v => onPerson('lastName', v)} />
        <Text style={s.formLabel}>{tr('Номер телефона')}</Text>
        <TextInput style={[s.formInput, cardShadow, int(500, 15)]} placeholder="+7 700 700 70 70" placeholderTextColor={C.dot}
          keyboardType="phone-pad" maxLength={16}
          value={person.phone || ''} onChangeText={v => onPerson('phone', formatPhoneKz(v))}
          onFocus={() => { if (!person.phone) onPerson('phone', '+7 '); }} />
        <Text style={s.formLabel}>Email</Text>
        <TextInput style={[s.formInput, cardShadow, int(500, 15)]} placeholder="you@mail.com" placeholderTextColor={C.dot}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email"
          value={person.email || ''} onChangeText={v => onPerson('email', v)} />
        <Text style={int(400, 12.5, { color: C.muted, marginTop: 10, lineHeight: 18 })}>
          {teacher
            ? 'На почту придёт код. По нему вы зайдёте в свой журнал с другого телефона — пары, отметки и оценки останутся при вас.'
            : 'На почту придёт код. По нему вы сможете зайти в свой профиль с другого телефона — расписание, группа и монеты останутся при вас.'}
        </Text>
      </ScrollView>
    );
  } else if (step === 6) {
    body = <SetupCodeStep email={codeSentTo || person.email} sentAt={sentAt} resendIn={resendIn} mode={mode} busy={busy} code={code} setCode={setCode}
      pass={pass} setPass={setPass} onResend={onResend} />;
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, paddingTop: topInset + 8 }}>
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        <Pressable onPress={onBack} style={s.backLink}>
          <Icon name="chevron-left" size={18} color={C.muted} />
          <Text style={int(600, 15, { color: C.muted })}>{t('back')}</Text>
        </Pressable>
        <View style={s.progress}>
          {(teacher ? [1, 2, 5, 6] : [1, 2, 3, 4, 5, 6]).map(i => <View key={i} style={[s.progressSeg, i <= step && { backgroundColor: C.purple }]} />)}
        </View>
        <Text style={man(800, 24, { letterSpacing: -0.3 })}>{title}</Text>
        <Text style={int(400, 15, { color: C.muted, marginTop: 8 })} numberOfLines={1}>{sub}</Text>
        {body}
      </View>
      <View style={{ padding: 20 }}>
        <PrimaryButton
          label={busy ? '…'
            : step === 6 ? t('done')
            : step === 5 ? (codeSentTo && codeSentTo === String(person.email || '').trim().toLowerCase() ? t('enterCode') : t('loginSendCode'))
            : t('next')}
          onPress={() => !busy && onNext()} />
      </View>
    </KeyboardAvoidingView>
  );
}

/* ============ Главная ============ */
export function HomeScreen({ state, selectedDay, topInset, actions }) {
  const days = weekDates();
  const todayIdx = mondayIndex(tzNow());
  const lessons = SCHEDULE[selectedDay] || [];
  const activeLessons = lessons.filter(l => !l.cancelled);
  const countLine = activeLessons.length
    ? `${tPlural(activeLessons.length, 'pairForms')} · ${activeLessons[0].start} — ${activeLessons[activeLessons.length - 1].end}`
    : null;
  const examDays = daysToFirstExam(state.exams);
  return (
    <PullScroll topInset={topInset} onRefresh={() => actions.refreshed()} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: PAD_BOTTOM }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View>
          <Text style={int(400, 15, { color: C.muted })}>{tGreeting()}</Text>
          <Text style={man(800, 28, { letterSpacing: -0.5, marginTop: 2 })}>{state.profile.firstName}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <IconBtn icon="bell" badge={NOTIFS.some(n => !state.readNotifs.includes(n.id))} onPress={() => actions.nav('notifications')} />
          <IconBtn icon="search" onPress={() => actions.nav('search')} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
        <Chip label={t('forum')} active={state.chips === 'forum'} onPress={() => actions.setChips('forum')} />
        <Chip label={t('exams')} active={state.chips === 'exams'} onPress={() => actions.setChips('exams')} />
        <Chip label={t('subjects')} active={state.chips === 'subjects'} onPress={() => actions.setChips('subjects')} />
      </View>

      {state.chips === 'subjects' ? (
        <>
          {/* Календарь недели */}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 20, alignItems: 'center' }}>
            {days.map((d, i) => {
              const today = i === todayIdx, sel = i === selectedDay;
              return (
                <Pressable key={d.name} onPress={() => actions.selectDay(i)}
                  style={[s.dayPill, cardShadow,
                    sel && { backgroundColor: C.purple, ...sh(C.purple, 0.32, 24, 10, 5) },
                    !sel && today && { borderColor: C.purple, borderWidth: 2 }]}>
                  <Text style={int(400, 12, { color: sel ? 'rgba(255,255,255,.85)' : today ? C.purple : C.muted })}>{d.name}</Text>
                  <Text style={man(700, 16, { color: sel ? '#fff' : today ? C.purple : C.ink })}>{d.num}</Text>
                </Pressable>
              );
            })}
            <Pressable onPress={() => actions.openLessonEditor(selectedDay, null)}
              style={({ pressed }) => [s.dayPlus, sh(C.purple, 0.34, 20, 8, 5), pressed && { transform: [{ scale: 0.92 }] }]}>
              <Icon name="plus" size={20} color="#fff" />
            </Pressable>
          </View>
          <Pressable onPress={() => actions.nav('calendar')} hitSlop={8} style={{ marginTop: 16, marginBottom: 4 }}>
            <Text style={[int(400, 13, { color: C.muted }), { fontVariant: ['tabular-nums'] }]}>{countLine || t('freeDay')}</Text>
          </Pressable>
          {examDays !== null && examDays >= 0 && examDays <= 30 && (
            <Pressable onPress={() => actions.setChips('exams')} style={[s.examPill, cardShadow]}>
              <Text style={int(600, 13, { color: C.red })}>⏳ {t('daysToExam')} — {tPlural(examDays, 'dayForms')}</Text>
            </Pressable>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginHorizontal: 4 }}>
            <Text style={man(700, 19)}>{t('mySubjects')}</Text>
            <Pressable onPress={() => actions.nav('calendar')} hitSlop={8}>
              <Text style={int(600, 13, { color: C.purple })}>{t('calendar')}</Text>
            </Pressable>
          </View>
          {lessons.length ? (
            <View style={s.subjectGrid}>
              {lessons.map(l => {
                const parts = (l.teacher || '').split(/\s+/);
                return (
                  <View key={l.id} style={[{ width: '47.8%' }, l.cancelled && { opacity: 0.45 }]}>
                    <SubjectCard
                      s={{
                        color: l.color, icon: l.icon || 'book-open', time: l.start, name: l.name,
                        tInitials: l.tInitials || (parts[0] ? parts[0][0].toUpperCase() : '·'),
                        tShort: parts[1] ? `${parts[0]} ${parts[1][0]}.` : (parts[0] || '—'),
                      }}
                      bookmarked={state.bookmarks.includes(l.id)}
                      onPress={() => actions.openLesson(l.id)}
                      onBookmark={() => actions.bookmark(l.id)}
                      onLongPress={() => actions.openLessonEditor(selectedDay, l)}
                    />
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: 30 }}>
              <Text style={int(400, 15, { color: C.muted })}>{t('noLessons')}</Text>
            </View>
          )}

          <TasksBlock tasks={state.tasks || []} groupTasks={state.groupTasks || []} groupTaskDone={state.groupTaskDone || {}}
            onOpen={() => actions.nav('tasks')} onToggle={actions.toggleTask} onToggleGroup={actions.toggleGroupTask} />
        </>
      ) : state.chips === 'forum' ? (
        state.group ? (
          <ForumSection posts={state.forum || []} onPost={actions.addForumPost} onReport={actions.reportPost} blocked={state.blocked} groupName={state.group.name} />
        ) : (
          <View style={{ alignItems: 'center', paddingTop: 50 }}>
            <EmptyArt icon="users" />
            <Text style={man(800, 20)}>{tr('Вы не в группе')}</Text>
            <Text style={int(400, 14, { color: C.muted, marginTop: 8, textAlign: 'center' })}>
              Чат виден только участникам группы.{'\n'}Вступите по коду от старосты.
            </Text>
            <PrimaryButton label={t('groupAdd')} style={{ marginTop: 18, alignSelf: 'stretch' }}
              onPress={() => actions.nav('group')} />
          </View>
        )
      ) : (
        <ExamsSection exams={state.exams || []} onAdd={actions.openExamSheet} onDelete={actions.deleteExam} />
      )}
    </PullScroll>
  );
}

/* ============ Форум группы (вкладка на главной) ============ */
function ForumSection({ posts, onPost, onReport, blocked, groupName }) {
  const [text, setText] = React.useState('');
  const send = () => {
    const v = text.trim();
    if (!v) return;
    setText('');
    onPost(v);
  };
  return (
    <View style={{ marginTop: 24 }}>
      <Text style={man(700, 19, { marginHorizontal: 4 })}>{t('forumTitle')}{groupName ? ' · ' + groupName : ''}</Text>
      {/* Правило App Store 1.2: человек должен видеть, по каким правилам
          работает чат и как пожаловаться. */}
      <Text style={int(400, 12, { color: C.muted, marginHorizontal: 4, marginTop: 6, lineHeight: 17 })}>{t('chatRules')}</Text>
      <View style={{ gap: 12, marginTop: 14 }}>
        {posts.filter(p => !(blocked || []).includes(p.author)).map(p => (
          <Pressable key={p.id} onLongPress={() => !p.mine && onReport(p)} style={[s.forumPost, cardShadow]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={s.forumAva}><Text style={man(700, 10, { color: '#fff' })}>{(p.author.trim()[0] || '•').toUpperCase()}</Text></View>
              <Text style={int(600, 13)}>{p.author}</Text>
              <Text style={int(400, 12, { color: C.muted, marginLeft: 'auto' })}>{p.when}</Text>
            </View>
            <Text style={int(400, 15, { marginTop: 8, lineHeight: 21 })}>{p.text}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={int(400, 11, { color: C.muted, marginTop: 8, marginLeft: 4 })}>
        Долгое нажатие на чужое сообщение — пожаловаться или скрыть автора
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 }}>
        <TextInput
          style={[s.forumInput, cardShadow, int(500, 15)]}
          placeholder={t('forumPlaceholder')}
          placeholderTextColor={C.dot}
          value={text}
          onChangeText={setText}
          onSubmitEditing={send}
          returnKeyType="send"
        />
        <Pressable onPress={send} style={({ pressed }) => [s.forumSend, sh(C.purple, 0.34, 20, 8, 5), pressed && { transform: [{ scale: 0.92 }] }]}>
          <Icon name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

/* ============ Экзамены (вкладка на главной) ============ */
function ExamsSection({ exams, onAdd, onDelete }) {
  const days = daysToFirstExam(exams);
  return (
    <View style={{ marginTop: 24 }}>
      {days !== null && days >= 0 && (
        <View style={[s.examCounter, sh(C.purple, 0.3, 28, 12, 6)]}>
          <Text style={man(800, 30, { color: '#fff' })}>{tPlural(days, 'dayForms')}</Text>
          <Text style={int(500, 13, { color: 'rgba(255,255,255,.85)', marginTop: 2 })}>{t('daysToExam').toLowerCase()}</Text>
        </View>
      )}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 4 }}>
        <View>
          <Text style={man(700, 19)}>{t('examsTitle')}</Text>
          <Text style={int(400, 13, { color: C.muted, marginTop: 2 })}>{t('examsSub')}</Text>
        </View>
        <Pressable onPress={onAdd} style={({ pressed }) => [s.plusBtn, sh(C.purple, 0.34, 20, 8, 5), pressed && { transform: [{ scale: 0.9 }] }]}>
          <Icon name="plus" size={20} color="#fff" />
        </Pressable>
      </View>
      <View style={{ gap: 12, marginTop: 14 }}>
        {exams.map(x => (
          <Pressable key={x.id} onLongPress={() => onDelete(x.id)} style={[s.examCard, cardShadow]}>
            <View style={[s.examDate, { backgroundColor: x.color }]}>
              <Text style={man(800, 18, { color: '#fff' })}>{x.date.split(' ')[0]}</Text>
              <Text style={int(400, 11, { color: 'rgba(255,255,255,.85)' })}>{x.date.split(' ').slice(1).join(' ') || ''}</Text>
            </View>
            <View style={{ flex: 1, justifyContent: 'center', gap: 3 }}>
              <Text style={int(600, 16)}>{x.subject}</Text>
              <Text style={[int(400, 13, { color: C.muted }), { fontVariant: ['tabular-nums'] }]}>{x.time} · ауд. {x.room}</Text>
              {!!x.note && (
                <Text style={int(400, 12.5, { color: C.muted, marginTop: 2 })} numberOfLines={3}>{x.note}</Text>
              )}
            </View>
            <View style={[s.examTag, { backgroundColor: hexRgba(x.color, 0.12) }]}>
              <Text style={int(600, 11, { color: x.color })}>{t('examWord')}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/* ============ Расписание ============ */
export function ScheduleScreen({ selectedDay, topInset, actions }) {
  const days = weekDates();
  const todayIdx = mondayIndex(tzNow());
  const lessons = SCHEDULE[selectedDay] || [];
  const active = lessons.filter(l => !l.cancelled);
  const countLine = active.length
    ? `${active.length} ${plural(active.length, 'пара', 'пары', 'пар')} · ${active[0].start} — ${active[active.length - 1].end}`
    : null;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: PAD_BOTTOM }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={man(800, 24)}>{tr('Расписание')}</Text>
        <IconBtn icon="search" onPress={() => actions.nav('search')} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
        {days.map((d, i) => {
          const today = i === todayIdx, sel = i === selectedDay;
          return (
            <Pressable key={d.name} onPress={() => actions.selectDay(i)}
              style={[s.dayPill, cardShadow,
                today && { backgroundColor: C.purple, ...sh(C.purple, 0.32, 24, 10, 5) },
                sel && !today && { borderColor: C.purple, borderWidth: 2 }]}>
              <Text style={int(400, 12, { color: today ? 'rgba(255,255,255,.85)' : sel ? C.purple : C.muted })}>{d.name}</Text>
              <Text style={man(700, 16, { color: today ? '#fff' : sel ? C.purple : C.ink })}>{d.num}</Text>
            </Pressable>
          );
        })}
      </View>
      {countLine
        ? <Text style={[int(400, 13, { color: C.muted, marginTop: 22, marginBottom: 12 }), { fontVariant: ['tabular-nums'] }]}>{countLine}</Text>
        : <View style={{ height: 22 }} />}
      {lessons.length ? (
        <View style={{ gap: 12 }}>
          {lessons.map(l => {
            const now = isToday(selectedDay) && !l.cancelled && nowMin() >= toMin(l.start) && nowMin() < toMin(l.end);
            return <LessonCard key={l.id} l={l} now={now} onPress={() => actions.openLesson(l.id)} />;
          })}
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingTop: 40 }}>
          <EmptyArt />
          <Text style={man(800, 22)}>{tr('В этот день пар нет')}</Text>
          <Text style={int(400, 15, { color: C.muted, marginTop: 8, textAlign: 'center', lineHeight: 21 })}>
            Добавьте пару кнопкой «+»{'\n'}или откройте календарь
          </Text>
          <PrimaryButton label={tr('Добавить пару')} style={{ marginTop: 18, alignSelf: 'stretch' }}
            onPress={() => actions.nav('calendar')} />
        </View>
      )}
    </ScrollView>
  );
}

/* ============ Детали занятия ============ */
export function LessonScreen({ id, group, lessonData, topInset, actions }) {
  const l = findLesson(id) || SCHEDULE.flat()[0];
  if (!l) return null;
  const ld = lessonFields(lessonData, l);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={[s.detailHead, { backgroundColor: l.color, paddingTop: topInset + 8, height: topInset + 8 + 126 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => actions.nav('home')} style={s.dhBack}>
            <Icon name="chevron-left" size={22} color="#fff" />
          </Pressable>
          <View style={s.dhBadge}>
            {l.badge
              ? <Text style={man(800, 16, { color: '#fff' })}>{l.badge}</Text>
              : <Icon name={l.icon || 'book-open'} size={22} color="#fff" />}
          </View>
        </View>
        <View style={{ marginTop: 'auto', paddingBottom: 22 }}>
          <Text style={man(800, 24, { color: '#fff' })}>{l.name}</Text>
          <Text style={[int(600, 14, { color: 'rgba(255,255,255,.85)', marginTop: 4 }), { fontVariant: ['tabular-nums'] }]}>
            {t('today')}, {l.start} — {l.end}
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
        <View style={[s.infoCard, cardShadow]}>
          <InfoRow k={t('room')}><Text style={int(600, 15)}>{l.room}</Text></InfoRow>
          <InfoRow k={t('building')}><Text style={int(600, 15)}>{l.building || 'Главный, А'}</Text></InfoRow>
          <InfoRow k={t('teacherRow')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={[s.miniAva, { backgroundColor: l.color }]}><Text style={man(700, 10, { color: '#fff' })}>{l.tInitials || '·'}</Text></View>
              <Text style={int(600, 15)}>{l.teacher}</Text>
            </View>
          </InfoRow>
          <InfoRow k={t('lessonType')}><Text style={int(600, 15)}>{l.cancelled ? 'Отменена' : (l.type || 'Лекция')}</Text></InfoRow>
          <InfoRow k={t('groupRow')} last><Text style={int(600, 15)}>{group}</Text></InfoRow>
        </View>
        <View style={{ gap: 12, marginTop: 12 }}>
          {[['paperclip', t('materials'), 'materials'], ['book-open', t('homework'), 'hw'], ['pencil', t('notes'), 'notes']].map(([ic, label, field]) => {
            const photos = ld[field + '_photos'] || [];
            const sub = [ld[field], photos.length ? `📷 ${photos.length}` : ''].filter(Boolean).join(' · ');
            return (
              <ListRow key={field} icon={ic} title={label}
                sub={sub || t('tapToAdd')}
                accent={!!sub}
                onPress={() => actions.editLessonField(subjectKey(l.name), field, label, ld[field] || '', photos)}
                right={<Icon name="chevron-right" size={18} color={C.dot} />} />
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

/* ============ Уведомления ============ */
export function NotificationsScreen({ state, adminData, topInset, actions }) {
  if (state.isAdmin) {
    const items = [];
    (adminData?.profiles || []).slice(0, 8).forEach(p => items.push({
      id: 'u' + p.id, color: C.purple, icon: 'user',
      text: `Новый студент: ${p.first_name} ${p.last_name}`,
      sub: `${p.university || '—'}${p.group_name ? ' · ' + p.group_name : ''} · ${p.course} курс`,
    }));
    (adminData?.groups || []).slice(0, 6).forEach(g => items.push({
      id: 'g' + g.id, color: C.teal, icon: 'users',
      text: `Создана группа ${g.name}`, sub: `${g.university || '—'} · код ${g.code}`,
    }));
    (adminData?.posts || []).slice(0, 6).forEach(p => items.push({
      id: 'p' + p.id, color: C.yellow, icon: 'messages-square',
      text: `${p.author} написал в форум`, sub: String(p.body).slice(0, 70),
    }));
    return (
      <PullScroll topInset={topInset} onRefresh={actions.adminRefresh} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: PAD_BOTTOM }}>
        <Text style={man(800, 24)}>{t('notifications')}</Text>
        <Text style={int(400, 13, { color: C.muted, marginTop: 4 })}>{tr('Активность в приложении')}</Text>
        <View style={{ gap: 12, marginTop: 18 }}>
          {items.map(n => (
            <View key={n.id} style={[s.notif, { backgroundColor: C.card }, cardShadow]}>
              <View style={[s.ntIco, { backgroundColor: n.color }]}><Icon name={n.icon} size={20} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={int(500, 15, { lineHeight: 21 })}>{n.text}</Text>
                <Text style={int(400, 13, { color: C.muted, marginTop: 3 })} numberOfLines={2}>{n.sub}</Text>
              </View>
            </View>
          ))}
          {!items.length && (
            <View style={{ alignItems: 'center', paddingTop: 50 }}>
              <EmptyArt icon="bell" />
              <Text style={man(800, 20)}>{tr('Пока тихо')}</Text>
              <Text style={int(400, 14, { color: C.muted, marginTop: 6 })}>{tr('Новые студенты и группы появятся здесь.')}</Text>
            </View>
          )}
        </View>
      </PullScroll>
    );
  }
  return (
    <PullScroll topInset={topInset} onRefresh={() => actions.refreshed()} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: PAD_BOTTOM }}>
      <Text style={man(800, 24)}>{t('notifications')}</Text>
      <Pressable onPress={actions.readAll} hitSlop={8} style={{ marginTop: 10 }}>
        <Text style={int(600, 13, { color: C.purple })}>{t('markAllRead')}</Text>
      </Pressable>
      <View style={{ gap: 12, marginTop: 16 }}>
        {NOTIFS.map(n => {
          const read = state.readNotifs.includes(n.id);
          const bgc = read || n.bg === '#fff' ? C.card : n.bg;
          return (
            <View key={n.id} style={[s.notif, { backgroundColor: bgc }, read && cardShadow]}>
              <View style={[s.ntIco, { backgroundColor: n.color, opacity: read ? 0.55 : 1 }]}>
                <Icon name={n.icon} size={20} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={int(500, 15, { lineHeight: 21, color: read ? '#5a5d69' : C.ink })}>
                  {n.bold ? (<>{n.text[0]}<Text style={int(600, 15)}>{n.bold}</Text>{n.text[1]}</>) : n.text[0]}
                </Text>
                <Text style={int(400, 13, { color: C.muted, marginTop: 4 })}>{n.when}</Text>
              </View>
              {!read && <View style={[s.ntDot, { backgroundColor: n.color }]} />}
            </View>
          );
        })}
      </View>
    </PullScroll>
  );
}

/* ============ Профиль ============ */
function AttendBadge({ attendance }) {
  const st = React.useMemo(() => ATT.stats(attendance), [attendance]);
  if (st.percent == null) return <Icon name="chevron-right" size={18} color={C.dot} />;
  const col = st.percent >= 85 ? C.green : st.percent >= 70 ? C.yellow : C.red;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ backgroundColor: hexRgba(col, 0.14), borderRadius: 999, paddingVertical: 2, paddingHorizontal: 9 }}>
        <Text style={[int(600, 12, { color: col }), { fontVariant: ['tabular-nums'] }]}>{st.percent}%</Text>
      </View>
      <Icon name="chevron-right" size={18} color={C.dot} />
    </View>
  );
}

function CountBadge({ n }) {
  if (!n) return <Icon name="chevron-right" size={18} color={C.dot} />;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ backgroundColor: hexRgba(C.purple, 0.12), borderRadius: 999, paddingVertical: 2, paddingHorizontal: 9 }}>
        <Text style={int(600, 12, { color: C.purple })}>{n}</Text>
      </View>
      <Icon name="chevron-right" size={18} color={C.dot} />
    </View>
  );
}

export function ProfileScreen({ state, streak = 0, topInset, actions }) {
  const p = state.profile, su = state.setup;
  const favCount = state.subjects.filter(x => state.bookmarks.includes(x.id)).length;
  const postCount = (state.forum || []).filter(x => x.mine || x.author === p.firstName).length;
  const noteCount = Object.entries(state.lessonData || {}).reduce((n, [id, f]) =>
    n + ((id.startsWith('subj:') ? findLessonBySubject(id) : findLesson(id)) ? Object.values(f || {}).filter(v => typeof v === 'string' && v.trim()).length : 0), 0);
  const weeklyCount = (state.schedule || []).flat().filter(l => !l.cancelled).length;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: PAD_BOTTOM }} showsVerticalScrollIndicator={false}>
      <LinearGradient
        colors={themeMode === 'dark' ? ['#262837', '#2C2447', '#1E3A36'] : ['#FFFFFF', '#EFEBFB', '#DFF2ED']}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        style={[s.studCard, cardShadow]}>
        <Pressable onPress={() => actions.toast(t('coinsHint'))} hitSlop={10} style={[s.studShare, { alignItems: 'flex-end' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Image source={require('../assets/orta-coin.png')} style={{ width: 30, height: 30 }} resizeMode="contain" />
            <Text style={man(800, 17, { color: '#D9A514' })}>{state.coins ?? 0}</Text>
          </View>
          {streak > 0 && <Text style={int(600, 11, { color: C.muted, marginTop: 3 })}>🔥 {streak} дн.</Text>}
        </Pressable>
        <Text style={man(800, 26, { marginTop: 34 })}>{p.firstName} {p.lastName}</Text>
        {state.isAdmin
          ? <Text style={[man(800, 15, { color: '#D9A514', marginTop: 3 }), { letterSpacing: 4 }]}>BOSS</Text>
          : <Text style={int(400, 15, { color: C.muted, marginTop: 3 })}>{t('roleStudent')} · {su.course} {t('statCourse').toLowerCase()}</Text>}
        {/* Почта аккаунта на виду: у одного человека может быть несколько профилей,
            и без неё непонятно, в какой именно ты сейчас вошёл. */}
        {!!state.profile?.email && (
          <View style={s.mailPill}>
            <Icon name="check" size={12} color={C.green} />
            <Text style={int(500, 12, { color: C.muted })} numberOfLines={1}>{state.profile.email}</Text>
          </View>
        )}
        {!state.isAdmin && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            {[su.university, su.faculty].filter(Boolean).map(tag => (
              <View key={tag} style={s.studTag}><Text style={int(500, 12, { color: C.muted })} numberOfLines={1}>{tag}</Text></View>
            ))}
          </View>
        )}
        {!state.isAdmin && <View style={s.studStats}>
          <View style={s.studStat}>
            <Text style={man(800, 18)}>{su.course}</Text>
            <Text style={int(400, 12, { color: C.muted, marginTop: 2 })}>{t('statCourse')}</Text>
          </View>
          <View style={s.studDivider} />
          <View style={s.studStat}>
            <Text style={man(800, 18)}>{weeklyCount}</Text>
            <Text style={int(400, 12, { color: C.muted, marginTop: 2 })}>{t('statPerWeek')}</Text>
          </View>
          <View style={s.studDivider} />
          <View style={s.studStat}>
            <Text style={man(800, 18)} numberOfLines={1}>{(state.group && state.group.name) || su.group || '—'}</Text>
            <Text style={int(400, 12, { color: C.muted, marginTop: 2 })}>{t('groupRow')}</Text>
          </View>
        </View>}
        {state.isAdmin ? (
          <Pressable onPress={actions.openProfileSheet} style={({ pressed }) => [s.studBtn, { alignSelf: 'stretch', marginTop: 18 }, pressed && { opacity: 0.8 }]}>
            <Text style={man(700, 15)}>{t('editProfile')}</Text>
          </Pressable>
        ) : (
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 18, alignSelf: 'stretch' }}>
            <Pressable onPress={actions.openProfileSheet} style={({ pressed }) => [s.studBtn, pressed && { opacity: 0.8 }]}>
              <Text style={man(700, 15)}>{t('editProfile')}</Text>
            </Pressable>
            <Pressable onPress={actions.shareProfile} style={({ pressed }) => [s.studRound, cardShadow, pressed && { transform: [{ scale: 0.94 }] }]}>
              <Icon name="share-2" size={20} color={C.ink} />
            </Pressable>
          </View>
        )}
      </LinearGradient>
      {!state.isAdmin && <Pressable onPress={() => actions.nav('group')}
        style={({ pressed }) => [s.groupCard, sh(C.teal, 0.3, 28, 12, 6), pressed && { transform: [{ scale: 0.98 }] }]}>
        <View style={s.roundIcon}><Icon name="users" size={24} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={man(800, 17, { color: '#fff' })}>{state.group ? `${t('group')} ${state.group.name}` : t('groupAdd')}</Text>
          <Text style={int(400, 12, { color: 'rgba(255,255,255,.8)', marginTop: 2 })} numberOfLines={1}>
            {state.group ? (state.group.role === 'owner' ? t('groupYouOwner') : t('groupYouMember')) : t('groupSub')}
          </Text>
        </View>
        <Icon name="chevron-right" size={20} color="rgba(255,255,255,.8)" />
      </Pressable>}
      {!state.isAdmin && <Pressable onPress={() => actions.nav('coins')}
        style={({ pressed }) => [s.bigCard, sh(C.purple, 0.35, 28, 12, 6), pressed && { transform: [{ scale: 0.98 }] }]}>
        <Image source={require('../assets/orta-coin.png')} style={{ width: 44, height: 44 }} resizeMode="contain" />
        <View style={{ flex: 1 }}>
          <Text style={man(800, 17, { color: '#fff' })}>O-COIN</Text>
          <Text style={int(400, 12, { color: 'rgba(255,255,255,.8)', marginTop: 2 })}>{t('coinsSub')}</Text>
        </View>
        <Text style={[man(800, 19, { color: '#fff' }), { fontVariant: ['tabular-nums'] }]}>{state.coins ?? 0}</Text>
        <Icon name="chevron-right" size={20} color="rgba(255,255,255,.8)" />
      </Pressable>}
      <View style={{ gap: 12, marginTop: 16 }}>
        {!state.isAdmin && <ListRow icon="graduation-cap" title={t('myGrades')} accent onPress={() => actions.nav('grades')}
          right={<CountBadge n={(state.grades || []).length} />} />}
        {!state.isAdmin && <ListRow icon="check" title={t('attendance')} accent onPress={() => actions.nav('attendance')}
          right={<AttendBadge attendance={state.attendance} />} />}
        {!state.isAdmin && <ListRow icon="bookmark" title={t('myFavorites')} accent onPress={() => actions.nav('favorites')}
          right={<CountBadge n={favCount} />} />}
        {!state.isAdmin && <ListRow icon="messages-square" title={t('myPosts')} accent onPress={() => actions.nav('myposts')}
          right={<CountBadge n={postCount} />} />}
        {!state.isAdmin && <ListRow icon="pencil" title={t('myNotes')} accent onPress={() => actions.nav('mynotes')}
          right={<CountBadge n={noteCount} />} />}
        <ListRow icon="settings" title={t('rowSettings')} accent onPress={() => actions.nav('settings')}
          right={<Icon name="chevron-right" size={18} color={C.dot} />} />
        <ListRow icon="bell" title={t('rowNotifications')} accent onPress={() => actions.nav('notifications')}
          right={<Icon name="chevron-right" size={18} color={C.dot} />} />
        <ListRow icon="moon" title={t('rowTheme')} accent onPress={() => actions.nav('settings')}
          right={<Icon name="chevron-right" size={18} color={C.dot} />} />
      </View>
    </ScrollView>
  );
}

/* ============ Настройки ============ */
export function SettingsScreen({ state, topInset, actions }) {
  const syncLabel = state.lastSync
    ? (() => { const m = Math.round((Date.now() - state.lastSync) / 60000); return m < 1 ? 'Обновлено только что' : `Обновлено ${m} ${plural(m, 'минуту', 'минуты', 'минут')} назад`; })()
    : 'Обновлено 5 минут назад';
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('profile')} />
        <Text style={man(800, 24)}>{t('settings')}</Text>
      </View>

      <Text style={s.sectionLabel}>{t('secNotif')}</Text>
      <View style={[s.settingsCard, cardShadow]}>
        <View style={[s.settingsRow, { borderBottomWidth: 1, borderBottomColor: C.border }]}>
          <Text style={int(500, 15)}>{t('remindLesson')}</Text>
          <Pressable onPress={actions.cycleRemind} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={int(600, 14, { color: C.purple })}>{t('beforeMin').replace('{n}', state.remindBefore)}</Text>
            <Icon name="chevron-right" size={16} color={C.purple} />
          </Pressable>
        </View>
        <View style={[s.settingsRow, { borderBottomWidth: 1, borderBottomColor: C.border }]}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={int(500, 15)}>{t('remindChanges')}</Text>
            <Text style={int(400, 12, { color: C.muted, marginTop: 2 })}>{t('remindChangesSub')}</Text>
          </View>
          <Switch on={state.notifChangesOn !== false} onPress={actions.toggleChanges} />
        </View>
        <View style={s.settingsRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={int(500, 15)}>{t('attendanceAsk')}</Text>
            <Text style={int(400, 12, { color: C.muted, marginTop: 2 })}>{t('attendanceAskSub')}</Text>
          </View>
          <Switch on={state.attendAsk === true} onPress={actions.toggleAttendAsk} />
        </View>
      </View>

      <Text style={s.sectionLabel}>{t('secTheme')}</Text>
      <View style={[s.settingsCard, cardShadow, { paddingVertical: 14, paddingHorizontal: 16 }]}>
        <View style={s.seg}>
          {[['light', t('light')], ['dark', t('dark')], ['system', t('system')]].map(([mode, label]) => {
            const active = state.theme === mode;
            return (
              <Pressable key={mode} style={[s.segBtn, active && [s.segActive, sh('#14161C', 0.06, 10, 4, 2)]]} onPress={() => actions.setTheme(mode)}>
                <Text style={active ? int(600, 13) : int(500, 13, { color: C.muted })}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={s.sectionLabel}>{t('secLang')}</Text>
      <View style={[s.settingsCard, cardShadow]}>
        {[['ru', 'Русский'], ['kk', 'Қазақша'], ['en', 'English']].map(([code, label], i) => (
          <Pressable key={code} style={[s.settingsRow, i < 2 && { borderBottomWidth: 1, borderBottomColor: C.border }]} onPress={() => actions.setLang(code)}>
            <Text style={int(500, 15, state.lang === code ? {} : { color: C.muted })}>{label}</Text>
            {state.lang === code && <Icon name="check" size={18} color={C.purple} />}
          </Pressable>
        ))}
      </View>

      <Text style={s.sectionLabel}>{tr('Виджет')}</Text>
      <Pressable onPress={actions.refreshWidget} style={[s.settingsCard, cardShadow, { paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Icon name="refresh-cw" size={18} color={C.purple} />
          <Text style={int(500, 15)}>{tr('Обновить виджет')}</Text>
        </View>
        <Icon name="chevron-right" size={18} color={C.dot} />
      </Pressable>

      {/* Экран админа раньше не имел входа вовсе — попасть на него было нельзя.
          Обычному пользователю строку не показываем: ему там нечего делать. */}
      {!!state.isAdmin && (<>
        <Text style={s.sectionLabel}>{t('secAdmin')}</Text>
        <Pressable onPress={() => actions.nav('admin')} style={[s.settingsCard, cardShadow, { paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="shield" size={18} color={C.purple} />
            <Text style={int(500, 15)}>{t('adminPanel')}</Text>
          </View>
          <Icon name="chevron-right" size={18} color={C.dot} />
        </Pressable>
      </>)}

      <Text style={s.sectionLabel}>{t('secAccount')}</Text>
      <View style={[s.settingsCard, cardShadow]}>
        {!!state.profile?.email && (
          <View style={[s.settingsRow, { borderBottomWidth: 1, borderBottomColor: C.border }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={int(500, 15)} numberOfLines={1}>{state.profile.email}</Text>
              <Text style={int(400, 12, { color: C.muted, marginTop: 2 })}>{t('accountEmailSub')}</Text>
            </View>
            <Icon name="check" size={18} color={C.green} />
          </View>
        )}
        {!!state.profile?.email && (
          <Pressable style={[s.settingsRow, { borderBottomWidth: 1, borderBottomColor: C.border }]} onPress={actions.openPassSheet}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="shield" size={18} color={C.purple} />
              <Text style={int(500, 15)}>{t('passChange')}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={C.dot} />
          </Pressable>
        )}
        <Pressable style={[s.settingsRow, { borderBottomWidth: 1, borderBottomColor: C.border }]} onPress={() => actions.nav('privacy')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="shield" size={18} color={C.purple} />
            <Text style={int(500, 15)}>{t('privacy')}</Text>
          </View>
          <Icon name="chevron-right" size={18} color={C.dot} />
        </Pressable>
        <Pressable style={[s.settingsRow, { borderBottomWidth: 1, borderBottomColor: C.border }]} onPress={actions.logout}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Icon name="log-out" size={18} color={C.red} />
            <Text style={int(500, 15, { color: C.red })}>{t('logout')}</Text>
          </View>
        </Pressable>
        {/* Правило App Store 5.1.1(v): раз аккаунт можно завести, его должно
            быть можно и удалить прямо из приложения — не письмом в поддержку. */}
        <Pressable style={s.settingsRow} onPress={actions.deleteAccount}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Icon name="trash-2" size={18} color={C.red} />
              <Text style={int(500, 15, { color: C.red })}>{t('delAccount')}</Text>
            </View>
            <Text style={int(400, 12, { color: C.muted, marginTop: 4, marginLeft: 28 })}>{t('delAccountSub')}</Text>
          </View>
        </Pressable>
      </View>

      <Text style={s.sectionLabel}>{t('secSync')}</Text>
      <View style={[s.settingsCard, cardShadow, { paddingVertical: 14, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
        <Text style={int(400, 13, { color: C.muted })}>{syncLabel}</Text>
        <Pressable onPress={actions.sync} hitSlop={8}>
          <Text style={int(600, 14, { color: C.purple })}>{t('syncNow')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

/* ============ Поиск ============ */
export function SearchScreen({ query, setQuery, topInset, actions }) {
  const q = query.trim().toLowerCase();
  const found = [];
  if (q) SCHEDULE.forEach((day, di) => day.forEach(l => {
    if (l.name.toLowerCase().includes(q) || l.teacher.toLowerCase().includes(q)) found.push({ l, di });
  }));
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: PAD_BOTTOM }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={man(800, 24)}>{t('search')}</Text>
        <Pressable onPress={() => actions.nav('home')} hitSlop={8}>
          <Text style={int(600, 15, { color: C.purple })}>{t('close')}</Text>
        </Pressable>
      </View>
      <View style={[s.searchBar, cardShadow]}>
        <Icon name="search" size={18} color={C.muted} />
        <TextInput
          style={[int(500, 15), { flex: 1, paddingVertical: 0 }]}
          placeholder={t('searchPlaceholder')}
          placeholderTextColor={C.dot}
          value={query}
          onChangeText={setQuery}
          autoFocus
        />
      </View>
      {q ? (
        found.length ? (
          <View style={{ gap: 12, marginTop: 18 }}>
            {found.map(({ l, di }, i) => (
              <View key={l.id + i}>
                <Text style={int(600, 12, { color: C.muted, marginBottom: 6, marginLeft: 4 })}>{DAY_NAMES[di]}</Text>
                <LessonCard l={l} now={false} onPress={() => actions.openLesson(l.id)} />
              </View>
            ))}
          </View>
        ) : <Text style={int(400, 15, { color: C.muted, textAlign: 'center', marginTop: 60 })}>{t('nothingFound')}</Text>
      ) : (
        <Text style={int(400, 15, { color: C.muted, textAlign: 'center', marginTop: 60 })}>
          Введите название предмета{'\n'}или имя преподавателя
        </Text>
      )}
    </ScrollView>
  );
}

/* ============ Афиша ============ */
export function AfishaScreen({ events, isAdmin, topInset, actions }) {
  return (
    <PullScroll topInset={topInset} onRefresh={() => actions.refreshed()} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: PAD_BOTTOM }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={man(800, 24)}>{t('afisha')}</Text>
        <IconBtn icon="plus" onPress={actions.openEventSheet} />
      </View>
      <Text style={int(400, 15, { color: C.muted, marginTop: 6 })}>{t('afishaSub')}</Text>
      {/* Правило App Store 1.2: пользовательский контент — правила и жалоба на виду */}
      <Text style={int(400, 12, { color: C.muted, marginTop: 8, lineHeight: 17 })}>{tr('Событие видит весь ваш университет. Без рекламы и оскорблений. Нарушает правила — откройте событие и нажмите «Пожаловаться».')}</Text>
      <View style={{ gap: 16, marginTop: 18 }}>
        {events.map(e => {
          const cover = (e.photos || [])[0];
          return (
            <Pressable key={e.id} onPress={() => actions.openEvent(e)}
              style={({ pressed }) => [s.eventCard, cardShadow, pressed && { opacity: 0.92 }]}>
              {cover ? (
                <Image source={{ uri: cover }} style={s.eventCover} />
              ) : (
                <View style={[s.eventCover, { backgroundColor: e.color, alignItems: 'center', justifyContent: 'center' }]}>
                  <Icon name={e.icon} size={44} color="rgba(255,255,255,.9)" />
                </View>
              )}
              {(e.photos || []).length > 1 && (
                <View style={s.eventCount}>
                  <Text style={int(600, 11, { color: '#fff' })}>1/{e.photos.length}</Text>
                </View>
              )}
              <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={[man(800, 19, { flex: 1, lineHeight: 24 })]} numberOfLines={2}>{e.title}</Text>
                  {e.custom ? (
                    <Pressable onPress={() => actions.deleteEvent(e.id)} hitSlop={8}>
                      <Icon name="trash-2" size={18} color={C.muted} />
                    </Pressable>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                  <Icon name="calendar-days" size={14} color={C.muted} />
                  <Text style={int(400, 14, { color: C.muted })} numberOfLines={1}>{e.date}</Text>
                  <Text style={int(400, 14, { color: C.dot })}>·</Text>
                  <Text style={int(400, 14, { color: C.muted, flex: 1 })} numberOfLines={1}>{e.place}</Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </PullScroll>
  );
}

/* ============ ИИ-помощник ============ */
export function AiScreen({ messages, thinking, onSend, isAdmin, topInset, bottomInset }) {
  const [text, setText] = React.useState('');
  const [kb, setKb] = React.useState(false);
  React.useEffect(() => {
    const a = Keyboard.addListener('keyboardWillShow', () => setKb(true));
    const b = Keyboard.addListener('keyboardWillHide', () => setKb(false));
    return () => { a.remove(); b.remove(); };
  }, []);
  const scrollRef = React.useRef(null);
  const send = t => {
    const msg = (t ?? text).trim();
    if (!msg) return;
    setText('');
    onSend(msg);
  };
  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, paddingTop: topInset + 8 }}>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={[s.aiBadge, sh(C.purple, 0.3, 20, 8, 4)]}><Icon name="sparkles" size={20} color="#fff" /></View>
          <View>
            <Text style={man(800, 24)}>{t('aiTitle')}</Text>
            <Text style={int(400, 13, { color: C.muted })}>{isAdmin ? 'Помощник администратора' : t('aiSub')}</Text>
          </View>
        </View>
      </View>
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, marginTop: 16 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 10 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {messages.length === 0 && (
          <View style={[s.aiIntro, cardShadow]}>
            <Text style={int(500, 15, { lineHeight: 22 })}>{isAdmin ? 'Здравствуйте, босс! Я вижу статистику приложения: студентов, форумы, афишу — спрашивайте 👇' : 'Привет! Я знаю твоё расписание и отвечу на вопросы о парах. Попробуй один из вопросов ниже 👇'}</Text>
          </View>
        )}
        {messages.map((m, i) => (
          <View key={i} style={[s.bubble, m.role === 'user' ? s.bubbleUser : [s.bubbleAi, cardShadow]]}>
            <Text style={int(500, 15, { color: m.role === 'user' ? '#fff' : C.ink, lineHeight: 21 })}>{m.text}</Text>
          </View>
        ))}
        {thinking && (
          <View style={[s.bubble, s.bubbleAi, cardShadow]}>
            <Text style={int(500, 15, { color: C.muted })}>{tr('Печатает…')}</Text>
          </View>
        )}
        {messages.length === 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            {(isAdmin ? AI_SUGGESTIONS_ADMIN : AI_SUGGESTIONS).map(sug => (
              <Pressable key={sug} onPress={() => send(sug)} style={[s.aiSug, cardShadow]}>
                <Text style={int(600, 13, { color: C.purple })}>{sug}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      <View style={[s.aiInputRow, { marginBottom: kb ? 12 : bottomInset + 94 }]}>
        <TextInput
          style={[s.aiInput, cardShadow, int(500, 15)]}
          placeholder={t('aiPlaceholder')}
          placeholderTextColor={C.dot}
          value={text}
          onChangeText={setText}
          onSubmitEditing={() => send()}
          returnKeyType="send"
        />
        <Pressable onPress={() => send()} style={({ pressed }) => [s.aiSend, sh(C.purple, 0.34, 20, 8, 5), pressed && { transform: [{ scale: 0.92 }] }]}>
          <Icon name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

/* ============ Календарь: полноэкранный редактор расписания ============ */

export function CalendarScreen({ schedule, topInset, actions }) {
  const now = tzNow();
  const [mOff, setMOff] = React.useState(0);
  const [selDate, setSelDate] = React.useState(now.getDate());
  const base = new Date(now.getFullYear(), now.getMonth() + mOff, 1);
  const year = base.getFullYear(), month = base.getMonth();
  const firstDow = (base.getDay() + 6) % 7;
  const daysIn = new Date(year, month + 1, 0).getDate();
  React.useEffect(() => { setSelDate(mOff === 0 ? now.getDate() : 1); }, [mOff]);

  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysIn; d++) cells.push(d);
  while (cells.length % 7) cells.push(null);

  const weekdayOf = d => (new Date(year, month, d).getDay() + 6) % 7;
  const selWd = weekdayOf(Math.min(selDate, daysIn));
  const lessons = selWd <= 5 ? (schedule[selWd] || []) : [];
  const isTodayCell = d => mOff === 0 && d === now.getDate();

  return (
    <View style={{ flex: 1, paddingTop: topInset + 8 }}>
      <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconBtn icon="chevron-left" onPress={() => actions.nav('home')} />
          <Text style={man(800, 24)}>{t('calendar')}</Text>
        </View>
        <Pressable
          onPress={() => selWd <= 5 ? actions.openLessonEditor(selWd, null) : actions.toast(t('sundayNoAdd'))}
          style={({ pressed }) => [s.plusBtn, sh(C.purple, 0.34, 20, 8, 5), pressed && { transform: [{ scale: 0.9 }] }]}>
          <Icon name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {/* Месяц */}
        <View style={[s.calCard, cardShadow]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Pressable onPress={() => setMOff(mOff - 1)} hitSlop={10} style={s.calNav}><Icon name="chevron-left" size={18} color={C.ink} /></Pressable>
            <Text style={man(700, 17)}>{tMonthsNom()[month]} {year}</Text>
            <Pressable onPress={() => setMOff(mOff + 1)} hitSlop={10} style={s.calNav}><Icon name="chevron-right" size={18} color={C.ink} /></Pressable>
          </View>
          <View style={{ flexDirection: 'row' }}>
            {tDaysShort().map((d, di) => (
              <Text key={d} style={[int(600, 11, { color: di === 6 ? C.red : C.muted, textAlign: 'center' }), { width: '14.28%' }]}>{d}</Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 6 }}>
            {cells.map((d, i) => {
              if (!d) return <View key={'e' + i} style={s.calCell} />;
              const wd = weekdayOf(d);
              const dayLessons = wd <= 5 ? (schedule[wd] || []).filter(l => !l.cancelled) : [];
              const sel = d === selDate;
              return (
                <Pressable key={d} onPress={() => setSelDate(d)} style={s.calCell}>
                  <View style={[s.calDay, sel && { backgroundColor: C.purple }, !sel && isTodayCell(d) && { borderWidth: 2, borderColor: C.purple }]}>
                    <Text style={int(600, 14, { color: sel ? '#fff' : wd === 6 ? C.red : C.ink })}>{d}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 2, height: 4, marginTop: 2 }}>
                    {dayLessons.slice(0, 3).map((l, j) => (
                      <View key={j} style={{ width: 4, height: 4, borderRadius: 999, backgroundColor: sel ? C.purple : l.color }} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Пары выбранного дня */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 12, marginHorizontal: 4 }}>
          <Text style={man(700, 17)}>{tDaysFull()[selWd]}, {Math.min(selDate, daysIn)} {tMonthsGen()[month]}</Text>
          <Text style={int(400, 13, { color: C.muted })}>{lessons.length ? tPlural(lessons.filter(l => !l.cancelled).length, 'pairForms') : ''}</Text>
        </View>
        {selWd === 6 ? (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Text style={int(400, 15, { color: C.muted })}>{t('sundayOff')}</Text>
          </View>
        ) : lessons.length ? (
          <View style={{ gap: 12 }}>
            {lessons.map(l => (
              <LessonCard key={l.id} l={l} now={false} onPress={() => actions.openLessonEditor(selWd, l)} />
            ))}
            <Text style={int(400, 12, { color: C.muted, textAlign: 'center', marginTop: 4 })}>{t('calHint')}</Text>
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Text style={int(400, 15, { color: C.muted })}>{t('calEmpty')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/* ============ Мои избранные ============ */
export function FavoritesScreen({ state, topInset, actions }) {
  const subjFavs = state.subjects.filter(su => state.bookmarks.includes(su.id));
  const lessonFavs = (state.schedule || []).flat()
    .filter(l => state.bookmarks.includes(l.id) && !subjFavs.some(x => x.id === l.id))
    .map(l => {
      const parts = (l.teacher || '').split(/\s+/);
      return {
        id: l.id, color: l.color, icon: l.icon || 'book-open', time: l.start, name: l.name,
        tInitials: l.tInitials || '·', tShort: parts[1] ? `${parts[0]} ${parts[1][0]}.` : (parts[0] || '—'),
        __lesson: true,
      };
    });
  const favs = [...subjFavs, ...lessonFavs];
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('profile')} />
        <Text style={[man(800, 24), { flex: 1 }]}>{t('myFavorites')}</Text>
        {/* предмет вне расписания — факультатив, самоподготовка */}
        <IconBtn icon="plus" onPress={actions.openSheet} />
      </View>
      <Text style={int(400, 12.5, { color: C.muted, marginTop: 8 })}>{t('favHint')}</Text>
      {favs.length ? (
        <View style={s.subjectGrid}>
          {favs.map(sub => (
            <View key={sub.id} style={{ width: '47.8%' }}>
              <SubjectCard
                s={sub}
                bookmarked
                onPress={() => sub.__lesson ? actions.openLesson(sub.id) : actions.openSubject(sub)}
                onBookmark={() => actions.bookmark(sub.id)}
                onLongPress={() => !sub.__lesson && actions.removeSubject(sub)}
              />
            </View>
          ))}
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingTop: 70 }}>
          <EmptyArt icon="bookmark" />
          <Text style={man(800, 22)}>{tr('Пока пусто')}</Text>
          <Text style={int(400, 15, { color: C.muted, marginTop: 8, textAlign: 'center' })}>
            Нажмите на закладку на карточке предмета,{'\n'}и он появится здесь.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ============ Мои посты ============ */
export function MyPostsScreen({ state, topInset, actions }) {
  const mine = (state.forum || []).filter(p => p.mine || p.author === state.profile.firstName);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('profile')} />
        <Text style={man(800, 24)}>{tr('Мои посты')}</Text>
      </View>
      {mine.length ? (
        <View style={{ gap: 12, marginTop: 18 }}>
          {mine.map(p => (
            <View key={p.id} style={[s.forumPost, cardShadow]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={s.forumAva}><Text style={man(700, 10, { color: '#fff' })}>{state.profile.initials}</Text></View>
                <Text style={int(600, 13)}>{p.author}</Text>
                <Text style={int(400, 12, { color: C.muted, marginLeft: 'auto' })}>{p.when}</Text>
              </View>
              <Text style={int(400, 15, { marginTop: 8, lineHeight: 21 })}>{p.text}</Text>
              <Pressable onPress={() => actions.deleteForumPost(p.id)} hitSlop={8} style={{ marginTop: 10, alignSelf: 'flex-start' }}>
                <Text style={int(600, 13, { color: C.red })}>{tr('Удалить')}</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingTop: 70 }}>
          <EmptyArt icon="messages-square" />
          <Text style={man(800, 22)}>{tr('Постов пока нет')}</Text>
          <Text style={int(400, 15, { color: C.muted, marginTop: 8, textAlign: 'center' })}>
            Напишите что-нибудь в форум группы{'\n'}на главной странице.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ============ Мои заметки ============ */
const NOTE_LABELS = { materials: 'Материалы', hw: 'Домашнее задание', notes: 'Заметки' };

export function MyNotesScreen({ state, topInset, actions }) {
  const items = [];
  Object.entries(state.lessonData || {}).forEach(([lessonId, fields]) => {
    const lesson = lessonId.startsWith('subj:') ? findLessonBySubject(lessonId) : findLesson(lessonId);
    if (!lesson) return;
    Object.entries(fields || {}).forEach(([field, text]) => {
      if (typeof text === 'string' && text.trim() && !field.endsWith('_photos')) items.push({ lessonId, lesson, field, text });
    });
  });
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('profile')} />
        <Text style={man(800, 24)}>{tr('Мои заметки')}</Text>
      </View>
      {items.length ? (
        <View style={{ gap: 12, marginTop: 18 }}>
          {items.map((it, i) => (
            <Pressable key={it.lessonId + it.field + i}
              onPress={() => actions.editLessonField(it.lessonId, it.field, NOTE_LABELS[it.field] || it.field, it.text, ((state.lessonData || {})[it.lessonId] || {})[it.field + '_photos'] || [])}
              style={[s.noteCard, cardShadow]}>
              <View style={[s.noteBar, { backgroundColor: it.lesson.color }]} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={int(600, 15)}>{it.lesson.name}</Text>
                  <Text style={int(600, 11, { color: it.lesson.color })}>{NOTE_LABELS[it.field] || it.field}</Text>
                </View>
                <Text style={int(400, 14, { color: C.muted, marginTop: 5, lineHeight: 20 })} numberOfLines={3}>{it.text}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingTop: 70 }}>
          <EmptyArt icon="pencil" />
          <Text style={man(800, 22)}>{tr('Заметок пока нет')}</Text>
          <Text style={int(400, 15, { color: C.muted, marginTop: 8, textAlign: 'center' })}>
            Откройте пару и добавьте материалы,{'\n'}домашнее задание или заметку.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ============ Конфиденциальность ============ */
export function PrivacyScreen({ privacy, topInset, actions }) {
  const p = privacy || {};
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('settings')} />
        <Text style={man(800, 24)}>{t('privacy')}</Text>
      </View>

      <Text style={s.sectionLabel}>{tr('Видимость')}</Text>
      <View style={[s.settingsCard, cardShadow]}>
        <View style={s.settingsRow}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={int(500, 15)}>{tr('Имя видно одногруппникам')}</Text>
            <Text style={int(400, 12, { color: C.muted, marginTop: 2 })}>{tr('Вы в группе — участники видят ваше имя в чате и списке')}</Text>
          </View>
          <Icon name="check" size={18} color={C.green} />
        </View>
      </View>

      <View style={[s.settingsCard, cardShadow, { marginTop: 12, paddingVertical: 16 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <Icon name="shield" size={18} color={C.green} />
          <Text style={int(600, 15)}>{tr('Как хранятся ваши данные')}</Text>
        </View>
        <Text style={int(400, 13, { color: C.muted, lineHeight: 20 })}>
          Расписание, заметки и настройки хранятся на самом устройстве — приложение открывается и работает без интернета.{'\n\n'}
          На сервер уходит только то, что нужно для группы и входа с другого телефона: имя, вуз, курс и расписание. Реклама и продажа данных исключены.{'\n\n'}
          Уведомления и посещаемость обрабатываются локально. Удалить всё можно одной кнопкой ниже.
        </Text>
      </View>

      <Pressable onPress={actions.clearData} style={({ pressed }) => [s.settingsCard, cardShadow, { marginTop: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }, pressed && { opacity: 0.7 }]}>
        <Icon name="trash-2" size={18} color={C.red} />
        <Text style={int(600, 15, { color: C.red })}>{tr('Очистить данные приложения')}</Text>
      </Pressable>
    </ScrollView>
  );
}


/* ============ Задачи (ДЗ с дедлайнами) ============ */
function TaskRow({ task, onToggle, onDelete }) {
  return (
    <Pressable onPress={() => onToggle(task.id)} onLongPress={() => onDelete && onDelete(task.id)} style={[s.taskRow, cardShadow]}>
      <View style={[s.taskCheck, task.done && { backgroundColor: C.green, borderColor: C.green }]}>
        {task.done && <Icon name="check" size={13} color="#fff" />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={int(500, 15, task.done ? { color: C.muted, textDecorationLine: 'line-through' } : {})} numberOfLines={2}>{task.title}</Text>
        {(task.due || task.subject) ? (
          <Text style={int(400, 12, { color: C.muted, marginTop: 2 })} numberOfLines={1}>
            {[task.due, task.subject].filter(Boolean).join(' \u00b7 ')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function GroupTaskRow({ task, done, isOwner, onToggle, onDelete, onOpenPhoto }) {
  return (
    <Pressable onPress={() => onToggle(task.id)} onLongPress={() => isOwner && onDelete(task)}
      style={[s.taskRow, cardShadow, { alignItems: 'flex-start' }]}>
      <View style={[s.taskCheck, { marginTop: 2 }, done && { backgroundColor: C.teal, borderColor: C.teal }]}>
        {done && <Icon name="check" size={13} color="#fff" />}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={s.gtaskTag}><Text style={int(700, 10, { color: C.teal })}>{t('fromLeader')}</Text></View>
          {!!task.subject && <Text style={int(500, 11.5, { color: C.muted })} numberOfLines={1}>{task.subject}</Text>}
        </View>
        <Text style={int(500, 15, done ? { color: C.muted, textDecorationLine: 'line-through' } : { marginTop: 4 })} numberOfLines={3}>
          {task.title}
        </Text>
        {!!task.note && <Text style={int(400, 12.5, { color: C.muted, marginTop: 3 })} numberOfLines={4}>{task.note}</Text>}
        {!!task.due && <Text style={int(600, 12, { color: C.red, marginTop: 4 })}>до {task.due}</Text>}
        {!!(task.photos && task.photos.length) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {task.photos.map((url, i) => (
                <Pressable key={url + i} onPress={() => onOpenPhoto && onOpenPhoto(url)}>
                  <Image source={{ uri: url }} style={s.gtaskPhoto} />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </Pressable>
  );
}

function TasksBlock({ tasks, groupTasks, groupTaskDone, onOpen, onToggle, onToggleGroup }) {
  const done = groupTaskDone || {};
  const gtsUndone = (groupTasks || []).filter(x => !done[x.id]);
  const undone = tasks.filter(x => !x.done);
  if (!tasks.length && !(groupTasks || []).length) return null;
  const count = undone.length + gtsUndone.length;
  return (
    <View style={{ marginTop: 24 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 4 }}>
        <Text style={man(700, 19)}>{t('tasks')}{count ? ` \u00b7 ${count}` : ''}</Text>
        <Pressable onPress={onOpen} hitSlop={8}>
          <Text style={int(600, 13, { color: C.purple })}>{t('all')}</Text>
        </Pressable>
      </View>
      <View style={{ gap: 10, marginTop: 12 }}>
        {/* ДЗ от старосты идёт первым — его задали всей группе */}
        {gtsUndone.slice(0, 2).map(gt => (
          <GroupTaskRow key={gt.id} task={gt} done={false} isOwner={false} onToggle={onToggleGroup} onDelete={() => {}} />
        ))}
        {(undone.length ? undone : tasks).slice(0, gtsUndone.length ? 2 : 3).map(task => (
          <TaskRow key={task.id} task={task} onToggle={onToggle} />
        ))}
      </View>
    </View>
  );
}

export function TasksScreen({ tasks, groupTasks, groupTaskDone, isOwner, inGroup, topInset, actions }) {
  const sorted = [...(tasks || [])].sort((a, b) => Number(a.done) - Number(b.done));
  const gts = groupTasks || [];
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconBtn icon="chevron-left" onPress={() => actions.nav('home')} />
          <Text style={man(800, 24)}>{t('tasksAll')}</Text>
        </View>
        <Pressable onPress={actions.openTaskSheet} style={({ pressed }) => [s.plusBtn, sh(C.purple, 0.34, 20, 8, 5), pressed && { transform: [{ scale: 0.9 }] }]}>
          <Icon name="plus" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* ДЗ от старосты — общее на всю группу */}
      {inGroup && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }}>
            <Text style={[s.attSection, { marginTop: 0, marginBottom: 0 }]}>{t('groupHomework')}</Text>
            {isOwner && (
              <Pressable onPress={actions.openGroupTaskSheet} hitSlop={8}
                style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 5 }, pressed && { opacity: 0.7 }]}>
                <Icon name="plus" size={15} color={C.teal} />
                <Text style={int(600, 13, { color: C.teal })}>{t('publish')}</Text>
              </Pressable>
            )}
          </View>
          {gts.length ? (
            <View style={{ gap: 10 }}>
              {gts.map(gt => (
                <GroupTaskRow key={gt.id} task={gt} done={!!(groupTaskDone || {})[gt.id]} isOwner={isOwner}
                  onToggle={actions.toggleGroupTask} onDelete={actions.deleteGroupTask} onOpenPhoto={actions.openPhoto} />
              ))}
            </View>
          ) : (
            <Text style={int(400, 13.5, { color: C.muted, lineHeight: 19 })}>
              {isOwner ? t('groupHomeworkOwnerEmpty') : t('groupHomeworkEmpty')}
            </Text>
          )}
          <Text style={[s.attSection, { marginBottom: 10 }]}>{t('myTasks')}</Text>
        </>
      )}

      {sorted.length ? (
        <View style={{ gap: 10, marginTop: 18 }}>
          {sorted.map(task => (
            <TaskRow key={task.id} task={task} onToggle={actions.toggleTask} onDelete={actions.deleteTask} />
          ))}
          <Text style={int(400, 12, { color: C.muted, textAlign: 'center', marginTop: 4 })}>{t('calHint').split(',')[0]}. {t('delete')} — долгое нажатие</Text>
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingTop: 70 }}>
          <EmptyArt icon="pencil" />
          <Text style={man(800, 22)}>{t('tasksEmpty')}</Text>
          <Text style={int(400, 15, { color: C.muted, marginTop: 8, textAlign: 'center' })}>{t('tasksEmptySub')}</Text>
        </View>
      )}
    </ScrollView>
  );
}

/* ============ Группа со старостой (QR вместо кода) ============ */
export function GroupScreen({ group, groupLink, backendEnabled, busyGroup, topInset, actions }) {
  const [qrSize, setQrSize] = React.useState(0);
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('profile')} />
        <View style={{ flex: 1 }}>
          <Text style={man(800, 24)}>{group ? t('myGroup') : t('groupAdd')}</Text>
          <Text style={int(400, 13, { color: C.muted })}>{t('groupSub')}</Text>
        </View>
      </View>

      {!backendEnabled ? (
        <Text style={int(400, 15, { color: C.muted, textAlign: 'center', marginTop: 60 })}>{tr('Нужно подключение к интернету')}</Text>
      ) : group ? (
        <>
          <View style={[s.groupHero, sh(C.teal, 0.3, 28, 12, 6)]}>
            <View style={s.roundIcon}><Icon name="users" size={24} color="#fff" /></View>
            <Text style={man(800, 24, { color: '#fff', marginTop: 12, textAlign: 'center' })}>{group.name}</Text>
            <Text style={int(500, 13, { color: 'rgba(255,255,255,.85)', marginTop: 2, textAlign: 'center' })} numberOfLines={1}>{group.university}</Text>
            <Text style={int(400, 12, { color: 'rgba(255,255,255,.8)', marginTop: 10, textAlign: 'center' })}>
              {group.role === 'owner' ? t('groupYouOwner') : t('groupYouMember')}
            </Text>
          </View>

          {/* QR группы — вместо кода */}
          {/* qrCard: padding 18, внутри qrBox: padding 16 → полезная ширина = w − 36 − 32 */}
          <View style={[s.qrCard, cardShadow]} onLayout={e => setQrSize(Math.max(0, Math.round(e.nativeEvent.layout.width - 68)))}>
            <Text style={int(600, 13, { color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase' })}>{t('groupQrTitle')}</Text>
            <View style={s.qrBox}>
              {qrSize > 40 && groupLink ? (
                <QRCode value={groupLink} size={qrSize} backgroundColor="#FFFFFF" color="#171320" quietZone={14} ecl="M" />
              ) : (
                <View style={{ width: qrSize > 40 ? qrSize : 220, height: qrSize > 40 ? qrSize : 220 }} />
              )}
            </View>
            <Text style={int(400, 12.5, { color: C.muted, marginTop: 14, textAlign: 'center', lineHeight: 18 })}>{t('groupQrHint')}</Text>
          </View>

          <PrimaryButton label={t('groupShare')} onPress={() => actions.groupShare()} style={{ marginTop: 16 }} />
          <Pressable onPress={actions.groupLeave} style={{ alignItems: 'center', paddingVertical: 16 }}>
            <Text style={int(600, 15, { color: C.red })}>{t('groupLeave')}</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Pressable onPress={actions.groupCreate} disabled={busyGroup}
            style={({ pressed }) => [s.groupOption, cardShadow, pressed && { opacity: 0.8 }]}>
            <View style={[s.roundIcon, { backgroundColor: hexRgba(C.purple, 0.12) }]}><Icon name="megaphone" size={22} color={C.purple} /></View>
            <View style={{ flex: 1 }}>
              <Text style={int(600, 15)}>{t('groupCreate')}</Text>
              <Text style={int(400, 12, { color: C.muted, marginTop: 2 })}>{t('groupCreateSub')}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={C.dot} />
          </Pressable>

          <Pressable onPress={() => actions.nav('groupScan')} disabled={busyGroup}
            style={({ pressed }) => [s.groupOption, cardShadow, pressed && { opacity: 0.8 }]}>
            <View style={[s.roundIcon, { backgroundColor: hexRgba(C.teal, 0.14) }]}><Icon name="scan-line" size={22} color={C.teal} /></View>
            <View style={{ flex: 1 }}>
              <Text style={int(600, 15)}>{t('groupJoin')}</Text>
              <Text style={int(400, 12, { color: C.muted, marginTop: 2 })}>{t('groupJoinSub')}</Text>
            </View>
            <Icon name="chevron-right" size={18} color={C.dot} />
          </Pressable>

          <Text style={int(400, 13, { color: C.muted, textAlign: 'center', marginTop: 18, lineHeight: 19 })}>
            {t('groupFlowHint')}
          </Text>
        </>
      )}
    </ScrollView>
  );
}

/* ============ Сканер QR группы ============ */
export function GroupScanScreen({ busyGroup, topInset, actions }) {
  const [perm, requestPerm] = useCameraPermissions();
  const handled = React.useRef(false);
  const line = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(line, { toValue: 1, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(line, { toValue: 0, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [line]);

  // при уходе с экрана снимаем блокировку, чтобы можно было сканировать снова
  React.useEffect(() => () => { handled.current = false; }, []);

  const onScan = React.useCallback(({ data }) => {
    if (handled.current) return;
    handled.current = true;
    actions.groupScanned(String(data || ''), () => { handled.current = false; });
  }, [actions]);

  const header = (
    <View style={[s.scanHeader, { paddingTop: topInset + 8 }]}>
      <IconBtn icon="chevron-left" onPress={() => actions.nav('group')} />
      <Text style={man(800, 18, { color: '#fff' })}>{t('groupScanTitle')}</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  if (!perm) {
    return <View style={s.scanRoot}>{header}</View>;
  }

  if (!perm.granted) {
    return (
      <View style={s.scanRoot}>
        {header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <View style={[s.roundIcon, { width: 64, height: 64, borderRadius: 22 }]}>
            <Icon name="camera" size={28} color="#fff" />
          </View>
          <Text style={man(800, 20, { color: '#fff', marginTop: 18, textAlign: 'center' })}>{t('groupScanCamTitle')}</Text>
          <Text style={int(400, 14, { color: 'rgba(255,255,255,.72)', marginTop: 8, textAlign: 'center', lineHeight: 20 })}>{t('groupScanCamSub')}</Text>
          <PrimaryButton label={t('groupScanAllow')} onPress={requestPerm} style={{ marginTop: 24, alignSelf: 'stretch' }} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.scanRoot}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={busyGroup ? undefined : onScan}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <View style={s.scanFrame}>
            <View style={[s.scanCorner, { top: -2, left: -2, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 18 }]} />
            <View style={[s.scanCorner, { top: -2, right: -2, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 18 }]} />
            <View style={[s.scanCorner, { bottom: -2, left: -2, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 18 }]} />
            <View style={[s.scanCorner, { bottom: -2, right: -2, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 18 }]} />
            <Animated.View style={[s.scanLine, {
              transform: [{ translateY: line.interpolate({ inputRange: [0, 1], outputRange: [6, 234] }) }],
            }]} />
          </View>
          <Text style={int(500, 14.5, { color: '#fff', marginTop: 26, textAlign: 'center', paddingHorizontal: 40 })}>
            {busyGroup ? t('groupJoined').split('!')[0] + '…' : t('groupScanHint')}
          </Text>
        </View>
      </View>
    </View>
  );
}

/* ============ O-COIN ============ */
const COIN_EARN = [
  { icon: 'check', color: '#3DB96B', title: 'Заходить каждый день', value: '+2', sub: 'Просто открыть приложение' },
  { icon: 'sparkles', color: '#F2B23E', title: 'Серия 7 дней подряд', value: '+50', sub: 'Не пропускай ни одного дня' },
  { icon: 'pencil', color: '#5324B0', title: 'Выполнить задачу', value: '+10', sub: 'До 5 задач в день' },
  { icon: 'users', color: '#2FA8A0', title: 'Позвать друга', value: '+100', sub: 'Обоим — тебе и другу' },
  { icon: 'megaphone', color: '#F4564E', title: 'Быть старостой', value: '+30', sub: 'Раз в неделю за ведение расписания группы' },
];

const COIN_SPEND = [
  { icon: 'moon', title: 'Тёмные и цветные темы', cost: 150, ready: true },
  { icon: 'palette', title: 'Иконки и обложки предметов', cost: 200, ready: true },
  { icon: 'ticket', title: 'Билеты на события из афиши', cost: 500, ready: false },
  { icon: 'coffee', title: 'Скидки у партнёров возле вуза', cost: 800, ready: false },
];

export function CoinsScreen({ coins, streak, topInset, actions }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('profile')} />
        <View style={{ flex: 1 }}>
          <Text style={man(800, 24)}>O-COIN</Text>
          <Text style={int(400, 13, { color: C.muted })}>{t('coinsSub')}</Text>
        </View>
      </View>

      <LinearGradient
        colors={themeMode === 'dark' ? ['#3A2470', '#5324B0', '#2E1A57'] : ['#6B3BE0', '#5324B0', '#3D1A85']}
        start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
        style={[s.coinHero, sh(C.purple, 0.35, 30, 14, 7)]}>
        <Image source={require('../assets/orta-coin.png')} style={{ width: 92, height: 92 }} resizeMode="contain" />
        <Text style={[man(800, 46, { color: '#fff', marginTop: 10 }), { fontVariant: ['tabular-nums'] }]}>{coins ?? 0}</Text>
        <Text style={int(500, 14, { color: 'rgba(255,255,255,.85)', marginTop: 2 })}>O-COIN {t('coinsBalance')}</Text>
        {streak > 0 && (
          <View style={s.coinStreak}>
            <Text style={int(600, 13, { color: '#fff' })}>🔥 {t('coinsStreak').replace('{n}', streak)}</Text>
          </View>
        )}
      </LinearGradient>

      <Text style={s.attSection}>{t('coinsHowEarn')}</Text>
      {COIN_EARN.map(r => (
        <View key={r.title} style={[s.coinRow, cardShadow]}>
          <View style={[s.coinIcon, { backgroundColor: hexRgba(r.color, 0.14) }]}>
            <Icon name={r.icon} size={19} color={r.color} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={int(600, 15)}>{r.title}</Text>
            <Text style={int(400, 12.5, { color: C.muted, marginTop: 2 })}>{r.sub}</Text>
          </View>
          <Text style={man(800, 16, { color: r.color })}>{r.value}</Text>
        </View>
      ))}

      <Text style={s.attSection}>{t('coinsHowSpend')}</Text>
      {COIN_SPEND.map(r => {
        const enough = (coins ?? 0) >= r.cost;
        return (
          <View key={r.title} style={[s.coinRow, cardShadow, !r.ready && { opacity: 0.62 }]}>
            <View style={[s.coinIcon, { backgroundColor: C.chipBg }]}>
              <Icon name={r.icon} size={19} color={C.ink} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={int(600, 15)} numberOfLines={2}>{r.title}</Text>
              <Text style={int(400, 12.5, { color: C.muted, marginTop: 2 })}>
                {r.ready ? (enough ? t('coinsCanTake') : t('coinsNotEnough')) : t('coinsSoon')}
              </Text>
            </View>
            <Text style={man(800, 15, { color: enough && r.ready ? C.purple : C.muted })}>{r.cost}</Text>
          </View>
        );
      })}

      <PrimaryButton label={t('coinsInvite')} onPress={actions.shareProfile} style={{ marginTop: 18 }} />
      <Text style={int(400, 12.5, { color: C.muted, textAlign: 'center', marginTop: 14, lineHeight: 18 })}>
        {t('coinsFooter')}
      </Text>
    </ScrollView>
  );
}

/* ============ Преподаватель: пара, QR и журнал ============ */
const MARK_STYLE = {
  present: { color: '#1F9254', bg: 'rgba(31,146,84,.14)', icon: 'check', label: 'Пришёл' },
  late:    { color: '#C98A00', bg: 'rgba(201,138,0,.16)', icon: 'clock', label: 'Опоздал' },
  absent:  { color: '#D93A34', bg: 'rgba(217,58,52,.14)', icon: 'triangle-alert', label: 'Не пришёл' },
};

function MarkButtons({ status, onSet }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {['present', 'late', 'absent'].map(k => {
        const m = MARK_STYLE[k];
        const on = status === k;
        return (
          <Pressable key={k} onPress={() => onSet(on ? null : k)}
            style={({ pressed }) => [s.markBtn,
              { backgroundColor: on ? m.color : m.bg },
              pressed && { transform: [{ scale: 0.9 }] }]}>
            <Icon name={m.icon} size={15} color={on ? '#fff' : m.color} />
          </Pressable>
        );
      })}
    </View>
  );
}

export function TeacherScreen({ state, busy, asHome, topInset, actions }) {
  const sessions = state.teacherSessions || [];
  return (
    <PullScroll topInset={topInset} onRefresh={actions.teacherRefresh}
      contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: PAD_BOTTOM }}>
      {/* на главной снизу панель вкладок, а из профиля нужна стрелка назад */}
      {!asHome && <View style={{ alignSelf: 'flex-start', marginBottom: 10 }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('profile')} />
      </View>}
      <Text style={man(800, 26)}>{t('teacherTitle')}</Text>
      <Text style={int(400, 14, { color: C.muted, marginTop: 4 })}>{t('teacherSub')}</Text>

      <Pressable onPress={actions.openSessionSheet} disabled={busy}
        style={({ pressed }) => [s.bigCard, sh(C.purple, 0.35, 28, 12, 6), { marginTop: 20 }, pressed && { transform: [{ scale: 0.98 }] }]}>
        <View style={s.roundIcon}><Icon name="qr-code" size={24} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={man(800, 17, { color: '#fff' })}>{t('teacherOpen')}</Text>
          <Text style={int(400, 12, { color: 'rgba(255,255,255,.85)', marginTop: 2 })}>{t('teacherOpenSub')}</Text>
        </View>
        <Icon name="chevron-right" size={20} color="rgba(255,255,255,.8)" />
      </Pressable>

      <Text style={s.attSection}>{t('teacherRecent')}</Text>
      {sessions.length ? sessions.map(x => (
        <Pressable key={x.id} onPress={() => actions.openSession(x)}
          onLongPress={() => actions.deleteSession(x)} delayLongPress={500}
          style={({ pressed }) => [s.attRow, cardShadow, pressed && { opacity: 0.8 }]}>
          <View style={[s.attBar, { backgroundColor: C.purple }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={int(600, 15)} numberOfLines={1}>{x.subject || t('lessonNoName')}</Text>
            <Text style={int(400, 12.5, { color: C.muted, marginTop: 2 })}>
              {new Date(x.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {x.room ? ` · ауд. ${x.room}` : ''}
            </Text>
          </View>
          <View style={s.gtaskTag}><Text style={int(700, 11, { color: C.teal })}>{x.marks}</Text></View>
          <Icon name="chevron-right" size={18} color={C.dot} />
        </Pressable>
      )) : (
        <Text style={int(400, 14, { color: C.muted, lineHeight: 20 })}>{t('teacherEmpty')}</Text>
      )}
      {sessions.length > 0 && <Text style={int(400, 12, { color: C.muted, marginTop: 6, textAlign: 'center' })}>{t('teacherDelHint')}</Text>}
    </PullScroll>
  );
}

/* Полоска посещаемости: зелёный / жёлтый / красный в долях */
function AttendBar({ present = 0, late = 0, absent = 0, height = 8 }) {
  const total = present + late + absent;
  if (!total) return <View style={[s.tpBar, { height }]} />;
  const parts = [['present', present], ['late', late], ['absent', absent]];
  return (
    <View style={[s.tpBar, { height, marginTop: 8 }]}>
      {parts.map(([k, n]) => n > 0 && (
        <View key={k} style={{ flex: n, backgroundColor: MARK_STYLE[k].color }} />
      ))}
    </View>
  );
}

/* Доля присутствия одним числом: пришёл или опоздал — считается за явку */
function attendPct(x) {
  const total = (x.present || 0) + (x.late || 0) + (x.absent || 0);
  return total ? Math.round(((x.present || 0) + (x.late || 0)) / total * 100) : null;
}

const pctColor = p => (p >= 75 ? MARK_STYLE.present.color : MARK_STYLE.absent.color);

/* ============ Мои студенты ============ */
export function TeacherStudentsScreen({ students, excluded, topInset, actions }) {
  const [q, setQ] = React.useState('');
  const list = students || [];
  const needle = q.trim().toLowerCase();
  const found = needle
    ? list.filter(x => `${x.name || ''} ${x.group_name || ''}`.toLowerCase().includes(needle))
    : list;

  // раскладываем по группам — преподаватель думает группами, а не списком фамилий
  const groups = [];
  for (const st of found) {
    const g = st.group_name || t('tsNoGroup');
    let box = groups.find(x => x.name === g);
    if (!box) { box = { name: g, items: [] }; groups.push(box); }
    box.items.push(st);
  }

  return (
    <PullScroll topInset={topInset} onRefresh={actions.studentsRefresh}
      contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: PAD_BOTTOM }}>
      <Text style={man(800, 26)}>{t('tsTitle')}</Text>
      <Text style={int(400, 14, { color: C.muted, marginTop: 4 })}>
        {list.length ? tPlural(list.length, 'tsCount') : t('tsSub')}
      </Text>

      {list.length > 0 && (
        <TextInput style={[s.formInput, cardShadow, int(500, 15), { marginTop: 16 }]}
          placeholder={t('tsSearch')} placeholderTextColor={C.dot}
          autoCorrect={false} value={q} onChangeText={setQ} />
      )}

      {!list.length ? (
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <EmptyArt icon="users" />
          <Text style={int(400, 14, { color: C.muted, marginTop: 18, textAlign: 'center', lineHeight: 20 })}>
            {t('tsEmpty')}
          </Text>
        </View>
      ) : !found.length ? (
        <Text style={int(400, 14, { color: C.muted, marginTop: 20 })}>{t('tsNotFound')}</Text>
      ) : groups.map(g => (
        <View key={g.name}>
          <Text style={s.attSection}>{g.name} · {tPlural(g.items.length, 'tsCount')}</Text>
          {g.items.map(st => {
            const pct = attendPct(st);
            return (
              <Pressable key={st.student_id} onPress={() => actions.openStudent(st)}
                style={({ pressed }) => [s.attRow, cardShadow, { alignItems: 'flex-start' }, pressed && { opacity: 0.8 }]}>
                <View style={s.tsAvatar}>
                  <Text style={man(800, 15, { color: C.purple })}>
                    {(st.name || '?').trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={int(600, 15)} numberOfLines={1}>{st.name || t('tpNoName')}</Text>
                  <Text style={int(400, 12.5, { color: C.muted, marginTop: 2 })} numberOfLines={1}>
                    {[st.course ? `${st.course} ${t('statCourse').toLowerCase()}` : null,
                      st.grades ? tPlural(st.grades, 'tsGradesN') : null].filter(Boolean).join(' · ') || '—'}
                  </Text>
                  <AttendBar present={st.present} late={st.late} absent={st.absent} height={5} />
                </View>
                {pct !== null && (
                  <View style={[s.gtaskTag, { backgroundColor: hexRgba(pctColor(pct), 0.14), marginTop: 2 }]}>
                    <Text style={int(700, 11, { color: pctColor(pct) })}>{pct}%</Text>
                  </View>
                )}
                <Icon name="chevron-right" size={18} color={C.dot} />
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* кого убрали из списка — чтобы можно было вернуть */}
      {!!(excluded || []).length && (<>
        <Text style={s.attSection}>{t('tsExcluded')}</Text>
        {excluded.map(st => (
          <View key={st.student_id} style={[s.attRow, cardShadow, { opacity: 0.7 }]}>
            <View style={s.tsAvatar}>
              <Text style={man(800, 15, { color: C.purple })}>{(st.name || '?').trim().charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={int(600, 15)} numberOfLines={1}>{st.name || t('tpNoName')}</Text>
              <Text style={int(400, 12.5, { color: C.muted, marginTop: 2 })} numberOfLines={1}>{st.group_name || '—'}</Text>
            </View>
            <Pressable onPress={() => actions.includeStudent(st)}
              style={({ pressed }) => [s.gtaskTag, { paddingVertical: 6, paddingHorizontal: 12 }, pressed && { opacity: 0.6 }]}>
              <Text style={int(700, 12, { color: C.teal })}>{t('tsInclude')}</Text>
            </Pressable>
          </View>
        ))}
      </>)}
    </PullScroll>
  );
}

/* ============ Карточка студента: посещаемость и оценки ============ */
export function TeacherStudentScreen({ card, busy, topInset, actions }) {
  if (!card) return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20 }}>
      <View style={{ alignSelf: 'flex-start' }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('students')} />
      </View>
      <Text style={int(400, 14, { color: C.muted, marginTop: 30, textAlign: 'center' })}>{t('tsLoading')}</Text>
    </ScrollView>
  );

  const marks = card.marks || [], grades = card.grades || [];
  const counts = {
    present: marks.filter(m => m.status === 'present').length,
    late: marks.filter(m => m.status === 'late').length,
    absent: marks.filter(m => m.status === 'absent').length,
  };
  const pct = attendPct(counts);

  return (
    <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: PAD_BOTTOM }}>
      <View style={{ alignSelf: 'flex-start', marginBottom: 10 }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('students')} />
      </View>

      <View style={[s.tpCard, cardShadow, { alignItems: 'center' }]}>
        <View style={[s.tsAvatar, { width: 62, height: 62, borderRadius: 22 }]}>
          <Text style={man(800, 26, { color: C.purple })}>{(card.name || '?').trim().charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={man(800, 22, { marginTop: 12, textAlign: 'center' })}>{card.name || t('tpNoName')}</Text>
        <Text style={int(400, 13.5, { color: C.muted, marginTop: 4, textAlign: 'center' })}>
          {[card.group_name, card.course ? `${card.course} ${t('statCourse').toLowerCase()}` : null, card.faculty]
            .filter(Boolean).join(' · ') || '—'}
        </Text>
        {pct !== null && <>
          <Text style={man(800, 34, { marginTop: 14, color: pctColor(pct) })}>{pct}%</Text>
          <Text style={int(400, 12.5, { color: C.muted, marginTop: 2 })}>{t('tsAttendPct')}</Text>
        </>}
        <View style={{ alignSelf: 'stretch' }}><AttendBar {...counts} /></View>
        <View style={{ flexDirection: 'row', marginTop: 12, alignSelf: 'stretch' }}>
          {['present', 'late', 'absent'].map(k => (
            <View key={k} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={man(800, 17, { color: MARK_STYLE[k].color })}>{counts[k]}</Text>
              <Text style={int(400, 11.5, { color: C.muted, marginTop: 2 })}>{MARK_STYLE[k].label}</Text>
            </View>
          ))}
        </View>
      </View>

      <Pressable onPress={() => actions.openStudentGrade(card)} disabled={busy}
        style={({ pressed }) => [s.bigCard, sh(C.purple, 0.35, 28, 12, 6), pressed && { transform: [{ scale: 0.98 }] }]}>
        <View style={s.roundIcon}><Icon name="graduation-cap" size={24} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={man(800, 17, { color: '#fff' })}>{t('tsGiveGrade')}</Text>
          <Text style={int(400, 12, { color: 'rgba(255,255,255,.85)', marginTop: 2 })}>{t('tsGiveGradeSub')}</Text>
        </View>
        <Icon name="chevron-right" size={20} color="rgba(255,255,255,.8)" />
      </Pressable>

      <Text style={s.attSection}>{t('tsGrades')}</Text>
      {grades.length ? grades.map(g => (
        <View key={g.id} style={[s.attRow, cardShadow]}>
          <View style={s.tpGrade}><Text style={man(800, 16, { color: C.purple })}>{g.value}</Text></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={int(600, 14.5)} numberOfLines={1}>{g.subject || t('lessonNoName')}</Text>
            <Text style={int(400, 12.5, { color: C.muted, marginTop: 2 })} numberOfLines={2}>
              {g.comment || new Date(g.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
            </Text>
          </View>
          <Pressable onPress={() => actions.deleteGrade(g, card)} hitSlop={8}
            style={({ pressed }) => [s.delBtn, pressed && { opacity: 0.6 }]}>
            <Icon name="trash-2" size={16} color={C.muted} />
          </Pressable>
        </View>
      )) : <Text style={int(400, 14, { color: C.muted })}>{t('tsNoGrades')}</Text>}

      <Text style={s.attSection}>{t('tsVisits')}</Text>
      {marks.length ? marks.map((m, i) => (
        <View key={i} style={[s.attRow, cardShadow]}>
          <View style={[s.attBar, { backgroundColor: MARK_STYLE[m.status]?.color || C.dot }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={int(600, 14.5)} numberOfLines={1}>{m.subject || t('lessonNoName')}</Text>
            <Text style={int(400, 12.5, { color: C.muted, marginTop: 2 })}>
              {new Date(m.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {m.room ? ` · ауд. ${m.room}` : ''}
            </Text>
          </View>
          {!!MARK_STYLE[m.status] && (
            <View style={[s.gtaskTag, { backgroundColor: MARK_STYLE[m.status].bg }]}>
              <Text style={int(700, 11, { color: MARK_STYLE[m.status].color })}>{MARK_STYLE[m.status].label}</Text>
            </View>
          )}
        </View>
      )) : <Text style={int(400, 14, { color: C.muted })}>{t('tsNoVisits')}</Text>}

      {/* мягкое исключение: данные студента остаются, он просто уходит из списка */}
      <Pressable onPress={() => actions.excludeStudent(card)} disabled={busy}
        style={({ pressed }) => [s.dangerBtn, { marginTop: 24 }, pressed && { opacity: 0.75 }]}>
        <Icon name="user-minus" size={17} color={MARK_STYLE.absent.color} />
        <Text style={int(600, 15, { color: MARK_STYLE.absent.color })}>{t('tsExclude')}</Text>
      </Pressable>
      <Text style={int(400, 12, { color: C.muted, marginTop: 8, textAlign: 'center', lineHeight: 17 })}>{t('tsExcludeHint')}</Text>
    </ScrollView>
  );
}

/* ============ Отчёты: по группам, предметам и парам ============ */
export function TeacherReportsScreen({ report, topInset, actions }) {
  const [tab, setTab] = React.useState('groups');
  const r = report || {};
  const rows = r[tab] || [];
  const TABS = [['groups', 'trGroups'], ['subjects', 'trSubjects'], ['sessions', 'trSessions']];

  // общая посещаемость — считаем по группам, там каждая отметка ровно один раз
  const total = (r.groups || []).reduce((a, x) => ({
    present: a.present + (x.present || 0), late: a.late + (x.late || 0), absent: a.absent + (x.absent || 0),
  }), { present: 0, late: 0, absent: 0 });
  const totalAll = total.present + total.late + total.absent;

  return (
    <PullScroll topInset={topInset} onRefresh={actions.reportRefresh}
      contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: PAD_BOTTOM }}>
      <Text style={man(800, 26)}>{t('trTitle')}</Text>
      <Text style={int(400, 14, { color: C.muted, marginTop: 4 })}>{t('trSub')}</Text>

      {totalAll > 0 && (
        <View style={[s.tpCard, cardShadow, { marginTop: 16 }]}>
          <Text style={int(600, 13, { color: C.muted })}>{t('trOverall')}</Text>
          <Text style={man(800, 34, { marginTop: 4, color: pctColor(attendPct(total)) })}>{attendPct(total)}%</Text>
          <AttendBar {...total} />
          <View style={{ flexDirection: 'row', marginTop: 12 }}>
            {['present', 'late', 'absent'].map(k => (
              <View key={k} style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[s.tpDot, { backgroundColor: MARK_STYLE[k].color }]} />
                  <Text style={man(800, 16)}>{total[k]}</Text>
                </View>
                <Text style={int(400, 11.5, { color: C.muted, marginTop: 2 })}>{MARK_STYLE[k].label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* карточки под переключателем шли впритык — отбиваем их */}
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 18, marginBottom: 16 }}>
        {TABS.map(([id, key]) => (
          <Pressable key={id} onPress={() => setTab(id)}
            style={({ pressed }) => [s.trTab, tab === id && { backgroundColor: C.purple, borderColor: C.purple }, pressed && { opacity: 0.85 }]}>
            <Text style={int(600, 13, { color: tab === id ? '#fff' : C.muted })}>{t(key)}</Text>
          </Pressable>
        ))}
      </View>

      {!rows.length ? (
        <View style={{ alignItems: 'center', marginTop: 40 }}>
          <EmptyArt icon="clipboard-list" />
          <Text style={int(400, 14, { color: C.muted, marginTop: 18, textAlign: 'center', lineHeight: 20 })}>{t('trEmpty')}</Text>
        </View>
      ) : rows.map((x, i) => {
        const pct = attendPct(x);
        const title = tab === 'groups' ? x.group_name : (x.subject || t('lessonNoName'));
        const sub = tab === 'groups'
          ? tPlural(x.students, 'tsCount')
          : tab === 'subjects'
            ? `${tPlural(x.sessions, 'trPairsN')} · ${tPlural(x.students, 'tsCount')}`
            : new Date(x.created_at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
              + (x.room ? ` · ауд. ${x.room}` : '');
        return (
          <View key={x.id || i} style={[s.attRow, cardShadow, { alignItems: 'flex-start' }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={int(600, 15)} numberOfLines={1}>{title}</Text>
              <Text style={int(400, 12.5, { color: C.muted, marginTop: 2 })} numberOfLines={1}>{sub}</Text>
              <AttendBar present={x.present} late={x.late} absent={x.absent} height={6} />
              <Text style={int(400, 11.5, { color: C.muted, marginTop: 6 })}>
                {MARK_STYLE.present.label} {x.present} · {MARK_STYLE.late.label} {x.late} · {MARK_STYLE.absent.label} {x.absent}
              </Text>
            </View>
            {pct !== null && <Text style={man(800, 17, { color: pctColor(pct), marginTop: 2 })}>{pct}%</Text>}
          </View>
        );
      })}
    </PullScroll>
  );
}

/* ============ Профиль преподавателя: всё на одном экране ============ */
export function TeacherProfileScreen({ state, streak = 0, topInset, actions }) {
  const p = state.profile || {}, su = state.setup || {};
  const st = state.teacherStats || null;
  const sessions = state.teacherSessions || [];

  // пары и студенты считаем из сводки, но если сервер молчит — берём то, что уже загружено
  const nSessions = st ? st.sessions : sessions.length;
  const nStudents = st ? st.students : 0;
  const nGrades = st ? st.grades : 0;
  const marks = [st?.present || 0, st?.late || 0, st?.absent || 0];
  const totalMarks = marks[0] + marks[1] + marks[2];
  const keys = ['present', 'late', 'absent'];

  return (
    <PullScroll topInset={topInset} onRefresh={actions.teacherRefresh}
      contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: PAD_BOTTOM }}>
      <LinearGradient
        colors={themeMode === 'dark' ? ['#262837', '#2C2447', '#1E3A36'] : ['#FFFFFF', '#EFEBFB', '#DFF2ED']}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        style={[s.studCard, cardShadow]}>
        <View style={s.studShare}>
          <View style={s.tpBadge}>
            <Icon name="graduation-cap" size={13} color={C.purple} />
            <Text style={int(700, 11.5, { color: C.purple })}>{t('roleTeacher')}</Text>
          </View>
          {streak > 0 && <Text style={int(600, 11, { color: C.muted, marginTop: 5, textAlign: 'right' })}>🔥 {streak} дн.</Text>}
        </View>
        <Text style={man(800, 26, { marginTop: 34 })}>{p.firstName} {p.lastName}</Text>
        <Text style={int(400, 15, { color: C.muted, marginTop: 3 })}>{t('teacherProfileSub')}</Text>
        {!!p.email && (
          <View style={s.mailPill}>
            <Icon name="check" size={12} color={C.green} />
            <Text style={int(500, 12, { color: C.muted })} numberOfLines={1}>{p.email}</Text>
          </View>
        )}
        {!!(su.university || st?.university) && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <View style={s.studTag}>
              <Text style={int(500, 12, { color: C.muted })} numberOfLines={1}>{su.university || st.university}</Text>
            </View>
          </View>
        )}
        <View style={s.studStats}>
          <View style={s.studStat}>
            <Text style={man(800, 18)}>{nSessions}</Text>
            <Text style={int(400, 12, { color: C.muted, marginTop: 2 })}>{t('tpPairs')}</Text>
          </View>
          <View style={s.studDivider} />
          <View style={s.studStat}>
            <Text style={man(800, 18)}>{nStudents}</Text>
            <Text style={int(400, 12, { color: C.muted, marginTop: 2 })}>{t('tpStudents')}</Text>
          </View>
          <View style={s.studDivider} />
          <View style={s.studStat}>
            <Text style={man(800, 18)}>{nGrades}</Text>
            <Text style={int(400, 12, { color: C.muted, marginTop: 2 })}>{t('tpGrades')}</Text>
          </View>
        </View>
        <Pressable onPress={actions.openProfileSheet}
          style={({ pressed }) => [s.studBtn, { alignSelf: 'stretch', marginTop: 18 }, pressed && { opacity: 0.8 }]}>
          <Text style={man(700, 15)}>{t('editProfile')}</Text>
        </Pressable>
      </LinearGradient>

      <Pressable onPress={actions.openSessionSheet}
        style={({ pressed }) => [s.bigCard, sh(C.purple, 0.35, 28, 12, 6), pressed && { transform: [{ scale: 0.98 }] }]}>
        <View style={s.roundIcon}><Icon name="qr-code" size={24} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={man(800, 17, { color: '#fff' })}>{t('teacherOpen')}</Text>
          <Text style={int(400, 12, { color: 'rgba(255,255,255,.85)', marginTop: 2 })}>{t('teacherOpenSub')}</Text>
        </View>
        <Icon name="chevron-right" size={20} color="rgba(255,255,255,.8)" />
      </Pressable>

      {/* Посещаемость по всем парам разом */}
      <Text style={s.attSection}>{t('tpAttendance')}</Text>
      {totalMarks ? (
        <View style={[s.tpCard, cardShadow]}>
          <AttendBar present={marks[0]} late={marks[1]} absent={marks[2]} height={10} />
          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            {keys.map((k, i) => (
              <View key={k} style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={[s.tpDot, { backgroundColor: MARK_STYLE[k].color }]} />
                  <Text style={man(800, 17)}>{marks[i]}</Text>
                </View>
                <Text style={int(400, 12, { color: C.muted, marginTop: 2 })} numberOfLines={1}>
                  {MARK_STYLE[k].label} · {Math.round(marks[i] / totalMarks * 100)}%
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Text style={int(400, 14, { color: C.muted, lineHeight: 20 })}>{t('tpNoMarks')}</Text>
      )}

      {/* Последние оценки */}
      {!!st?.recent_grades?.length && (<>
        <Text style={s.attSection}>{t('tpRecentGrades')}</Text>
        {st.recent_grades.map((g, i) => (
          <View key={i} style={[s.attRow, cardShadow]}>
            <View style={s.tpGrade}><Text style={man(800, 16, { color: C.purple })}>{g.value}</Text></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={int(600, 15)} numberOfLines={1}>{g.student || t('tpNoName')}</Text>
              <Text style={int(400, 12.5, { color: C.muted, marginTop: 2 })} numberOfLines={1}>
                {[g.subject, g.comment].filter(Boolean).join(' · ')
                  || new Date(g.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
              </Text>
            </View>
          </View>
        ))}
      </>)}

      <View style={{ gap: 12, marginTop: 24 }}>
        <ListRow icon="users" title={t('tsTitle')} accent onPress={() => actions.nav('students')}
          right={<CountBadge n={nStudents} />} />
        <ListRow icon="clipboard-list" title={t('trTitle')} accent onPress={() => actions.nav('reports')}
          right={<Icon name="chevron-right" size={18} color={C.dot} />} />
        <ListRow icon="calendar-days" title={t('tpJournal')} accent onPress={() => actions.nav('teacher')}
          right={<CountBadge n={nSessions} />} />
        <ListRow icon="settings" title={t('rowSettings')} accent onPress={() => actions.nav('settings')}
          right={<Icon name="chevron-right" size={18} color={C.dot} />} />
        <ListRow icon="bell" title={t('rowNotifications')} accent onPress={() => actions.nav('notifications')}
          right={<Icon name="chevron-right" size={18} color={C.dot} />} />
        <ListRow icon="moon" title={t('rowTheme')} accent onPress={() => actions.nav('settings')}
          right={<Icon name="chevron-right" size={18} color={C.dot} />} />
      </View>
    </PullScroll>
  );
}

export function SessionScreen({ session, roster, link, busy, topInset, actions }) {
  const [qrSize, setQrSize] = React.useState(0);
  const [left, setLeft] = React.useState(0);

  React.useEffect(() => {
    if (!session?.expires_at) return;
    const tick = () => setLeft(Math.max(0, Math.round((new Date(session.expires_at) - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.expires_at]);

  // список сам обновляется, пока идёт пара
  React.useEffect(() => {
    const id = setInterval(() => actions.refreshRoster(), 5000);
    return () => clearInterval(id);
  }, [actions]);

  if (!session) return null;
  const list = roster || [];
  const counts = ['present', 'late', 'absent'].map(k => list.filter(x => x.status === k).length);
  const mmss = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('teacher')} />
        <View style={{ flex: 1 }}>
          <Text style={man(800, 22)} numberOfLines={1}>{session.subject || t('lessonNoName')}</Text>
          <Text style={int(400, 13, { color: C.muted })}>
            {session.room ? `ауд. ${session.room} · ` : ''}{left > 0 ? t('teacherLeft').replace('{t}', mmss) : t('teacherClosed')}
          </Text>
        </View>
      </View>

      {left > 0 && (
        <View style={[s.qrCard, cardShadow]} onLayout={e => setQrSize(Math.max(0, Math.round(e.nativeEvent.layout.width - 68)))}>
          <Text style={int(600, 13, { color: C.muted, letterSpacing: 0.6, textTransform: 'uppercase' })}>{t('teacherScanMe')}</Text>
          <View style={s.qrBox}>
            {qrSize > 40 && link ? (
              <QRCode value={link} size={qrSize} backgroundColor="#FFFFFF" color="#171320" quietZone={14} ecl="M" />
            ) : <View style={{ width: 220, height: 220 }} />}
          </View>
          <Text style={[man(800, 20), { letterSpacing: 4, marginTop: 12 }]}>{session.code}</Text>
          <Text style={int(400, 12.5, { color: C.muted, marginTop: 6, textAlign: 'center', lineHeight: 18 })}>{t('teacherQrHint')}</Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
        {['present', 'late', 'absent'].map((k, i) => (
          <View key={k} style={[s.countPill, { backgroundColor: MARK_STYLE[k].bg }]}>
            <Text style={man(800, 18, { color: MARK_STYLE[k].color })}>{counts[i]}</Text>
            <Text style={int(500, 11.5, { color: MARK_STYLE[k].color })}>{MARK_STYLE[k].label}</Text>
          </View>
        ))}
      </View>

      <Text style={s.attSection}>{t('teacherRoster')} · {list.length}</Text>
      {list.length ? list.map(st => (
        <View key={st.student_id} style={[s.attRow, cardShadow, { alignItems: 'center' }]}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={int(600, 15)} numberOfLines={1}>{st.name || t('teacherNoName')}</Text>
            <Text style={int(400, 12, { color: C.muted, marginTop: 2 })} numberOfLines={1}>
              {[st.group_name, st.course ? `${st.course} курс` : ''].filter(Boolean).join(' · ') || '—'}
            </Text>
          </View>
          <Pressable onPress={() => actions.openGradeSheet(st)} hitSlop={8}
            style={({ pressed }) => [s.gradeBtn, pressed && { opacity: 0.7 }]}>
            <Icon name="pencil" size={15} color={C.purple} />
          </Pressable>
          <MarkButtons status={st.status} onSet={v => actions.setMark(st.student_id, v)} />
        </View>
      )) : (
        <Text style={int(400, 14, { color: C.muted, lineHeight: 20 })}>{t('teacherRosterEmpty')}</Text>
      )}
    </ScrollView>
  );
}

/* ============ Студент: мои оценки ============ */
export function GradesScreen({ grades, topInset, actions }) {
  const list = grades || [];
  return (
    <PullScroll topInset={topInset} onRefresh={actions.gradesRefresh}
      contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: PAD_BOTTOM }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('profile')} />
        <View style={{ flex: 1 }}>
          <Text style={man(800, 24)}>{t('myGrades')}</Text>
          <Text style={int(400, 13, { color: C.muted })}>{t('myGradesSub')}</Text>
        </View>
      </View>
      {list.length ? (
        <View style={{ marginTop: 18, gap: 10 }}>
          {list.map(g => (
            <View key={g.id} style={[s.attRow, cardShadow, { alignItems: 'flex-start' }]}>
              <View style={[s.gradeValue, sh(C.purple, 0.28, 20, 8, 4)]}>
                <Text style={man(800, 20, { color: '#fff' })}>{g.value}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={int(600, 15)} numberOfLines={1}>{g.subject || '—'}</Text>
                {!!g.comment && <Text style={int(400, 13, { color: C.muted, marginTop: 3 })}>{g.comment}</Text>}
                <Text style={int(400, 11.5, { color: C.dot, marginTop: 4 })}>
                  {g.teacher || ''} · {new Date(g.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}
                </Text>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingTop: 60 }}>
          <EmptyArt icon="pencil" />
          <Text style={man(800, 20, { marginTop: 4 })}>{t('myGradesEmpty')}</Text>
          <Text style={int(400, 14.5, { color: C.muted, marginTop: 8, textAlign: 'center', lineHeight: 20 })}>{t('myGradesEmptySub')}</Text>
        </View>
      )}
    </PullScroll>
  );
}

/* ============ Моя посещаемость ============ */
function AttendPill({ status, onPress, compact }) {
  const map = {
    [ATT.PRESENT]: { label: 'Был', color: C.green, icon: 'check' },
    [ATT.LATE]: { label: 'Опоздал', color: C.yellow, icon: 'clock' },
    [ATT.ABSENT]: { label: 'Не был', color: C.red, icon: 'triangle-alert' },
  };
  const m = map[status];
  if (!m) return null;
  return (
    <Pressable onPress={onPress} disabled={!onPress}
      style={[s.attPill, { backgroundColor: hexRgba(m.color, 0.14) }, compact && { paddingHorizontal: 8 }]}>
      <Icon name={m.icon} size={12} color={m.color} />
      {!compact && <Text style={int(600, 12, { color: m.color })}>{m.label}</Text>}
    </Pressable>
  );
}

export function AttendanceScreen({ attendance, teacherMarks, schedule, topInset, actions }) {
  const st = React.useMemo(() => ATT.stats(attendance), [attendance]);
  const now = ATT.now();
  const today = ATT.dayKey(now);
  const todayLessons = ATT.lessonsOfDay(schedule, ATT.scheduleDay(now));
  const days = React.useMemo(() => ATT.recentDays(attendance), [attendance]);
  const months = tMonthsGen();

  // Календарь: 0 = текущий месяц, отрицательные — назад. Вперёд не пускаем.
  const [monthOffset, setMonth] = React.useState(0);
  const nowY = now.getFullYear();
  const viewDate = new Date(nowY, now.getMonth() + monthOffset, 1);
  const viewYear = viewDate.getFullYear(), viewMonth = viewDate.getMonth();
  const grid = React.useMemo(
    () => ATT.monthGrid(attendance, viewYear, viewMonth),
    [attendance, viewYear, viewMonth],
  );

  const ring = st.percent == null ? 0 : st.percent;
  const ringColor = st.percent == null ? C.dot : st.percent >= 85 ? C.green : st.percent >= 70 ? C.yellow : C.red;

  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('profile')} />
        <View style={{ flex: 1 }}>
          <Text style={man(800, 24)}>{t('attendance')}</Text>
          <Text style={int(400, 13, { color: C.muted })}>{t('attendanceSub')}</Text>
        </View>
      </View>

      {/* Сводка */}
      <View style={[s.attHero, cardShadow]}>
        <View style={{ flex: 1 }}>
          <Text style={[man(800, 40, { color: ringColor }), { fontVariant: ['tabular-nums'] }]}>
            {st.percent == null ? '—' : `${ring}%`}
          </Text>
          <Text style={int(400, 13, { color: C.muted, marginTop: 2 })}>
            {st.total ? `${st.present + st.late} из ${st.total} ${plural(st.total, 'пары', 'пар', 'пар')}` : t('attendanceNoData')}
          </Text>
        </View>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[s.attDot, { backgroundColor: C.green }]} />
            <Text style={int(500, 13)}>{st.present} был</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[s.attDot, { backgroundColor: C.yellow }]} />
            <Text style={int(500, 13)}>{st.late} опоздал</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={[s.attDot, { backgroundColor: C.red }]} />
            <Text style={int(500, 13)}>{st.absent} пропустил</Text>
          </View>
        </View>
      </View>

      {/* Сегодняшние пары — отметить в один тап */}
      {todayLessons.length ? (
        <>
          <Text style={s.attSection}>{t('attendanceToday')}</Text>
          {todayLessons.map(l => {
            const mark = ATT.getMark(attendance, today, l.id);
            return (
              <View key={l.id} style={[s.attRow, cardShadow]}>
                <View style={[s.attBar, { backgroundColor: l.color || C.purple }]} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={int(600, 15)} numberOfLines={1}>{l.name}</Text>
                  <Text style={int(400, 12.5, { color: C.muted, marginTop: 2 })}>
                    {l.start}{l.room && l.room !== '—' ? ` · ауд. ${l.room}` : ''}
                  </Text>
                </View>
                {mark ? (
                  <AttendPill status={mark.status} onPress={() => actions.attendMark(today, l, null)} />
                ) : (
                  <View style={{ flexDirection: 'row', gap: 7 }}>
                    <Pressable onPress={() => actions.attendMark(today, l, ATT.PRESENT)}
                      style={({ pressed }) => [s.attBtn, { backgroundColor: C.green }, pressed && { opacity: 0.8 }]}>
                      <Icon name="check" size={16} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => actions.attendMark(today, l, ATT.LATE)}
                      style={({ pressed }) => [s.attBtn, { backgroundColor: hexRgba(C.yellow, 0.18) }, pressed && { opacity: 0.8 }]}>
                      <Icon name="clock" size={16} color={C.yellow} />
                    </Pressable>
                    <Pressable onPress={() => actions.attendMark(today, l, ATT.ABSENT)}
                      style={({ pressed }) => [s.attBtn, { backgroundColor: hexRgba(C.red, 0.14) }, pressed && { opacity: 0.8 }]}>
                      <Icon name="triangle-alert" size={16} color={C.red} />
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
          <Text style={int(400, 12, { color: C.muted, textAlign: 'center', marginTop: 8 })}>{t('attendanceTapHint')}</Text>
        </>
      ) : null}

      {/* Отметки от преподавателей — их ставит не студент, поэтому отдельным блоком */}
      {!!(teacherMarks || []).length && (
        <>
          <Text style={s.attSection}>{t('fromTeachers')}</Text>
          {(teacherMarks || []).slice(0, 12).map((m, i) => (
            <View key={i} style={[s.attRow, cardShadow, { alignItems: 'center' }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={int(600, 15)} numberOfLines={1}>{m.subject || t('lessonNoName')}</Text>
                <Text style={int(400, 12, { color: C.muted, marginTop: 2 })}>
                  {m.room ? `ауд. ${m.room} · ` : ''}
                  {new Date(m.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
              <AttendPill status={m.status} />
            </View>
          ))}
        </>
      )}

      {/* Календарь посещаемости */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 10 }}>
        <Text style={[s.attSection, { marginTop: 0, marginBottom: 0 }]}>{t('attendanceCalendar')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Pressable onPress={() => setMonth(m => m - 1)} hitSlop={10} style={s.attNav}>
            <Icon name="chevron-left" size={16} color={C.ink} />
          </Pressable>
          <Text style={[int(600, 13.5), { minWidth: 96, textAlign: 'center' }]}>
            {tMonthsNom()[viewMonth]} {viewYear !== nowY ? viewYear : ''}
          </Text>
          <Pressable onPress={() => setMonth(m => m + 1)} hitSlop={10} disabled={monthOffset >= 0}
            style={[s.attNav, monthOffset >= 0 && { opacity: 0.3 }]}>
            <Icon name="chevron-right" size={16} color={C.ink} />
          </Pressable>
        </View>
      </View>
      <View style={[s.attCal, cardShadow]}>
        <View style={{ flexDirection: 'row' }}>
          {tDaysShort().map((d, i) => (
            <Text key={d + i} style={[int(600, 11, { color: C.muted }), { flex: 1, textAlign: 'center' }]}>{d}</Text>
          ))}
        </View>
        {grid.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row', marginTop: 6 }}>
            {week.map((cell, ci) => {
              if (!cell) return <View key={ci} style={{ flex: 1 }} />;
              const isToday = cell.key === today;
              // цвет дня: красный если был пропуск, жёлтый если только опоздания, зелёный если всё посещено
              const col = !cell.total ? null : cell.absent ? C.red : cell.late ? C.yellow : C.green;
              return (
                <View key={ci} style={{ flex: 1, alignItems: 'center' }}>
                  <View style={[
                    s.attCell,
                    col && { backgroundColor: hexRgba(col, 0.16) },
                    isToday && { borderWidth: 1.5, borderColor: C.purple },
                  ]}>
                    <Text style={int(cell.total ? 700 : 400, 13, { color: col || (cell.total ? C.ink : C.muted) })}>
                      {cell.day}
                    </Text>
                  </View>
                  {cell.total ? <View style={[s.attCellDot, { backgroundColor: col }]} /> : <View style={{ height: 5 }} />}
                </View>
              );
            })}
          </View>
        ))}
        {!ATT.monthHasMarks(attendance, viewYear, viewMonth) && (
          <Text style={int(400, 12, { color: C.muted, textAlign: 'center', marginTop: 12 })}>
            {t('attendanceNoData')}
          </Text>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 }}>
        {[[C.green, 'был'], [C.yellow, 'опоздал'], [C.red, 'пропуск']].map(([c, lbl]) => (
          <View key={lbl} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={[s.attDot, { backgroundColor: c }]} />
            <Text style={int(400, 12, { color: C.muted })}>{lbl}</Text>
          </View>
        ))}
      </View>

      {/* По предметам */}
      {st.subjects.length ? (
        <>
          <Text style={s.attSection}>{t('attendanceBySubject')}</Text>
          {st.subjects.map(r => {
            const col = r.percent >= 85 ? C.green : r.percent >= 70 ? C.yellow : C.red;
            return (
              <View key={r.name} style={[s.attSubj, cardShadow]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={[int(600, 14.5), { flex: 1 }]} numberOfLines={1}>{r.name}</Text>
                  <Text style={[int(700, 14, { color: col }), { fontVariant: ['tabular-nums'] }]}>{r.percent}%</Text>
                </View>
                <View style={s.attTrack}>
                  <View style={[s.attFill, { width: `${Math.max(2, r.percent)}%`, backgroundColor: col }]} />
                </View>
                <Text style={int(400, 11.5, { color: C.muted, marginTop: 6 })}>
                  {r.present + r.late} из {r.total} · пропущено {r.absent}
                </Text>
              </View>
            );
          })}
        </>
      ) : null}

      {/* История */}
      {days.length ? (
        <>
          <Text style={s.attSection}>{t('attendanceHistory')}</Text>
          {days.map(d => (
            <View key={d.date} style={[s.attDay, cardShadow]}>
              <Text style={int(600, 13, { color: C.muted, marginBottom: 8 })}>{ATT.humanDate(d.date, months)}</Text>
              {d.marks.map(m => (
                <View key={m.lessonId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                  <Text style={[int(500, 14), { flex: 1 }]} numberOfLines={1}>{m.name || '—'}</Text>
                  <AttendPill status={m.status} />
                </View>
              ))}
            </View>
          ))}
        </>
      ) : !todayLessons.length ? (
        <View style={{ alignItems: 'center', paddingTop: 50 }}>
          <EmptyArt icon="check" />
          <Text style={man(800, 20, { marginTop: 4 })}>{t('attendanceNoData')}</Text>
          <Text style={int(400, 14.5, { color: C.muted, marginTop: 8, textAlign: 'center', lineHeight: 20 })}>{t('attendanceEmptySub')}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

/* ============ Публичный профиль (по ссылке) ============ */
export function PublicProfileScreen({ data, topInset, actions }) {
  if (!data) return null;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('home')} />
        <Text style={man(800, 24)}>{t('publicProfile')}</Text>
      </View>
      <LinearGradient
        colors={themeMode === 'dark' ? ['#262837', '#2C2447', '#1E3A36'] : ['#FFFFFF', '#EFEBFB', '#DFF2ED']}
        start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }}
        style={[s.studCard, cardShadow, { marginTop: 16 }]}>
        <Text style={man(800, 26)}>{data.first_name} {data.last_name}</Text>
        <Text style={int(400, 15, { color: C.muted, marginTop: 3 })}>{t('roleStudent')} · {data.course} {t('statCourse').toLowerCase()}</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {[data.university, data.faculty].filter(Boolean).map(tag => (
            <View key={tag} style={s.studTag}><Text style={int(500, 12, { color: C.muted })} numberOfLines={1}>{tag}</Text></View>
          ))}
        </View>
        {(data.group_title || data.group_name) ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
            <Icon name="users" size={16} color={C.teal} />
            <Text style={int(600, 14)}>{data.group_title || data.group_name}</Text>
          </View>
        ) : null}
      </LinearGradient>
    </ScrollView>
  );
}

/* ============ Админ-панель (CRM внутри приложения) ============ */
function AdminTile({ value, label, color }) {
  return (
    <View style={[s.adminTile, cardShadow]}>
      <Text style={[man(800, 26), { fontVariant: ['tabular-nums'] }]}>{value}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
        <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: color }} />
        <Text style={int(500, 12, { color: C.muted })}>{label}</Text>
      </View>
    </View>
  );
}

export function AdminScreen({ isAdmin, deviceId, data, crashes, busy, asHome, topInset, actions }) {
  const [d, setD] = React.useState({ title: '', date: '', place: '', description: '', color: C.purple, icon: 'ticket', photos: [] });
  if (!isAdmin) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconBtn icon="chevron-left" onPress={() => actions.nav('settings')} />
          <Text style={man(800, 24)}>{tr('Админ-режим')}</Text>
        </View>
        <View style={[s.settingsCard, cardShadow, { marginTop: 18, paddingVertical: 18 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <Icon name="shield" size={18} color={C.purple} />
            <Text style={int(600, 15)}>{tr('Как активировать')}</Text>
          </View>
          <Text style={int(400, 13, { color: C.muted, lineHeight: 20 })}>
            1. Нажмите кнопку ниже — SQL-активация скопируется.{'\n'}
            2. Вставьте её в Supabase → SQL Editor → Run.{'\n'}
            3. Вернитесь и нажмите «Проверить».{'\n\n'}
            ID устройства: {deviceId ? deviceId.slice(0, 8) + '…' : 'нет соединения'}
          </Text>
        </View>
        <PrimaryButton label={tr('Скопировать SQL-активацию')} onPress={actions.adminCopySql} style={{ marginTop: 16 }} />
        <Pressable onPress={actions.adminRecheck} style={{ alignItems: 'center', paddingVertical: 16 }}>
          <Text style={int(600, 15, { color: C.purple })}>{busy ? 'Проверяем…' : 'Проверить доступ'}</Text>
        </Pressable>
      </ScrollView>
    );
  }
  const st = data?.stats || {};
  const publish = () => {
    if (!d.title.trim()) { actions.toast('Введите название'); return; }
    Promise.resolve(actions.adminPublish({ ...d, title: d.title.trim(), date: d.date.trim() || 'Дата уточняется', place: d.place.trim() || 'Место уточняется' }))
      .then(ok => { if (ok !== false) setD({ title: '', date: '', place: '', description: '', color: C.purple, icon: 'ticket', photos: [] }); });
  };
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: asHome ? 120 : 40 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {!asHome && <IconBtn icon="chevron-left" onPress={() => actions.nav('profile')} />}
          <View>
            <Text style={man(800, 24)}>{tr('Админ-панель')}</Text>
            {asHome ? <Text style={int(400, 13, { color: C.muted })}>{tr('ORTA · дашборд')}</Text> : null}
          </View>
        </View>
        <Pressable onPress={actions.adminRefresh} hitSlop={8}>
          <Text style={int(600, 13, { color: C.purple })}>{busy ? '…' : 'Обновить'}</Text>
        </Pressable>
      </View>

      {/* Падения: раньше отчёты некуда было смотреть, теперь они здесь.
          Одинаковые сообщения сгруппированы — важно, скольких людей задело. */}
      <Text style={s.sectionLabel}>{t('crashesTitle')}</Text>
      {!crashes?.length ? (
        <View style={[s.settingsCard, cardShadow, { paddingVertical: 16, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
          <Icon name="check" size={18} color={C.green} />
          <Text style={int(500, 14, { color: C.muted })}>{t('crashesEmpty')}</Text>
        </View>
      ) : crashes.slice(0, 10).map((c, i) => (
        <View key={i} style={[s.attRow, cardShadow, { alignItems: 'flex-start' }]}>
          <View style={[s.attBar, { backgroundColor: C.red }]} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={int(600, 13.5)} numberOfLines={2}>{c.message}</Text>
            <Text style={int(400, 12, { color: C.muted, marginTop: 3 })} numberOfLines={1}>
              {[c.screen && ('экран ' + c.screen), c.version && ('версия ' + c.version), c.platform]
                .filter(Boolean).join(' · ')}
            </Text>
            <Text style={int(400, 11.5, { color: C.muted, marginTop: 2 })}>
              {new Date(c.last).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={man(800, 16, { color: C.red })}>{c.count}</Text>
            <Text style={int(400, 11, { color: C.muted })}>{c.users} чел.</Text>
          </View>
        </View>
      ))}

      {/* Статистика */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 18 }}>
        <AdminTile value={st.users ?? '—'} label={tr('Студентов')} color={C.purple} />
        <AdminTile value={st.groups ?? '—'} label={tr('Групп')} color={C.teal} />
        <AdminTile value={st.posts ?? '—'} label={tr('Постов')} color={C.yellow} />
        <AdminTile value={st.events ?? '—'} label={tr('Событий')} color={C.green} />
      </View>

      {/* Публикация афиши */}
      <View style={[s.settingsCard, cardShadow, { marginTop: 18, paddingVertical: 16 }]}>
        <Text style={man(700, 16, { marginBottom: 4 })}>{tr('Опубликовать афишу для всех')}</Text>
        <Text style={int(400, 12, { color: C.muted, marginBottom: 12 })}>{tr('Появится у каждого пользователя в разделе «Афиша»')}</Text>
        <TextInput style={[s.formInput, cardShadow, int(500, 15), { marginTop: 0 }]} placeholder={tr('Название')} placeholderTextColor={C.dot}
          value={d.title} onChangeText={v => setD(x => ({ ...x, title: v }))} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <TextInput style={[s.formInput, cardShadow, int(500, 15), { flex: 1, marginTop: 0 }]} placeholder={tr('10 сентября, 15:00')} placeholderTextColor={C.dot}
            value={d.date} onChangeText={v => setD(x => ({ ...x, date: v }))} />
          <TextInput style={[s.formInput, cardShadow, int(500, 15), { flex: 1, marginTop: 0 }]} placeholder={tr('Место')} placeholderTextColor={C.dot}
            value={d.place} onChangeText={v => setD(x => ({ ...x, place: v }))} />
        </View>
        <TextInput style={[s.formInput, cardShadow, int(500, 15), { height: 100, paddingTop: 14, textAlignVertical: 'top', marginTop: 10 }]}
          placeholder={tr('Описание события (необязательно)')} placeholderTextColor={C.dot} multiline
          value={d.description} onChangeText={v => setD(x => ({ ...x, description: v }))} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {[C.purple, C.red, C.yellow, C.green, C.blue, C.teal].map(c => (
            <Pressable key={c} onPress={() => setD(x => ({ ...x, color: c }))}
              style={[{ width: 34, height: 34, borderRadius: 999, backgroundColor: c, borderWidth: 3, borderColor: 'transparent' }, d.color === c && { borderColor: C.card }]} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {['ticket', 'megaphone', 'music', 'code', 'graduation-cap', 'dumbbell', 'palette', 'briefcase'].map(ic => (
            <Pressable key={ic} onPress={() => setD(x => ({ ...x, icon: ic }))}
              style={[{ width: 42, height: 42, borderRadius: 14, backgroundColor: C.chipBg, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' }, d.icon === ic && { borderColor: C.purple }]}>
              <Icon name={ic} size={18} color={d.icon === ic ? C.purple : C.ink} />
            </Pressable>
          ))}
        </View>
        <Text style={int(600, 13, { color: C.muted, marginTop: 14, marginBottom: 8, marginLeft: 4 })}>
          Фото ({(d.photos || []).length}/5)
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {(d.photos || []).map((uri, i) => (
            <Pressable key={uri + i} onLongPress={() => setD(x => ({ ...x, photos: x.photos.filter((_, j) => j !== i) }))}>
              <Image source={{ uri }} style={{ width: 76, height: 76, borderRadius: 14 }} />
            </Pressable>
          ))}
          {(d.photos || []).length < 5 && (
            <Pressable onPress={() => actions.adminPickPhotos(d.photos || [], ph => setD(x => ({ ...x, photos: ph })))}
              style={{ width: 76, height: 76, borderRadius: 14, backgroundColor: C.chipBg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="plus" size={22} color={C.purple} />
            </Pressable>
          )}
        </ScrollView>
        <Text style={int(400, 11, { color: C.muted, marginTop: 6, marginLeft: 4 })}>{tr('Долгое нажатие — убрать фото')}</Text>
        <PrimaryButton label={busy ? 'Публикуем…' : 'Опубликовать'} onPress={publish} style={{ marginTop: 14 }} />
      </View>

      {/* Общие события */}
      <Text style={s.sectionLabel}>{tr('События в афише')}</Text>
      <View style={{ gap: 10 }}>
        {(data?.events || []).map(e => (
          <View key={e.id} style={[s.adminRow, cardShadow]}>
            <View style={{ width: 8, height: 8, borderRadius: 99, backgroundColor: e.color, marginTop: 6 }} />
            <View style={{ flex: 1 }}>
              <Text style={int(600, 14)} numberOfLines={1}>{e.title}</Text>
              <Text style={int(400, 12, { color: C.muted })} numberOfLines={1}>{e.date_text} · {e.place} · {e.user_id ? 'личная' : 'для всех'}</Text>
            </View>
            {!e.user_id && (
              <Pressable onPress={() => actions.adminDelete(e.id)} hitSlop={8}>
                <Text style={int(600, 12, { color: C.red })}>{tr('Удалить')}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      {/* Последние студенты */}
      <Text style={s.sectionLabel}>{tr('Последние студенты')}</Text>
      <View style={[s.settingsCard, cardShadow]}>
        {(data?.profiles || []).map((p, i) => (
          <Pressable key={p.id} onPress={() => actions.adminOpenStudent(p)}
            style={[{ paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, i < (data.profiles.length - 1) && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={int(600, 14)}>{p.first_name} {p.last_name}</Text>
              <Text style={int(400, 12, { color: C.muted })} numberOfLines={1}>{p.university}{p.group_name ? ' · ' + p.group_name : ''} · {p.course} курс</Text>
            </View>
            <Icon name="chevron-right" size={16} color={C.dot} />
          </Pressable>
        ))}
        {!(data?.profiles || []).length && <Text style={int(400, 13, { color: C.muted, paddingVertical: 10 })}>{tr('Пока никого')}</Text>}
      </View>

      {/* Группы */}
      <Text style={s.sectionLabel}>{tr('Группы')}</Text>
      <View style={[s.settingsCard, cardShadow]}>
        {(data?.groups || []).map((g, i) => (
          <View key={g.id} style={[{ paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, i < (data.groups.length - 1) && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={int(600, 14)}>{g.name}</Text>
              <Text style={int(400, 12, { color: C.muted })} numberOfLines={1}>{g.university}</Text>
            </View>
            <Text style={[int(600, 13, { color: C.purple }), { letterSpacing: 1.5 }]}>{g.code}</Text>
          </View>
        ))}
        {!(data?.groups || []).length && <Text style={int(400, 13, { color: C.muted, paddingVertical: 10 })}>{tr('Пока нет групп')}</Text>}
      </View>

      {/* Форум */}
      <Text style={s.sectionLabel}>{tr('Последние посты форумов')}</Text>
      <View style={[s.settingsCard, cardShadow]}>
        {(data?.posts || []).map((p, i) => (
          <View key={p.id} style={[{ paddingVertical: 10 }, i < (data.posts.length - 1) && { borderBottomWidth: 1, borderBottomColor: C.border }]}>
            <Text style={int(600, 13)}>{p.author} <Text style={int(400, 12, { color: C.muted })}>· {p.group_key}</Text></Text>
            <Text style={int(400, 13, { color: C.muted, marginTop: 2 })} numberOfLines={2}>{p.body}</Text>
          </View>
        ))}
        {!(data?.posts || []).length && <Text style={int(400, 13, { color: C.muted, paddingVertical: 10 })}>{tr('Пока пусто')}</Text>}
      </View>
    </ScrollView>
  );
}

/* ============ Админ: расписание студента ============ */
export function AdminStudentScreen({ data, topInset, actions }) {
  if (!data) return null;
  const p = data.profile || {};
  const sched = data.schedule || [[], [], [], [], [], []];
  const days = tDaysFull();
  const total = sched.flat().length;
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: topInset + 8, paddingHorizontal: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <IconBtn icon="chevron-left" onPress={() => actions.nav('home')} />
        <View style={{ flex: 1 }}>
          <Text style={man(800, 22)} numberOfLines={1}>{p.first_name} {p.last_name}</Text>
          <Text style={int(400, 13, { color: C.muted })} numberOfLines={1}>{p.university}{p.group_name ? ' · ' + p.group_name : ''} · {p.course} курс</Text>
        </View>
      </View>
      {total === 0 ? (
        <View style={{ alignItems: 'center', paddingTop: 70 }}>
          <EmptyArt />
          <Text style={man(800, 20)}>{tr('Расписание не загружено')}</Text>
          <Text style={int(400, 14, { color: C.muted, marginTop: 6, textAlign: 'center' })}>{tr('Студент ещё не синхронизировал пары с облаком.')}</Text>
        </View>
      ) : sched.map((day, di) => day.length ? (
        <View key={di} style={{ marginTop: 18 }}>
          <Text style={man(700, 15, { marginBottom: 10, marginLeft: 4 })}>{days[di]} · {tPlural(day.filter(l => !l.cancelled).length, 'pairForms')}</Text>
          <View style={{ gap: 10 }}>
            {day.map(l => <LessonCard key={l.id} l={l} now={false} onPress={() => actions.toast(`${l.name} · ${l.start}–${l.end} · ауд. ${l.room}`)} />)}
          </View>
        </View>
      ) : null)}
    </ScrollView>
  );
}

/* ============ Событие афиши (детали) ============ */
export function EventScreen({ event, topInset, actions }) {
  if (!event) return null;
  const photos = event.photos || [];
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View>
        {photos[0] ? (
          <Image source={{ uri: photos[0] }} style={{ width: '100%', height: 320 }} />
        ) : (
          <View style={{ width: '100%', height: 220, backgroundColor: event.color, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={event.icon} size={64} color="rgba(255,255,255,.9)" />
          </View>
        )}
        <Pressable onPress={() => actions.nav('afisha')} style={[s.eventBack, { top: topInset + 8 }]}>
          <Icon name="chevron-left" size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={s.eventSheet}>
        <Text style={man(800, 26, { lineHeight: 32 })}>{event.title}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <View style={[s.eventIcoSmall, { backgroundColor: hexRgba(event.color, 0.14) }]}>
            <Icon name="calendar-days" size={18} color={event.color} />
          </View>
          <Text style={int(500, 16)}>{event.date}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <View style={[s.eventIcoSmall, { backgroundColor: hexRgba(event.color, 0.14) }]}>
            <Icon name="map-pin" size={18} color={event.color} />
          </View>
          <Text style={int(500, 16, { flex: 1 })}>{event.place}</Text>
        </View>

        {event.description ? (
          <>
            <Text style={man(700, 18, { marginTop: 26 })}>{tr('О событии')}</Text>
            <Text style={int(400, 15, { color: C.muted, marginTop: 10, lineHeight: 23 })}>{event.description}</Text>
          </>
        ) : null}

        {photos.length > 1 ? (
          <>
            <Text style={man(700, 18, { marginTop: 26, marginBottom: 12 })}>{tr('Фотографии')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {photos.slice(1).map((uri, i) => (
                <Pressable key={uri + i} onPress={() => actions.viewPhoto && actions.viewPhoto(uri)}>
                  <Image source={{ uri }} style={{ width: 160, height: 120, borderRadius: 16 }} />
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        <PrimaryButton label={tr('Поделиться событием')} style={{ marginTop: 26 }}
          onPress={() => actions.shareEvent(event)} />
        {!event.custom && !event.official ? (
          <Pressable onPress={() => actions.reportEvent(event)} hitSlop={8} style={{ alignSelf: 'center', marginTop: 16, paddingVertical: 6 }}>
            <Text style={int(600, 14, { color: C.red })}>{tr('Пожаловаться')}</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
}

/* ============ Загрузка (скелетон) ============ */
export function LoadingScreen({ topInset }) {
  return (
    <View style={{ flex: 1, paddingTop: topInset + 8, paddingHorizontal: 20 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Skel w={110} h={14} />
          <Skel w={90} h={26} style={{ marginTop: 8 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Skel w={40} h={40} r={999} />
          <Skel w={40} h={40} r={999} />
        </View>
      </View>
      <Skel w="100%" h={150} r={24} style={{ marginTop: 22 }} />
      <Skel w={120} h={20} style={{ marginTop: 24, marginBottom: 12 }} />
      <View style={{ gap: 12 }}>
        <Skel w="100%" h={84} r={20} />
        <Skel w="100%" h={84} r={20} />
        <Skel w="100%" h={84} r={20} />
        <Skel w="100%" h={84} r={20} />
      </View>
    </View>
  );
}

const makeS = () => StyleSheet.create({
  onbHero: { height: 300, marginTop: 24, marginBottom: 8 },
  onbCard: { position: 'absolute', width: 150, height: 190, borderRadius: 24, ...sh(C.ink, 0.1, 24, 8, 4) },
  onbCenter: { position: 'absolute', alignSelf: 'center', top: 60, width: 170, height: 220, backgroundColor: C.purple, borderRadius: 26, justifyContent: 'space-between', padding: 20 },
  onbIco: { width: 48, height: 48, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center' },
  onbDots: { flexDirection: 'row', gap: 6, justifyContent: 'center', marginTop: 20 },
  onbDot: { width: 6, height: 6, borderRadius: 999, backgroundColor: C.dot },
  onbMini: { width: 150, height: 190, borderRadius: 24, padding: 16, justifyContent: 'space-between' },
  onbMiniIco: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center' },
  heroLogo: { width: 100, height: 98 },

  backLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, alignSelf: 'flex-start' },
  progress: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 28 },
  progressSeg: { flex: 1, height: 5, borderRadius: 999, backgroundColor: C.border },
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 28 },
  pickCard: { width: '48%', height: 96, backgroundColor: C.card, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  pickRow: { backgroundColor: C.card, borderRadius: 20, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 2, borderColor: 'transparent' },
  pickCheck: { width: 22, height: 22, borderRadius: 999, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },

  plusBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },
  subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, marginTop: 14, justifyContent: 'space-between' },

  dayPlus: { width: 44, height: 64, borderRadius: 999, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },
  dayPill: { flex: 1, height: 64, borderRadius: 999, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', gap: 2 },

  detailHead: { borderBottomLeftRadius: 28, borderBottomRightRadius: 28, paddingHorizontal: 24 },
  dhBack: { width: 40, height: 40, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.2)', alignItems: 'center', justifyContent: 'center' },
  dhBadge: { width: 44, height: 44, borderRadius: 999, backgroundColor: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center' },
  infoCard: { backgroundColor: C.card, borderRadius: 24, paddingVertical: 6, paddingHorizontal: 18 },
  miniAva: { width: 26, height: 26, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  soonPill: { backgroundColor: C.chipBg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },

  notif: { borderRadius: 20, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  ntIco: { width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  ntDot: { width: 8, height: 8, borderRadius: 999, marginTop: 6 },

  avatarXl: { width: 80, height: 80, borderRadius: 999, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { ...int(600, 13, { color: C.muted }), marginTop: 22, marginBottom: 10, marginLeft: 4 },
  settingsCard: { backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 4 },
  settingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  seg: { flexDirection: 'row', gap: 6, backgroundColor: C.bg, borderRadius: 14, padding: 4 },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 11 },
  segActive: { backgroundColor: C.card },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 18, height: 48, marginTop: 16 },
  formLabel: { ...int(600, 13, { color: C.muted }), marginLeft: 4, marginTop: 10 },
  formInput: { height: 52, backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 16, marginTop: 8 },

  eventCard: { borderRadius: 24, backgroundColor: C.card, overflow: 'hidden' },
  eventCover: { width: '100%', height: 190 },
  eventCount: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,.55)', borderRadius: 999, paddingVertical: 4, paddingHorizontal: 10 },
  eventBack: { position: 'absolute', left: 16, width: 40, height: 40, borderRadius: 999, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center' },
  eventSheet: { backgroundColor: C.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, marginTop: -28, paddingTop: 24, paddingHorizontal: 20 },
  eventIcoSmall: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  eventIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center' },
  eventDel: { backgroundColor: 'rgba(255,255,255,.18)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 12 },

  aiBadge: { width: 44, height: 44, borderRadius: 999, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },
  aiIntro: { backgroundColor: C.card, borderRadius: 20, padding: 16 },
  bubble: { maxWidth: '82%', borderRadius: 20, paddingVertical: 11, paddingHorizontal: 15 },
  bubbleUser: { alignSelf: 'flex-end', backgroundColor: C.purple, borderBottomRightRadius: 6 },
  bubbleAi: { alignSelf: 'flex-start', backgroundColor: C.card, borderBottomLeftRadius: 6 },
  aiSug: { backgroundColor: C.card, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15 },
  aiInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20 },
  aiInput: { flex: 1, height: 48, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 18 },
  aiSend: { width: 48, height: 48, borderRadius: 999, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },

  forumPost: { backgroundColor: C.card, borderRadius: 20, padding: 14 },
  noteCard: { backgroundColor: C.card, borderRadius: 20, padding: 14, flexDirection: 'row', gap: 12 },
  noteBar: { width: 4, borderRadius: 999 },
  calCard: { backgroundColor: C.card, borderRadius: 24, padding: 14 },
  calNav: { width: 32, height: 32, borderRadius: 999, backgroundColor: C.chipBg, alignItems: 'center', justifyContent: 'center' },
  calCell: { width: '14.28%', alignItems: 'center', paddingVertical: 4 },
  calDay: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  forumAva: { width: 26, height: 26, borderRadius: 999, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },
  forumInput: { flex: 1, height: 48, backgroundColor: C.card, borderRadius: 999, paddingHorizontal: 18 },
  forumSend: { width: 48, height: 48, borderRadius: 999, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },

  examCard: { backgroundColor: C.card, borderRadius: 20, padding: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  examDate: { width: 64, height: 60, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  examTag: { borderRadius: 999, paddingVertical: 3, paddingHorizontal: 9 },

  bigCard: { marginTop: 16, backgroundColor: C.purple, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  roundIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,.22)', alignItems: 'center', justifyContent: 'center' },
  dossChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.card, borderRadius: 999, paddingVertical: 9, paddingHorizontal: 15 },
  dossRadar: { height: 320, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  dossMe: { width: 84, height: 84, borderRadius: 999, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },
  dossPeer: { position: 'absolute', top: 14, right: 34, backgroundColor: C.card, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  dossPeerAva: { width: 44, height: 44, borderRadius: 999, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' },
  dossDone: { width: 56, height: 56, borderRadius: 999, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  examPill: { alignSelf: 'flex-start', backgroundColor: C.card, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, marginTop: 18 },
  examCounter: { backgroundColor: C.purple, borderRadius: 24, padding: 18, alignItems: 'center', marginBottom: 14 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14 },
  gtaskTag: { backgroundColor: 'rgba(47,168,160,.14)', borderRadius: 999, paddingVertical: 2, paddingHorizontal: 7 },
  gtaskPhoto: { width: 84, height: 84, borderRadius: 12, backgroundColor: C.chipBg },
  taskCheck: { width: 24, height: 24, borderRadius: 999, borderWidth: 2, borderColor: C.dot, alignItems: 'center', justifyContent: 'center' },
  studCard: { borderRadius: 28, padding: 22, marginTop: 8, alignItems: 'flex-start' },
  studShare: { position: 'absolute', top: 20, right: 20, zIndex: 2 },
  mailPill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', backgroundColor: C.chipBg, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 11, marginTop: 10, maxWidth: '100%' },
  studTag: { backgroundColor: C.card, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, maxWidth: 220 },
  studStats: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch', marginTop: 18 },
  studStat: { flex: 1, alignItems: 'center' },
  studDivider: { width: 1, height: 30, backgroundColor: C.border },
  studBtn: { flex: 1, height: 54, borderRadius: 999, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  studRound: { width: 54, height: 54, borderRadius: 999, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' },
  groupCard: { marginTop: 16, backgroundColor: C.teal, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupHero: { backgroundColor: C.teal, borderRadius: 24, padding: 20, alignItems: 'center', marginTop: 18 },
  groupOption: { backgroundColor: C.card, borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  coinHero: { borderRadius: 28, padding: 24, alignItems: 'center', marginTop: 18 },
  coinStreak: { backgroundColor: 'rgba(255,255,255,.2)', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, marginTop: 12 },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 10 },
  coinIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  attHero: { flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: C.card, borderRadius: 24, padding: 20, marginTop: 18 },
  attDot: { width: 8, height: 8, borderRadius: 99 },
  attSection: { ...int(700, 13, { color: C.muted }), letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 24, marginBottom: 10 },
  attRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 10, overflow: 'hidden' },
  attBar: { width: 4, alignSelf: 'stretch', borderRadius: 4 },
  attBtn: { width: 38, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  attPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  attSubj: { backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 10 },
  attTrack: { height: 6, borderRadius: 3, backgroundColor: C.chipBg, marginTop: 10, overflow: 'hidden' },
  attFill: { height: '100%', borderRadius: 3 },
  attDay: { backgroundColor: C.card, borderRadius: 18, padding: 14, marginBottom: 10 },
  markBtn: { width: 36, height: 36, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  tpBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: hexRgba(C.purple, 0.12), borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  tpCard: { backgroundColor: C.card, borderRadius: 18, padding: 16 },
  tpBar: { flexDirection: 'row', height: 10, borderRadius: 999, overflow: 'hidden', backgroundColor: C.chipBg, gap: 2 },
  tpDot: { width: 8, height: 8, borderRadius: 999 },
  tsAvatar: { width: 40, height: 40, borderRadius: 14, backgroundColor: hexRgba(C.purple, 0.12), alignItems: 'center', justifyContent: 'center' },
  delBtn: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  dangerBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: 999, backgroundColor: hexRgba(MARK_STYLE.absent.color, 0.1), borderWidth: 1, borderColor: hexRgba(MARK_STYLE.absent.color, 0.25) },
  trTab: { flex: 1, height: 38, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: C.card, borderWidth: 1, borderColor: C.border },
  tpGrade: { width: 34, height: 34, borderRadius: 12, backgroundColor: hexRgba(C.purple, 0.12), alignItems: 'center', justifyContent: 'center' },
  gradeBtn: { width: 34, height: 34, borderRadius: 999, backgroundColor: C.chipBg, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  gradeValue: { width: 46, height: 46, borderRadius: 16, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center' },
  countPill: { flex: 1, alignItems: 'center', borderRadius: 16, paddingVertical: 10 },
  attCal: { backgroundColor: C.card, borderRadius: 20, padding: 14 },
  attCell: { width: 32, height: 32, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  attCellDot: { width: 5, height: 5, borderRadius: 99, marginTop: 3 },
  attNav: { width: 28, height: 28, borderRadius: 999, backgroundColor: C.chipBg, alignItems: 'center', justifyContent: 'center' },
  startCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.teal, borderRadius: 22, padding: 18, marginTop: 26 },
  qrCard: { backgroundColor: C.card, borderRadius: 24, padding: 18, alignItems: 'center', marginTop: 16 },
  qrBox: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginTop: 12, alignSelf: 'stretch', alignItems: 'center' },
  scanRoot: { flex: 1, backgroundColor: '#0B0912' },
  scanHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 10 },
  scanFrame: { width: 250, height: 250, borderRadius: 20, overflow: 'hidden' },
  scanCorner: { position: 'absolute', width: 42, height: 42, borderWidth: 4, borderColor: '#fff' },
  scanLine: { position: 'absolute', left: 14, right: 14, height: 2, borderRadius: 2, backgroundColor: '#5FE3C0' },
  adminTile: { width: '47.8%', backgroundColor: C.card, borderRadius: 20, padding: 16 },
  adminRow: { backgroundColor: C.card, borderRadius: 16, padding: 12, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
});

let s = makeS();
onThemeChange(() => { s = makeS(); });

/* ============ Обязательное обновление ============ */
export function UpdateScreen({ current, latest, message, storeUrl, topInset, onOpen }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, paddingTop: topInset }}>
      <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: C.purple, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <Icon name="refresh-cw" size={44} color="#fff" />
      </View>
      <Text style={man(800, 26, { textAlign: 'center' })}>{tr('Обновите ORTA')}</Text>
      <Text style={int(400, 15, { color: C.muted, textAlign: 'center', marginTop: 12, lineHeight: 22 })}>
        {message || tr('Вышла новая версия. Чтобы расписание, группа и афиша работали правильно, обновите приложение.')}
      </Text>
      <Text style={int(500, 13, { color: C.dot, marginTop: 14 })}>{tr('У вас')} {current} · {tr('доступна')} {latest}</Text>
      <PrimaryButton label={tr('Обновить в App Store')} style={{ marginTop: 28, alignSelf: 'stretch' }} onPress={onOpen} />
    </View>
  );
}
