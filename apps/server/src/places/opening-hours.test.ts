import { describe, expect, it } from "@effect/vitest"
import {
  type OpeningHours,
  openingHoursFromWeek,
  weekFromOpeningHours,
  weeklyHoursError,
} from "@placard/domain"
import { formatDistance, isOpenAt, isOpenTonight, toLocalClock } from "./opening-hours.ts"

/** Monday 12:00–23:00 local (da Michele style). day 1 = Monday. */
const weekdayLunch: OpeningHours = {
  periods: [
    { open: { day: 1, hour: 12, minute: 0 }, close: { day: 1, hour: 23, minute: 0 } },
    { open: { day: 2, hour: 12, minute: 0 }, close: { day: 2, hour: 23, minute: 0 } },
  ],
}

/** Friday 22:00 → Saturday 02:00 (wraps midnight). */
const lateNight: OpeningHours = {
  periods: [{ open: { day: 5, hour: 22, minute: 0 }, close: { day: 6, hour: 2, minute: 0 } }],
}

/** Fixed UTC instant: 2026-10-26 17:00 UTC = Monday 18:00 at UTC+1. */
const mondayAfternoonUtc = Date.UTC(2026, 9, 26, 17, 0, 0)
/** Monday 10:00 UTC = Monday 11:00 at UTC+1 (before open). */
const mondayMorningUtc = Date.UTC(2026, 9, 26, 10, 0, 0)
/** Friday 23:30 UTC = Saturday 00:30 at UTC+1. */
const fridayLateUtc = Date.UTC(2026, 9, 30, 23, 30, 0)

describe("toLocalClock", () => {
  it("applies the place's UTC offset", () => {
    expect(toLocalClock(mondayAfternoonUtc, 60)).toEqual({ day: 1, hour: 18, minute: 0 })
    expect(toLocalClock(mondayAfternoonUtc, -300)).toEqual({ day: 1, hour: 12, minute: 0 })
  })
})

describe("isOpenAt", () => {
  it("is open during a weekday lunch period", () => {
    expect(isOpenAt(weekdayLunch, 60, mondayAfternoonUtc)).toBe(true)
  })

  it("is closed before opening", () => {
    expect(isOpenAt(weekdayLunch, 60, mondayMorningUtc)).toBe(false)
  })

  it("handles periods that wrap midnight", () => {
    expect(isOpenAt(lateNight, 60, fridayLateUtc)).toBe(true)
    // Friday 20:00 UTC = Friday 21:00 UTC+1 — before 22:00 open
    expect(isOpenAt(lateNight, 60, Date.UTC(2026, 9, 30, 20, 0, 0))).toBe(false)
  })

  it("returns false with no hours", () => {
    expect(isOpenAt(null, 60, mondayAfternoonUtc)).toBe(false)
    expect(isOpenAt({ periods: [] }, 60, mondayAfternoonUtc)).toBe(false)
  })

  it("is consistent across midnight in another time zone", () => {
    // Tokyo UTC+9: Monday 02:00 local = Sunday 17:00 UTC
    const sundayUtc = Date.UTC(2026, 9, 25, 17, 0, 0)
    const tokyoMondayHours: OpeningHours = {
      periods: [{ open: { day: 1, hour: 0, minute: 0 }, close: { day: 1, hour: 6, minute: 0 } }],
    }
    expect(isOpenAt(tokyoMondayHours, 540, sundayUtc)).toBe(true)
    expect(isOpenAt(tokyoMondayHours, 0, sundayUtc)).toBe(false)
  })
})

describe("isOpenTonight", () => {
  it("checks dinner time when still afternoon", () => {
    // Monday 14:00 UTC+1 → dinner check at 19:00 local → open
    const afternoon = Date.UTC(2026, 9, 26, 13, 0, 0)
    expect(isOpenTonight(weekdayLunch, 60, afternoon)).toBe(true)
  })

  it("uses now when already past dinner", () => {
    // Monday 20:00 UTC+1 — still within 12–23
    const evening = Date.UTC(2026, 9, 26, 19, 0, 0)
    expect(isOpenTonight(weekdayLunch, 60, evening)).toBe(true)
    // Monday 23:30 UTC+1 — closed
    const late = Date.UTC(2026, 9, 26, 22, 30, 0)
    expect(isOpenTonight(weekdayLunch, 60, late)).toBe(false)
  })

  it("rejects places that only open for lunch", () => {
    const lunchOnly: OpeningHours = {
      periods: [{ open: { day: 1, hour: 11, minute: 0 }, close: { day: 1, hour: 15, minute: 0 } }],
    }
    const afternoon = Date.UTC(2026, 9, 26, 13, 0, 0)
    expect(isOpenTonight(lunchOnly, 60, afternoon)).toBe(false)
  })
})

describe("formatDistance", () => {
  it("formats km and miles", () => {
    expect(formatDistance(250, "km")).toBe("250 m")
    expect(formatDistance(2500, "km")).toBe("2.5 km")
    expect(formatDistance(2500, "mi")).toBe("1.6 mi")
  })
})

describe("manual weekly hours", () => {
  const hours = openingHoursFromWeek({
    timeZone: "Europe/Brussels",
    days: [
      { kind: "closed" },
      {
        kind: "intervals",
        intervals: [
          { start: "11:00", end: "14:00" },
          { start: "18:00", end: "21:30" },
        ],
      },
      { kind: "unknown" },
      { kind: "unknown" },
      { kind: "unknown" },
      { kind: "allDay" },
      { kind: "intervals", intervals: [{ start: "22:00", end: "02:00" }] },
    ],
  })

  it("uses summer and winter local times for split shifts and tonight", () => {
    for (const [date, offset] of [
      ["2026-07-06", 2],
      ["2026-11-16", 1],
    ] as const) {
      const utcMidnight = Date.parse(`${date}T00:00:00Z`)
      const at = (hour: number) => utcMidnight + (hour - offset) * 3_600_000
      expect(isOpenAt(hours, null, at(11))).toBe(true)
      expect(isOpenAt(hours, null, at(14))).toBe(false)
      expect(isOpenAt(hours, null, at(18))).toBe(true)
      expect(isOpenTonight(hours, null, at(15))).toBe(true)
    }
  })

  it("preserves overnight, all-day and incomplete hours when reopened", () => {
    expect(hours.weekdayDescriptions).toContain("Sunday: 00:00–02:00")
    expect(hours.weekdayDescriptions).toContain("Tuesday: Hours unknown")
    expect(isOpenAt(hours, null, Date.parse("2026-11-14T23:30:00Z"))).toBe(true)
    expect(isOpenAt(hours, null, Date.parse("2026-11-15T01:00:00Z"))).toBe(false)
    expect(openingHoursFromWeek(weekFromOpeningHours(hours, "UTC"))).toEqual(hours)
  })

  it("rejects overlaps across the week boundary", () => {
    const week = weekFromOpeningHours(hours, "UTC")
    expect(
      weeklyHoursError({ ...week, days: [{ kind: "allDay" }, ...week.days.slice(1)] }),
    ).toMatch(/overlap/)
    expect(weeklyHoursError({ ...week, timeZone: "Brussels/Moon" })).toMatch(/time zone/)
  })

  it("uses the provider's always-open period on every day", () => {
    const always = { periods: [{ open: { day: 0, hour: 0, minute: 0 } }] }
    expect(isOpenAt(always, 0, mondayAfternoonUtc)).toBe(true)
    expect(weekFromOpeningHours(always, "UTC").days.every((day) => day.kind === "allDay")).toBe(
      true,
    )
  })
})
