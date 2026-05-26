import { randomUUID } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import type { Server as HttpServer } from 'node:http'

import { BrowserWindow, ipcMain } from 'electron'
import express from 'express'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'

import type {
  McpResponseEnvelope,
  McpStatus,
  McpToolName,
} from './types.js'

const DEFAULT_PORT = 3939
const DEFAULT_HOST = '0.0.0.0'

type Pending = {
  resolve: (value: unknown) => void
  reject: (reason: Error) => void
  timeout: NodeJS.Timeout
}
const pending = new Map<string, Pending>()

ipcMain.on('mcp-response', (_event, payload: McpResponseEnvelope) => {
  const req = pending.get(payload.id)
  if (!req) return
  pending.delete(payload.id)
  clearTimeout(req.timeout)
  if (payload.error) req.reject(new Error(payload.error))
  else req.resolve(payload.result)
})

function callRenderer(window: BrowserWindow, tool: McpToolName, args: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (window.isDestroyed()) {
      reject(new Error('Renderer window is not available'))
      return
    }
    const id = randomUUID()
    const timeout = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`MCP tool '${tool}' timed out after 60s`))
    }, 60_000)
    pending.set(id, { resolve, reject, timeout })
    window.webContents.send('mcp-request', { id, tool, args })
  })
}

function jsonResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  }
}

function buildMcpServer(window: BrowserWindow): McpServer {
  const server = new McpServer({ name: 'mapgenerator', version: '1.0.0' })

  server.registerTool(
    'list_territories',
    {
      title: 'List all available territories',
      description:
        'Lists every polygon/territory the app knows about across world_borders and any custom GeoJSON layers in the geojson folder. Useful for discovering what is available before calling select_territories.',
      inputSchema: {
        layer: z
          .string()
          .optional()
          .describe('Restrict results to one layer (matched by layer key or label).'),
        search: z
          .string()
          .optional()
          .describe('Case-insensitive substring filter on territory name or code.'),
      },
    },
    async (args) => jsonResult(await callRenderer(window, 'list_territories', args)),
  )

  server.registerTool(
    'list_selected',
    {
      title: 'List currently selected territories',
      description:
        'Returns the territories currently in the selection list, including per-polygon nbNeeded and found counts.',
      inputSchema: {},
    },
    async () => jsonResult(await callRenderer(window, 'list_selected', {})),
  )

  server.registerTool(
    'select_territories',
    {
      title: 'Bulk-select territories',
      description:
        'Adds matching polygons to the selection. Mirrors the JSON file-import format: each entry needs a name or a code, plus optional layer (key/label) and nbNeeded.',
      inputSchema: {
        selections: z
          .array(
            z.object({
              name: z.string().optional(),
              code: z.string().optional(),
              layer: z.string().optional(),
              nbNeeded: z.number().int().positive().optional(),
            }),
          )
          .describe('List of territories to select.'),
      },
    },
    async (args) => jsonResult(await callRenderer(window, 'select_territories', args)),
  )

  server.registerTool(
    'deselect_all',
    {
      title: 'Clear the selection',
      description: 'Removes every territory from the selection list. Does not delete generated results.',
      inputSchema: {},
    },
    async () => jsonResult(await callRenderer(window, 'deselect_all', {})),
  )

  server.registerTool(
    'set_nb_needed',
    {
      title: 'Set the per-polygon target count',
      description:
        'Updates the nbNeeded (target locations) for already-selected polygons. With no match, applies to all selected. With match, applies only to the polygons whose name/code/layer match.',
      inputSchema: {
        nbNeeded: z.number().int().positive(),
        match: z
          .object({
            name: z.string().optional(),
            code: z.string().optional(),
            layer: z.string().optional(),
          })
          .optional(),
      },
    },
    async (args) => jsonResult(await callRenderer(window, 'set_nb_needed', args)),
  )

  server.registerTool(
    'start_generation',
    {
      title: 'Start the generator',
      description:
        'Begins generating Street View locations against the current selection using the current settings. No-op if already running.',
      inputSchema: {},
    },
    async () => jsonResult(await callRenderer(window, 'start_generation', {})),
  )

  server.registerTool(
    'stop_generation',
    {
      title: 'Stop the generator',
      description: 'Stops the generator. In-flight requests finish, then the loop exits.',
      inputSchema: {},
    },
    async () => jsonResult(await callRenderer(window, 'stop_generation', {})),
  )

  server.registerTool(
    'get_progress',
    {
      title: 'Get generation progress',
      description:
        'Returns per-polygon progress (found / nbNeeded), whether the generator is currently running, and aggregate totals.',
      inputSchema: {},
    },
    async () => jsonResult(await callRenderer(window, 'get_progress', {})),
  )

  server.registerTool(
    'get_results',
    {
      title: 'Get generated locations',
      description:
        'Returns the generated locations for each selected polygon (panoId, lat, lng, heading, pitch, zoom, imageDate). Same shape used by the JSON export.',
      inputSchema: {
        match: z
          .object({
            name: z.string().optional(),
            code: z.string().optional(),
            layer: z.string().optional(),
          })
          .optional()
          .describe('Restrict to specific polygons by name/code/layer. Omit to return all.'),
      },
    },
    async (args) => jsonResult(await callRenderer(window, 'get_results', args)),
  )

  server.registerTool(
    'clear_results',
    {
      title: 'Clear generated locations',
      description:
        'Empties polygon.found for every selected polygon and removes their markers. The selection itself is preserved.',
      inputSchema: {},
    },
    async () => jsonResult(await callRenderer(window, 'clear_results', {})),
  )

  return server
}

function getLanIp(): string {
  const interfaces = networkInterfaces()
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address
    }
  }
  return '127.0.0.1'
}

let httpServer: HttpServer | null = null
let status: McpStatus = {
  url: '',
  port: DEFAULT_PORT,
  host: DEFAULT_HOST,
  listening: false,
}

export function getMcpStatus(): McpStatus {
  return status
}

export async function startMcpServer(window: BrowserWindow): Promise<McpStatus> {
  if (httpServer) return status

  const port = Number.parseInt(process.env.MAP_GENERATOR_MCP_PORT ?? '', 10) || DEFAULT_PORT
  const host = process.env.MAP_GENERATOR_MCP_HOST || DEFAULT_HOST

  const mcp = buildMcpServer(window)
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  await mcp.connect(transport)

  const app = express()
  app.use(express.json({ limit: '4mb' }))

  const handle = async (req: express.Request, res: express.Response) => {
    try {
      await transport.handleRequest(req, res, req.body)
    } catch (err) {
      console.error('MCP request error:', err)
      if (!res.headersSent) res.status(500).end()
    }
  }
  app.post('/mcp', handle)
  app.get('/mcp', handle)
  app.delete('/mcp', handle)

  await new Promise<void>((resolve, reject) => {
    httpServer = app.listen(port, host, () => resolve())
    httpServer.on('error', (err) => {
      reject(err)
    })
  })

  const lanIp = getLanIp()
  status = {
    url: `http://${lanIp}:${port}/mcp`,
    port,
    host,
    listening: true,
  }
  console.log(`[mcp] listening at ${status.url} (also reachable on http://127.0.0.1:${port}/mcp)`)
  return status
}

export async function stopMcpServer(): Promise<void> {
  if (!httpServer) return
  await new Promise<void>((resolve, reject) => {
    httpServer!.close((err) => (err ? reject(err) : resolve()))
  })
  httpServer = null
  status = { ...status, listening: false }
}
