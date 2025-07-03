import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import figmaClient from '../figmaClient'
import { z } from 'zod'

// Get Variables By IDs Tool
export const registerGetVariablesByIds = (server: McpServer) => {
  server.tool(
    'get_variables_by_ids',
    'Get detailed information about multiple variables by their IDs in Figma',
    {
      variableIds: z
        .array(
          z
            .string()
            .regex(
              /^VariableID:[a-f0-9]{40}\/\d+:\d+$/,
              'Variable ID must match the format: VariableID:hexstring/number:number'
            )
        )
        .describe('Array of variable IDs to get information about'),
    },
    async ({ variableIds }) => {
      try {
        const result = await figmaClient.sendCommandToFigma('get_variables_by_ids', { variableIds })
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
              text: `Error getting variables by IDs: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        }
      }
    }
  )
}
