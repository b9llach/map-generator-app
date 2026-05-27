export type McpToolName =
  | 'list_territories'
  | 'list_selected'
  | 'select_territories'
  | 'deselect_all'
  | 'set_nb_needed'
  | 'start_generation'
  | 'stop_generation'
  | 'get_progress'
  | 'get_results'
  | 'clear_results'
  | 'add_custom_layer'
  | 'verify_coverage'

export interface McpRequestEnvelope {
  id: string
  tool: McpToolName
  args: unknown
}

export interface McpResponseEnvelope {
  id: string
  result?: unknown
  error?: string
}

export interface McpStatus {
  url: string
  port: number
  host: string
  listening: boolean
  error?: string
}

export interface SelectTerritoriesArgs {
  selections: Array<{
    name?: string
    code?: string
    layer?: string
    nbNeeded?: number
  }>
}

export interface SetNbNeededArgs {
  nbNeeded: number
  match?: { name?: string; code?: string; layer?: string }
}

export interface ListTerritoriesArgs {
  layer?: string
  search?: string
  coverage?: 'official' | 'mixed' | 'unofficial' | 'none' | 'unknown' | 'any'
}

export interface AddCustomLayerArgs {
  name: string
  geojson: unknown
  overwrite?: boolean
}

export interface VerifyCoverageArgs {
  code?: string
  name?: string
  layer?: string
  samples?: number
  radius?: number
}
