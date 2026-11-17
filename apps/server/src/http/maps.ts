import {
  Api,
  CurrentUser,
  type PlaceNotFound,
  type SavedPlace,
  type SaveFromMapsInput,
} from "@placard/domain"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { SqlClient } from "effect/sql"
import { GooglePlaces } from "../google/places.ts"
import { extractMapsSignals } from "../import/parse.ts"
import { Enrichment } from "../places/enrichment.ts"
import { Places } from "../places/places.ts"

export const MapsApiLive = HttpApiBuilder.group(
  Api,
  "maps",
  Effect.fn(function* (handlers) {
    const sql = yield* SqlClient.SqlClient
    const places = yield* Places
    const google = yield* GooglePlaces
    const enrichment = yield* Enrichment

    const prepareCreation = Effect.fn(function* (ownerId: string, input: SaveFromMapsInput) {
      if (input.mode === "manual") {
        return places.addManual(ownerId, input, { googlePlaceId: input.googlePlaceId })
      }
      // Reserve any paid request outside the save transaction so a rollback cannot erase its usage.
      const details = yield* google.details(input.googlePlaceId, null)
      return Effect.gen(function* () {
        const saved = yield* places.addFromGoogle(ownerId, details, "map_pick")
        if (saved.created) {
          // The user confirmed Place Details. Photo media is a separate paid request.
          yield* enrichment.applyDetails(ownerId, saved.place.id, { ...details, photoName: null })
          if (input.name !== details.name) {
            yield* places.update(ownerId, saved.place.id, { name: input.name })
          }
        }
        return saved
      })
    })

    const save = Effect.fn(function* (
      ownerId: string,
      input: SaveFromMapsInput,
      create: Effect.Effect<SavedPlace, PlaceNotFound>,
    ) {
      // The same source link can be submitted concurrently without a Google Place ID.
      const { featureId } = extractMapsSignals(input.mapsUrl)
      const feature = featureId?.toLowerCase() ?? null
      const lockKey = `${ownerId}|${feature ?? input.mapsUrl}`
      yield* sql`select pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`
      const [known] = yield* sql<{ id: string }>`
        select p.id from places p
        where p.owner_id = ${ownerId} and p.deleted_at is null and (
          p.google_place_id = ${input.googlePlaceId} or exists (
            select 1 from place_custom_fields f
            where f.place_id = p.id and f.type = 'url' and (
                f.value = ${input.mapsUrl} or (
                  f.label in ('Google Maps link', 'Takeout Maps link') and
                  substring(lower(f.value) from '(?:!1s|[?&]ftid=|/)(0x[0-9a-f]+:0x[0-9a-f]+)') = ${feature}
                )
              )
          )
        )
        order by (p.google_place_id = ${input.googlePlaceId}) desc nulls last, p.created_at
        limit 1 for update`
      const saved = known
        ? { place: yield* places.get(ownerId, known.id, false), created: false }
        : yield* create
      if (
        saved.place.customFields.some(
          (field) => field.type === "url" && field.value === input.mapsUrl,
        )
      ) {
        return saved
      }
      const place = yield* places.addCustomField(ownerId, saved.place.id, {
        label: "Google Maps link",
        type: "url",
        value: input.mapsUrl,
      })
      return { place, created: saved.created }
    })

    return handlers.handle(
      "save",
      Effect.fn(function* ({ payload }) {
        const { id } = yield* CurrentUser
        const create = yield* prepareCreation(id, payload)
        return yield* sql
          .withTransaction(save(id, payload, create))
          .pipe(Effect.catchTag("SqlError", Effect.die))
      }),
    )
  }),
)
