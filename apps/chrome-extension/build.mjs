import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { zipSync } from "fflate"

const source = new URL("extension/", import.meta.url)
const manifest = JSON.parse(await readFile(new URL("manifest.json", source), "utf8"))
const pkg = JSON.parse(await readFile(new URL("package.json", import.meta.url), "utf8"))
if (manifest.version !== pkg.version) throw new Error("Manifest and package versions must match")
const files = {}
for (const name of (await readdir(source)).sort())
  files[name] = await readFile(new URL(name, source))
const dist = new URL("dist/", import.meta.url)
await mkdir(dist, { recursive: true })
await writeFile(new URL(`placard-chrome-${manifest.version}.zip`, dist), zipSync(files))
