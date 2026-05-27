import booleanPointInPolygon from '@turf/boolean-point-in-polygon'

import { useStore } from '@/store'
import {
  availableLayers,
  selectPolygonsBulk,
  deselectAll,
  ensureLayerLoaded,
  findLayerKeyForPolygon,
  clearMarkers,
  getLoadedLayers,
  registerCustomLayer,
} from '@/map'
import { blueLineDetector } from '@/composables/blueLineDetector'
import { randomPointInPoly } from '@/composables/utils'
import { getCoverage, type CoverageCategory } from './coverage'
import type {
  AddCustomLayerArgs,
  ListTerritoriesArgs,
  McpToolName,
  SelectTerritoriesArgs,
  SetNbNeededArgs,
  VerifyCoverageArgs,
} from './types'

const { electronAPI } = window

type MatchClause = { name?: string; code?: string; layer?: string }

function matchesPolygon(polygon: Polygon, layerKey: string | undefined, m: MatchClause): boolean {
  const props = polygon.feature?.properties
  if (!props) return false
  if (m.name && props.name?.toLowerCase() !== m.name.toLowerCase()) return false
  if (m.code && props.code !== m.code) return false
  if (m.layer && layerKey !== m.layer) return false
  return true
}

interface TerritoryRecord {
  name?: string
  code?: string
  country?: string
  layer: string
  layerLabel: string
  coverage: CoverageCategory
}

async function listTerritories(args: ListTerritoriesArgs): Promise<TerritoryRecord[]> {
  const layers = args.layer
    ? availableLayers.value.filter((l) => l.key === args.layer || l.label === args.layer)
    : availableLayers.value

  const search = args.search?.toLowerCase()
  const coverageFilter = args.coverage && args.coverage !== 'any' ? args.coverage : undefined
  const results: TerritoryRecord[] = []
  const seenCodes = new Set<string>()

  for (const layerMeta of layers) {
    const loaded = await ensureLayerLoaded(layerMeta.key)
    if (!loaded) continue
    loaded.eachLayer((polyL) => {
      const polygon = polyL as Polygon
      const props = polygon.feature?.properties
      if (!props) return
      if (search) {
        const haystack = `${props.name ?? ''} ${props.code ?? ''}`.toLowerCase()
        if (!haystack.includes(search)) return
      }
      const coverage = getCoverage(props.code)
      if (coverageFilter && coverage !== coverageFilter) return
      // world_borders has multiple features per multi-polygon country (e.g. RU, ES, US territories).
      // Dedupe by code+layer so the agent gets one row per country.
      const dedupeKey = `${layerMeta.key}::${props.code ?? props.name}`
      if (seenCodes.has(dedupeKey)) return
      seenCodes.add(dedupeKey)
      results.push({
        name: props.name,
        code: props.code,
        country: props.country,
        layer: layerMeta.key,
        layerLabel: layerMeta.label,
        coverage,
      })
    })
  }

  return results
}

interface SelectedRecord {
  name?: string
  code?: string
  layer?: string
  nbNeeded: number
  found: number
}

function listSelected(): SelectedRecord[] {
  const { selected } = useStore()
  return (selected.value as Polygon[]).map((polygon) => {
    const props = polygon.feature?.properties
    return {
      name: props?.name,
      code: props?.code,
      layer: findLayerKeyForPolygon(polygon),
      nbNeeded: polygon.nbNeeded,
      found: polygon.found.length,
    }
  })
}

async function selectTerritories(args: SelectTerritoriesArgs) {
  if (!Array.isArray(args.selections)) {
    throw new Error("`selections` must be an array")
  }
  return selectPolygonsBulk(args.selections)
}

function setNbNeeded(args: SetNbNeededArgs) {
  const { selected } = useStore()
  if (!Number.isFinite(args.nbNeeded) || args.nbNeeded <= 0) {
    throw new Error("`nbNeeded` must be a positive integer")
  }
  let updated = 0
  for (const polygon of selected.value as Polygon[]) {
    const layerKey = findLayerKeyForPolygon(polygon)
    if (args.match && !matchesPolygon(polygon, layerKey, args.match)) continue
    polygon.nbNeeded = args.nbNeeded
    updated++
  }
  return { updated }
}

function startGeneration() {
  const { state, selected } = useStore()
  if (state.started) return { started: true, alreadyRunning: true }
  if (!selected.value.length) {
    throw new Error('Nothing selected. Call select_territories first.')
  }
  state.started = true
  return { started: true, alreadyRunning: false, polygonsQueued: selected.value.length }
}

function stopGeneration() {
  const { state } = useStore()
  const wasRunning = state.started
  state.started = false
  return { stopped: true, wasRunning }
}

function getProgress() {
  const { state, selected } = useStore()
  const polygons = (selected.value as Polygon[]).map((polygon) => {
    const props = polygon.feature?.properties
    return {
      name: props?.name,
      code: props?.code,
      layer: findLayerKeyForPolygon(polygon),
      nbNeeded: polygon.nbNeeded,
      found: polygon.found.length,
      processing: !!polygon.isProcessing,
    }
  })
  const totalNeeded = polygons.reduce((sum, p) => sum + p.nbNeeded, 0)
  const totalFound = polygons.reduce((sum, p) => sum + p.found, 0)
  return {
    running: state.started,
    polygons,
    totalNeeded,
    totalFound,
  }
}

function getResults(args: { match?: MatchClause }) {
  const { selected } = useStore()
  const out = []
  for (const polygon of selected.value as Polygon[]) {
    const layerKey = findLayerKeyForPolygon(polygon)
    if (args.match && !matchesPolygon(polygon, layerKey, args.match)) continue
    const props = polygon.feature?.properties
    out.push({
      name: props?.name,
      code: props?.code,
      layer: layerKey,
      customCoordinates: polygon.found,
    })
  }
  return out
}

function clearResults() {
  const { selected } = useStore()
  clearMarkers()
  let cleared = 0
  for (const polygon of selected.value as Polygon[]) {
    cleared += polygon.found.length
    polygon.found.length = 0
  }
  return { cleared, polygons: selected.value.length }
}

async function addCustomLayer(args: AddCustomLayerArgs) {
  if (typeof args?.name !== 'string' || !args.name.trim()) {
    throw new Error("`name` is required")
  }
  if (!args.geojson || typeof args.geojson !== 'object') {
    throw new Error("`geojson` must be a GeoJSON object")
  }
  // 1. Persist to disk via main process (returns the canonical file name on success).
  const saved = (await electronAPI.invoke(
    'save-custom-layer',
    args.name,
    args.geojson,
    !!args.overwrite,
  )) as { path: string; name: string; bytes: number }
  // 2. Register in the running app so it is usable immediately without restart.
  const registered = await registerCustomLayer(saved.name, args.geojson as GeoJSON.GeoJsonObject)
  return {
    name: saved.name,
    path: saved.path,
    bytes: saved.bytes,
    replaced: registered.replaced,
  }
}

async function verifyCoverage(args: VerifyCoverageArgs) {
  if (!args.code && !args.name) {
    throw new Error('Either `code` or `name` is required')
  }
  const requestedSamples = Math.max(10, Math.min(args.samples ?? 100, 500))
  const radius = args.radius && args.radius > 0 ? args.radius : 1000

  const layers = args.layer
    ? availableLayers.value.filter((l) => l.key === args.layer || l.label === args.layer)
    : availableLayers.value

  // Find the polygon. world_borders has multiple features for multi-polygon countries;
  // use the first match for sample-point generation (bounds + interior check work on either).
  let found: Polygon | undefined
  const wantedName = args.name?.toLowerCase()
  for (const layerMeta of layers) {
    const loaded = await ensureLayerLoaded(layerMeta.key)
    if (!loaded) continue
    loaded.eachLayer((polyL) => {
      if (found) return
      const polygon = polyL as Polygon
      const props = polygon.feature?.properties
      if (!props) return
      if (args.code && props.code !== args.code) return
      if (wantedName && props.name?.toLowerCase() !== wantedName) return
      found = polygon
    })
    if (found) break
  }
  if (!found) {
    throw new Error(
      `polygon not found (code=${args.code ?? ''}, name=${args.name ?? ''}, layer=${args.layer ?? ''})`,
    )
  }

  const props = found.feature?.properties
  const bounds = found.getBounds()
  const detector = await blueLineDetector(
    { lat: bounds.getNorth(), lng: bounds.getWest() },
    { lat: bounds.getSouth(), lng: bounds.getEast() },
  )

  let hits = 0
  let actualSamples = 0
  let attempts = 0
  const maxAttempts = requestedSamples * 30
  while (actualSamples < requestedSamples && attempts < maxAttempts) {
    attempts++
    const point = randomPointInPoly(found)
    if (!booleanPointInPolygon([point.lng, point.lat], found.feature)) continue
    actualSamples++
    if (detector(point.lat, point.lng, radius)) hits++
  }

  const confidence = actualSamples > 0 ? hits / actualSamples : 0
  return {
    name: props?.name,
    code: props?.code,
    layer: findLayerKeyForPolygon(found),
    samples: actualSamples,
    hits,
    confidence: Math.round(confidence * 1000) / 1000,
    radiusMeters: radius,
    curatedCoverage: getCoverage(props?.code),
  }
}

const handlers: Record<McpToolName, (args: any) => unknown | Promise<unknown>> = {
  list_territories: listTerritories,
  list_selected: listSelected,
  select_territories: selectTerritories,
  deselect_all: () => {
    deselectAll()
    return { ok: true }
  },
  set_nb_needed: setNbNeeded,
  start_generation: startGeneration,
  stop_generation: stopGeneration,
  get_progress: getProgress,
  get_results: getResults,
  clear_results: clearResults,
  add_custom_layer: addCustomLayer,
  verify_coverage: verifyCoverage,
}

export function dispatchMcpRequest(payload: { tool: string; args: unknown }): Promise<unknown> | unknown {
  const handler = handlers[payload.tool as McpToolName]
  if (!handler) throw new Error(`Unknown MCP tool: ${payload.tool}`)
  return handler(payload.args ?? {})
}

// Silence unused-import warnings for layers exposed for diagnostics
void getLoadedLayers
