import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, layer } from "@effect/vitest"
import { Effect, Layer } from "effect"
import { ServicesLayer } from "../../src/http/api.ts"
import { Import } from "../../src/import/import.ts"
import {
  IMPORT_COMMIT,
  IMPORT_PARSE,
  type ImportCommitJob,
  type ImportParseJob,
} from "../../src/jobs/names.ts"
import { JobQueue } from "../../src/jobs/queue.ts"
import { TestHttpFixtureClient } from "../../src/modules/github-fixture.ts"
import { ModuleRuntime } from "../../src/modules/loader.ts"
import { type Browser, TestApp } from "../layers/app.ts"
import { IntegrationLayer } from "../layers/postgis.ts"

const password = "correct horse battery"
const fixtureRoot = fileURLToPath(new URL("../../../../test/fixtures/takeout", import.meta.url))

const walk = (dir: string, base = dir): Array<{ path: string; text: string }> => {
  const out: Array<{ path: string; text: string }> = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full, base))
    else {
      out.push({
        path: full.slice(base.length + 1).replace(/\\/g, "/"),
        text: readFileSync(full, "utf8"),
      })
    }
  }
  return out
}

// Consume queued jobs explicitly so requests can be checked before any worker runs.
const run = <A>(
  f: (
    app: TestApp["Service"],
    work: (queue: typeof IMPORT_PARSE | typeof IMPORT_COMMIT) => Promise<void>,
  ) => Promise<A>,
) =>
  Effect.gen(function* () {
    const app = yield* TestApp
    const imports = yield* Import
    const { boss } = yield* JobQueue
    const work = async (queue: typeof IMPORT_PARSE | typeof IMPORT_COMMIT) => {
      if (queue === IMPORT_PARSE) {
        for (const job of await boss.fetch<ImportParseJob>(queue, { batchSize: 10 })) {
          await Effect.runPromise(imports.runParseJob(job.data.runId, job.data.upload))
          await boss.complete(queue, job.id)
        }
      } else {
        for (const job of await boss.fetch<ImportCommitJob>(queue, { batchSize: 10 })) {
          await Effect.runPromise(imports.runCommitJob(job.data.runId))
          await boss.complete(queue, job.id)
        }
      }
    }
    return yield* Effect.promise(() => f(app, work))
  })

const ImportTestLayer = Layer.merge(
  TestApp.layer,
  ServicesLayer.pipe(
    Layer.provide(TestHttpFixtureClient),
    Layer.provide(ModuleRuntime.layer),
    Layer.provide(IntegrationLayer),
  ),
)

layer(ImportTestLayer, { concurrent: false, timeout: 120_000 })("takeout import", (it) => {
  const admin = { browser: undefined as unknown as Browser }

  it.effect("setup: sign up and set a Google key", () =>
    run(async (app) => {
      admin.browser = app.browser()
      await admin.browser.send("POST", "/api/auth/sign-up/email", {
        name: "Importer",
        email: "import@example.com",
        password,
      })
      const key = await admin.browser.send("PUT", "/api/admin/settings/google-api-key", {
        apiKey: "fixture-key",
      })
      expect(key.status).toBe(200)
    }),
  )

  it.effect("parse → triage → skip a list → commit → undo", () =>
    run(async (_app, work) => {
      const started = await admin.browser.send("POST", "/api/import/runs", {
        kind: "files",
        files: walk(fixtureRoot),
      })
      expect(started.status).toBe(200)
      expect(started.body.status).toBe("parsing")
      expect(started.body.counts.parsed).toBe(0)

      const runId = started.body.id as string
      const before = await admin.browser.send("POST", `/api/import/runs/${runId}/entries`, {})
      expect(before.body).toHaveLength(0)
      await work(IMPORT_PARSE)
      const parsed = await admin.browser.get(`/api/import/runs/${runId}`)
      expect(parsed.body.status).toBe("triage")
      expect(parsed.body.counts.parsed).toBeGreaterThan(3)
      const entries = await admin.browser.send("POST", `/api/import/runs/${runId}/entries`, {})
      expect(entries.status).toBe(200)
      expect(entries.body.some((e: { needsLocation: boolean }) => e.needsLocation)).toBe(true)

      const skipList = await admin.browser.send("POST", `/api/import/runs/${runId}/lists`, {
        sourceList: "Want to go",
        decision: "skip",
      })
      expect(skipList.status).toBe(200)
      expect(skipList.body.counts.skipped).toBeGreaterThan(0)

      const pending = await admin.browser.send("POST", `/api/import/runs/${runId}/entries`, {
        decision: "pending",
      })
      const keepRest = await admin.browser.send("POST", `/api/import/runs/${runId}/decisions`, {
        entryIds: pending.body.map((e: { id: string }) => e.id),
        decision: "keep",
      })
      expect(keepRest.status).toBe(200)
      expect(keepRest.body.counts.pending).toBe(0)
      expect(keepRest.body.counts.skipped).toBeGreaterThan(0)

      const committed = await admin.browser.send("POST", `/api/import/runs/${runId}/commit`)
      expect(committed.status).toBe(200)
      expect(committed.body.status).toBe("committing")
      expect((await admin.browser.get("/api/places")).body).toHaveLength(0)
      const duplicate = await admin.browser.send("POST", `/api/import/runs/${runId}/commit`)
      expect(duplicate.status).toBe(400)
      await work(IMPORT_COMMIT)
      const finished = await admin.browser.get(`/api/import/runs/${runId}`)
      expect(finished.body.status).toBe("done")
      expect(finished.body.counts.matched + finished.body.counts.needsReview).toBeGreaterThan(0)

      const lists = await admin.browser.get("/api/lists")
      expect(lists.body.map((l: { name: string }) => l.name)).toContain("City trip")

      const places = await admin.browser.get("/api/places")
      expect(places.body.length).toBeGreaterThan(0)

      const undone = await admin.browser.send("POST", `/api/import/runs/${runId}/undo`, {
        confirmEdited: true,
      })
      expect(undone.status).toBe(200)
      expect(undone.body.status).toBe("undone")

      const after = await admin.browser.get("/api/places")
      expect(after.body.length).toBe(0)
    }),
  )

  it.effect("re-import remembers skips", () =>
    run(async (_app, work) => {
      const started = await admin.browser.send("POST", "/api/import/runs", {
        kind: "files",
        files: walk(fixtureRoot),
      })
      expect(started.status).toBe(200)
      expect(started.body.status).toBe("parsing")
      await work(IMPORT_PARSE)
      const parsed = await admin.browser.get(`/api/import/runs/${started.body.id}`)
      expect(parsed.body.counts.skipped).toBeGreaterThan(0)

      const entries = await admin.browser.send(
        "POST",
        `/api/import/runs/${started.body.id}/entries`,
        {
          decision: "skip",
        },
      )
      expect(
        entries.body.every((e: { sourceList: string | null }) => e.sourceList === "Want to go"),
      ).toBe(true)
    }),
  )
  it.effect("resolves exact matches, saved places and manual pins without a Google key", () =>
    run(async (_app, work) => {
      const browser = admin.browser
      await browser.send("DELETE", "/api/admin/settings/google-api-key")
      const sourceLink = "https://www.google.com/maps/place/Diner/data=!1s0x123:0x2a"
      const csv = [
        "Title,Note,URL,Tags,Comment",
        `Diner,Lunch break,${sourceLink},,`,
        "Already saved,Try the soup,https://maps.google.com/?cid=85,,",
        "Diner,Reservation required,https://maps.google.com/?cid=86,,",
        'Weak pin,Call first,"https://www.google.com/maps/search/48,4",,',
      ].join("\n")
      const files = [
        { path: "Saved/Lunch.csv", text: csv },
        {
          path: "Saved Places.json",
          text: JSON.stringify({
            features: [
              {
                geometry: { coordinates: [4.35, 50.85] },
                properties: {
                  google_maps_url: "https://maps.google.com/?cid=42",
                  location: { name: "Diner", address: "Brussels" },
                },
              },
            ],
          }),
        },
      ]
      const started = await browser.send("POST", "/api/import/runs", { kind: "files", files })
      const route = `/api/import/runs/${started.body.id}`
      await work(IMPORT_PARSE)
      const pending = await browser.send("POST", `${route}/entries`, {})
      await browser.send("POST", `${route}/decisions`, {
        entryIds: pending.body.map((entry: { id: string }) => entry.id),
        decision: "keep",
      })
      await browser.send("POST", `${route}/commit`)
      await work(IMPORT_COMMIT)
      const committed = await browser.get(route)
      expect(committed.body.counts).toMatchObject({ matched: 2, needsReview: 3 })
      const library = await browser.get("/api/places")
      expect(library.body).toHaveLength(2)
      const diner = library.body.find((p: { name: string }) => p.name === "Diner")
      expect(diner).toMatchObject({
        name: "Diner",
        address: "Brussels",
        notes: "Lunch break",
      })
      expect(diner.customFields.map((f: { value: string }) => f.value)).toContain(sourceLink)

      const existing = await browser.send("POST", "/api/places/manual", {
        name: "Already saved",
        location: { lat: 51, lng: 5 },
        category: "restaurant",
        address: null,
      })
      const existingId = existing.body.place.id
      await browser.send("PATCH", `/api/places/${existingId}`, { notes: "My original note" })
      const review = await browser.send("POST", `${route}/entries`, { matchStatus: "needs_review" })
      const linkId = review.body.find((e: { name: string }) => e.name === "Already saved").id
      const pinId = review.body.find((e: { name: string }) => e.name === "Diner").id
      const weak = review.body.find((e: { name: string }) => e.name === "Weak pin")
      const move = await browser.send("POST", `${route}/entries/${weak.id}/resolve`, {
        location: { lat: 48.1, lng: 4.1 },
      })
      expect(move.status).toBe(200)
      expect((await browser.get(`/api/places/${weak.placeId}`)).body).toMatchObject({
        name: "Weak pin",
        notes: "Call first",
        location: { lat: 48.1, lng: 4.1 },
      })
      const link = `${route}/entries/${linkId}/resolve`
      expect((await browser.send("POST", link, { placeId: "missing" })).status).toBe(400)
      expect((await browser.send("POST", link, { placeId: existingId })).status).toBe(200)
      const linked = await browser.get(`/api/places/${existingId}`)
      expect(linked.body.notes).toBe("My original note\n\nTry the soup")
      expect(linked.body.listIds).toEqual(diner.listIds)
      expect(linked.body.customFields[0].value).toBe("https://maps.google.com/?cid=85")
      const pin = `${route}/entries/${pinId}/resolve`
      const attempts = await Promise.all(
        [1, 2].map(() =>
          browser.send("POST", pin, { name: "New pin", location: { lat: 49, lng: 3 } }),
        ),
      )
      expect(attempts.map((r) => r.status).sort()).toEqual([200, 400])
      expect((await browser.get(route)).body.counts.needsReview).toBe(0)
      const all = await browser.get("/api/places")
      expect(all.body).toHaveLength(4)
      expect(all.body.find((p: { name: string }) => p.name === "New pin")).toMatchObject({
        source: "takeout",
        location: { lat: 49, lng: 3 },
        notes: "Reservation required",
        listIds: diner.listIds,
      })
      await browser.send("POST", `${route}/undo`, { confirmEdited: true })
      expect((await browser.get("/api/places")).body.map((p: { id: string }) => p.id)).toEqual([
        existingId,
      ])
    }),
  )

  it.effect("invalid archives fail in the worker and expose a useful error", () =>
    run(async (_app, work) => {
      const started = await admin.browser.send("POST", "/api/import/runs", {
        kind: "zip",
        filename: "broken.zip",
        contentBase64: "bm90IGEgemlw",
      })
      expect(started.body.status).toBe("parsing")
      await work(IMPORT_PARSE)
      const failed = await admin.browser.get(`/api/import/runs/${started.body.id}`)
      expect(failed.body.status).toBe("failed")
      expect(failed.body.errorMessage).toBeTruthy()
    }),
  )
})
