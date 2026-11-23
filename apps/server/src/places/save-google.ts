import type { Me, PlaceSource } from "@placard/domain"
import { Effect, Option } from "effect"
import type { GooglePlaces } from "../google/places.ts"
import type { Enrichment } from "./enrichment.ts"
import type { Places } from "./places.ts"

export const saveGooglePlace = (
  deps: {
    places: Places["Service"]
    google: GooglePlaces["Service"]
    enrichment: Enrichment["Service"]
  },
  user: Pick<Me, "id" | "householdEnabled">,
  input: {
    googlePlaceId: string
    sessionToken: string | null
    source: Extract<PlaceSource, "autocomplete" | "map_pick" | "mcp">
  },
) =>
  Effect.gen(function* () {
    const existing = yield* deps.places.findByGooglePlaceId(user.id, input.googlePlaceId)
    if (Option.isSome(existing)) return { place: existing.value, created: false }
    const details = yield* deps.google.details(input.googlePlaceId, input.sessionToken)
    const saved = yield* deps.places.addFromGoogle(user.id, details, input.source)
    if (!saved.created) return saved
    yield* deps.enrichment.applyDetails(user.id, saved.place.id, details).pipe(Effect.orDie)
    const place = yield* deps.places
      .get(user.id, saved.place.id, user.householdEnabled)
      .pipe(Effect.orDie)
    return { place, created: true }
  })
