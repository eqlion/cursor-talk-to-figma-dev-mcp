import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import figmaClient from '../figmaClient'

// Document Info Tool
export const registerGetDocumentInfo = (server: McpServer) => {
  server.tool(
    'get_document_info',
    'Get detailed information about the current Figma document',
    {},
    async () => {
      try {
        const result = await figmaClient.sendCommandToFigma('get_document_info')
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
              text: `Error getting document info: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        }
      }
    }
  )
}
