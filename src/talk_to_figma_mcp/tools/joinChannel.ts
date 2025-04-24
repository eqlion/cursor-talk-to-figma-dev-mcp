import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import figmaClient from '../figmaClient'
import { logger } from '../logger'

// Function to join a channel
async function joinChannel(channelName: string): Promise<void> {
  if (!figmaClient.isConnected) {
    throw new Error('Not connected to Figma')
  }

  try {
    await figmaClient.sendCommandToFigma('join', { channel: channelName })
    figmaClient.setCurrentChannel(channelName)
    logger.info(`Joined channel: ${channelName}`)
  } catch (error) {
    logger.error(
      `Failed to join channel: ${error instanceof Error ? error.message : String(error)}`
    )
    throw error
  }
}

export const registerJoinChannel = (server: McpServer) => {
  server.tool(
    'join_channel',
    'Join a specific channel to communicate with Figma',
    {
      channel: z.string().describe('The name of the channel to join').default(''),
    },
    async ({ channel }) => {
      try {
        if (!channel) {
          // If no channel provided, ask the user for input
          return {
            content: [
              {
                type: 'text',
                text: 'Please provide a channel name to join:',
              },
            ],
            followUp: {
              tool: 'join_channel',
              description: 'Join the specified channel',
            },
          }
        }

        await joinChannel(channel)
        return {
          content: [
            {
              type: 'text',
              text: `Successfully joined channel: ${channel}`,
            },
          ],
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error joining channel: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
        }
      }
    }
  )
}
