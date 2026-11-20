import {
  LatLng,
  MapsPlaceId,
  MapsSourceUrl,
  PlaceName,
  type PlacePreview,
  type PlaceSuggestion,
  type SaveFromMapsInput,
} from "@placard/domain"
import { Schema } from "effect"
import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import { newSessionToken } from "@/components/add/google-preview"
import { ErrorAlert } from "@/components/error-alert"
import { OsmLookup } from "@/components/place/osm-lookup"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { api, errorMessage } from "@/lib/api"
import { categoryLabel, formatCoordinates } from "@/lib/places"
import { useLoad } from "@/lib/use-load"

function coordinates(lat: string | null, lng: string | null): LatLng | null {
  if (!lat?.trim() || !lng?.trim()) return null
  const point = { lat: Number(lat), lng: Number(lng) }
  return Schema.is(LatLng)(point) ? point : null
}

function parseDraft(search: string) {
  const params = new URLSearchParams(search)
  const mapsUrl = params.get("mapsUrl")
  const name = params.get("name")?.trim()
  const placeId = params.get("placeId")
  if (!Schema.is(MapsSourceUrl)(mapsUrl) || !Schema.is(PlaceName)(name)) return null
  return {
    mapsUrl,
    name,
    placeId: Schema.is(MapsPlaceId)(placeId) ? placeId : null,
    location: coordinates(params.get("lat"), params.get("lng")),
  }
}

type Draft = NonNullable<ReturnType<typeof parseDraft>>
type Lookup =
  | { kind: "idle" }
  | { kind: "suggestions"; items: readonly PlaceSuggestion[]; sessionToken: string }
  | { kind: "preview"; place: PlacePreview }

const loadGoogle = () => api((client) => client.google.config())

function Review({ draft }: { draft: Draft }) {
  const { data: google, error: configError } = useLoad(loadGoogle)
  const navigate = useNavigate()
  const [name, setName] = useState(draft.name)
  const [lat, setLat] = useState(draft.location?.lat.toString() ?? "")
  const [lng, setLng] = useState(draft.location?.lng.toString() ?? "")
  const [address, setAddress] = useState<string | null>(null)
  const [lookup, setLookup] = useState<Lookup>({ kind: "idle" })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const location = coordinates(lat, lng)
  const validName = Schema.is(PlaceName)(name.trim())
  const reviewedName =
    lookup.kind === "preview" && name.trim() === draft.name ? lookup.place.name : name.trim()

  async function run(action: () => Promise<void>) {
    setPending(true)
    setError(null)
    try {
      await action()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setPending(false)
    }
  }

  async function preview(googlePlaceId: string, sessionToken?: string) {
    const place = await api((client) =>
      client.google.preview({
        params: { googlePlaceId },
        query: sessionToken ? { sessionToken } : {},
      }),
    )
    setLookup({ kind: "preview", place })
  }

  function lookupDetails() {
    void run(async () => {
      setLookup({ kind: "idle" })
      if (draft.placeId) return preview(draft.placeId)
      const sessionToken = newSessionToken()
      const items = await api((client) =>
        client.google.autocomplete({
          payload: { input: name.trim(), sessionToken, near: location },
        }),
      )
      setLookup({ kind: "suggestions", items, sessionToken })
    })
  }

  function save(payload: SaveFromMapsInput) {
    void run(async () => {
      const { place, created } = await api((client) => client.maps.save({ payload }))
      navigate(`/places/${place.id}`, { replace: true, state: { alreadySaved: !created } })
    })
  }

  return (
    <section className="flex max-w-2xl flex-col gap-5">
      <h1 className="font-catalog text-4xl font-semibold uppercase">Save from Google Maps</h1>
      <a className="w-fit text-sm underline" href={draft.mapsUrl} target="_blank" rel="noreferrer">
        Open original place in Google Maps
      </a>
      <Field>
        <FieldLabel htmlFor="maps-name">Name</FieldLabel>
        <Input
          id="maps-name"
          value={name}
          maxLength={200}
          disabled={pending}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      {!draft.location && (
        <>
          <p className="text-sm">
            The link has no exact pin. Find the place or enter its coordinates to save without
            Google.
          </p>
          <OsmLookup
            initialQuery={draft.name}
            onPick={(candidate) => {
              setLat(String(candidate.location.lat))
              setLng(String(candidate.location.lng))
              setAddress(candidate.address || null)
            }}
          />
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <FieldLabel htmlFor="maps-lat">Latitude</FieldLabel>
          <Input
            id="maps-lat"
            type="number"
            min="-90"
            max="90"
            disabled={pending}
            step="any"
            value={lat}
            onChange={(e) => {
              setLat(e.target.value)
              setAddress(null)
            }}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="maps-lng">Longitude</FieldLabel>
          <Input
            id="maps-lng"
            type="number"
            min="-180"
            max="180"
            disabled={pending}
            step="any"
            value={lng}
            onChange={(e) => {
              setLng(e.target.value)
              setAddress(null)
            }}
          />
        </Field>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          disabled={pending || !location || !validName}
          onClick={() =>
            location &&
            save({
              mode: "manual",
              name: name.trim(),
              mapsUrl: draft.mapsUrl,
              googlePlaceId: draft.placeId,
              location,
              address,
              category: "other",
            })
          }
        >
          Save without Google
        </Button>
        {google?.mapsApiKey && (
          <Button variant="outline" disabled={pending || !validName} onClick={lookupDetails}>
            Look up details with Google
          </Button>
        )}
      </div>
      {configError && <p role="status">Could not check whether Google lookup is configured.</p>}
      <ErrorAlert message={error} />
      {pending && <p role="status">Working…</p>}
      {lookup.kind === "suggestions" &&
        (lookup.items.length ? (
          <ul aria-label="Google matches" className="divide-y rounded-md border">
            {lookup.items.map((item) => (
              <li key={item.googlePlaceId}>
                <button
                  disabled={pending}
                  type="button"
                  className="grid w-full px-3 py-2 text-left hover:bg-muted"
                  onClick={() => void run(() => preview(item.googlePlaceId, lookup.sessionToken))}
                >
                  <strong>{item.primaryText}</strong>
                  <span className="text-sm">{item.secondaryText}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p role="status">
            No Google matches. Edit the name and try again, or save without Google.
          </p>
        ))}
      {lookup.kind === "preview" && (
        <Card role="region" aria-label="Google place preview">
          <CardHeader>
            <CardTitle>{lookup.place.name}</CardTitle>
            <p className="text-sm">{categoryLabel(lookup.place.category)}</p>
          </CardHeader>
          <CardContent className="grid justify-items-start gap-3">
            {lookup.place.address && <p>{lookup.place.address}</p>}
            {reviewedName !== lookup.place.name && <p>Save as {reviewedName}</p>}
            <p className="text-sm">{formatCoordinates(lookup.place)}</p>
            {lookup.place.existingPlaceId && <p>Already in your library.</p>}
            <Button
              disabled={pending || !validName}
              onClick={() =>
                save({
                  mode: "google",
                  googlePlaceId: lookup.place.googlePlaceId,
                  name: reviewedName,
                  mapsUrl: draft.mapsUrl,
                })
              }
            >
              {lookup.place.existingPlaceId ? "Open saved place" : "Save with Google details"}
            </Button>
          </CardContent>
        </Card>
      )}
    </section>
  )
}

export function SaveFromMapsPage() {
  const { search } = useLocation()
  const draft = parseDraft(search)
  if (draft) return <Review key={search} draft={draft} />
  return (
    <section className="grid justify-items-start gap-4">
      <h1 className="font-catalog text-4xl font-semibold uppercase">Unable to open this place</h1>
      <p>Open a place in Google Maps and select Save to Placard again.</p>
      <Button asChild variant="outline">
        <Link to="/add">Add a place manually</Link>
      </Button>
    </section>
  )
}
