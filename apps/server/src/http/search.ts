import { Api, CurrentUser } from "@placard/domain"
import { Config, Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { createOsmLookup } from "../places/osm-lookup.ts"
import { Search } from "../places/search.ts"

export const SearchApiLive = HttpApiBuilder.group(
  Api,
  "search",
  Effect.fn(function* (handlers) {
    const search = yield* Search
    const endpoint = yield* Config.URL("PLACARD_PHOTON_URL").pipe(
      Config.withDefault(new URL("https://photon.komoot.io/api/")),
      Effect.orDie,
    )
    const lookup = createOsmLookup(endpoint)
    return handlers
      .handle("osm", ({ payload }) => lookup(payload.query))
      .handle("query", ({ payload }) =>
        Effect.gen(function* () {
          const me = yield* CurrentUser
          return yield* search.query(me.id, me.householdEnabled, payload)
        }),
      )
  }),
)
