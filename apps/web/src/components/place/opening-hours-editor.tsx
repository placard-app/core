import {
  type DayHours,
  type Place,
  type WeeklyHours,
  weekdayNames,
  weekFromOpeningHours,
  weeklyHoursError,
} from "@placard/domain"
import { useState } from "react"
import { ErrorAlert } from "@/components/error-alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, errorMessage } from "@/lib/api"

const initialIntervals: DayHours = {
  kind: "intervals",
  intervals: [{ start: "09:00", end: "17:00" }],
}
const timeZones = [...new Set(["UTC", ...Intl.supportedValuesOf("timeZone")])]

export function OpeningHoursEditor({
  place,
  onSaved,
  onCancel,
}: {
  readonly place: Place
  readonly onSaved: (place: Place) => void
  readonly onCancel: () => void
}) {
  const [schedule, setSchedule] = useState<WeeklyHours>(() =>
    weekFromOpeningHours(
      place.facts.openingHours,
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const setDay = (index: number, day: DayHours) => {
    setSchedule((previous) => ({
      ...previous,
      days: previous.days.map((d, i) => (i === index ? day : d)),
    }))
  }
  const save = async (value: WeeklyHours | null) => {
    const validation = value && weeklyHoursError(value)
    setError(validation)
    if (validation) return
    setBusy(true)
    try {
      onSaved(
        await api((client) =>
          client.places.setFact({
            params: { id: place.id, key: "opening_hours" },
            payload: { value },
          }),
        ),
      )
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="rounded-md border p-4"
      onSubmit={(event) => {
        event.preventDefault()
        void save(schedule)
      }}
    >
      <fieldset disabled={busy} className="flex flex-col gap-3">
        <legend className="mb-3 font-medium">Weekly opening hours</legend>
        <label htmlFor="opening-time-zone" className="flex max-w-sm flex-col gap-1 text-sm">
          Place’s time zone
          <Input
            id="opening-time-zone"
            list="opening-time-zones"
            value={schedule.timeZone}
            required
            onChange={(e) => setSchedule({ ...schedule, timeZone: e.target.value })}
          />
        </label>
        {!place.facts.openingHours?.timeZone && (
          <p className="text-xs text-muted-foreground">
            The initial time zone comes from your device. Choose the local zone for this place.
          </p>
        )}
        <datalist id="opening-time-zones">
          {timeZones.map((zone) => (
            <option key={zone} value={zone} />
          ))}
        </datalist>
        {[1, 2, 3, 4, 5, 6, 0].map((index) => {
          const day = schedule.days[index]
          if (!day) return null
          const name = weekdayNames[index]
          return (
            <div key={name} className="flex flex-col gap-2 border-t pt-3">
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor={`opening-day-${index}`} className="w-24 text-sm font-medium">
                  {name}
                </label>
                <select
                  id={`opening-day-${index}`}
                  className="rounded-md border bg-background px-2 py-1 text-sm"
                  value={day.kind}
                  onChange={(e) => {
                    switch (e.target.value) {
                      case "unknown":
                        setDay(index, { kind: "unknown" })
                        break
                      case "closed":
                        setDay(index, { kind: "closed" })
                        break
                      case "allDay":
                        setDay(index, { kind: "allDay" })
                        break
                      case "intervals":
                        setDay(index, initialIntervals)
                        break
                    }
                  }}
                >
                  <option value="unknown">Hours unknown</option>
                  <option value="closed">Closed</option>
                  <option value="intervals">Set times</option>
                  <option value="allDay">Open 24 hours</option>
                </select>
                {index === 1 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setSchedule({
                        ...schedule,
                        days: schedule.days.map((d, i) => (i >= 2 && i <= 5 ? day : d)),
                      })
                    }
                  >
                    Copy to Tue–Fri
                  </Button>
                )}
              </div>
              {day.kind === "intervals" && (
                <>
                  {day.intervals.map((interval, row) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: intervals are controlled fields in numbered slots.
                    <div key={row} className="flex flex-wrap items-center gap-2 text-sm">
                      {(["start", "end"] as const).map((field) => (
                        <label
                          htmlFor={`hours-${index}-${row}-${field}`}
                          key={field}
                          className="flex items-center gap-1"
                        >
                          {field === "start" ? "From" : "to"}
                          <Input
                            id={`hours-${index}-${row}-${field}`}
                            type="time"
                            className="w-auto"
                            required
                            value={interval[field]}
                            aria-label={`${name} ${field === "start" ? "opens" : "closes"} ${row + 1}`}
                            onChange={(e) =>
                              setDay(index, {
                                kind: "intervals",
                                intervals: day.intervals.map((item, i) =>
                                  i === row ? { ...item, [field]: e.target.value } : item,
                                ),
                              })
                            }
                          />
                        </label>
                      ))}
                      {interval.end && interval.end < interval.start && <span>next day</span>}
                      {day.intervals.length > 1 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          aria-label={`Remove ${name} interval ${row + 1}`}
                          onClick={() =>
                            setDay(index, {
                              kind: "intervals",
                              intervals: day.intervals.filter((_, i) => i !== row),
                            })
                          }
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  {day.intervals.length < 24 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="w-fit"
                      onClick={() =>
                        setDay(index, {
                          kind: "intervals",
                          intervals: [...day.intervals, { start: "", end: "" }],
                        })
                      }
                    >
                      Add interval
                    </Button>
                  )}
                </>
              )}
            </div>
          )
        })}
        <ErrorAlert message={error} />
        <div className="flex gap-2">
          <Button type="submit">{busy ? "Saving…" : "Save hours"}</Button>
          {place.facts.openingHours?.timeZone && (
            <Button type="button" variant="outline" onClick={() => void save(null)}>
              Clear manual hours
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
