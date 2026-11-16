import type { DayHours, OpeningHours, WeeklyHours } from "./facts.ts"

export const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
]
const dayMinutes = 1440
const weekMinutes = 7 * dayMinutes

const formatTime = (minutes: number) =>
  [Math.floor(minutes / 60), minutes % 60].map((n) => String(n).padStart(2, "0")).join(":")

const point = (day: number, time: string) => ({
  day,
  hour: Number(time.slice(0, 2)),
  minute: Number(time.slice(3)),
})

export function weeklyHoursError(schedule: WeeklyHours): string | null {
  try {
    new Intl.DateTimeFormat("en", { timeZone: schedule.timeZone })
  } catch {
    return "Choose a valid time zone for this place."
  }
  const ranges: { start: number; end: number }[] = []
  for (const [index, day] of schedule.days.entries()) {
    if (day.kind === "allDay")
      ranges.push({ start: index * dayMinutes, end: (index + 1) * dayMinutes })
    if (day.kind !== "intervals") continue
    for (const { start, end } of day.intervals) {
      if (!start || !end) return "Enter an opening and closing time for every interval."
      if (start === end) return "Choose 24 hours for an all-day opening."
      const a = point(index, start)
      const b = point(index + Number(end < start), end)
      const from = a.day * dayMinutes + a.hour * 60 + a.minute
      const to = b.day * dayMinutes + b.hour * 60 + b.minute
      ranges.push({ start: from, end: Math.min(to, weekMinutes) })
      if (to > weekMinutes) ranges.push({ start: 0, end: to - weekMinutes })
    }
  }
  ranges.sort((a, b) => a.start - b.start)
  if (ranges.some((range, i) => (ranges[i - 1]?.end ?? 0) > range.start)) {
    return "Opening intervals overlap. Check hours that continue into the next day."
  }
  return null
}

export function openingHoursFromWeek({ days, timeZone }: WeeklyHours): OpeningHours {
  const periods: OpeningHours["periods"][number][] = []
  const unknownDays: number[] = []
  const descriptions = days.map((day, i) => {
    const previous = days[(i + 6) % 7]
    const carry =
      previous?.kind === "intervals"
        ? previous.intervals
            .filter(({ start, end }) => end < start && end !== "00:00")
            .map(({ end }) => `00:00–${end}`)
        : []
    let label: string
    switch (day.kind) {
      case "unknown":
        unknownDays.push(i)
        label = [...carry, "Hours unknown"].join(", ")
        break
      case "closed":
        label = carry.join(", ") || "Closed"
        break
      case "allDay":
        periods.push({ open: point(i, "00:00"), close: point((i + 1) % 7, "00:00") })
        label = "Open 24 hours"
        break
      case "intervals": {
        const intervals = [...day.intervals].sort((a, b) => a.start.localeCompare(b.start))
        for (const { start, end } of intervals) {
          periods.push({ open: point(i, start), close: point((i + Number(end < start)) % 7, end) })
        }
        label = [
          ...carry,
          ...intervals.map(({ start, end }) => `${start}–${end}${end < start ? " (+1 day)" : ""}`),
        ].join(", ")
        break
      }
    }
    return `${weekdayNames[i]}: ${label}`
  })
  return {
    periods,
    timeZone,
    unknownDays,
    weekdayDescriptions: [...descriptions.slice(1), ...descriptions.slice(0, 1)],
  }
}

export function weekFromOpeningHours(
  hours: OpeningHours | null,
  defaultTimeZone: string,
): WeeklyHours {
  const days: DayHours[] = weekdayNames.map((_, i) =>
    !hours || hours.unknownDays?.includes(i) ? { kind: "unknown" } : { kind: "closed" },
  )
  for (const { open, close } of hours?.periods ?? []) {
    if (!close) {
      days.fill({ kind: "allDay" })
      break
    }
    const start = open.hour * 60 + open.minute
    const end = close.hour * 60 + close.minute
    let remaining =
      ((close.day - open.day) * dayMinutes + end - start + weekMinutes) % weekMinutes || dayMinutes
    let day = open.day
    let minute = start
    // Preserve ordinary overnight intervals. Split longer provider periods at day boundaries.
    while (remaining > 0) {
      const length = remaining < dayMinutes ? remaining : dayMinutes - minute
      const previous = days[day]
      const interval = {
        start: formatTime(minute),
        end: formatTime((minute + length) % dayMinutes),
      }
      days[day] =
        length === dayMinutes
          ? { kind: "allDay" }
          : {
              kind: "intervals",
              intervals: [...(previous?.kind === "intervals" ? previous.intervals : []), interval],
            }
      remaining -= length
      day = (day + 1) % 7
      minute = 0
    }
  }
  return { timeZone: hours?.timeZone ?? defaultTimeZone, days }
}
