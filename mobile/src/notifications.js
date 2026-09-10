// Локальные напоминания о парах: «за N минут до начала», каждую неделю.
// Работают без сервера; в Expo Go доступны на iOS.
import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let scheduling = false;

/* Категория с кнопками прямо в уведомлении: студент отмечается, не открывая приложение. */
export const ATTEND_CATEGORY = 'orta-attendance';
export const ATTEND_PRESENT = 'attend-present';
export const ATTEND_ABSENT = 'attend-absent';

let categoryReady = false;
async function ensureAttendCategory() {
  if (categoryReady) return;
  try {
    await Notifications.setNotificationCategoryAsync(ATTEND_CATEGORY, [
      { identifier: ATTEND_PRESENT, buttonTitle: 'Пришёл', options: { opensAppToForeground: false } },
      { identifier: ATTEND_ABSENT, buttonTitle: 'Не был', options: { opensAppToForeground: false } },
    ]);
    categoryReady = true;
  } catch (e) {}
}

export async function rescheduleLessonReminders(schedule, minutesBefore, askAttendance = true) {
  if (scheduling) return;
  scheduling = true;
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (status !== 'granted') return;
    await ensureAttendCategory();
    const mins = Number(minutesBefore) || 15;
    const weekly = (weekday, hour, minute) => ({
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday, hour, minute,
    });
    const plural = (n, a, b, c) => {
      const m10 = n % 10, m100 = n % 100;
      return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c;
    };

    for (let day = 0; day < 6; day++) {
      const lessons = ((schedule && schedule[day]) || []).filter(l => !l.cancelled);

      // Напоминание перед каждой парой
      for (const l of lessons) {
        const [h, m] = String(l.start).split(':').map(Number);
        if (isNaN(h) || isNaN(m)) continue;
        let total = h * 60 + m - mins;
        if (total < 0) total += 24 * 60;
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'ORTA',
            body: `Через ${mins} минут ${l.name}${l.room && l.room !== '—' ? ', ауд. ' + l.room : ''}`,
          },
          trigger: weekly(day + 2, Math.floor(total / 60), total % 60), // 1=Вс, 2=Пн … 7=Сб
        });
      }

      // Отметка о посещении: через 10 минут после начала пары, две кнопки прямо в уведомлении
      if (askAttendance) {
        for (const l of lessons) {
          const [h, m] = String(l.start).split(':').map(Number);
          if (isNaN(h) || isNaN(m)) continue;
          const total = (h * 60 + m + 10) % (24 * 60);
          await Notifications.scheduleNotificationAsync({
            content: {
              title: `${l.name} · ${l.start}`,
              body: 'Ты на паре? Отметься — попадёт в твой журнал посещаемости',
              categoryIdentifier: ATTEND_CATEGORY,
              data: { kind: 'attendance', lessonId: l.id, lessonName: l.name, day },
            },
            trigger: weekly(day + 2, Math.floor(total / 60), total % 60),
          });
        }
      }

      if (!lessons.length) continue;
      const count = `${lessons.length} ${plural(lessons.length, 'пара', 'пары', 'пар')}`;

      // Утренняя сводка в 7:30 в день пар
      await Notifications.scheduleNotificationAsync({
        content: { title: 'ORTA · сегодня', body: `${count}, первая в ${lessons[0].start} — ${lessons[0].name}` },
        trigger: weekly(day + 2, 7, 30),
      });

      // Вечерняя сводка накануне в 20:30 (Пн → уведомление в Вс и т.д.)
      const eveWeekday = day + 1 === 1 ? 8 : day + 1; // день перед day: iOS weekday = day+2-1
      await Notifications.scheduleNotificationAsync({
        content: { title: 'ORTA · завтра', body: `${count}, первая в ${lessons[0].start}. Не забудь собраться 🎒` },
        trigger: weekly(eveWeekday > 7 ? 1 : eveWeekday, 20, 30),
      });
    }
  } catch (e) {
    // нет разрешения или платформа не поддерживает — просто молчим
  } finally {
    scheduling = false;
  }
}

/* Токен устройства для пуш-уведомлений (нужен в TestFlight/App Store) */
export async function registerPushToken(projectId) {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return null;
    const res = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return res?.data || null;
  } catch (e) {
    return null;
  }
}
