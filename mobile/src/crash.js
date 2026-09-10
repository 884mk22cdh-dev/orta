// Ловля падений.
//
// Без этого одна ошибка в любом экране даёт белый экран, из которого
// не выйти, а мы о ней никогда не узнаём — человек просто удаляет
// приложение. Здесь три слоя:
//   1. ErrorBoundary — вместо белого экрана понятная страница с кнопкой;
//   2. глобальный перехватчик — ошибки вне отрисовки (таймеры, ответы сервера);
//   3. отправка отчёта на сервер, чтобы падения было видно в админке.

import React from 'react';
import { View, Text, Pressable, ScrollView, Platform } from 'react-native';
import Constants from 'expo-constants';
import { C, man, int, cardShadow } from './theme';
import { t } from './i18n';
import { reportCrash } from './backend';

const VERSION = Constants.expoConfig?.version || '?';

// Экран, на котором человек был в момент падения — подставляет App.js
let currentScreen = '';
export function setCrashScreen(name) { currentScreen = String(name || ''); }

// Одно и то же сообщение не шлём чаще раза в минуту: при ошибке в цикле
// отрисовки React зовёт обработчик десятки раз подряд.
const recent = new Map();
function tooOften(message) {
  const now = Date.now();
  for (const [k, at] of recent) if (now - at > 60000) recent.delete(k);
  if (recent.has(message)) return true;
  recent.set(message, now);
  return false;
}

export async function sendCrash(error, isFatal = true) {
  try {
    const message = String(error?.message || error || 'неизвестная ошибка').slice(0, 500);
    if (tooOften(message)) return;
    await reportCrash({
      message,
      stack: String(error?.stack || '').slice(0, 4000),
      screen: currentScreen,
      version: VERSION,
      platform: Platform.OS,
      fatal: !!isFatal,
    });
  } catch {
    // отчёт о падении не должен ронять приложение сам
  }
}

/** Ошибки вне отрисовки: таймеры, промисы, обработчики ответов. */
export function installGlobalHandler() {
  const g = global;
  if (g.__ortaCrashInstalled) return;
  g.__ortaCrashInstalled = true;

  if (typeof g.ErrorUtils?.getGlobalHandler === 'function') {
    const prev = g.ErrorUtils.getGlobalHandler();
    g.ErrorUtils.setGlobalHandler((e, isFatal) => {
      sendCrash(e, isFatal);
      if (prev) prev(e, isFatal);   // красный экран в разработке остаётся
    });
  }
}

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) { return { error }; }

  componentDidCatch(error, info) {
    sendCrash({ message: error?.message, stack: `${error?.stack || ''}\n${info?.componentStack || ''}` }, true);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const msg = String(this.state.error?.message || '');
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', paddingHorizontal: 28 }}>
        <Text style={{ fontSize: 46, textAlign: 'center', marginBottom: 12 }}>🙈</Text>
        <Text style={man(800, 24, { textAlign: 'center' })}>{t('crashTitle')}</Text>
        <Text style={int(400, 15, { color: C.muted, textAlign: 'center', marginTop: 10, lineHeight: 22 })}>
          {t('crashText')}
        </Text>
        <Pressable onPress={() => this.setState({ error: null })}
          style={({ pressed }) => [{
            height: 54, borderRadius: 999, backgroundColor: C.purple,
            alignItems: 'center', justifyContent: 'center', marginTop: 26,
          }, cardShadow, pressed && { opacity: 0.85 }]}>
          <Text style={man(700, 16, { color: '#fff' })}>{t('crashRetry')}</Text>
        </Pressable>
        {__DEV__ && !!msg && (
          <ScrollView style={{ maxHeight: 160, marginTop: 20 }}>
            <Text style={int(400, 11, { color: C.muted })}>{msg}</Text>
          </ScrollView>
        )}
      </View>
    );
  }
}
