import type { ImportEntry, SearchHit } from "@placard/domain"
import { useEffect, useState } from "react"
import { ErrorAlert } from "@/components/error-alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, errorMessage } from "@/lib/api"
import { formatCoordinates } from "@/lib/places"

export function ReviewLibrarySearch({
  entry,
  busy,
  onPick,
}: {
  readonly entry: ImportEntry
  readonly busy: boolean
  readonly onPick: (placeId: string) => void
}) {
  const [query, setQuery] = useState((entry.name ?? "").slice(0, 200))
  const [result, setResult] = useState<{
    text: string
    hits: ReadonlyArray<SearchHit>
    error?: string
  } | null>(null)
  const text = query.trim()
  useEffect(() => {
    if (!text) return
    let current = true
    const timeout = window.setTimeout(() => {
      api((c) => c.search.query({ payload: { text, householdScope: "mine" } })).then(
        (hits) => {
          if (current)
            setResult({ text, hits: hits.filter((hit) => hit.place.id !== entry.placeId) })
        },
        (cause: unknown) => {
          if (current) setResult({ text, hits: [], error: errorMessage(cause) })
        },
      )
    }, 200)
    return () => {
      current = false
      window.clearTimeout(timeout)
    }
  }, [text, entry.placeId])

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="review-library-query" className="text-sm font-medium">
        Search your saved places
      </label>
      <Input
        id="review-library-query"
        value={query}
        maxLength={200}
        onChange={(event) => setQuery(event.target.value)}
      />
      {text &&
        (result?.text !== text ? (
          <p role="status" className="text-sm">
            Searching…
          </p>
        ) : result.error ? (
          <ErrorAlert message={result.error} />
        ) : result.hits.length === 0 ? (
          <p role="status" className="text-sm text-muted-foreground">
            No saved places match. Try another name or drop a pin.
          </p>
        ) : (
          <ul className="max-h-80 overflow-y-auto divide-y">
            {result.hits.map(({ place }) => (
              <li key={place.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm font-medium">{place.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {place.address ?? formatCoordinates(place)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => onPick(place.id)}
                  aria-label={`Link to ${place.name}`}
                >
                  Link
                </Button>
              </li>
            ))}
          </ul>
        ))}
    </div>
  )
}
