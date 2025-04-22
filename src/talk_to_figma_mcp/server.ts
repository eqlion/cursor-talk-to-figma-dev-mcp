#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import WebSocket from 'ws'
import { v4 as uuidv4 } from 'uuid'

import path from 'path'

// Define TypeScript interfaces for Figma responses
interface FigmaResponse {
  id: string
  result?: any
  error?: string
}

// Define interface for command progress updates
interface CommandProgressUpdate {
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

// Custom logging functions that write to stderr instead of stdout to avoid being captured
const logger = {
  info: (message: string) => process.stderr.write(`[INFO] ${message}\n`),
  debug: (message: string) => process.stderr.write(`[DEBUG] ${message}\n`),
  warn: (message: string) => process.stderr.write(`[WARN] ${message}\n`),
  error: (message: string) => process.stderr.write(`[ERROR] ${message}\n`),
  log: (message: string) => process.stderr.write(`[LOG] ${message}\n`),
}

// WebSocket connection and request tracking
let ws: WebSocket | null = null
const pendingRequests = new Map<
  string,
  {
    resolve: (value: unknown) => void
    reject: (reason: unknown) => void
    timeout: ReturnType<typeof setTimeout>
    lastActivity: number // Add timestamp for last activity
  }
>()

// Track which channel each client is in
let currentChannel: string | null = null

// Create MCP server
const server = new McpServer({
  name: 'TalkToFigmaMCP',
  version: '1.0.0',
})

// Add command line argument parsing
const args = process.argv.slice(2)
const serverArg = args.find((arg) => arg.startsWith('--server='))
const serverUrl = serverArg ? serverArg.split('=')[1] : 'localhost'
const WS_URL = serverUrl === 'localhost' ? `ws://${serverUrl}` : `wss://${serverUrl}`

// Document Info Tool
server.tool(
  'get_document_info',
  'Get detailed information about the current Figma document',
  {},
  async () => {
    try {
      const result = await sendCommandToFigma('get_document_info')
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting document info: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      }
    }
  }
)

// Selection Tool
server.tool(
  'get_selection',
  'Get information about the current selection in Figma',
  {},
  async () => {
    try {
      const result = await sendCommandToFigma('get_selection')
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting selection: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      }
    }
  }
)

// Node Info Tool
server.tool(
  'get_node_info',
  'Get detailed information about a specific node in Figma',
  {
    nodeId: z.string().describe('The ID of the node to get information about'),
  },
  async ({ nodeId }) => {
    try {
      const result = await sendCommandToFigma('get_node_info', { nodeId })
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(filterFigmaNode(result)),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting node info: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      }
    }
  }
)

function rgbaToHex(color: any): string {
  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)
  const a = Math.round(color.a * 255)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b
    .toString(16)
    .padStart(2, '0')}${a === 255 ? '' : a.toString(16).padStart(2, '0')}`
}

function filterFigmaNode(node: any) {
  // Skip VECTOR type nodes
  if (node.type === 'VECTOR') {
    return null
  }

  const filtered: any = {
    id: node.id,
    name: node.name,
    type: node.type,
  }

  if (node.fills && node.fills.length > 0) {
    filtered.fills = node.fills.map((fill: any) => {
      const processedFill = { ...fill }

      // Remove boundVariables and imageRef
      delete processedFill.boundVariables
      delete processedFill.imageRef

      // Process gradientStops if present
      if (processedFill.gradientStops) {
        processedFill.gradientStops = processedFill.gradientStops.map((stop: any) => {
          const processedStop = { ...stop }
          // Convert color to hex if present
          if (processedStop.color) {
            processedStop.color = rgbaToHex(processedStop.color)
          }
          // Remove boundVariables
          delete processedStop.boundVariables
          return processedStop
        })
      }

      // Convert solid fill colors to hex
      if (processedFill.color) {
        processedFill.color = rgbaToHex(processedFill.color)
      }

      return processedFill
    })
  }

  if (node.strokes && node.strokes.length > 0) {
    filtered.strokes = node.strokes.map((stroke: any) => {
      const processedStroke = { ...stroke }
      // Remove boundVariables
      delete processedStroke.boundVariables
      // Convert color to hex if present
      if (processedStroke.color) {
        processedStroke.color = rgbaToHex(processedStroke.color)
      }
      return processedStroke
    })
  }

  if (node.cornerRadius !== undefined) {
    filtered.cornerRadius = node.cornerRadius
  }

  if (node.absoluteBoundingBox) {
    filtered.absoluteBoundingBox = node.absoluteBoundingBox
  }

  if (node.characters) {
    filtered.characters = node.characters
  }

  if (node.style) {
    filtered.style = {
      fontFamily: node.style.fontFamily,
      fontStyle: node.style.fontStyle,
      fontWeight: node.style.fontWeight,
      fontSize: node.style.fontSize,
      textAlignHorizontal: node.style.textAlignHorizontal,
      letterSpacing: node.style.letterSpacing,
      lineHeightPx: node.style.lineHeightPx,
    }
  }

  if (node.children) {
    filtered.children = node.children
      .map((child: any) => filterFigmaNode(child))
      .filter((child: any) => child !== null) // Remove null children (VECTOR nodes)
  }

  return filtered
}

// Nodes Info Tool
server.tool(
  'get_nodes_info',
  'Get detailed information about multiple nodes in Figma',
  {
    nodeIds: z.array(z.string()).describe('Array of node IDs to get information about'),
  },
  async ({ nodeIds }) => {
    try {
      const results = await Promise.all(
        nodeIds.map(async (nodeId) => {
          const result = await sendCommandToFigma('get_node_info', { nodeId })
          return { nodeId, info: result }
        })
      )
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results.map((result) => filterFigmaNode(result.info))),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting nodes info: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      }
    }
  }
)

// Export Node as Image Tool
server.tool(
  'export_node_as_image',
  'Export a node as an image from Figma',
  {
    nodeId: z.string().describe('The ID of the node to export'),
    format: z.enum(['PNG', 'JPG', 'SVG', 'PDF']).optional().describe('Export format'),
    scale: z.number().positive().optional().describe('Export scale'),
  },
  async ({ nodeId, format, scale }) => {
    try {
      const result = await sendCommandToFigma('export_node_as_image', {
        nodeId,
        format: format || 'PNG',
        scale: scale || 1,
      })
      const typedResult = result as { imageData: string; mimeType: string }

      return {
        content: [
          {
            type: 'image',
            data: typedResult.imageData,
            mimeType: typedResult.mimeType || 'image/png',
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error exporting node as image: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      }
    }
  }
)

// Get Styles Tool
server.tool('get_styles', 'Get all styles from the current Figma document', {}, async () => {
  try {
    const result = await sendCommandToFigma('get_styles')
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error getting styles: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
})

// Get Local Components Tool
server.tool(
  'get_local_components',
  'Get all local components from the Figma document',
  {},
  async () => {
    try {
      const result = await sendCommandToFigma('get_local_components')
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting local components: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      }
    }
  }
)

// Get Annotations Tool
server.tool(
  'get_annotations',
  'Get all annotations in the current document or specific node',
  {
    nodeId: z.string().optional().describe('Optional node ID to get annotations for specific node'),
    includeCategories: z
      .boolean()
      .optional()
      .default(true)
      .describe('Whether to include category information'),
  },
  async ({ nodeId, includeCategories }) => {
    try {
      const result = await sendCommandToFigma('get_annotations', {
        nodeId,
        includeCategories,
      })
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error getting annotations: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      }
    }
  }
)

// Get Team Components Tool
// server.tool(
//   "get_team_components",
//   "Get all team library components available in Figma",
//   {},
//   async () => {
//     try {
//       const result = await sendCommandToFigma('get_team_components');
//       return {
//         content: [
//           {
//             type: "text",
//             text: JSON.stringify(result, null, 2)
//           }
//         ]
//       };
//     } catch (error) {
//       return {
//         content: [
//           {
//             type: "text",
//             text: `Error getting team components: ${error instanceof Error ? error.message : String(error)}`
//           }
//         ]
//       };
//     }
//   }
// );

server.prompt('read_design_strategy', 'Best practices for reading Figma designs', (extra) => {
  return {
    messages: [
      {
        role: 'assistant',
        content: {
          type: 'text',
          text: `When reading Figma designs, follow these best practices:

1. Start with selection:
   - First use get_selection() to understand the current selection
   - If no selection ask user to select single or multiple nodes

2. Get node infos of the selected nodes:
   - Use get_nodes_info() to get the information of the selected nodes
   - If no selection ask user to select single or multiple nodes
`,
        },
      },
    ],
    description: 'Best practices for reading Figma designs',
  }
})

// Text Node Scanning Tool
server.tool(
  'scan_text_nodes',
  'Scan all text nodes in the selected Figma node',
  {
    nodeId: z.string().describe('ID of the node to scan'),
  },
  async ({ nodeId }) => {
    try {
      // Initial response to indicate we're starting the process
      const initialStatus = {
        type: 'text' as const,
        text: 'Starting text node scanning. This may take a moment for large designs...',
      }

      // Use the plugin's scan_text_nodes function with chunking flag
      const result = await sendCommandToFigma('scan_text_nodes', {
        nodeId,
        useChunking: true, // Enable chunking on the plugin side
        chunkSize: 10, // Process 10 nodes at a time
      })

      // If the result indicates chunking was used, format the response accordingly
      if (result && typeof result === 'object' && 'chunks' in result) {
        const typedResult = result as {
          success: boolean
          totalNodes: number
          processedNodes: number
          chunks: number
          textNodes: Array<any>
        }

        const summaryText = `
        Scan completed:
        - Found ${typedResult.totalNodes} text nodes
        - Processed in ${typedResult.chunks} chunks
        `

        return {
          content: [
            initialStatus,
            {
              type: 'text' as const,
              text: summaryText,
            },
            {
              type: 'text' as const,
              text: JSON.stringify(typedResult.textNodes, null, 2),
            },
          ],
        }
      }

      // If chunking wasn't used or wasn't reported in the result format, return the result as is
      return {
        content: [
          initialStatus,
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error scanning text nodes: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      }
    }
  }
)

// Node Type Scanning Tool
server.tool(
  'scan_nodes_by_types',
  'Scan for nodes with specific types in the selected Figma node',
  {
    nodeId: z.string().describe('ID of the node to scan'),
    types: z
      .array(z.string())
      .describe("Array of node types to find (e.g. ['COMPONENT', 'FRAME'])"),
  },
  async ({ nodeId, types }) => {
    try {
      // Initial response to indicate we're starting the process
      const initialStatus = {
        type: 'text' as const,
        text: `Starting node type scanning for types: ${types.join(', ')}...`,
      }

      // Use the plugin's scan_nodes_by_types function
      const result = await sendCommandToFigma('scan_nodes_by_types', {
        nodeId,
        types,
      })

      // Format the response
      if (result && typeof result === 'object' && 'matchingNodes' in result) {
        const typedResult = result as {
          success: boolean
          count: number
          matchingNodes: Array<{
            id: string
            name: string
            type: string
            bbox: {
              x: number
              y: number
              width: number
              height: number
            }
          }>
          searchedTypes: Array<string>
        }

        const summaryText = `Scan completed: Found ${
          typedResult.count
        } nodes matching types: ${typedResult.searchedTypes.join(', ')}`

        return {
          content: [
            initialStatus,
            {
              type: 'text' as const,
              text: summaryText,
            },
            {
              type: 'text' as const,
              text: JSON.stringify(typedResult.matchingNodes, null, 2),
            },
          ],
        }
      }

      // If the result is in an unexpected format, return it as is
      return {
        content: [
          initialStatus,
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error scanning nodes by types: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      }
    }
  }
)

// Define command types and parameters
type FigmaCommand =
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

// Update the connectToFigma function
function connectToFigma(port: number = 3055) {
  // If already connected, do nothing
  if (ws && ws.readyState === WebSocket.OPEN) {
    logger.info('Already connected to Figma')
    return
  }

  const wsUrl = serverUrl === 'localhost' ? `${WS_URL}:${port}` : WS_URL
  logger.info(`Connecting to Figma socket server at ${wsUrl}...`)
  ws = new WebSocket(wsUrl)

  ws.on('open', () => {
    logger.info('Connected to Figma socket server')
    // Reset channel on new connection
    currentChannel = null
  })

  ws.on('message', (data: any) => {
    try {
      // Define a more specific type with an index signature to allow any property access
      interface ProgressMessage {
        message: FigmaResponse | any
        type?: string
        id?: string
        [key: string]: any // Allow any other properties
      }

      const json = JSON.parse(data) as ProgressMessage

      // Handle progress updates
      if (json.type === 'progress_update') {
        const progressData = json.message.data as CommandProgressUpdate
        const requestId = json.id || ''

        if (requestId && pendingRequests.has(requestId)) {
          const request = pendingRequests.get(requestId)!

          // Update last activity timestamp
          request.lastActivity = Date.now()

          // Reset the timeout to prevent timeouts during long-running operations
          clearTimeout(request.timeout)

          // Create a new timeout
          request.timeout = setTimeout(() => {
            if (pendingRequests.has(requestId)) {
              logger.error(`Request ${requestId} timed out after extended period of inactivity`)
              pendingRequests.delete(requestId)
              request.reject(new Error('Request to Figma timed out'))
            }
          }, 60000) // 60 second timeout for inactivity

          // Log progress
          logger.info(
            `Progress update for ${progressData.commandType}: ${progressData.progress}% - ${progressData.message}`
          )

          // For completed updates, we could resolve the request early if desired
          if (progressData.status === 'completed' && progressData.progress === 100) {
            // Optionally resolve early with partial data
            // request.resolve(progressData.payload);
            // pendingRequests.delete(requestId);

            // Instead, just log the completion, wait for final result from Figma
            logger.info(`Operation ${progressData.commandType} completed, waiting for final result`)
          }
        }
        return
      }

      // Handle regular responses
      const myResponse = json.message
      logger.debug(`Received message: ${JSON.stringify(myResponse)}`)
      logger.log('myResponse' + JSON.stringify(myResponse))

      // Handle response to a request
      if (myResponse.id && pendingRequests.has(myResponse.id) && myResponse.result) {
        const request = pendingRequests.get(myResponse.id)!
        clearTimeout(request.timeout)

        if (myResponse.error) {
          logger.error(`Error from Figma: ${myResponse.error}`)
          request.reject(new Error(myResponse.error))
        } else {
          if (myResponse.result) {
            request.resolve(myResponse.result)
          }
        }

        pendingRequests.delete(myResponse.id)
      } else {
        // Handle broadcast messages or events
        logger.info(`Received broadcast message: ${JSON.stringify(myResponse)}`)
      }
    } catch (error) {
      logger.error(
        `Error parsing message: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  })

  ws.on('error', (error) => {
    logger.error(`Socket error: ${error}`)
  })

  ws.on('close', () => {
    logger.info('Disconnected from Figma socket server')
    ws = null

    // Reject all pending requests
    for (const [id, request] of pendingRequests.entries()) {
      clearTimeout(request.timeout)
      request.reject(new Error('Connection closed'))
      pendingRequests.delete(id)
    }

    // Attempt to reconnect
    logger.info('Attempting to reconnect in 2 seconds...')
    setTimeout(() => connectToFigma(port), 2000)
  })
}

// Function to join a channel
async function joinChannel(channelName: string): Promise<void> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    throw new Error('Not connected to Figma')
  }

  try {
    await sendCommandToFigma('join', { channel: channelName })
    currentChannel = channelName
    logger.info(`Joined channel: ${channelName}`)
  } catch (error) {
    logger.error(
      `Failed to join channel: ${error instanceof Error ? error.message : String(error)}`
    )
    throw error
  }
}

// Function to send commands to Figma
function sendCommandToFigma(
  command: FigmaCommand,
  params: unknown = {},
  timeoutMs: number = 30000
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    // If not connected, try to connect first
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      connectToFigma()
      reject(new Error('Not connected to Figma. Attempting to connect...'))
      return
    }

    // Check if we need a channel for this command
    const requiresChannel = command !== 'join'
    if (requiresChannel && !currentChannel) {
      reject(new Error('Must join a channel before sending commands'))
      return
    }

    const id = uuidv4()
    const request = {
      id,
      type: command === 'join' ? 'join' : 'message',
      ...(command === 'join' ? { channel: (params as any).channel } : { channel: currentChannel }),
      message: {
        id,
        command,
        params: {
          ...(params as any),
          commandId: id, // Include the command ID in params
        },
      },
    }

    // Set timeout for request
    const timeout = setTimeout(() => {
      if (pendingRequests.has(id)) {
        pendingRequests.delete(id)
        logger.error(`Request ${id} to Figma timed out after ${timeoutMs / 1000} seconds`)
        reject(new Error('Request to Figma timed out'))
      }
    }, timeoutMs)

    // Store the promise callbacks to resolve/reject later
    pendingRequests.set(id, {
      resolve,
      reject,
      timeout,
      lastActivity: Date.now(),
    })

    // Send the request
    logger.info(`Sending command to Figma: ${command}`)
    logger.debug(`Request details: ${JSON.stringify(request)}`)
    ws.send(JSON.stringify(request))
  })
}

// Update the join_channel tool
server.tool(
  'join_channel',
  'Join a specific channel to communicate with Figma',
  {
    channel: z.string().describe('The name of the channel to join').default(''),
  },
  async ({ channel }) => {
    try {
      if (!channel) {
        // If no channel provided, ask the user for input
        return {
          content: [
            {
              type: 'text',
              text: 'Please provide a channel name to join:',
            },
          ],
          followUp: {
            tool: 'join_channel',
            description: 'Join the specified channel',
          },
        }
      }

      await joinChannel(channel)
      return {
        content: [
          {
            type: 'text',
            text: `Successfully joined channel: ${channel}`,
          },
        ],
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error joining channel: ${
              error instanceof Error ? error.message : String(error)
            }`,
          },
        ],
      }
    }
  }
)

// Start the server
async function main() {
  try {
    // Try to connect to Figma socket server
    connectToFigma()
  } catch (error) {
    logger.warn(
      `Could not connect to Figma initially: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
    logger.warn('Will try to connect when the first command is sent')
  }

  // Start the MCP server with stdio transport
  const transport = new StdioServerTransport()
  await server.connect(transport)
  logger.info('FigmaMCP server running on stdio')
}

// Run the server
main().catch((error) => {
  logger.error(
    `Error starting FigmaMCP server: ${error instanceof Error ? error.message : String(error)}`
  )
  process.exit(1)
})
