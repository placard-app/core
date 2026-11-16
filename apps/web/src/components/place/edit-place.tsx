import {
  type Place,
  type PlaceCategory,
  type PlaceList,
  type PlaceStatus,
  priceLevels,
} from "@placard/domain"
import { type FormEvent, useEffect, useState } from "react"
import { ErrorAlert } from "@/components/error-alert"
import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { api, errorMessage } from "@/lib/api"
import { usePlaceCategories } from "@/lib/place-categories"
import { categoryLabel } from "@/lib/places"

export function EditPlace({
  place,
  lists,
  onSaved,
  onCancel,
}: {
  readonly place: Place
  readonly lists: ReadonlyArray<PlaceList>
  readonly onSaved: (place: Place) => void
  readonly onCancel: () => void
}) {
  const [name, setName] = useState(place.name)
  const placeCategories = usePlaceCategories()
  const [category, setCategory] = useState<PlaceCategory>(place.category)
  const [address, setAddress] = useState(place.address ?? "")
  const [notes, setNotes] = useState(place.notes ?? "")
  const [phone, setPhone] = useState(place.facts.phone ?? "")
  const [website, setWebsite] = useState(place.facts.website ?? "")
  const [cuisine, setCuisine] = useState(place.facts.cuisine ?? "")
  const [price, setPrice] = useState<string>(place.facts.priceLevel ?? "")
  const [status, setStatus] = useState<PlaceStatus | "none">(place.status ?? "none")
  const [tagNames, setTagNames] = useState(place.tags.map((t) => t.name).join(", "))
  const [listIds, setListIds] = useState<ReadonlySet<string>>(new Set(place.listIds))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setName(place.name)
    setCategory(place.category)
    setAddress(place.address ?? "")
    setNotes(place.notes ?? "")
    setPhone(place.facts.phone ?? "")
    setWebsite(place.facts.website ?? "")
    setCuisine(place.facts.cuisine ?? "")
    setPrice(place.facts.priceLevel ?? "")
    setStatus(place.status ?? "none")
    setTagNames(place.tags.map((t) => t.name).join(", "))
    setListIds(new Set(place.listIds))
  }, [place])

  const toggleList = (listId: string) =>
    setListIds((prev) => {
      const next = new Set(prev)
      if (next.has(listId)) next.delete(listId)
      else next.add(listId)
      return next
    })

  const save = (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const names = tagNames
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
    const editedFacts = [
      ["phone", phone, place.facts.phone],
      ["website", website, place.facts.website],
      ["cuisine", cuisine, place.facts.cuisine],
      ["price_level", price, place.facts.priceLevel],
    ] as const
    void (async () => {
      try {
        const facts = Object.fromEntries(
          editedFacts.flatMap(([key, input, previous]) => {
            const value = input.trim() || null
            return value === previous ? [] : [[key, value]]
          }),
        )
        const next = await api((c) =>
          c.places.update({
            params: { id: place.id },
            payload: {
              ...(name !== place.name && { name }),
              ...(category !== place.category && { category }),
              ...(address.trim() !== (place.address ?? "") && { address: address.trim() || null }),
              ...(notes.trim() !== (place.notes ?? "") && { notes: notes.trim() || null }),
              ...(status !== (place.status ?? "none") && {
                status: status === "none" ? null : status,
              }),
              facts,
              ...(tagNames !== place.tags.map((t) => t.name).join(", ") && { tags: names }),
              ...((listIds.size !== place.listIds.length ||
                place.listIds.some((id) => !listIds.has(id))) && { listIds: [...listIds] }),
            },
          }),
        )
        onSaved(next)
        setSaving(false)
      } catch (cause) {
        setError(errorMessage(cause))
        setSaving(false)
      }
    })()
  }

  return (
    <form
      onSubmit={save}
      className="filter-sheet flex flex-col gap-4 rounded-md p-4"
      aria-labelledby="place-edit-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="place-edit-heading" className="text-lg font-medium">
          Edit
        </h2>
        <p className="text-xs text-muted-foreground">
          Your edits are kept when Google details are refreshed.
        </p>
      </div>

      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="place-name">Name</FieldLabel>
          <Input id="place-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field>
          <FieldLabel htmlFor="place-category">Type</FieldLabel>
          <Select value={category} onValueChange={(v) => setCategory(v as PlaceCategory)}>
            <SelectTrigger id="place-category" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...new Set([...placeCategories, place.category])].map((value) => (
                <SelectItem key={value} value={value}>
                  {categoryLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="place-status">Status</FieldLabel>
          <Select value={status} onValueChange={(v) => setStatus(v as PlaceStatus | "none")}>
            <SelectTrigger id="place-status" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No status</SelectItem>
              <SelectItem value="want_to_go">Want to go</SelectItem>
              <SelectItem value="been_there">Been there</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor="place-address">Address</FieldLabel>
          <Input id="place-address" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="place-phone">Phone</FieldLabel>
          <Input
            id="place-phone"
            type="tel"
            maxLength={100}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Not set"
            className="max-w-xs"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="place-website">Website</FieldLabel>
          <Input
            id="place-website"
            maxLength={2048}
            type="url"
            pattern="https?://.+"
            placeholder="https://"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="place-cuisine">Cuisine</FieldLabel>
          <Input
            id="place-cuisine"
            maxLength={200}
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="place-price">Price range</FieldLabel>
          <select
            id="place-price"
            className="w-fit rounded-md border bg-background px-3 py-2 text-sm"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          >
            <option value="">Unspecified</option>
            {priceLevels.map((level) => (
              <option key={level} value={level}>
                {level[0]?.toUpperCase()}
                {level.slice(1).replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <FieldLabel htmlFor="place-notes">Notes</FieldLabel>
          <Textarea
            id="place-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="place-tags">Tags</FieldLabel>
          <Input
            id="place-tags"
            value={tagNames}
            onChange={(e) => setTagNames(e.target.value)}
            placeholder="date-night, pizza"
          />
          <p className="text-xs text-muted-foreground">Comma-separated. New names create tags.</p>
        </Field>
        {lists.length > 0 && (
          <Field>
            <FieldLabel>Lists</FieldLabel>
            <ul className="flex flex-col gap-2">
              {lists.map((list) => (
                <li key={list.id} className="flex min-h-11 items-center gap-2 text-sm sm:min-h-0">
                  <input
                    type="checkbox"
                    id={`list-${list.id}`}
                    checked={listIds.has(list.id)}
                    onChange={() => toggleList(list.id)}
                    className="size-4"
                  />
                  <label htmlFor={`list-${list.id}`}>{list.name}</label>
                </li>
              ))}
            </ul>
          </Field>
        )}
      </FieldGroup>
      <ErrorAlert message={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-11 w-fit sm:min-h-8" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 sm:min-h-8"
          disabled={saving}
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
