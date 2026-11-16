import type { OsmCandidate } from "@placard/domain"
import { type FormEvent, useId, useState } from "react"
import { ErrorAlert } from "@/components/error-alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, errorMessage } from "@/lib/api"

export function OsmLookup({
  initialQuery,
  onPick,
}: {
  readonly initialQuery: string
  readonly onPick: (candidate: OsmCandidate) => void
}) {
  const id = useId()
  const [query, setQuery] = useState(initialQuery.slice(0, 200))
  const [found, setFound] = useState<readonly OsmCandidate[] | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function search(event: FormEvent) {
    event.preventDefault()
    if (pending || query.trim().length < 2) return
    setPending(true)
    setFound(null)
    setError(null)
    try {
      setFound(await api((c) => c.search.osm({ payload: { query: query.trim() } })))
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setPending(false)
    }
  }
  return (
    <div className="grid gap-2">
      <form onSubmit={search} className="grid gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          Find on OpenStreetMap
        </label>
        <div className="flex flex-wrap gap-2">
          <Input
            id={id}
            className="min-w-48 flex-1"
            placeholder="Place name and town"
            maxLength={200}
            value={query}
            disabled={pending}
            onChange={(e) => {
              setQuery(e.target.value)
              setFound(null)
              setError(null)
            }}
          />
          <Button type="submit" variant="outline" disabled={pending || query.trim().length < 2}>
            {pending ? "Searching…" : "Search OpenStreetMap"}
          </Button>
        </div>
      </form>
      <ErrorAlert message={error} />
      {found &&
        (found.length ? (
          <ul className="divide-y rounded-md border">
            {found.map((candidate) => (
              <li
                key={`${candidate.location.lat},${candidate.location.lng}-${candidate.name}-${candidate.kind}`}
              >
                <button
                  type="button"
                  className="grid w-full gap-1 px-3 py-2 text-left hover:bg-muted"
                  onClick={() => {
                    onPick(candidate)
                    setFound(null)
                  }}
                >
                  <strong className="text-sm">{candidate.name}</strong>
                  <span className="text-xs text-muted-foreground">
                    {[candidate.kind, candidate.address].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p role="status" className="text-sm">
            No matches. Try another name or include the town.
          </p>
        ))}
      <p className="text-xs text-muted-foreground">
        Search data ©{" "}
        <a
          className="underline"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap contributors
        </a>
      </p>
    </div>
  )
}
