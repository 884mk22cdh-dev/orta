// Дизайн-токены из «Расписание студента.dc.html» + тёмная тема
export const LIGHT = {
  purple: '#6C4FE0',
  purpleDark: '#5a3fd0',
  red: '#F4564E',
  yellow: '#F2B23E',
  green: '#3DB96B',
  blue: '#3E9BF0',
  teal: '#22B8A6',
  ink: '#14161C',
  bg: '#F1F2F6',
  card: '#FFFFFF',
  canvas: '#DEE0E8',
  muted: '#8A8D99',
  border: '#E6E7EC',
  dot: '#C9CBD4',
  chipBg: '#EEF0F4',
  white: '#fff',
};

export const DARK = {
  ...LIGHT,
  ink: '#F2F3F7',
  bg: '#15161C',
  card: '#20222B',
  canvas: '#0F1014',
  muted: '#8F93A3',
  border: '#2C2E39',
  dot: '#3D4050',
  chipBg: '#2A2C37',
};

// Текущая палитра — мутируется при смене темы, компоненты читают её при рендере
export const C = { ...LIGHT };

const listeners = [];
export const onThemeChange = f => listeners.push(f);
export let themeMode = 'light';
export function applyTheme(mode) {
  themeMode = mode === 'dark' ? 'dark' : 'light';
  Object.assign(C, themeMode === 'dark' ? DARK : LIGHT);
  listeners.forEach(f => f());
}

const MANROPE = { 600: 'Manrope_600SemiBold', 700: 'Manrope_700Bold', 800: 'Manrope_800ExtraBold' };
const INTER = { 400: 'Inter_400Regular', 500: 'Inter_500Medium', 600: 'Inter_600SemiBold', 700: 'Inter_700Bold' };

// man(800, 28) ≈ font:800 28px 'Manrope' — цвет берётся из C в момент рендера
export const man = (w, size, extra = {}) => ({ fontFamily: MANROPE[w], fontSize: size, color: C.ink, ...extra });
export const int = (w, size, extra = {}) => ({ fontFamily: INTER[w], fontSize: size, color: C.ink, ...extra });

// Тень: sh('#000', .06, 24, 8) ≈ box-shadow:0 8px 24px rgba(0,0,0,.06)
export const sh = (color, opacity, blur, y, elevation = 4) => ({
  shadowColor: color,
  shadowOpacity: opacity,
  shadowRadius: blur / 2,
  shadowOffset: { width: 0, height: y },
  elevation,
});

export const cardShadow = sh('#14161C', 0.06, 24, 8, 3);

export function hexRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
