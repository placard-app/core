import {
  type GooglePlacesError,
  type ImportCounts,
  type ImportDecision,
  type ImportEntry,
  type ImportEntryFilter,
  ImportInvalidState,
  ImportNotFound,
  type ImportResolveInput,
  type ImportRun,
  type ImportUndoPreview,
  type ImportUpload,
  MAX_IMPORT_FILES,
  MAX_IMPORT_TEXT_BYTES,
  TakeoutParseError,
  validateCustomFieldValue,
} from "@placard/domain"
import { Context, DateTime, Effect, Layer } from "effect"
import { SqlClient } from "effect/sql"
import { v7 as uuidv7 } from "uuid"
import { UsageSource } from "../budget/budget.ts"
import { type GooglePlaceDetails, GooglePlaces } from "../google/places.ts"
import { JobQueue } from "../jobs/queue.ts"
import { createCustomField } from "../places/custom-fields.ts"
import { Enrichment } from "../places/enrichment.ts"
import { Lists } from "../places/lists.ts"
import { Places } from "../places/places.ts"
import { decodeBase64Zip, parseTakeoutFiles, type TakeoutFile, unzipTakeout } from "./parse.ts"

interface RunRow {
  readonly id: string
  readonly status: ImportRun["status"]
  readonly source_fingerprint: string
  readonly counts: ImportCounts
  readonly error_message: string | null
  readonly created_at: Date
  readonly committed_at: Date | null
  readonly undone_at: Date | null
}

interface EntryRow {
  readonly id: string
  readonly run_id: string
  readonly dedupe_key: string
  readonly source_file: string
  readonly source_list: string | null
  readonly name: string | null
  readonly address: string | null
  readonly country_code: string | null
  readonly note: string | null
  readonly lat: number | null
  readonly lng: number | null
  readonly google_maps_url: string | null
  readonly cid: string | null
  readonly feature_id: string | null
  readonly saved_at: Date | null
  readonly decision: ImportDecision
  readonly match_status: ImportEntry["matchStatus"]
  readonly place_id: string | null
}
interface TriageRow extends EntryRow {
  readonly already_in_library: boolean
  readonly cross_list_duplicate: boolean
}

/** The second half of a Maps feature ID is the decimal CID encoded in hex. */
const exactGroups = (rows: ReadonlyArray<EntryRow>): EntryRow[][] => {
  const groups = new Map<string, EntryRow[]>()
  for (const row of rows) {
    const hex = row.feature_id?.match(/^0x[0-9a-f]+:(0x[0-9a-f]{1,16})$/i)?.[1]
    const cid = row.cid?.match(/^\d{1,20}$/)?.[0] ?? (hex ? BigInt(hex).toString() : null)
    const key = cid ? `cid:${cid}` : `entry:${row.id}`
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }
  return [...groups.values()].flatMap((group) => {
    const locations = new Set(group.filter((r) => r.lat !== null).map((r) => `${r.lat},${r.lng}`))
    return locations.size > 1 ? group.map((row) => [row]) : [group]
  })
}

const emptyCounts = (): ImportCounts => ({
  parsed: 0,
  kept: 0,
  skipped: 0,
  matched: 0,
  needsReview: 0,
  pending: 0,
})

const toRun = (row: RunRow): ImportRun => ({
  id: row.id,
  status: row.status,
  sourceFingerprint: row.source_fingerprint,
  counts: row.counts,
  expectedApiCalls: row.counts.kept * 3,
  createdAt: DateTime.fromDateUnsafe(row.created_at),
  committedAt: row.committed_at ? DateTime.fromDateUnsafe(row.committed_at) : null,
  undoneAt: row.undone_at ? DateTime.fromDateUnsafe(row.undone_at) : null,
  errorMessage: row.error_message,
})

const toEntry = (row: TriageRow): ImportEntry => ({
  id: row.id,
  runId: row.run_id,
  dedupeKey: row.dedupe_key,
  sourceFile: row.source_file,
  sourceList: row.source_list,
  name: row.name,
  address: row.address,
  countryCode: row.country_code,
  note: row.note,
  location: row.lat !== null && row.lng !== null ? { lat: row.lat, lng: row.lng } : null,
  googleMapsUrl: row.google_maps_url,
  cid: row.cid,
  featureId: row.feature_id,
  savedAt: row.saved_at ? DateTime.fromDateUnsafe(row.saved_at) : null,
  decision: row.decision,
  matchStatus: row.match_status,
  placeId: row.place_id,
  alreadyInLibrary: row.already_in_library,
  crossListDuplicate: row.cross_list_duplicate,
  needsLocation: row.lat === null || row.lng === null,
})

const filesFromUpload = (upload: ImportUpload): Effect.Effect<TakeoutFile[], TakeoutParseError> =>
  Effect.try({
    try: () => {
      if (upload.kind === "files") {
        if (upload.files.length > MAX_IMPORT_FILES) {
          throw new Error(`Too many files for one import (max ${MAX_IMPORT_FILES}).`)
        }
        const totalBytes = upload.files.reduce(
          (sum, file) => sum + Buffer.byteLength(file.text, "utf8"),
          0,
        )
        if (totalBytes > MAX_IMPORT_TEXT_BYTES) {
          throw new Error(
            `Import files are too large (max ${MAX_IMPORT_TEXT_BYTES / (1024 * 1024)} MB).`,
          )
        }
        return [...upload.files]
      }
      const files = unzipTakeout(decodeBase64Zip(upload.contentBase64))
      if (files.length === 0) {
        throw new Error("Zip has no Saved Places.json or Saved/*.csv files")
      }
      return files
    },
    catch: (cause) =>
      new TakeoutParseError({
        message: cause instanceof Error ? cause.message : "Could not read the Takeout upload",
      }),
  })

/** Takeout import: free parse/triage, then commit matching + enrichment. */
export class Import extends Context.Service<
  Import,
  {
    readonly start: (
      ownerId: string,
      upload: ImportUpload,
    ) => Effect.Effect<ImportRun, TakeoutParseError>
    readonly listRuns: (ownerId: string) => Effect.Effect<ReadonlyArray<ImportRun>>
    readonly getRun: (ownerId: string, runId: string) => Effect.Effect<ImportRun, ImportNotFound>
    readonly listEntries: (
      ownerId: string,
      runId: string,
      filter?: ImportEntryFilter,
    ) => Effect.Effect<ReadonlyArray<ImportEntry>, ImportNotFound>
    readonly setDecisions: (
      ownerId: string,
      runId: string,
      entryIds: ReadonlyArray<string>,
      decision: ImportDecision,
    ) => Effect.Effect<ImportRun, ImportNotFound | ImportInvalidState>
    readonly setListDecision: (
      ownerId: string,
      runId: string,
      sourceList: string | null,
      decision: ImportDecision,
    ) => Effect.Effect<ImportRun, ImportNotFound | ImportInvalidState>
    readonly commit: (
      ownerId: string,
      runId: string,
    ) => Effect.Effect<ImportRun, ImportNotFound | ImportInvalidState>
    readonly undoPreview: (
      ownerId: string,
      runId: string,
    ) => Effect.Effect<ImportUndoPreview, ImportNotFound | ImportInvalidState>
    readonly undo: (
      ownerId: string,
      runId: string,
      confirmEdited: boolean,
    ) => Effect.Effect<ImportRun, ImportNotFound | ImportInvalidState>
    /** Drop a needs-review entry (and soft-delete its import-created place, if any). */
    readonly dismissReview: (
      ownerId: string,
      runId: string,
      entryId: string,
    ) => Effect.Effect<ImportRun, ImportNotFound | ImportInvalidState>
    /** Keep an already-created weak-match place and mark the entry matched. */
    readonly acceptReview: (
      ownerId: string,
      runId: string,
      entryId: string,
    ) => Effect.Effect<ImportRun, ImportNotFound | ImportInvalidState>
    /** Resolve a needs-review entry to a saved place, a pin, or a Google place. */
    readonly resolveReview: (
      ownerId: string,
      runId: string,
      entryId: string,
      input: ImportResolveInput,
    ) => Effect.Effect<ImportRun, ImportNotFound | ImportInvalidState | GooglePlacesError>
    readonly runParseJob: (
      runId: string,
      upload?: ImportUpload,
      lastAttempt?: boolean,
    ) => Effect.Effect<void>
    readonly runCommitJob: (runId: string, lastAttempt?: boolean) => Effect.Effect<void>
  }
>()("placard/Import") {
  static readonly layer = Layer.effect(
    Import,
    Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const places = yield* Places
      const lists = yield* Lists
      const google = yield* GooglePlaces
      const enrichment = yield* Enrichment
      const jobs = yield* JobQueue
      const point = (lat: number, lng: number) =>
        sql`st_setsrid(st_makepoint(${lng}, ${lat}), 4326)::geography`

      const loadRun = (ownerId: string, runId: string, lock = false) =>
        sql<RunRow>`
          select id, status, source_fingerprint, counts, error_message,
                 created_at, committed_at, undone_at
          from import_runs
          where id = ${runId} and owner_id = ${ownerId} ${lock ? sql`for update` : sql``}`.pipe(
          Effect.orDie,
          Effect.flatMap((rows) => (rows[0] ? Effect.succeed(rows[0]) : new ImportNotFound())),
        )

      const loadRunById = (runId: string) =>
        sql<RunRow & { owner_id: string }>`
          select id, owner_id, status, source_fingerprint, counts, error_message,
                 created_at, committed_at, undone_at
          from import_runs where id = ${runId}`.pipe(
          Effect.orDie,
          Effect.flatMap((rows) =>
            rows[0] ? Effect.succeed(rows[0]) : Effect.die(`import run ${runId} missing`),
          ),
        )

      const recount = (runId: string) =>
        Effect.gen(function* () {
          const [row] = yield* sql<{
            parsed: number
            kept: number
            skipped: number
            matched: number
            needs_review: number
            pending: number
          }>`
            select
              count(*)::int as parsed,
              count(*) filter (where decision = 'keep')::int as kept,
              count(*) filter (where decision = 'skip')::int as skipped,
              count(*) filter (where match_status = 'matched')::int as matched,
              count(*) filter (where match_status = 'needs_review')::int as needs_review,
              count(*) filter (where decision = 'pending')::int as pending
            from import_entries where run_id = ${runId}`.pipe(Effect.orDie)
          const counts: ImportCounts = {
            parsed: row?.parsed ?? 0,
            kept: row?.kept ?? 0,
            skipped: row?.skipped ?? 0,
            matched: row?.matched ?? 0,
            needsReview: row?.needs_review ?? 0,
            pending: row?.pending ?? 0,
          }
          yield* sql`
            update import_runs set counts = ${JSON.stringify(counts)}::jsonb
            where id = ${runId}`.pipe(Effect.orDie)
          return counts
        })

      const entryColumns = sql`
        e.id, e.run_id, e.dedupe_key, e.source_file, e.source_list, e.name, e.address,
        e.country_code, e.note,
        st_y(e.location::geometry) as lat, st_x(e.location::geometry) as lng,
        e.google_maps_url, e.cid, e.feature_id, e.saved_at, e.decision, e.match_status, e.place_id`
      const entrySelect = sql`
        ${entryColumns}, exists (
          select 1 from places p
          where p.owner_id = e.owner_id and p.deleted_at is null
            and e.name is not null and lower(p.name) = lower(e.name)
            and (
              e.location is null
              or st_dwithin(p.location, e.location, 50)
            )
        ) as already_in_library,
        exists (
          select 1 from import_entries o
          where o.run_id = e.run_id and o.dedupe_key = e.dedupe_key and o.id <> e.id
        ) as cross_list_duplicate`

      const fillStaging = (ownerId: string, runId: string, files: ReadonlyArray<TakeoutFile>) =>
        Effect.gen(function* () {
          const parsed = yield* Effect.try({
            try: () => parseTakeoutFiles(files),
            catch: (cause) =>
              new TakeoutParseError({
                message: cause instanceof Error ? cause.message : "Takeout parse failed",
              }),
          })

          const skips = yield* sql<{ dedupe_key: string }>`
            select dedupe_key from import_skips where owner_id = ${ownerId}`.pipe(Effect.orDie)
          const skipSet = new Set(skips.map((s) => s.dedupe_key))

          for (const entry of parsed.entries) {
            const decision = skipSet.has(entry.dedupeKey) ? "skip" : "pending"
            yield* sql`
              insert into import_entries (
                id, run_id, owner_id, dedupe_key, source_file, source_list, name, address,
                country_code, note, location, google_maps_url, cid, feature_id, saved_at, decision
              ) values (
                ${uuidv7()}, ${runId}, ${ownerId}, ${entry.dedupeKey}, ${entry.sourceFile},
                ${entry.sourceList}, ${entry.name}, ${entry.address}, ${entry.countryCode},
                ${entry.note},
                ${entry.location ? point(entry.location.lat, entry.location.lng) : null},
                ${entry.googleMapsUrl}, ${entry.cid}, ${entry.featureId},
                ${entry.savedAt}, ${decision}
              )
              on conflict (run_id, dedupe_key, source_file) do nothing`.pipe(Effect.orDie)
          }

          yield* sql`
            update import_runs set
              status = 'triage',
              source_fingerprint = ${parsed.fingerprint},
              error_message = null
            where id = ${runId}`.pipe(Effect.orDie)
          yield* recount(runId)
        })

      const applyDecisions = (
        ownerId: string,
        runId: string,
        entryIds: ReadonlyArray<string>,
        decision: ImportDecision,
      ) =>
        Effect.gen(function* () {
          const run = yield* loadRun(ownerId, runId)
          if (run.status !== "triage") {
            return yield* new ImportInvalidState({
              message: "Decisions can only change while the import is in triage.",
            })
          }
          if (entryIds.length === 0) return toRun(run)
          yield* sql`
            update import_entries set decision = ${decision}
            where run_id = ${runId} and owner_id = ${ownerId}
              and ${sql.in("id", entryIds)}`.pipe(Effect.orDie)

          const keys = yield* sql<{ dedupe_key: string }>`
            select distinct dedupe_key from import_entries
            where run_id = ${runId} and ${sql.in("id", entryIds)}`.pipe(Effect.orDie)

          if (decision === "skip") {
            for (const { dedupe_key } of keys) {
              yield* sql`
                insert into import_skips (owner_id, dedupe_key)
                values (${ownerId}, ${dedupe_key})
                on conflict do nothing`.pipe(Effect.orDie)
            }
          } else if (keys.length > 0) {
            yield* sql`
              delete from import_skips
              where owner_id = ${ownerId}
                and ${sql.in(
                  "dedupe_key",
                  keys.map((k) => k.dedupe_key),
                )}`.pipe(Effect.orDie)
          }

          yield* recount(runId)
          return toRun(yield* loadRun(ownerId, runId))
        })

      const buildUndoPreview = (ownerId: string, runId: string) =>
        Effect.gen(function* () {
          const run = yield* loadRun(ownerId, runId)
          if (run.status !== "done") {
            return yield* new ImportInvalidState({
              message: "Only a finished import can be undone.",
            })
          }
          const placeCount = yield* sql<{ n: number }>`
            select count(*)::int as n from places
            where owner_id = ${ownerId} and import_run_id = ${runId} and deleted_at is null`.pipe(
            Effect.map((rows) => rows[0]?.n ?? 0),
            Effect.orDie,
          )
          const listCount = yield* sql<{ n: number }>`
            select count(*)::int as n from lists
            where owner_id = ${ownerId} and import_run_id = ${runId}`.pipe(
            Effect.map((rows) => rows[0]?.n ?? 0),
            Effect.orDie,
          )
          const editedPlaces = yield* sql<{ id: string; name: string }>`
            select id, name from places
            where owner_id = ${ownerId} and import_run_id = ${runId} and deleted_at is null
              and cardinality(manual_fields) > 0
            order by name`.pipe(Effect.orDie)
          return { placeCount, listCount, editedPlaces }
        })

      const matchEntry = (entry: EntryRow) =>
        Effect.gen(function* () {
          const name = entry.name?.trim()
          const near =
            entry.lat !== null && entry.lng !== null ? { lat: entry.lat, lng: entry.lng } : null
          const query = name || entry.address || "place"
          const hits = yield* google.searchText(query, near).pipe(
            Effect.catchTag("GoogleKeyMissing", () => Effect.succeed([])),
            Effect.catchTag("GooglePlacesFailed", () => Effect.succeed([])),
          )
          const hit = hits[0]
          if (!hit) return { status: "needs_review" as const, details: null }

          const nameOverlap =
            name !== undefined &&
            name !== "" &&
            (hit.name.toLowerCase().includes(name.toLowerCase()) ||
              name.toLowerCase().includes(hit.name.toLowerCase().slice(0, 8)))
          if (!nameOverlap && !entry.feature_id && !entry.cid) {
            return { status: "needs_review" as const, details: null }
          }
          const details = yield* google.details(hit.googlePlaceId, null).pipe(
            Effect.catchTag("GoogleKeyMissing", () => Effect.succeed(null)),
            Effect.catchTag("GooglePlacesFailed", () => Effect.succeed(null)),
          )
          if (!details) return { status: "needs_review" as const, details: null }
          return { status: "matched" as const, details }
        })

      const saveGoogle = (ownerId: string, runId: string, details: GooglePlaceDetails) =>
        Effect.gen(function* () {
          const saved = yield* places.addFromGoogle(ownerId, details, "takeout", {
            importRunId: runId,
          })
          return {
            placeId: saved.place.id,
            enrich: saved.created
              ? enrichment.applyDetails(ownerId, saved.place.id, details).pipe(Effect.orDie)
              : Effect.void,
          }
        })

      const attachEntry = (
        ownerId: string,
        entry: EntryRow,
        placeId: string,
        status: "matched" | "needs_review",
      ) =>
        Effect.gen(function* () {
          if (entry.source_list) {
            const list = yield* lists.ensure(ownerId, entry.source_list, {
              importRunId: entry.run_id,
            })
            yield* sql`insert into list_items (list_id, place_id) values (${list.id}, ${placeId})
            on conflict do nothing`.pipe(Effect.orDie)
          }
          const note = entry.note?.trim()
          if (note) {
            yield* sql`update places set notes = concat_ws(chr(10) || chr(10), nullif(notes, ''), ${note}::text)
            where id = ${placeId} and strpos(chr(10) || chr(10) || coalesce(notes, '') || chr(10) || chr(10),
              chr(10) || chr(10) || ${note}::text || chr(10) || chr(10)) = 0`.pipe(Effect.orDie)
          }
          const url = entry.google_maps_url
          if (url && /^https?:\/\//i.test(url) && validateCustomFieldValue("url", url).ok) {
            const existing = yield* sql`select 1 from place_custom_fields
            where place_id = ${placeId} and type = 'url' and value = ${url} limit 1`.pipe(
              Effect.orDie,
            )
            if (!existing.length) {
              yield* createCustomField(sql, placeId, {
                label: "Takeout Maps link",
                type: "url",
                value: url,
              }).pipe(Effect.orDie)
            }
          }
          yield* sql`update import_entries set match_status = ${status}, place_id = ${placeId}
          where id = ${entry.id}`.pipe(Effect.orDie)
        })

      const executeCommit = (runId: string) =>
        Effect.gen(function* () {
          const run = yield* loadRunById(runId)
          if (run.status !== "committing") return
          const ownerId = run.owner_id
          const rows = yield* sql<EntryRow>`select ${entryColumns} from import_entries e
            where e.run_id = ${runId} order by e.id`.pipe(Effect.orDie)
          for (const group of exactGroups(rows)) {
            const kept = group.filter((row) => row.decision === "keep" && !row.place_id)
            if (!kept.length) continue
            const located = group.find((row) => row.lat !== null && row.lng !== null)
            if (!located || located.lat === null || located.lng === null) {
              yield* sql`update import_entries set match_status = 'needs_review'
                where decision = 'keep' and match_status = 'unmatched' and place_id is null and ${sql.in(
                  "id",
                  kept.map((row) => row.id),
                )}`.pipe(Effect.orDie)
              continue
            }
            const location = { lat: located.lat, lng: located.lng }
            const matched = group.some((r) => r.place_id) ? null : yield* matchEntry(located)
            const enrich = yield* sql
              .withTransaction(
                Effect.gen(function* () {
                  const currentRun = yield* loadRun(ownerId, runId, true)
                  if (currentRun.status !== "committing") return Effect.void
                  const groupEntries = yield* sql<{ id: string; place_id: string | null }>`
                select e.id, p.id as place_id from import_entries e
                left join places p on p.id = e.place_id and p.owner_id = e.owner_id and p.deleted_at is null
                where ${sql.in(
                  "e.id",
                  group.map((r) => r.id),
                )}`
                  const pendingIds = new Set(
                    groupEntries.filter((r) => !r.place_id).map((r) => r.id),
                  )
                  const pending = kept.filter((r) => pendingIds.has(r.id))
                  if (pending.length === 0) return Effect.void

                  const existing = groupEntries.find((r) => r.place_id)?.place_id
                  const details = matched?.details
                  let placeId: string
                  let enrich = Effect.void
                  if (existing) {
                    placeId = existing
                  } else if (details) {
                    const saved = yield* saveGoogle(ownerId, runId, details)
                    placeId = saved.placeId
                    enrich = saved.enrich
                  } else {
                    const saved = yield* places.addFromTakeout(ownerId, {
                      name: located.name ?? pending[0]?.name ?? "Imported place",
                      category: "other",
                      location,
                      address: located.address,
                      notes: null,
                      importRunId: runId,
                    })
                    placeId = saved.place.id
                  }
                  yield* ownPlace(ownerId, placeId)
                  for (const entry of pending) {
                    yield* attachEntry(
                      ownerId,
                      entry,
                      placeId,
                      details || group.length > 1 ? "matched" : "needs_review",
                    )
                  }
                  yield* recount(runId)
                  return enrich
                }),
              )
              .pipe(Effect.orDie)
            yield* enrich
          }

          yield* recount(runId)
          yield* sql`
            update import_runs set status = 'done', committed_at = now()
            where id = ${runId} and status = 'committing'`.pipe(Effect.orDie)
        })

      const reviewEntry = (ownerId: string, runId: string, entryId: string, lock = true) =>
        Effect.gen(function* () {
          const run = yield* loadRun(ownerId, runId, lock)
          if (run.status !== "done") {
            return yield* new ImportInvalidState({
              message: "Needs-review actions are only available after commit.",
            })
          }
          const [entry] = yield* sql<EntryRow>`select ${entryColumns} from import_entries e
            where e.id = ${entryId} and e.run_id = ${runId} and e.owner_id = ${ownerId}`.pipe(
            Effect.orDie,
          )
          if (entry?.match_status !== "needs_review") {
            return yield* new ImportInvalidState({
              message: "That entry is not waiting for review.",
            })
          }
          return entry
        })

      const ownPlace = (ownerId: string, placeId: string) =>
        sql`select id from places where id = ${placeId} and owner_id = ${ownerId}
          and deleted_at is null for update`.pipe(
          Effect.orDie,
          Effect.flatMap((rows) =>
            rows.length
              ? Effect.void
              : new ImportInvalidState({ message: "Choose a place from your library." }),
          ),
        )

      type ReviewTarget =
        | Exclude<ImportResolveInput, { googlePlaceId: string }>
        | { details: GooglePlaceDetails }

      const resolveTarget = (ownerId: string, entry: EntryRow, target: ReviewTarget) =>
        Effect.gen(function* () {
          if ("details" in target) return yield* saveGoogle(ownerId, entry.run_id, target.details)
          if ("placeId" in target) return { placeId: target.placeId, enrich: Effect.void }
          if (entry.place_id) {
            const [moved] = yield* sql<{ id: string }>`
              update places p set location = ${point(target.location.lat, target.location.lng)},
                name = coalesce(${target.name ?? null}, p.name),
                address = coalesce(${target.address ?? null}, p.address), updated_at = now()
              where p.id = ${entry.place_id} and p.owner_id = ${ownerId} and p.import_run_id = ${entry.run_id}
                and p.deleted_at is null and not exists (
                  select 1 from import_entries e where e.place_id = p.id and e.id <> ${entry.id}
                )
              returning p.id`.pipe(Effect.orDie)
            if (moved) return { placeId: moved.id, enrich: Effect.void }
          }
          const saved = yield* places.addFromTakeout(ownerId, {
            name: target.name ?? entry.name ?? "Imported place",
            category: "other",
            location: target.location,
            address: target.address ?? entry.address,
            notes: null,
            importRunId: entry.run_id,
          })
          return { placeId: saved.place.id, enrich: Effect.void }
        })

      const retireWeakPin = (ownerId: string, entry: EntryRow) =>
        entry.place_id
          ? sql`update places set deleted_at = now()
          where id = ${entry.place_id} and owner_id = ${ownerId} and import_run_id = ${entry.run_id}
            and deleted_at is null and not exists (
              select 1 from import_entries e where e.place_id = places.id
            )`.pipe(Effect.orDie, Effect.asVoid)
          : Effect.void

      const failRun = (runId: string, message: string) =>
        sql`update import_runs set status = 'failed', error_message = ${message}
            where id = ${runId} and status in ('parsing','committing')`.pipe(
          Effect.asVoid,
          Effect.orDie,
        )

      return {
        start: Effect.fn("Import.start")(function* (ownerId, upload) {
          const id = uuidv7()
          yield* sql`
            insert into import_runs (id, owner_id, status, source_fingerprint, counts)
            values (
              ${id}, ${ownerId}, 'parsing', '',
              ${JSON.stringify(emptyCounts())}::jsonb
            )`.pipe(Effect.orDie)
          yield* jobs
            .enqueueImportParse({ runId: id, upload })
            .pipe(
              Effect.catchCause((cause) =>
                failRun(id, "Could not queue the import. Please upload it again.").pipe(
                  Effect.andThen(Effect.failCause(cause)),
                ),
              ),
            )
          return toRun(yield* loadRun(ownerId, id).pipe(Effect.orDie))
        }),

        listRuns: (ownerId) =>
          sql<RunRow>`
            select id, status, source_fingerprint, counts, error_message,
                   created_at, committed_at, undone_at
            from import_runs where owner_id = ${ownerId}
            order by created_at desc`.pipe(
            Effect.map((rows) => rows.map(toRun)),
            Effect.orDie,
          ),

        getRun: (ownerId, runId) => loadRun(ownerId, runId).pipe(Effect.map(toRun)),

        listEntries: Effect.fn("Import.listEntries")(function* (ownerId, runId, filter) {
          yield* loadRun(ownerId, runId)
          const clauses = [sql`e.run_id = ${runId}`, sql`e.owner_id = ${ownerId}`]
          if (filter?.decision) clauses.push(sql`e.decision = ${filter.decision}`)
          if (filter?.matchStatus) clauses.push(sql`e.match_status = ${filter.matchStatus}`)
          if (filter?.sourceList !== undefined) {
            clauses.push(
              filter.sourceList === null
                ? sql`e.source_list is null`
                : sql`e.source_list = ${filter.sourceList}`,
            )
          }
          if (filter?.text) {
            const q = `%${filter.text}%`
            clauses.push(sql`(e.name ilike ${q} or e.address ilike ${q} or e.note ilike ${q})`)
          }
          if (filter?.needsLocation === true) clauses.push(sql`e.location is null`)
          if (filter?.needsLocation === false) clauses.push(sql`e.location is not null`)
          if (filter?.alreadyInLibrary === true) {
            clauses.push(sql`exists (
              select 1 from places p
              where p.owner_id = e.owner_id and p.deleted_at is null
                and e.name is not null and lower(p.name) = lower(e.name)
            )`)
          }
          const rows = yield* sql<TriageRow>`
            select ${entrySelect}
            from import_entries e
            where ${sql.and(clauses)}
            order by e.source_list nulls first, e.name nulls last, e.id`.pipe(Effect.orDie)
          return rows.map(toEntry)
        }),

        setDecisions: applyDecisions,

        setListDecision: Effect.fn("Import.setListDecision")(
          function* (ownerId, runId, sourceList, decision) {
            const listClause =
              sourceList === null ? sql`source_list is null` : sql`source_list = ${sourceList}`
            const ids = yield* sql<{ id: string }>`
              select id from import_entries
              where run_id = ${runId} and owner_id = ${ownerId} and ${listClause}`.pipe(
              Effect.orDie,
            )
            return yield* applyDecisions(
              ownerId,
              runId,
              ids.map((r) => r.id),
              decision,
            )
          },
        ),

        commit: Effect.fn("Import.commit")(function* (ownerId, runId) {
          const run = yield* loadRun(ownerId, runId)
          if (run.status !== "triage") {
            return yield* new ImportInvalidState({
              message: "Only a triage import can be committed.",
            })
          }
          if (run.counts.pending > 0) {
            return yield* new ImportInvalidState({
              message: `Still ${run.counts.pending} pending — keep or skip them first.`,
            })
          }
          const claimed = yield* sql<{ id: string }>`
            update import_runs set status = 'committing'
            where id = ${runId} and status = 'triage' returning id`.pipe(Effect.orDie)
          if (claimed.length === 0) {
            return yield* new ImportInvalidState({
              message: "This import is already being committed.",
            })
          }
          yield* jobs
            .enqueueImportCommit({ runId })
            .pipe(
              Effect.catchCause((cause) =>
                sql`update import_runs set status = 'triage' where id = ${runId}`.pipe(
                  Effect.orDie,
                  Effect.andThen(Effect.failCause(cause)),
                ),
              ),
            )
          return toRun(yield* loadRun(ownerId, runId))
        }),

        undoPreview: buildUndoPreview,

        undo: Effect.fn("Import.undo")(
          function* (ownerId, runId, confirmEdited) {
            yield* loadRun(ownerId, runId, true)
            const preview = yield* buildUndoPreview(ownerId, runId)
            if (preview.editedPlaces.length > 0 && !confirmEdited) {
              return yield* new ImportInvalidState({
                message: `${preview.editedPlaces.length} imported places were edited — confirm to remove them too.`,
              })
            }
            yield* sql`
            update places set deleted_at = now()
            where owner_id = ${ownerId} and import_run_id = ${runId} and deleted_at is null`.pipe(
              Effect.orDie,
            )
            yield* sql`
            delete from lists where owner_id = ${ownerId} and import_run_id = ${runId}`.pipe(
              Effect.orDie,
            )
            yield* sql`
            update import_runs set status = 'undone', undone_at = now() where id = ${runId}`.pipe(
              Effect.orDie,
            )
            return toRun(yield* loadRun(ownerId, runId))
          },
          sql.withTransaction,
          Effect.catchTag("SqlError", Effect.die),
        ),

        runParseJob: (runId, upload, lastAttempt = true) =>
          Effect.gen(function* () {
            const run = yield* loadRunById(runId)
            if (run.status !== "parsing") return
            if (!upload) {
              yield* failRun(runId, "Import upload is missing. Please upload it again.")
              return
            }
            const files = yield* filesFromUpload(upload)
            yield* sql
              .withTransaction(fillStaging(run.owner_id, runId, files))
              .pipe(Effect.catchTag("SqlError", Effect.die))
          }).pipe(
            Effect.catchTag("TakeoutParseError", (error) => failRun(runId, error.message)),
            Effect.catchCause((cause) =>
              (lastAttempt
                ? failRun(runId, "Import parsing failed. Please upload it again.")
                : Effect.void
              ).pipe(Effect.andThen(Effect.failCause(cause))),
            ),
          ),

        runCommitJob: (runId, lastAttempt = true) =>
          executeCommit(runId).pipe(
            Effect.provideService(UsageSource, "Imports"),
            Effect.catchCause((cause) =>
              (lastAttempt
                ? failRun(runId, "Import could not finish. Some places may have been imported.")
                : Effect.void
              ).pipe(Effect.andThen(Effect.failCause(cause))),
            ),
          ),

        dismissReview: Effect.fn("Import.dismissReview")(
          function* (ownerId, runId, entryId) {
            const entry = yield* reviewEntry(ownerId, runId, entryId)
            yield* sql`update import_entries set match_status = 'failed', decision = 'skip', place_id = null
            where id = ${entryId}`.pipe(Effect.orDie)
            yield* retireWeakPin(ownerId, entry)
            yield* sql`insert into import_skips (owner_id, dedupe_key)
            values (${ownerId}, ${entry.dedupe_key}) on conflict do nothing`.pipe(Effect.orDie)
            yield* recount(runId)
            return toRun(yield* loadRun(ownerId, runId))
          },
          sql.withTransaction,
          Effect.catchTag("SqlError", Effect.die),
        ),

        acceptReview: Effect.fn("Import.acceptReview")(
          function* (ownerId, runId, entryId) {
            const entry = yield* reviewEntry(ownerId, runId, entryId)
            if (!entry.place_id)
              return yield* new ImportInvalidState({
                message: "This entry still needs a location.",
              })
            yield* ownPlace(ownerId, entry.place_id)
            yield* attachEntry(ownerId, entry, entry.place_id, "matched")
            yield* recount(runId)
            return toRun(yield* loadRun(ownerId, runId))
          },
          sql.withTransaction,
          Effect.catchTag("SqlError", Effect.die),
        ),

        resolveReview: Effect.fn("Import.resolveReview")(
          function* (ownerId, runId, entryId, input) {
            let target: ReviewTarget
            if ("googlePlaceId" in input) {
              yield* reviewEntry(ownerId, runId, entryId, false)
              target = { details: yield* google.details(input.googlePlaceId, input.sessionToken) }
            } else {
              target = input
            }
            const { run, enrich } = yield* sql
              .withTransaction(
                Effect.gen(function* () {
                  const entry = yield* reviewEntry(ownerId, runId, entryId)
                  const { placeId, enrich } = yield* resolveTarget(ownerId, entry, target)
                  yield* ownPlace(ownerId, placeId)
                  yield* attachEntry(ownerId, entry, placeId, "matched")
                  if (entry.place_id !== placeId) yield* retireWeakPin(ownerId, entry)
                  yield* recount(runId)
                  return { run: toRun(yield* loadRun(ownerId, runId)), enrich }
                }),
              )
              .pipe(Effect.catchTag("SqlError", Effect.die))
            yield* enrich
            return run
          },
        ),
      }
    }),
  )
}
