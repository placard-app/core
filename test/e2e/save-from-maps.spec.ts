import { resolve } from "node:path"
import { chromium, expect, test } from "@playwright/test"
import { admin, signInAsAdmin } from "./support.ts"

test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), "uses a throwaway Placard installation")

test("the Chrome action carries a selected place through sign-in and a keyless save", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Playwright needs a Placard URL")
  await signInAsAdmin(page, baseURL)
  const keyEndpoint = "/api/admin/settings/google-api-key"
  const headers = { origin: baseURL }
  const key = await page.request.put(keyEndpoint, { data: { apiKey: "fake-key" }, headers })
  expect(key.ok()).toBe(true)
  const usage = async () => (await (await page.request.get("/api/admin/budget")).json()).rows
  const before = await usage()
  const profile = await chromium.launchPersistentContext("", {
    channel: "chromium",
    args: ["--enable-unsafe-extension-debugging"],
    ignoreDefaultArgs: ["--disable-extensions"],
  })
  try {
    const browser = profile.browser()
    if (!browser) throw new Error("Could not connect to Chrome")
    const cdp = await browser.newBrowserCDPSession()
    const { id } = await cdp.send("Extensions.loadUnpacked", {
      path: resolve("apps/chrome-extension/extension"),
    })
    const maps = profile.pages()[0]
    const mapsUrl =
      "https://www.google.com/maps/place/Canal+Coffee/@51.12,2.34,15z/data=!4m6!3m5!1s0x123:0xabcd!8m2!3d50.8505!4d4.3525"
    await maps.route(mapsUrl, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<title>Canal Coffee - Google Maps</title><h1>Canal Coffee</h1>",
      }),
    )
    await maps.goto(mapsUrl)
    const { targetInfos } = await cdp.send("Target.getTargets", { filter: [{ type: "tab" }] })
    const targetInfo = targetInfos.find((target) => target.url === mapsUrl) ?? targetInfos[0]
    const invoke = async () => {
      await maps.bringToFront()
      const nextPage = profile.waitForEvent("page")
      await cdp.send("Extensions.triggerAction", { id, targetId: targetInfo.targetId })
      return nextPage
    }
    const options = await invoke()
    await options.getByLabel(/Placard instance URL/i).fill(baseURL)
    await options.getByRole("button", { name: /save/i }).click()
    await expect(options.getByRole("status")).toContainText("Saved.")
    await options.close()
    const review = await invoke()
    await review.getByLabel("Email").fill(admin.email)
    await review.getByLabel("Password").fill(admin.password)
    await review.getByRole("button", { name: "Sign in" }).click()
    await expect(review.getByLabel("Name", { exact: true })).toHaveValue("Canal Coffee")
    await expect(review.getByRole("button", { name: "Look up details with Google" })).toBeVisible()
    await review.getByLabel("Name", { exact: true }).fill("My canal coffee spot")
    await review.getByRole("button", { name: "Save without Google" }).click()
    await expect(review.getByRole("heading", { name: "My canal coffee spot" })).toBeVisible()
    const savedUrl = review.url()
    const saved = await (
      await page.request.get(savedUrl.replace("/places/", "/api/places/"))
    ).json()
    expect(saved.customFields).toContainEqual(
      expect.objectContaining({ type: "url", value: mapsUrl }),
    )
    expect(saved.location).toEqual({ lat: 50.8505, lng: 4.3525 })
    const movedCamera = mapsUrl.replace("@51.12,2.34", "@50.85,4.36")
    await maps.route(movedCamera, (route) => route.fulfill({ body: "Canal Coffee" }))
    await maps.goto(movedCamera)
    const repeat = await invoke()
    await repeat.getByRole("button", { name: "Save without Google" }).click()
    await expect(repeat).toHaveURL(savedUrl)
    expect(await usage()).toEqual(before)
  } finally {
    await profile.close()
    await page.request.delete(keyEndpoint, { headers })
  }
})

test("Google lookup previews the match and a budget failure leaves the draft editable", async ({
  page,
  baseURL,
}) => {
  if (!baseURL) throw new Error("Playwright needs a Placard URL")
  await signInAsAdmin(page, baseURL)
  const headers = { origin: baseURL }
  const budgetEndpoint = "/api/admin/budget"
  const keyEndpoint = "/api/admin/settings/google-api-key"
  const budget = await (await page.request.get(budgetEndpoint)).json()
  const handoff = (name: string, placeId: string) => {
    const mapsUrl = `https://www.google.com/maps/search/?${new URLSearchParams({
      api: "1",
      query: name,
      query_place_id: placeId,
    })}`
    return `/save-from-maps?${new URLSearchParams({ name, mapsUrl, placeId })}`
  }
  const paris = handoff("Paris", "ChIJ-fixture-city-paris")
  await page.goto(paris)
  await expect(page.getByLabel("Latitude")).toBeEmpty()
  await expect(page.getByRole("button", { name: "Save without Google" })).toBeDisabled()
  await expect(page.getByRole("button", { name: "Look up details with Google" })).toHaveCount(0)
  try {
    expect(
      (await page.request.put(keyEndpoint, { data: { apiKey: "fake-key" }, headers })).ok(),
    ).toBe(true)
    await page.goto(handoff("Unknown cafe", "ChIJ-unknown-place"))
    await page.getByRole("button", { name: "Look up details with Google" }).click()
    await expect(page.getByRole("alert")).toBeVisible()
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Unknown cafe")
    await page.goto(paris)
    await page.getByRole("button", { name: "Look up details with Google" }).click()
    await expect(page.getByLabel("Google place preview")).toContainText("Paris")
    await expect(page).toHaveURL(/save-from-maps/)
    await page.getByRole("button", { name: "Save with Google details" }).click()
    await expect(page.getByRole("heading", { name: "Paris", exact: true })).toBeVisible()
    const parisUrl = page.url()
    await page.goto(paris)
    await page.getByRole("button", { name: "Look up details with Google" }).click()
    await page.getByRole("button", { name: "Open saved place" }).click()
    await expect(page).toHaveURL(parisUrl)

    expect(
      (
        await page.request.put(budgetEndpoint, {
          data: { monthlyLimitUsd: 0, pauseAtLimit: true, useFreeAllowance: false },
          headers,
        })
      ).ok(),
    ).toBe(true)
    await page.goto(handoff("Another cafe", "ChIJ-new-cafe"))
    await page.getByRole("button", { name: "Look up details with Google" }).click()
    await expect(page.getByRole("alert")).toContainText("budget")
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Another cafe")
    await page.getByLabel("Latitude").fill("48.85")
    await page.getByLabel("Longitude").fill("2.35")
    await page.getByRole("button", { name: "Save without Google" }).click()
    await expect(page.getByRole("heading", { name: "Another cafe" })).toBeVisible()
  } finally {
    await page.request.put(budgetEndpoint, { data: budget.settings, headers })
    await page.request.delete(keyEndpoint, { headers })
  }
})
