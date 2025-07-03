#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import figmaClient from './figmaClient'
import { logger } from './logger'

import {
  registerSelectionTool,
  registerGetDocumentInfo,
  registerGetNodeInfo,
  registerGetNodesInfo,
  registerExportNodeAsImage,
  registerGetStyles,
  registerGetStylesByIds,
  registerGetVariablesByIds,
  registerGetLocalComponents,
  registerGetAnnotations,
  registerScanTextNodes,
  registerScanNodesByTypes,
  registerJoinChannel,
} from './tools'
import { registerReadDesignStrategy } from './prompts'

// Create MCP server
const server = new McpServer({
  name: 'TalkToFigmaMCP',
  version: '1.0.0',
})

// Tools
registerSelectionTool(server)
registerGetDocumentInfo(server)
registerGetNodeInfo(server)
registerGetNodesInfo(server)
registerExportNodeAsImage(server)
registerGetStyles(server)
registerGetStylesByIds(server)
registerGetVariablesByIds(server)
registerGetLocalComponents(server)
registerGetAnnotations(server)
registerScanTextNodes(server)
registerScanNodesByTypes(server)
registerJoinChannel(server)
// Prompts
registerReadDesignStrategy(server)

// Start the server
async function main() {
  try {
    // Try to connect to Figma socket server
    figmaClient.connectToFigma()
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
