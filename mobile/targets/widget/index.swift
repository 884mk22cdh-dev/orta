import WidgetKit
import SwiftUI

private let GROUP = "group.kz.orta.app"

// Пара в том виде, в каком её кладёт приложение (src/widget.js → compactWeek)
struct WLesson: Codable {
  let n: String            // название
  let s: String            // начало «08:00»
  let e: String?           // конец
  let r: String?           // аудитория
  let t: String?           // преподаватель
}

struct Shown {
  let name: String
  let time: String
  let room: String
  let teacher: String
  let when: String         // «сегодня» / «завтра» / «в пятницу»
  let hasData: Bool
}

private let WEEKDAY_IN = ["в понедельник", "во вторник", "в среду", "в четверг", "в пятницу", "в субботу"]

/// Всю неделю берём из App Group и считаем ближайшую пару здесь, а не в приложении —
/// тогда виджет остаётся верным, даже если ORTA не открывали несколько дней.
func loadWeek() -> [[WLesson]] {
  guard let d = UserDefaults(suiteName: GROUP),
        let raw = d.string(forKey: "schedule_json"),
        let data = raw.data(using: .utf8),
        let week = try? JSONDecoder().decode([[WLesson]].self, from: data)
  else { return [] }
  return week
}

func appEverOpened() -> Bool {
  UserDefaults(suiteName: GROUP)?.string(forKey: "updated_at") != nil
}

/// Минуты с полуночи из «08:00»
func minutes(_ hhmm: String) -> Int {
  let p = hhmm.split(separator: ":")
  guard p.count >= 2, let h = Int(p[0]), let m = Int(p[1]) else { return -1 }
  return h * 60 + m
}

/// Понедельник = 0 … воскресенье = 6
func mondayIndex(_ date: Date) -> Int {
  (Calendar.current.component(.weekday, from: date) + 5) % 7
}

/// Ближайшая пара относительно момента `now`
func nextLesson(_ week: [[WLesson]], at now: Date) -> Shown {
  let empty = week.allSatisfy { $0.isEmpty }
  if empty {
    return Shown(name: appEverOpened() ? "Расписание пусто" : "Откройте ORTA",
                 time: "", room: "", teacher: "", when: "", hasData: false)
  }

  let today = mondayIndex(now)
  let cal = Calendar.current
  let mins = cal.component(.hour, from: now) * 60 + cal.component(.minute, from: now)

  func shown(_ l: WLesson, _ when: String) -> Shown {
    Shown(name: l.n, time: l.s, room: l.r ?? "", teacher: l.t ?? "", when: when, hasData: true)
  }

  if today <= 5, today < week.count {
    if let l = week[today].first(where: { minutes($0.s) > mins }) {
      return shown(l, "сегодня")
    }
  }
  for i in 1...7 {
    let d = (today + i) % 7
    if d > 5 || d >= week.count || week[d].isEmpty { continue }
    return shown(week[d][0], i == 1 ? "завтра" : WEEKDAY_IN[d])
  }
  return Shown(name: "Пар больше нет", time: "", room: "", teacher: "", when: "", hasData: false)
}

/// Моменты, когда виджету надо перерисоваться: начала ближайших пар (плюс минута).
func refreshPoints(_ week: [[WLesson]], from now: Date) -> [Date] {
  var out: [Date] = []
  let cal = Calendar.current
  for dayOffset in 0...7 {
    guard let base = cal.date(byAdding: .day, value: dayOffset, to: now) else { continue }
    let d = mondayIndex(base)
    if d > 5 || d >= week.count { continue }
    for l in week[d] {
      let m = minutes(l.s)
      if m < 0 { continue }
      var c = cal.dateComponents([.year, .month, .day], from: base)
      c.hour = m / 60
      c.minute = m % 60
      if let t = cal.date(from: c), t > now.addingTimeInterval(60) {
        out.append(t.addingTimeInterval(60))
      }
    }
    if out.count >= 12 { break }
  }
  return Array(out.sorted().prefix(12))
}

struct Entry: TimelineEntry {
  let date: Date
  let lesson: Shown
}

struct Provider: TimelineProvider {
  func placeholder(in context: Context) -> Entry {
    Entry(date: Date(), lesson: Shown(name: "Математика", time: "09:00", room: "214",
                                      teacher: "Айгүль С.", when: "сегодня", hasData: true))
  }
  func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
    let week = loadWeek()
    completion(Entry(date: Date(), lesson: nextLesson(week, at: Date())))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
    let now = Date()
    let week = loadWeek()
    var entries = [Entry(date: now, lesson: nextLesson(week, at: now))]
    for point in refreshPoints(week, from: now) {
      entries.append(Entry(date: point, lesson: nextLesson(week, at: point)))
    }
    let after = entries.last?.date ?? Calendar.current.date(byAdding: .hour, value: 1, to: now)!
    completion(Timeline(entries: entries, policy: .after(after)))
  }
}

struct WidgetView: View {
  @Environment(\.widgetFamily) var family
  var entry: Entry

  var body: some View {
    switch family {
    case .accessoryRectangular:
      VStack(alignment: .leading, spacing: 2) {
        Text(entry.lesson.hasData ? "\(entry.lesson.time) \(entry.lesson.when)" : "ORTA")
          .font(.system(size: 13, weight: .bold))
        Text(entry.lesson.name)
          .font(.system(size: 15, weight: .semibold))
          .lineLimit(1)
        if !entry.lesson.room.isEmpty {
          Text("ауд. " + entry.lesson.room)
            .font(.system(size: 12))
            .opacity(0.8)
        }
      }
      .widgetURL(URL(string: "orta://home"))

    case .accessoryInline:
      Text(entry.lesson.hasData ? "\(entry.lesson.time) · \(entry.lesson.name)" : "ORTA · \(entry.lesson.name)")

    case .accessoryCircular:
      VStack(spacing: 0) {
        Text(entry.lesson.hasData ? String(entry.lesson.time.prefix(2)) : "—")
          .font(.system(size: 18, weight: .bold))
        Text(entry.lesson.hasData ? String(entry.lesson.time.suffix(2)) : "")
          .font(.system(size: 12))
      }
      .widgetURL(URL(string: "orta://home"))

    default:
      ZStack {
        ContainerRelativeShape().fill(Color(red: 0.325, green: 0.141, blue: 0.690))
        VStack(alignment: .leading, spacing: 6) {
          Text(entry.lesson.hasData ? "Следующая пара · \(entry.lesson.when)" : "ORTA")
            .font(.system(size: 11, weight: .semibold))
            .foregroundColor(.white.opacity(0.75))
            .lineLimit(1)
          Text(entry.lesson.name)
            .font(.system(size: 20, weight: .heavy))
            .foregroundColor(.white)
            .lineLimit(2)
          if entry.lesson.hasData {
            Text(entry.lesson.time)
              .font(.system(size: 17, weight: .bold))
              .foregroundColor(.white)
            if !entry.lesson.room.isEmpty {
              Text("ауд. " + entry.lesson.room + (entry.lesson.teacher.isEmpty ? "" : " · " + entry.lesson.teacher))
                .font(.system(size: 12))
                .foregroundColor(.white.opacity(0.85))
                .lineLimit(1)
            }
          }
          Spacer(minLength: 0)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      .widgetURL(URL(string: "orta://home"))
    }
  }
}

@main
struct OrtaWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "OrtaWidget", provider: Provider()) { entry in
      if #available(iOS 17.0, *) {
        WidgetView(entry: entry).containerBackground(.clear, for: .widget)
      } else {
        WidgetView(entry: entry)
      }
    }
    .configurationDisplayName("Следующая пара")
    .description("Показывает ближайшую пару из расписания ORTA")
    .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular, .accessoryInline, .accessoryCircular])
  }
}
