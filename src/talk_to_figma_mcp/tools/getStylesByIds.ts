import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import figmaClient from '../figmaClient'
import { z } from 'zod'

// Get Styles By IDs Tool
export const registerGetStylesByIds = (server: McpServer) => {
  server.tool(
    'get_styles_by_ids',
    'Get detailed information about multiple styles by their IDs in Figma',
    {
      styleIds: z
        .array(
          z
            .string()
            .regex(
              /^S:[a-f0-9]{40}$/,
              'Invalid style ID format. Expected format: S:<40-character hex string>'
            )
        )
        .describe('Array of style IDs to get information about'),
    },
    async ({ styleIds }) => {
      try {
        const result = await figmaClient.sendCommandToFigma('get_styles_by_ids', { styleIds })
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
              text: `Error getting styles by IDs: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        }
      }
    }
  )
}
