import { randomUUID } from "node:crypto"
import { readdir, readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, layer } from "@effect/vitest"
import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { Effect } from "effect"
import { strToU8, zipSync } from "fflate"
import { type Browser, TestApp } from "../layers/app.ts"

const password = "correct horse battery"

const signUp = (browser: Browser, name: string, email: string) =>
  browser.send("POST", "/api/auth/sign-up/email", { name, email, password })

const run = <A>(f: (app: TestApp["Service"]) => Promise<A>) =>
  Effect.gen(function* () {
    const app = yield* TestApp
    return yield* Effect.promise(() => f(app))
  })

const mcpFetch =
  (app: TestApp["Service"], secret: string | null): typeof fetch =>
  (input, init) => {
    const headers = new Headers(init?.headers)
    if (secret) headers.set("authorization", `Bearer ${secret}`)
    return app.fetch(input, { ...init, headers })
  }

layer(TestApp.layer, { concurrent: false, timeout: 120_000 })("mcp", (it) => {
  const admin = { browser: undefined as unknown as Browser }
  let secret = ""
  let placeId = ""
  let listId = ""

  it.effect("token CRUD and MCP status", () =>
    run(async (app) => {
      admin.browser = app.browser()
      expect((await signUp(admin.browser, "Ada", "ada@example.com")).status).toBe(200)

      const status = await admin.browser.get("/api/mcp/status")
      expect(status.status).toBe(200)
      expect(status.body).toMatchObject({ enabled: true })
      expect(status.body.endpoint).toBe(new URL("/mcp", app.publicUrl).href)

      const created = await admin.browser.send("POST", "/api/tokens", { name: "Cursor" })
      expect(created.status).toBe(200)
      expect(created.body.secret).toMatch(/^plc_/)
      expect(created.body.token.name).toBe("Cursor")
      secret = created.body.secret

      const listed = await admin.browser.get("/api/tokens")
      expect(listed.body).toEqual([
        expect.objectContaining({ id: created.body.token.id, name: "Cursor", revokedAt: null }),
      ])
    }),
  )

  it.effect("/mcp rejects missing and revoked tokens", () =>
    run(async (app) => {
      const denied = await app.fetch(new URL("/mcp", app.publicUrl), {
        method: "POST",
        headers: { "content-type": "application/json", origin: app.publicUrl.origin },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "t", version: "0" },
          },
        }),
      })
      expect(denied.status).toBe(401)

      const listed = await admin.browser.get("/api/tokens")
      const id = listed.body[0].id as string
      expect((await admin.browser.send("DELETE", `/api/tokens/${id}`)).status).toBe(200)

      const revoked = await app.fetch(new URL("/mcp", app.publicUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: app.publicUrl.origin,
          authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "t", version: "0" },
          },
        }),
      })
      expect(revoked.status).toBe(401)

      const again = await admin.browser.send("POST", "/api/tokens", { name: "tools" })
      expect(again.status).toBe(200)
      secret = again.body.secret
    }),
  )

  it.effect("seed place + list", () =>
    run(async () => {
      const pin = await admin.browser.send("POST", "/api/places/manual", {
        name: "Da Michele",
        category: "restaurant",
        location: { lat: 40.85, lng: 14.26 },
        address: "Napoli",
      })
      expect(pin.status).toBe(200)
      placeId = pin.body.place.id

      const list = await admin.browser.send("POST", "/api/lists", {
        name: "Italian",
        description: null,
      })
      expect(list.status).toBe(200)
      listId = list.body.id
    }),
  )

  it.effect("MCP SDK client lists tools and calls search / add_to_list / set_status", () =>
    run(async (app) => {
      const transport = new StreamableHTTPClientTransport(new URL("/mcp", app.publicUrl), {
        fetch: mcpFetch(app, secret),
      })
      const client = new Client({ name: "placard-test", version: "0.0.0" })
      await client.connect(transport)

      const tools = await client.listTools()
      const names = tools.tools.map((t) => t.name).sort()
      expect(names).toEqual(
        [
          "lookup_places",
          "save_google_place",
          "add_to_list",
          "create_place",
          "get_place",
          "list_lists",
          "search_places",
          "set_status",
        ].sort(),
      )

      const lookup = await client.callTool({
        name: "lookup_places",
        arguments: { text: "Maison Sureau Brussels" },
      })
      expect(lookup.isError).toBe(true)
      const saveMissingKey = await client.callTool({
        name: "save_google_place",
        arguments: { googlePlaceId: "missing-key-fixture" },
      })
      expect(saveMissingKey.isError).toBe(true)
      const manual = await client.callTool({
        name: "create_place",
        arguments: { name: "Manual MCP café", category: "cafe", lat: 50.85, lng: 4.35 },
      })
      expect(manual.isError).toBeFalsy()

      const search = await client.callTool({
        name: "search_places",
        arguments: { text: "Michele", category: "restaurant" },
      })
      expect(search.isError).toBeFalsy()
      const searchText = (search.content as { type: string; text: string }[])[0]?.text ?? ""
      expect(searchText).toContain("Da Michele")

      const add = await client.callTool({
        name: "add_to_list",
        arguments: { placeId, listId },
      })
      expect(add.isError).toBeFalsy()

      const status = await client.callTool({
        name: "set_status",
        arguments: { placeId, status: "want_to_go" },
      })
      expect(status.isError).toBeFalsy()

      const wanted = await client.callTool({
        name: "search_places",
        arguments: { status: "want_to_go" },
      })
      expect(JSON.stringify(wanted.content)).toContain("Da Michele")
      expect(JSON.stringify(wanted.content)).not.toContain("Manual MCP café")

      const got = await client.callTool({ name: "get_place", arguments: { id: placeId } })
      expect(got.isError).toBeFalsy()
      expect((got.content as { text: string }[])[0]?.text).toContain("want_to_go")

      expect(
        (
          await admin.browser.send("PUT", "/api/admin/settings/google-api-key", {
            apiKey: "AIza-good-key-9876",
          })
        ).status,
      ).toBe(200)
      const candidates = await client.callTool({
        name: "lookup_places",
        arguments: { text: "Sperl" },
      })
      expect(candidates.isError).toBeFalsy()
      expect(JSON.stringify(candidates.content)).toContain("ChIJ-fixture-cafe-sperl")
      expect(JSON.stringify(candidates.content)).toContain("sessionToken")
      const googleArgs = { googlePlaceId: "ChIJ-fixture-cafe-sperl" }
      const saved = await client.callTool({ name: "save_google_place", arguments: googleArgs })
      expect(saved.isError).toBeFalsy()
      expect((saved.content as { text: string }[])[0]?.text).toContain('"created": true')
      expect((saved.content as { text: string }[])[0]?.text).toContain('"source": "mcp"')
      const duplicate = await client.callTool({ name: "save_google_place", arguments: googleArgs })
      expect(duplicate.isError).toBeFalsy()
      expect((duplicate.content as { text: string }[])[0]?.text).toContain('"created": false')
      const failed = await client.callTool({
        name: "save_google_place",
        arguments: { googlePlaceId: "unknown-provider-place" },
      })
      expect(failed.isError).toBe(true)
      await admin.browser.send("DELETE", "/api/admin/settings/google-api-key")

      await client.close()
    }),
  )

  it.effect("disabling module MCP hides that module's tools", () =>
    run(async (app) => {
      const zip = Buffer.from(
        zipSync({
          "placard.module.json": strToU8(
            JSON.stringify({
              id: "demo.mcp",
              name: "MCP Demo",
              version: "0.1.0",
              description: "MCP toggle fixture",
              permissions: ["places.read"],
              nav: [{ path: "/m/demo.mcp", label: "Demo", slot: "more" }],
              source: "upload",
              sdkVersion: "0.1.0",
              webRoutes: [{ path: "/m/demo.mcp", exportName: "DemoPage" }],
              mcpTools: [{ name: "ping", title: "Ping", description: "Fixture ping" }],
            }),
          ),
          "server/index.js": strToU8(`
export function createModule() {
  return {
    mcpTools: [{
      def: { name: "ping", description: "Fixture ping", inputSchema: { type: "object", properties: {} } },
      handler: async () => ({ content: [{ type: "text", text: "pong" }] }),
    }],
  }
}
`),
          "web/index.js": strToU8(`export const DemoPage = () => null\n`),
        }),
      ).toString("base64")

      const uploaded = await admin.browser.send("POST", "/api/modules/upload", {
        filename: "demo.mcp.zip",
        contentBase64: zip,
      })
      expect(uploaded.status).toBe(200)

      const transportOn = new StreamableHTTPClientTransport(new URL("/mcp", app.publicUrl), {
        fetch: mcpFetch(app, secret),
      })
      const clientOn = new Client({ name: "placard-test", version: "0.0.0" })
      await clientOn.connect(transportOn)
      expect((await clientOn.listTools()).tools.map((t) => t.name)).toContain("demo_mcp__ping")
      await clientOn.close()

      const off = await admin.browser.send("PATCH", "/api/modules/me/demo.mcp/mcp", {
        enabled: false,
      })
      expect(off.status).toBe(200)
      expect(off.body.mcpEnabled).toBe(false)

      const transport = new StreamableHTTPClientTransport(new URL("/mcp", app.publicUrl), {
        fetch: mcpFetch(app, secret),
      })
      const client = new Client({ name: "placard-test", version: "0.0.0" })
      await client.connect(transport)
      expect((await client.listTools()).tools.map((t) => t.name)).not.toContain("demo_mcp__ping")
      await client.close()
    }),
  )

  it.effect("bundled Menus saves structured menu data and respects MCP toggle", () =>
    run(async (app) => {
      const root = fileURLToPath(new URL("../../bundled-plugins/places.menus/", import.meta.url))
      const files: Record<string, Uint8Array> = {}
      for (const name of await readdir(root, { recursive: true })) {
        if ((await stat(join(root, name))).isFile()) files[name] = await readFile(join(root, name))
      }
      expect(
        (
          await admin.browser.send("POST", "/api/modules/upload", {
            filename: "menus.zip",
            contentBase64: Buffer.from(zipSync(files)).toString("base64"),
          })
        ).status,
      ).toBe(200)
      const client = new Client({ name: "menu-test", version: "0.0.0" })
      await client.connect(
        new StreamableHTTPClientTransport(new URL("/mcp", app.publicUrl), {
          fetch: mcpFetch(app, secret),
        }),
      )
      const saved = await client.callTool({
        name: "places_menus__save_menu",
        arguments: {
          placeId,
          requestId: randomUUID(),
          menu: {
            name: "Dinner",
            currency: "EUR",
            sections: [
              {
                name: "Mains",
                items: [
                  { name: "Roasted pumpkin", price: "18" },
                  { name: "Mushroom risotto", price: "24" },
                ],
              },
            ],
          },
        },
      })
      expect(saved.isError).toBeFalsy()
      const menus = await client.callTool({
        name: "places_menus__get_menus",
        arguments: { placeId },
      })
      expect(JSON.stringify(menus.content)).toContain("Mushroom risotto")
      await client.close()
      expect(
        (await admin.browser.send("PATCH", "/api/modules/me/places.menus/mcp", { enabled: false }))
          .status,
      ).toBe(200)
      const disabled = new Client({ name: "menu-disabled", version: "0.0.0" })
      await disabled.connect(
        new StreamableHTTPClientTransport(new URL("/mcp", app.publicUrl), {
          fetch: mcpFetch(app, secret),
        }),
      )
      expect((await disabled.listTools()).tools.map((tool) => tool.name)).not.toContain(
        "places_menus__save_menu",
      )
      await disabled.close()
    }),
  )

  it.effect("user isolation: another user's token cannot see the place", () =>
    run(async (app) => {
      const invite = await admin.browser.send("POST", "/api/admin/invites", {
        email: "bob@example.com",
      })
      expect(invite.status).toBe(200)
      const token = new URL(invite.body.url).pathname.split("/").pop() as string
      const member = app.browser()
      expect(
        (
          await member.send("POST", "/api/auth/sign-up/email", {
            name: "Bob",
            email: "bob@example.com",
            password,
            inviteToken: token,
          })
        ).status,
      ).toBe(200)

      const memberTok = await member.send("POST", "/api/tokens", { name: "bob" })
      expect(memberTok.status).toBe(200)

      const transport = new StreamableHTTPClientTransport(new URL("/mcp", app.publicUrl), {
        fetch: mcpFetch(app, memberTok.body.secret),
      })
      const client = new Client({ name: "bob-client", version: "0.0.0" })
      await client.connect(transport)
      const got = await client.callTool({ name: "get_place", arguments: { id: placeId } })
      expect(got.isError).toBe(true)
      await client.close()
    }),
  )
})
