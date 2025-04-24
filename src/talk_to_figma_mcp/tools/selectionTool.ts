import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import figmaClient from '../figmaClient'

export const registerSelectionTool = (server: McpServer) => {
  // Selection Tool
  server.tool(
    'get_selection',
    'Get information about the current selection in Figma',
    {},
    async () => {
      try {
        const result = await figmaClient.sendCommandToFigma('get_selection')
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
}
