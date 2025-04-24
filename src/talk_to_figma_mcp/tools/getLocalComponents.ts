import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import figmaClient from '../figmaClient'

export const registerGetLocalComponents = (server: McpServer) => {
  server.tool(
    'get_local_components',
    'Get all local components from the Figma document',
    {},
    async () => {
      try {
        const result = await figmaClient.sendCommandToFigma('get_local_components')
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
}
