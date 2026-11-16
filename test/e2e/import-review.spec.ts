import { expect, test } from "@playwright/test"
import { signInAsAdmin } from "./support.ts"

test("a Takeout row can be pinned and another linked to it without Google", async ({
  page,
  baseURL,
}) => {
  // This test creates and commits an import on the throwaway installation.
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL))
  await signInAsAdmin(page, baseURL as string)
  await page.route(/tile\.openstreetmap\.org/, (route) => route.abort())
  const suffix = crypto.randomUUID().slice(0, 8)
  const name = `Canal Cafe ${suffix}`
  const list = `Canal walks ${suffix}`
  const runResponse = await page.request.post("/api/import/runs", {
    data: {
      kind: "files",
      files: [
        {
          path: `Saved/${list}.csv`,
          text: `Title,Note,URL,Tags,Comment\n${name},Try lunch,https://maps.google.com/?cid=15,,\n${name} terrace,Outside tables,https://maps.google.com/?cid=16,,`,
        },
      ],
    },
  })
  expect(runResponse.ok()).toBe(true)
  const { id } = await runResponse.json()
  await page.goto(`/import/${id}`)
  await page.getByRole("button", { name: "Keep all shown", exact: false }).click()
  await page.getByRole("button", { name: "Commit kept" }).click()
  await page.getByRole("button", { name: "Confirm commit" }).click()
  const row = page.getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) })
  await row.getByRole("button", { name: "Drop a pin" }).click()
  await row.getByLabel("Latitude").fill("50.8505")
  await row.getByLabel("Longitude").fill("4.3525")
  await row.getByRole("button", { name: "Set pin" }).click()
  await expect(row.getByLabel("Name", { exact: true })).toHaveValue(name)
  await row.getByRole("button", { name: "Save import pin" }).click()
  await expect(row).toHaveCount(0)

  await page.getByRole("button", { name: "Link to a saved place" }).click()
  await page.getByLabel("Search your saved places").fill(name)
  await page.getByRole("button", { name: `Link to ${name}`, exact: true }).click()
  await expect(page.getByText(/Import finished. Matched 2, needs review 0/)).toBeVisible()

  const entries = await page.request.post(`/api/import/runs/${id}/entries`, { data: {} })
  const [first, second] = await entries.json()
  expect(first.placeId).toBeTruthy()
  expect(second.placeId).toBe(first.placeId)
  await page.goto(`/places/${first.placeId}`)
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible()
  await expect(page.getByText(list, { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Add hours" }).click()
  await page.getByLabel("Place’s time zone").fill("Europe/Brussels")
  await page.getByLabel("Monday", { exact: true }).selectOption("intervals")
  await page.getByLabel("Monday opens 1").fill("11:30")
  await page.getByLabel("Monday closes 1").fill("14:00")
  await page.getByRole("button", { name: "Add interval" }).click()
  await page.getByLabel("Monday opens 2").fill("18:00")
  await page.getByLabel("Monday closes 2").fill("22:00")
  await page.getByRole("button", { name: "Copy to Tue–Fri" }).click()
  await expect(page.getByLabel("Friday closes 2")).toHaveValue("22:00")
  await page.getByRole("button", { name: "Save hours" }).click()
  await expect(page.getByRole("button", { name: "Edit hours" })).toBeVisible()
  await page.getByRole("button", { name: "Edit", exact: true }).click()
  await page.getByLabel("Website", { exact: true }).fill("https://example.org/canal")
  await page.getByLabel("Cuisine", { exact: true }).fill("Belgian")
  await page.getByLabel("Price range", { exact: true }).selectOption("moderate")
  await page.getByRole("button", { name: "Save changes" }).click()
  await expect(page.getByRole("link", { name: "example.org" })).toHaveAttribute(
    "href",
    "https://example.org/canal",
  )
  await page.reload()
  await expect(page.getByText("Belgian", { exact: true })).toBeVisible()
  await expect(page.getByText("Moderate", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Edit hours" }).click()
  await expect(page.getByLabel("Friday opens 2")).toHaveValue("18:00")
  await expect(page.getByLabel("Place’s time zone")).toHaveValue("Europe/Brussels")
})
