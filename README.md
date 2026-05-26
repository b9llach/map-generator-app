# MapGenerator

Desktop tool to generate Google Street View locations inside selected polygons (country borders, custom GeoJSON, or polygons drawn directly on the map). Found locations export to JSON, CSV, or clipboard, and can be re-imported.

Built as an Electron app with Vue 3 + Vite + TypeScript. Forked from [tzhf/map-generator-app](https://github.com/tzhf/map-generator-app); this fork adds bulk-select from a JSON file and an embedded MCP server so LLM agents can drive the whole pipeline over LAN.

## Requirements

- Node.js 22+
- npm
- Windows, macOS, or Linux

## Run

```shell
npm install
npm start
```

That boots the Vite dev server, Electron, and the MCP server. The Layers panel shows the live MCP URL once the window is up.

## Package / build installers

```shell
npm run package      # unpacked app in ./out
npm run make         # platform installers (squirrel / zip / deb / rpm)
```

## Features

### Standard generator

Pick countries from the world-borders layer, draw your own polygon, or drop GeoJSON files into the user's geojson folder. Set a target count per polygon and start. The generator probes Street View via the JS SDK and applies whatever coverage filters you've configured: official-only, gen 1/2/3/4, date range, trekker, photosphere, blue-line presence, link length, curve angle, tile color, description match, and more.

Markers are dropped on the map for each found location, color-coded by generation. For very large runs, untick **Place markers on map** in the Markers panel and the generator skips marker placement entirely — locations still accumulate in memory and remain fully exportable, without the per-pin DOM cost.

### Bulk-select from a JSON file

The **Import selection from JSON** button in the Layers panel reads a file shaped:

```json
{
  "selections": [
    { "name": "France", "nbNeeded": 500 },
    { "code": "JP", "nbNeeded": 200 },
    { "name": "California", "layer": "us_states.geojson", "nbNeeded": 100 }
  ]
}
```

- `name` — case-insensitive match against `feature.properties.name`.
- `code` — exact match against `feature.properties.code`.
- `layer` *(optional)* — restrict to one layer, matched by its key or label.
- `nbNeeded` *(optional)* — per-polygon target count.

At least one of `name` or `code` is required per entry. Unmatched entries don't block the import — everything that matched is selected, and an alert lists the misses so typos are easy to spot.

### MCP server

An MCP (Model Context Protocol) server runs inside the Electron main process while the app is open. It binds to `0.0.0.0:3939` by default, so any machine on the same LAN can connect.

> **No auth.** Anyone on the network who can reach the port can drive the app. Intended for trusted networks only.

The Layers panel shows the live URL with click-to-copy. A green dot means listening; a red dot means it failed to bind (port already in use, etc.).

#### Configuration

Set env vars before `npm start` to change the bind:

```shell
# bash / zsh
MAP_GENERATOR_MCP_PORT=4000 MAP_GENERATOR_MCP_HOST=127.0.0.1 npm start

# PowerShell
$env:MAP_GENERATOR_MCP_PORT="4000"; $env:MAP_GENERATOR_MCP_HOST="127.0.0.1"; npm start
```

Set `MAP_GENERATOR_MCP_HOST=127.0.0.1` to make the server localhost-only (no LAN exposure).

#### Tools exposed

| Tool | What it does |
| --- | --- |
| `list_territories(layer?, search?)` | All polygons across world_borders and custom layers. Optional substring search on name/code. |
| `list_selected()` | Current selection with `nbNeeded` and `found` counts. |
| `select_territories(selections[])` | Bulk-select. Same shape as the JSON import. |
| `deselect_all()` | Clear the selection. |
| `set_nb_needed(nbNeeded, match?)` | Update the target count for matched (or all) selected polygons. |
| `start_generation()` | Begin generating against the current selection. |
| `stop_generation()` | Stop the generator loop. |
| `get_progress()` | Per-polygon `found`/`nbNeeded` plus a `running` flag and totals. |
| `get_results(match?)` | Generated locations in the same shape as the JSON export. |
| `clear_results()` | Empty `polygon.found` everywhere and clear markers. |

## Adding the MCP server to an agent

In every snippet below, replace `<host>` with the value the app prints in the Layers panel — e.g. `192.168.1.42` for LAN, or `127.0.0.1` if the agent runs on the same machine as the app.

### Claude Code (CLI)

```shell
claude mcp add --transport http --scope user mapgenerator http://<host>:3939/mcp
```

Scopes: `local` (this project), `user` (all your projects), `project` (committed to `.mcp.json`). Inside any Claude Code session, run `/mcp` to verify the connection and see the tool list.

To remove later: `claude mcp remove mapgenerator`.

### Claude Desktop

Edit `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "mapgenerator": {
      "type": "streamableHttp",
      "url": "http://<host>:3939/mcp"
    }
  }
}
```

Restart Claude Desktop after editing.

### Cursor

Edit `~/.cursor/mcp.json` for global, or `.cursor/mcp.json` inside a project for project-local:

```json
{
  "mcpServers": {
    "mapgenerator": {
      "url": "http://<host>:3939/mcp"
    }
  }
}
```

### Codex CLI (OpenAI)

Codex CLI's built-in MCP config is stdio-only, so bridge through `mcp-remote`. Edit `~/.codex/config.toml`:

```toml
[mcp_servers.mapgenerator]
command = "npx"
args = ["-y", "mcp-remote", "http://<host>:3939/mcp"]
```

### Any other MCP client

The endpoint speaks the standard MCP Streamable HTTP transport. If the client supports HTTP MCP servers directly, point it at `http://<host>:3939/mcp`. If it only supports stdio servers (Continue, Cline, older Codex builds, etc.), use `mcp-remote` as a bridge — the same pattern as the Codex example above.

## Custom GeoJSON layers

Click **Open Custom GeoJSON Folder** in the Layers panel to open the app's data directory. Drop `.json` or `.geojson` files in there and they'll appear as toggleable layers on next launch. Bulk-select via JSON respects them — reference them by file name in the `layer` field.

## Persisted state

UI settings are stored in localStorage under:

- `map_generator__settings_v11` — generator settings
- `map_generator__layers` — selected base map + overlays
- `map_generator__panels` — collapsed/expanded panel state

Clearing these resets everything to defaults.

## License

MIT. Original work © [tzhf](https://github.com/tzhf); this fork adds the JSON bulk-select and MCP server features.
