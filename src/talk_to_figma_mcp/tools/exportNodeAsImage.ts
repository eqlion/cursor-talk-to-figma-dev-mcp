import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import figmaClient from '../figmaClient'
import { z } from 'zod'
import path from 'node:path'
import { $ } from 'bun'

// Export Node as Image Tool
export const registerExportNodeAsImage = (server: McpServer) => {
  server.tool(
    'export_node_as_image',
    'Export a node as an image from Figma. If a path is provided, the image will be saved to the file. Otherwise, the image will be returned as a base64 encoded string. If you pass a path, use the current working directory from your context as the base path.',
    {
      nodeId: z.string().describe('The ID of the node to export'),
      format: z.enum(['PNG', 'JPG', 'SVG', 'PDF']).optional().describe('Export format'),
      scale: z.number().positive().optional().describe('Export scale'),
      path: z.string().optional().describe('An optional path to the file that should be saved'),
    },
    async ({ nodeId, format, scale, path }) => {
      try {
        const result = await figmaClient.sendCommandToFigma('export_node_as_image', {
          nodeId,
          format: format || 'PNG',
          scale: scale || 1,
        })
        const typedResult = result as { imageData: string; mimeType: string }

        if (path) {
          const { imageData, mimeType } = typedResult
          const base64Image = `data:${mimeType};base64,${imageData}`
          const result = await fetch(base64Image)
          await Bun.write(path, result)
          return {
            content: [
              {
                type: 'text',
                text: `Image saved to ${path}`,
              },
            ],
          }
        }
        return {
          content: [
            {
              type: 'image',
              data: typedResult.imageData,
              mimeType: typedResult.mimeType || 'image/png',
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error exporting node as image: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        }
      }
    }
  )
}
