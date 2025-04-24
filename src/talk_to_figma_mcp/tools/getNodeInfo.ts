import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import figmaClient from '../figmaClient'
import { z } from 'zod'
import { filterFigmaNode } from './filterFigmaNode'

// Node Info Tool
export const registerGetNodeInfo = (server: McpServer) => {
  server.tool(
    'get_node_info',
    'Get detailed information about a specific node in Figma',
    {
      nodeId: z.string().describe('The ID of the node to get information about'),
    },
    async ({ nodeId }) => {
      try {
        const result = await figmaClient.sendCommandToFigma('get_node_info', { nodeId })
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
}
