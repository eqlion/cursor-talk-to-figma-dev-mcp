import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import figmaClient from '../figmaClient'

export const registerGetAnnotations = (server: McpServer) => {
  server.tool(
    'get_annotations',
    'Get all annotations in the current document or specific node',
    {
      nodeId: z
        .string()
        .optional()
        .describe('Optional node ID to get annotations for specific node'),
      includeCategories: z
        .boolean()
        .optional()
        .default(true)
        .describe('Whether to include category information'),
    },
    async ({ nodeId, includeCategories }) => {
      try {
        const result = await figmaClient.sendCommandToFigma('get_annotations', {
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
}
