import { LatLng, type OsmCandidate, OsmLookupFailed } from "@placard/domain"
import { Effect, Schema } from "effect"

const text = Schema.optional(Schema.String)
const point = Schema.Struct({
  geometry: Schema.Struct({
    type: Schema.Literal("Point"),
    coordinates: Schema.Tuple([Schema.Finite, Schema.Finite]),
  }),
  properties: Schema.Struct({
    name: text,
    street: text,
    housenumber: text,
    district: text,
    city: text,
    state: text,
    country: text,
    osm_value: text,
  }),
})
const decode = Schema.decodeUnknownSync(Schema.Struct({ features: Schema.Array(Schema.Unknown) }))

export function createOsmLookup(endpoint: URL, request = fetch) {
  const cache = new Map<string, { at: number; results: OsmCandidate[] }>()
  let lastRequest = 0
  return (query: string) =>
    Effect.tryPromise({
      try: async (signal) => {
        const key = query.trim().toLowerCase()
        const now = Date.now()
        const hit = cache.get(key)
        if (hit && now - hit.at < 15 * 60_000) return hit.results
        if (now - lastRequest < 1000)
          throw new OsmLookupFailed({ message: "Please wait a moment before searching again." })
        lastRequest = now
        const url = new URL(endpoint)
        url.searchParams.set("q", query.trim())
        url.searchParams.set("limit", "5")
        const response = await request(url, {
          headers: { Accept: "application/json", "User-Agent": "Placard OpenStreetMap lookup" },
          signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
        })
        if (!response.ok) throw new Error("Photon lookup failed")
        const { features } = decode(await response.json())
        const results: OsmCandidate[] = []
        for (const feature of features) {
          if (!Schema.is(point)(feature)) continue
          const [lng, lat] = feature.geometry.coordinates
          const location = { lat, lng }
          if (!Schema.is(LatLng)(location)) continue
          const p = feature.properties
          const street = [p.housenumber, p.street].filter(Boolean).join(" ")
          const address = [
            ...new Set([street, p.district, p.city, p.state, p.country].filter(Boolean)),
          ].join(", ")
          const name = p.name || street || p.city
          if (name)
            results.push({ name, address, location, kind: p.osm_value?.replaceAll("_", " ") ?? "" })
        }
        if (cache.size >= 256) {
          const oldest = cache.keys().next()
          if (!oldest.done) cache.delete(oldest.value)
        }
        cache.set(key, { at: now, results })
        return results
      },
      catch: (cause) =>
        cause instanceof OsmLookupFailed
          ? cause
          : new OsmLookupFailed({
              message: "OpenStreetMap search is unavailable. Try again or drop a pin.",
            }),
    })
}
