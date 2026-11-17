import assert from "node:assert/strict"
import test from "node:test"
import { instanceBase, reviewUrl, selectedPlace } from "../extension/capture.js"

test("instance settings retain ports and nested deployment paths", () => {
  assert.equal(
    instanceBase("http://localhost:8080/home/placard"),
    "http://localhost:8080/home/placard/",
  )
  for (const input of [
    "",
    "javascript:alert(1)",
    "https://user:password@example.com",
    "https://example.com/?token=1",
    "https://example.com/#page",
  ]) {
    assert.throws(() => instanceBase(input))
  }
})

test("handoff retains the place coordinates and the original Maps URL", () => {
  const mapsUrl =
    "https://www.google.be/maps/u/0/place/Caf%C3%A9+Sperl/@48,2,14z/data=!3d50.85!4d4.35?hl=fr"
  const place = selectedPlace(mapsUrl)
  assert.equal(place.name, "Café Sperl")
  assert.deepEqual(place.location, { lat: 50.85, lng: 4.35 })
  const handoff = new URL(reviewUrl("https://example.com/placard", place))
  assert.equal(handoff.pathname, "/placard/save-from-maps")
  assert.deepEqual(Object.fromEntries(handoff.searchParams), {
    name: "Café Sperl",
    mapsUrl,
    lat: "50.85",
    lng: "4.35",
  })
})

test("viewport center, missing coordinates, and bad coordinates remain unknown", () => {
  for (const path of [
    "/@48,2,12z",
    "/data=!3d100!4d2",
    "/data=!3d1!4d-181",
    "/data=!3d1!4d2!3d3!4d4",
    "",
  ]) {
    const place = selectedPlace(`https://google.co.uk/maps/place/Test${path}`)
    assert.equal(place.location, null)
    assert.equal(new URL(reviewUrl("https://example.com", place)).searchParams.has("lat"), false)
  }
})

test("place-ID search links and explicit pin names retain exact signals", () => {
  const url = "https://www.google.com/maps/search/?api=1&query=Test&query_place_id=ChIJ_123"
  assert.equal(selectedPlace(url).placeId, "ChIJ_123")
  assert.equal(selectedPlace("https://google.com/maps/place/45.67,-122.5").location.lng, -122.5)
  assert.equal(
    selectedPlace("https://google.com/maps/place/Test/data=!4m2!1sChIJa_b-c!8m2!3d45!4d2").placeId,
    "ChIJa_b-c",
  )
})

test("general map, directions, unselected search, malformed and unrelated URLs cannot create drafts", () => {
  for (const url of [
    "https://www.google.com/maps/@51,4,12z",
    "https://www.google.com/maps/dir/Paris/London",
    "https://www.google.com/maps/search/tacos/",
    "https://www.google.com/maps/search/?api=1&query=tacos",
    "https://www.google.com/maps/place/@51,4,12z",
    "https://www.google.com/maps/place/%ZZ",
    "https://google.com.attacker.com/maps/place/Cafe",
    "https://user:pass@google.com/maps/place/Cafe",
    undefined,
  ])
    assert.equal(selectedPlace(url), null)
})

test("handoff fits the editable name field and explains oversized source links", () => {
  const url = `https://www.google.com/maps/place/${"x".repeat(205)}`
  assert.equal(
    new URL(reviewUrl("http://localhost", selectedPlace(url))).searchParams.get("name").length,
    200,
  )
  assert.throws(
    () => reviewUrl("http://localhost", selectedPlace(`${url}?data=${"x".repeat(2000)}`)),
    /Maps link exceeds/,
  )
})
