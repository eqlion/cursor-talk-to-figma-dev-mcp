import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import figmaClient from '../figmaClient'
import { z } from 'zod'

// Get Component Instances Info Tool
export const registerGetComponentInstancesInfo = (server: McpServer) => {
  server.tool(
    'get_component_instances_info',
    'Get detailed information about component instances by their node IDs in Figma',
    {
      nodeIds: z
        .array(z.string())
        .describe('Array of node IDs to analyze for component instance information'),
      includeOverrides: z
        .boolean()
        .optional()
        .default(true)
        .describe('Whether to include override information'),
    },
    async ({ nodeIds, includeOverrides = true }) => {
      try {
        const result = await figmaClient.sendCommandToFigma('get_component_instances_info', {
          nodeIds,
          includeOverrides,
        })
        return {
          content: [
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
              text: `Error getting component instances info: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        }
      }
    }
  )
}
