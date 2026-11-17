export function instanceBase(value) {
  const url = URL.parse(value)
  if (
    !url ||
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new Error("Enter an http or https instance URL, including its deployment path if needed.")
  }
  url.pathname = url.pathname.replace(/\/*$/, "/")
  return url.href
}

const mapsHost = /^(?:(?:www|maps)\.)?google\.(?:com|cat|[a-z]{2}|(?:com|co)\.[a-z]{2})$/
const placeIdPattern = /^[A-Za-z0-9_-]{1,255}$/
const coordinatePair = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/

export function selectedPlace(rawUrl) {
  const url = URL.parse(rawUrl)
  if (
    url?.protocol !== "https:" ||
    !mapsHost.test(url.hostname) ||
    url.port ||
    url.username ||
    url.password
  )
    return null
  const path = url.pathname.replace(/^\/maps\/u\/\d+\//, "/maps/")
  const segment = path.match(/^\/maps\/place\/([^/]+)/)?.[1]
  const queryId = url.searchParams.get("query_place_id")
  const placeId = queryId && placeIdPattern.test(queryId) ? queryId : null
  let name
  if (segment && !segment.startsWith("@") && !segment.startsWith("data=")) {
    try {
      name = decodeURIComponent(segment.replace(/\+/g, " ")).trim()
    } catch {
      return null
    }
  } else if (/^\/maps\/search\/?$/.test(path) && placeId) {
    name = url.searchParams.get("query")?.trim()
  }
  if (!name) return null
  const data = path.match(/\/data=([^/]*)/)?.[1] ?? ""
  const pins = [...data.matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)(?=!|$)/g)]
  const pin = pins.length === 1 ? pins[0] : coordinatePair.exec(name)
  const location =
    pin && Math.abs(Number(pin[1])) <= 90 && Math.abs(Number(pin[2])) <= 180
      ? { lat: Number(pin[1]), lng: Number(pin[2]) }
      : null
  const encodedId = path.match(/!1s(ChIJ[A-Za-z0-9_-]+)(?=[!/]|$)/)?.[1]
  return { name, mapsUrl: url.href, location, placeId: placeId ?? encodedId ?? null }
}

export function reviewUrl(instance, place) {
  if (place.mapsUrl.length > 2000)
    throw new Error(
      "This Maps link exceeds Placard’s 2,000-character limit. Open the place from a shorter Maps link and try again.",
    )
  const url = new URL("save-from-maps", instanceBase(instance))
  url.searchParams.set("name", place.name.slice(0, 200).trim())
  url.searchParams.set("mapsUrl", place.mapsUrl)
  if (place.location) {
    url.searchParams.set("lat", String(place.location.lat))
    url.searchParams.set("lng", String(place.location.lng))
  }
  if (place.placeId) url.searchParams.set("placeId", place.placeId)
  return url.href
}
