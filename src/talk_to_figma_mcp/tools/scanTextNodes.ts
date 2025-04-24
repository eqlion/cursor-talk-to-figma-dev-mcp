import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import figmaClient from '../figmaClient'

export const registerScanTextNodes = (server: McpServer) => {
  server.tool(
    'scan_text_nodes',
    'Scan all text nodes in the selected Figma node',
    {
      nodeId: z.string().describe('ID of the node to scan'),
    },
    async ({ nodeId }) => {
      try {
        // Initial response to indicate we're starting the process
        const initialStatus = {
          type: 'text' as const,
          text: 'Starting text node scanning. This may take a moment for large designs...',
        }

        // Use the plugin's scan_text_nodes function with chunking flag
        const result = await figmaClient.sendCommandToFigma('scan_text_nodes', {
          nodeId,
          useChunking: true, // Enable chunking on the plugin side
          chunkSize: 10, // Process 10 nodes at a time
        })

        // If the result indicates chunking was used, format the response accordingly
        if (result && typeof result === 'object' && 'chunks' in result) {
          const typedResult = result as {
            success: boolean
            totalNodes: number
            processedNodes: number
            chunks: number
            textNodes: Array<any>
          }

          const summaryText = `
          Scan completed:
          - Found ${typedResult.totalNodes} text nodes
          - Processed in ${typedResult.chunks} chunks
          `

          return {
            content: [
              initialStatus,
              {
                type: 'text' as const,
                text: summaryText,
              },
              {
                type: 'text' as const,
                text: JSON.stringify(typedResult.textNodes, null, 2),
              },
            ],
          }
        }

        // If chunking wasn't used or wasn't reported in the result format, return the result as is
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
              text: `Error scanning text nodes: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        }
      }
    }
  )
}
