/**
 * Starts a throwaway PostGIS container and the real server on top of it, so
 * Playwright always sees a fresh install. Used as Playwright's `webServer`.
 */
import { type ChildProcess, spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { PostgreSqlContainer } from "@testcontainers/postgresql"

const POSTGIS_IMAGE = "imresamu/postgis:18-3.6"
const serverDir = fileURLToPath(new URL("..", import.meta.url))
const port = process.env.PORT ?? "3100"

const modulesDir = await mkdtemp(join(tmpdir(), "placard-e2e-modules-"))
const container = await new PostgreSqlContainer(POSTGIS_IMAGE).start()

const childOptions = {
  cwd: serverDir,
  stdio: "inherit" as const,
  env: {
    ...process.env,
    DATABASE_URL: container.getConnectionUri(),
    BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdefghijklmnop",
    PORT: port,
    PLACARD_MODULES_DIR: modulesDir,
    WORKER_HEARTBEAT_FILE: join(modulesDir, "heartbeat"),
    PUBLIC_URL: `http://localhost:${port}`,
    WEB_DIST_DIR: "../web/dist",
    PLACARD_FAKE_GOOGLE: "true",
  },
}

const server = spawn(process.execPath, ["src/main.ts"], childOptions)
let worker: ChildProcess | undefined
let stopping = false
const stop = async (code: number) => {
  if (stopping) return
  stopping = true
  worker?.kill("SIGTERM")
  server.kill("SIGTERM")
  await container.stop().catch(() => undefined)
  await rm(modulesDir, { recursive: true, force: true })
  process.exit(code)
}

process.on("SIGTERM", () => void stop(0))
process.on("SIGINT", () => void stop(0))
server.on("exit", (code) => void stop(code ?? 1))

// The API applies migrations before it starts listening. Import jobs can run after that.
while (!stopping) {
  const ready = await fetch(`http://localhost:${port}/api/health`, {
    signal: AbortSignal.timeout(2_000),
  }).then(
    (r) => r.ok,
    () => false,
  )
  if (ready) {
    worker = spawn(process.execPath, ["src/worker.ts"], childOptions)
    worker.on("exit", (code) => void stop(code ?? 1))
    break
  }
  await new Promise((resolve) => setTimeout(resolve, 250))
}
