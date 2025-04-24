// Define TypeScript interfaces for Figma responses
export interface FigmaResponse {
  id: string
  result?: any
  error?: string
}

// Define interface for command progress updates
export interface CommandProgressUpdate {
  type: 'command_progress'
  commandId: string
  commandType: string
  status: 'started' | 'in_progress' | 'completed' | 'error'
  progress: number
  totalItems: number
  processedItems: number
  currentChunk?: number
  totalChunks?: number
  chunkSize?: number
  message: string
  payload?: any
  timestamp: number
}

// Define command types and parameters
export type FigmaCommand =
  | 'get_document_info'
  | 'get_selection'
  | 'get_node_info'
  | 'get_styles'
  | 'get_local_components'
  | 'get_team_components'
  | 'export_node_as_image'
  | 'join'
  | 'scan_text_nodes'
  | 'get_annotations'
  | 'scan_nodes_by_types'
