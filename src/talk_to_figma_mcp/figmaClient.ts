import { logger } from './logger'
import { v4 as uuidv4 } from 'uuid'
import WebSocket from 'ws'
import { CommandProgressUpdate, FigmaCommand, FigmaResponse } from './types'

class FigmaClient {
  private ws: WebSocket | null = null
  private currentChannel: string | null = null
  private pendingRequests = new Map<
    string,
    {
      resolve: (value: unknown) => void
      reject: (reason: unknown) => void
      timeout: ReturnType<typeof setTimeout>
      lastActivity: number // Add timestamp for last activity
    }
  >()
  private WS_URL: string
  private serverUrl: string

  constructor() {
    const args = process.argv.slice(2)
    const serverArg = args.find((arg) => arg.startsWith('--server='))
    this.serverUrl = serverArg ? serverArg.split('=')[1] : 'localhost'
    this.WS_URL =
      this.serverUrl === 'localhost' ? `ws://${this.serverUrl}` : `wss://${this.serverUrl}`
  }

  sendCommandToFigma = (
    command: FigmaCommand,
    params: unknown = {},
    timeoutMs: number = 120000
  ): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      // If not connected, try to connect first
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        this.connectToFigma()
        reject(new Error('Not connected to Figma. Attempting to connect...'))
        return
      }

      // Check if we need a channel for this command
      const requiresChannel = command !== 'join'
      if (requiresChannel && !this.currentChannel) {
        reject(new Error('Must join a channel before sending commands'))
        return
      }

      const id = uuidv4()
      const request = {
        id,
        type: command === 'join' ? 'join' : 'message',
        ...(command === 'join'
          ? { channel: (params as any).channel }
          : { channel: this.currentChannel }),
        message: {
          id,
          command,
          params: {
            ...(params as any),
            commandId: id, // Include the command ID in params
          },
        },
      }

      // Set timeout for request
      const timeout = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          logger.error(`Request ${id} to Figma timed out after ${timeoutMs / 1000} seconds`)
          reject(new Error('Request to Figma timed out'))
        }
      }, timeoutMs)

      // Store the promise callbacks to resolve/reject later
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timeout,
        lastActivity: Date.now(),
      })

      // Send the request
      logger.info(`Sending command to Figma: ${command}`)
      logger.debug(`Request details: ${JSON.stringify(request)}`)
      this.ws?.send(JSON.stringify(request))
    })
  }

  connectToFigma = (port: number = 3055) => {
    // If already connected, do nothing
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      logger.info('Already connected to Figma')
      return
    }

    const wsUrl = this.serverUrl === 'localhost' ? `${this.WS_URL}:${port}` : this.WS_URL
    logger.info(`Connecting to Figma socket server at ${wsUrl}...`)
    this.ws = new WebSocket(wsUrl)

    this.ws.on('open', () => {
      logger.info('Connected to Figma socket server')
      // Reset channel on new connection
      this.currentChannel = null
    })

    this.ws.on('message', (data: any) => {
      try {
        // Define a more specific type with an index signature to allow any property access
        interface ProgressMessage {
          message: FigmaResponse | any
          type?: string
          id?: string
          [key: string]: any // Allow any other properties
        }

        const json = JSON.parse(data) as ProgressMessage

        // Handle progress updates
        if (json.type === 'progress_update') {
          const progressData = json.message.data as CommandProgressUpdate
          const requestId = json.id || ''

          if (requestId && this.pendingRequests.has(requestId)) {
            const request = this.pendingRequests.get(requestId)!

            // Update last activity timestamp
            request.lastActivity = Date.now()

            // Reset the timeout to prevent timeouts during long-running operations
            clearTimeout(request.timeout)

            // Create a new timeout
            request.timeout = setTimeout(() => {
              if (this.pendingRequests.has(requestId)) {
                logger.error(`Request ${requestId} timed out after extended period of inactivity`)
                this.pendingRequests.delete(requestId)
                request.reject(new Error('Request to Figma timed out'))
              }
            }, 60000) // 60 second timeout for inactivity

            // Log progress
            logger.info(
              `Progress update for ${progressData.commandType}: ${progressData.progress}% - ${progressData.message}`
            )

            // For completed updates, we could resolve the request early if desired
            if (progressData.status === 'completed' && progressData.progress === 100) {
              // Optionally resolve early with partial data
              // request.resolve(progressData.payload);
              // pendingRequests.delete(requestId);

              // Instead, just log the completion, wait for final result from Figma
              logger.info(
                `Operation ${progressData.commandType} completed, waiting for final result`
              )
            }
          }
          return
        }

        // Handle regular responses
        const myResponse = json.message
        logger.debug(`Received message: ${JSON.stringify(myResponse)}`)
        logger.log('myResponse' + JSON.stringify(myResponse))

        // Handle response to a request
        if (myResponse.id && this.pendingRequests.has(myResponse.id) && myResponse.result) {
          const request = this.pendingRequests.get(myResponse.id)!
          clearTimeout(request.timeout)

          if (myResponse.error) {
            logger.error(`Error from Figma: ${myResponse.error}`)
            request.reject(new Error(myResponse.error))
          } else {
            if (myResponse.result) {
              request.resolve(myResponse.result)
            }
          }

          this.pendingRequests.delete(myResponse.id)
        } else {
          // Handle broadcast messages or events
          logger.info(`Received broadcast message: ${JSON.stringify(myResponse)}`)
        }
      } catch (error) {
        logger.error(
          `Error parsing message: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    })

    this.ws.on('error', (error) => {
      logger.error(`Socket error: ${error}`)
    })

    this.ws.on('close', () => {
      logger.info('Disconnected from Figma socket server')
      this.ws = null

      // Reject all pending requests
      for (const [id, request] of this.pendingRequests.entries()) {
        clearTimeout(request.timeout)
        request.reject(new Error('Connection closed'))
        this.pendingRequests.delete(id)
      }

      // Attempt to reconnect
      logger.info('Attempting to reconnect in 2 seconds...')
      setTimeout(() => this.connectToFigma(port), 2000)
    })
  }

  setCurrentChannel = (channel: string) => {
    this.currentChannel = channel
  }

  get isConnected() {
    return !this.ws || this.ws?.readyState === WebSocket.OPEN
  }
}

const figmaClient = new FigmaClient()

export default figmaClient
