import { Schema } from "effect"

export const factKeys = [
  "opening_hours",
  "phone",
  "website",
  "price_level",
  "rating",
  "cuisine",
  "types",
] as const
export const FactKey = Schema.Literals(factKeys)
export type FactKey = typeof FactKey.Type

export const factSources = ["google", "manual", "takeout"] as const
export const FactSource = Schema.Literals(factSources)
export type FactSource = typeof FactSource.Type

export const priceLevels = [
  "free",
  "inexpensive",
  "moderate",
  "expensive",
  "very_expensive",
] as const
export const PriceLevel = Schema.Literals(priceLevels)
export type PriceLevel = typeof PriceLevel.Type

const TimeOfDay = Schema.Struct({
  day: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 6 }))),
  hour: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 23 }))),
  minute: Schema.Int.pipe(Schema.check(Schema.isBetween({ minimum: 0, maximum: 59 }))),
})

/** Google's regularOpeningHours.periods shape, plus optional weekday lines for display. */
export const OpeningHours = Schema.Struct({
  periods: Schema.Array(
    Schema.Struct({
      open: TimeOfDay,
      close: Schema.optional(TimeOfDay),
    }),
  ),
  timeZone: Schema.optional(Schema.String),
  unknownDays: Schema.optional(Schema.Array(Schema.Int)),
  weekdayDescriptions: Schema.optional(Schema.Array(Schema.String)),
})
export type OpeningHours = typeof OpeningHours.Type

export const FactValue = Schema.Union([
  OpeningHours,
  Schema.String,
  PriceLevel,
  Schema.Number,
  Schema.Array(Schema.String),
])
export type FactValue = typeof FactValue.Type

export const PlaceFact = Schema.Struct({
  key: FactKey,
  value: Schema.Unknown,
  source: FactSource,
  isOverride: Schema.Boolean,
  fetchedAt: Schema.DateTimeUtcFromString,
})
export type PlaceFact = typeof PlaceFact.Type

/** Effective facts for a place (override wins over Google). */
export const PlaceFacts = Schema.Struct({
  openingHours: Schema.NullOr(OpeningHours),
  phone: Schema.NullOr(Schema.String),
  website: Schema.NullOr(Schema.String),
  priceLevel: Schema.NullOr(PriceLevel),
  rating: Schema.NullOr(Schema.Number),
  cuisine: Schema.NullOr(Schema.String),
  types: Schema.NullOr(Schema.Array(Schema.String)),
  /** True when at least one fact came from Google (show attribution). */
  fromGoogle: Schema.Boolean,
})
export type PlaceFacts = typeof PlaceFacts.Type

const ClockTime = Schema.String.pipe(Schema.check(Schema.isPattern(/^([01]\d|2[0-3]):[0-5]\d$/)))
export const DayHours = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("unknown") }),
  Schema.Struct({ kind: Schema.Literal("closed") }),
  Schema.Struct({ kind: Schema.Literal("allDay") }),
  Schema.Struct({
    kind: Schema.Literal("intervals"),
    intervals: Schema.Array(Schema.Struct({ start: ClockTime, end: ClockTime })).pipe(
      Schema.check(Schema.isBetweenLength(1, 24)),
    ),
  }),
])
export type DayHours = typeof DayHours.Type

export const WeeklyHours = Schema.Struct({
  timeZone: Schema.NonEmptyString.pipe(Schema.check(Schema.isMaxLength(100))),
  /** Sunday first, matching the existing periods format. */
  days: Schema.Array(DayHours).pipe(Schema.check(Schema.isBetweenLength(7, 7))),
})
export type WeeklyHours = typeof WeeklyHours.Type

export class InvalidFact extends Schema.TaggedError<InvalidFact>()(
  "InvalidFact",
  { message: Schema.String },
  { httpApiStatus: 400 },
) {}

export const FactOverrideInput = Schema.Struct({
  value: Schema.Union([Schema.String, WeeklyHours, Schema.Null]),
})
export type FactOverrideInput = typeof FactOverrideInput.Type

export const enrichmentRunStatuses = ["running", "done", "failed"] as const
export const EnrichmentRunStatus = Schema.Literals(enrichmentRunStatuses)
export type EnrichmentRunStatus = typeof EnrichmentRunStatus.Type

export const EnrichmentRun = Schema.Struct({
  id: Schema.String,
  status: EnrichmentRunStatus,
  total: Schema.Number,
  completed: Schema.Number,
  failed: Schema.Number,
  createdAt: Schema.DateTimeUtcFromString,
  finishedAt: Schema.NullOr(Schema.DateTimeUtcFromString),
})
export type EnrichmentRun = typeof EnrichmentRun.Type

export const RefreshAllPlan = Schema.Struct({
  placeCount: Schema.Number,
})
export type RefreshAllPlan = typeof RefreshAllPlan.Type

/** How a single-place Google refresh treats owner overrides / edited fields. */
export const placeRefreshModes = ["merge", "replace"] as const
export const PlaceRefreshMode = Schema.Literals(placeRefreshModes)
export type PlaceRefreshMode = typeof PlaceRefreshMode.Type

export const PlaceRefreshInput = Schema.Struct({
  /** Omit or `merge` keeps overrides; `replace` clears them then re-fetches. */
  mode: Schema.optional(PlaceRefreshMode),
})
export type PlaceRefreshInput = typeof PlaceRefreshInput.Type

export class EnrichmentBusy extends Schema.TaggedError<EnrichmentBusy>()(
  "EnrichmentBusy",
  { message: Schema.String },
  { httpApiStatus: 409 },
) {}

export class FactNotFound extends Schema.TaggedError<FactNotFound>()(
  "FactNotFound",
  {},
  { httpApiStatus: 404 },
) {}
