# Connect agents with MCP

Placard exposes a [Model Context Protocol](https://modelcontextprotocol.io/) endpoint on your instance so tools like Cursor or Claude can search your library, add places, and run **installed module** tools using a personal access token you control.

## What you get

| Capability | Notes |
| --- | --- |
| Core tools | Search, get/create places, lists, want/been status |
| Module tools | Optional tools from modules you install (zip or GitHub) |
| Auth | Bearer PAT (`plc_…`) — same privacy rules as the UI |
| Transport | Streamable HTTP at `$PUBLIC_URL/mcp` |

Anyone with a token can read and change your places. Treat it like a password.

Search and get follow the same household rules as the UI when household mode is on. There are no MCP tools yet to share a place or change visibility.

## Connect a client

1. Open Placard → **Settings → MCP**.
2. Create a personal access token and copy it once.
3. Note your MCP URL: `https://your-domain/mcp` (same origin as the app).
4. Add that URL + Bearer token in your MCP host (Cursor, Claude Desktop, …).

Example Cursor-style config shape (adjust to your client’s schema):

```json
{
  "mcpServers": {
    "placard": {
      "url": "https://placard.example.com/mcp",
      "headers": {
        "Authorization": "Bearer plc_your_token_here"
      }
    }
  }
}
```

Disable MCP for the whole instance with `MCP_ENABLED=false` in the server environment.

## Core tools

Agents call these names directly (no module prefix):

| Tool | Purpose |
| --- | --- |
| `search_places` | Text / tag / list / type / open now or tonight / radius |
| `get_place` | Card-level detail and key facts |
| `lookup_places` | Find Google candidates by name/city and optional location bias |
| `save_google_place` | Save a selected Google Place ID; reuse an existing owned place |
| `create_place` | Save a manual place with a name, category and coordinates |
| `list_lists` | List your lists |
| `add_to_list` | Add a place to a list |
| `set_status` | Want to go / been there |

## Module tools

Installed modules may register extra tools. Placard prefixes them so names never collide:

`{module_id_with_dots_as_underscores}__{local_tool_name}`

Examples after you install those modules:

| Module | Local name | Name agents call |
| --- | --- | --- |
| Pick (`places.pick`, sibling `placard-places-pick`) | `pick_place` | `places_pick__pick_place` |
| Skeleton (`example.skeleton`) | `skeleton_hello` | `example_skeleton__skeleton_hello` |

Module tools are not part of the core MCP set. The host loads a module and exposes its tools when:

1. The module is installed and enabled for the instance
2. You allow MCP for that module under **Settings → Marketplace → [module] → Settings**

Settings lists the **global** tool names (what agents should call).

## Safety

- Prefer short-lived tokens; revoke unused ones in Settings → MCP
- Destructive core actions (delete) are not exposed as MCP tools today
- Turn off **Allow MCP for this module** to hide that module’s tools without uninstalling

## Related

- [Install](install.md) — Compose / Coolify / Dokploy
- [Creating modules](creating-modules.md) — ship your own tools
- [FOR AI — module brief](module-brief-for-ai.md) — copy-paste prompt for agents that write modules

## Try a conversation

- “Add this restaurant in Brussels to my Placard.” The assistant calls `lookup_places`, resolves the correct candidate, then calls `save_google_place` with its Google Place ID and lookup session token. Lookup and Google saving use your instance’s Google API configuration and usage limits. Without a key, `create_place` still supports a known name and coordinates.
- “Use this menu photo to fill the menu for this restaurant.” Install and enable **Menus** (`places.menus`) and allow its MCP tools. Attach the photo to your assistant’s chat. The assistant interprets it and calls `places_menus__save_menu` with structured sections, dishes and prices. Placard does not perform OCR or store the original chat attachment through this workflow. Unreadable prices should be omitted, and dietary labels must come from the source.
- “Recommend a restaurant from my want-to-go list in Brussels.” The assistant searches your saved library with `status: "want_to_go"` and compares recorded details. This status records your intent; it is not a complete history of everywhere you have visited.

`lookup_places` returns candidates with `primaryText`, `secondaryText` (address/context), and `googlePlaceId`, plus a `sessionToken`. Pass that token to `save_google_place` to complete the lookup session. Multiple branches can match: select the intended location before saving. `save_google_place` returns `{ place, created }` and does not duplicate an existing owned Google place.

Your compatible MCP assistant processes the information you provide to it and the library data it retrieves. Installed plugins extend available tools when you enable their MCP access; Placard does not include an embedded AI assistant.
