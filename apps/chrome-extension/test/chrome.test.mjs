import assert from "node:assert/strict"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import test from "node:test"
import { fileURLToPath } from "node:url"
import { chromium, expect } from "@playwright/test"

test("Chrome toolbar action configures an instance and opens the review at its subpath", async () => {
  const profile = await mkdtemp(path.join(tmpdir(), "placard-chrome-"))
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: true,
    args: ["--enable-unsafe-extension-debugging"],
    ignoreDefaultArgs: ["--disable-extensions"],
  })
  try {
    const page = context.pages()[0]
    const browser = await context.browser().newBrowserCDPSession()
    const { id } = await browser.send("Extensions.loadUnpacked", {
      path: fileURLToPath(new URL("../extension", import.meta.url)),
    })
    await context.route("https://www.google.com/**", (route) =>
      route.fulfill({ body: "Maps fixture" }),
    )
    await context.route("https://placard.example/**", (route) =>
      route.fulfill({ body: "Review fixture" }),
    )
    const maps = "https://www.google.com/maps/place/Caf%C3%A9+Sperl/@47,1,12z/data=!3d48.2!4d16.36"
    await page.goto(maps)
    const { targetInfos } = await browser.send("Target.getTargets", { filter: [{ type: "tab" }] })
    const { targetId } = targetInfos.find((target) => target.url === maps) ?? targetInfos[0]
    const act = () => browser.send("Extensions.triggerAction", { id, targetId })
    const [settings] = await Promise.all([context.waitForEvent("page", { timeout: 5000 }), act()])
    await settings.getByLabel("Placard instance URL").fill("https://placard.example/house")
    await settings.getByRole("button", { name: "Save settings" }).click()
    await expect(settings.getByRole("status")).toContainText("Saved.")
    await settings.close()
    await page.bringToFront()
    const [review] = await Promise.all([context.waitForEvent("page", { timeout: 5000 }), act()])
    await review.waitForURL("https://placard.example/house/save-from-maps?**")
    assert.deepEqual(Object.fromEntries(new URL(review.url()).searchParams), {
      name: "Café Sperl",
      mapsUrl: maps,
      lat: "48.2",
      lng: "16.36",
    })
  } finally {
    await context.close()
    await rm(profile, { recursive: true, force: true })
  }
})
