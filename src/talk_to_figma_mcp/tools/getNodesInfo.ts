import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import figmaClient from '../figmaClient'
import { z } from 'zod'
import { filterFigmaNode } from './filterFigmaNode'

// Nodes Info Tool
export const registerGetNodesInfo = (server: McpServer) => {
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
            const result = await figmaClient.sendCommandToFigma('get_node_info', { nodeId })
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
}
