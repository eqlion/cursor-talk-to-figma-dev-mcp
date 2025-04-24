import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import figmaClient from '../figmaClient'

export const registerScanNodesByTypes = (server: McpServer) => {
  server.tool(
    'scan_nodes_by_types',
    'Scan for nodes with specific types in the selected Figma node',
    {
      nodeId: z.string().describe('ID of the node to scan'),
      types: z
        .array(z.string())
        .describe("Array of node types to find (e.g. ['COMPONENT', 'FRAME'])"),
    },
    async ({ nodeId, types }) => {
      try {
        // Initial response to indicate we're starting the process
        const initialStatus = {
          type: 'text' as const,
          text: `Starting node type scanning for types: ${types.join(', ')}...`,
        }

        // Use the plugin's scan_nodes_by_types function
        const result = await figmaClient.sendCommandToFigma('scan_nodes_by_types', {
          nodeId,
          types,
        })

        // Format the response
        if (result && typeof result === 'object' && 'matchingNodes' in result) {
          const typedResult = result as {
            success: boolean
            count: number
            matchingNodes: Array<{
              id: string
              name: string
              type: string
              bbox: {
                x: number
                y: number
                width: number
                height: number
              }
            }>
            searchedTypes: Array<string>
          }

          const summaryText = `Scan completed: Found ${
            typedResult.count
          } nodes matching types: ${typedResult.searchedTypes.join(', ')}`

          return {
            content: [
              initialStatus,
              {
                type: 'text' as const,
                text: summaryText,
              },
              {
                type: 'text' as const,
                text: JSON.stringify(typedResult.matchingNodes, null, 2),
              },
            ],
          }
        }

        // If the result is in an unexpected format, return it as is
        return {
          content: [
            initialStatus,
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
              text: `Error scanning nodes by types: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        }
      }
    }
  )
}
