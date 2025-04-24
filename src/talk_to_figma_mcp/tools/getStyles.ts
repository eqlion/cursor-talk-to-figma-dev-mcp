import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import figmaClient from '../figmaClient'

// Get Styles Tool
export const registerGetStyles = (server: McpServer) => {
  server.tool('get_styles', 'Get all styles from the current Figma document', {}, async () => {
    try {
      const result = await figmaClient.sendCommandToFigma('get_styles')
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
}
