// This is the main code file for the Cursor MCP Figma plugin
// It handles Figma API commands

// Plugin state
const state = {
  serverPort: 3055, // Default port
}

// Helper function for progress updates
function sendProgressUpdate(
  commandId,
  commandType,
  status,
  progress,
  totalItems,
  processedItems,
  message,
  payload = null
) {
  const update = {
    type: 'command_progress',
    commandId,
    commandType,
    status,
    progress,
    totalItems,
    processedItems,
    message,
    timestamp: Date.now(),
  }

  // Add optional chunk information if present
  if (payload) {
    if (payload.currentChunk !== undefined && payload.totalChunks !== undefined) {
      update.currentChunk = payload.currentChunk
      update.totalChunks = payload.totalChunks
      update.chunkSize = payload.chunkSize
    }
    update.payload = payload
  }

  // Send to UI
  figma.ui.postMessage(update)
  console.log(`Progress update: ${status} - ${progress}% - ${message}`)

  return update
}

// Show UI
if (figma.editorType === 'dev') {
  figma.showUI(__html__, {
    width: 350,
    height: 450,
    themeColors: true,
    title: 'Cursor MCP Plugin',
  })
} else {
  figma.showUI(__html__, {
    width: 350,
    height: 450,
  })
}

// Plugin commands from UI
figma.ui.onmessage = async (msg) => {
  switch (msg.type) {
    case 'update-settings':
      updateSettings(msg)
      break
    case 'notify':
      figma.notify(msg.message)
      break
    case 'close-plugin':
      figma.closePlugin()
      break
    case 'execute-command':
      // Execute commands received from UI (which gets them from WebSocket)
      try {
        const result = await handleCommand(msg.command, msg.params)
        // Send result back to UI
        figma.ui.postMessage({
          type: 'command-result',
          id: msg.id,
          result,
        })
      } catch (error) {
        figma.ui.postMessage({
          type: 'command-error',
          id: msg.id,
          error: error.message || 'Error executing command',
        })
      }
      break
  }
}

// Listen for plugin commands from menu
figma.on('run', ({ command }) => {
  figma.ui.postMessage({ type: 'auto-connect' })
})

// Update plugin settings
function updateSettings(settings) {
  if (settings.serverPort) {
    state.serverPort = settings.serverPort
  }

  figma.clientStorage.setAsync('settings', {
    serverPort: state.serverPort,
  })
}

// Handle commands from UI
async function handleCommand(command, params) {
  switch (command) {
    case 'get_document_info':
      return await getDocumentInfo()
    case 'get_selection':
      return await getSelection()
    case 'get_node_info':
      if (!params || !params.nodeId) {
        throw new Error('Missing nodeId parameter')
      }
      return await getNodeInfo(params.nodeId)
    case 'get_nodes_info':
      if (!params || !params.nodeIds || !Array.isArray(params.nodeIds)) {
        throw new Error('Missing or invalid nodeIds parameter')
      }
      return await getNodesInfo(params.nodeIds)
    case 'get_styles':
      return await getStyles()
    case 'get_local_components':
      return await getLocalComponents()
    // case "get_team_components":
    //   return await getTeamComponents();
    case 'export_node_as_image':
      return await exportNodeAsImage(params)
    case 'scan_text_nodes':
      return await scanTextNodes(params)
    case 'get_annotations':
      return await getAnnotations(params)
    case 'scan_nodes_by_types':
      return await scanNodesByTypes(params)
    default:
      throw new Error(`Unknown command: ${command}`)
  }
}

// Command implementations

async function getDocumentInfo() {
  await figma.currentPage.loadAsync()
  const page = figma.currentPage
  return {
    name: page.name,
    id: page.id,
    type: page.type,
    children: page.children.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
    })),
    currentPage: {
      id: page.id,
      name: page.name,
      childCount: page.children.length,
    },
    pages: [
      {
        id: page.id,
        name: page.name,
        childCount: page.children.length,
      },
    ],
  }
}

async function getSelection() {
  return {
    selectionCount: figma.currentPage.selection.length,
    selection: figma.currentPage.selection.map((node) => ({
      id: node.id,
      name: node.name,
      type: node.type,
      visible: node.visible,
    })),
  }
}

async function getNodeInfo(nodeId) {
  const node = await figma.getNodeByIdAsync(nodeId)

  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`)
  }

  const response = await node.exportAsync({
    format: 'JSON_REST_V1',
  })

  return response.document
}

async function getNodesInfo(nodeIds) {
  try {
    // Load all nodes in parallel
    const nodes = await Promise.all(nodeIds.map((id) => figma.getNodeByIdAsync(id)))

    // Filter out any null values (nodes that weren't found)
    const validNodes = nodes.filter((node) => node !== null)

    // Export all valid nodes in parallel
    const responses = await Promise.all(
      validNodes.map(async (node) => {
        const response = await node.exportAsync({
          format: 'JSON_REST_V1',
        })
        return {
          nodeId: node.id,
          document: response.document,
        }
      })
    )

    return responses
  } catch (error) {
    throw new Error(`Error getting nodes info: ${error.message}`)
  }
}

async function getStyles() {
  const styles = {
    colors: await figma.getLocalPaintStylesAsync(),
    texts: await figma.getLocalTextStylesAsync(),
    effects: await figma.getLocalEffectStylesAsync(),
    grids: await figma.getLocalGridStylesAsync(),
  }

  return {
    colors: styles.colors.map((style) => ({
      id: style.id,
      name: style.name,
      key: style.key,
      paint: style.paints[0],
    })),
    texts: styles.texts.map((style) => ({
      id: style.id,
      name: style.name,
      key: style.key,
      fontSize: style.fontSize,
      fontName: style.fontName,
    })),
    effects: styles.effects.map((style) => ({
      id: style.id,
      name: style.name,
      key: style.key,
    })),
    grids: styles.grids.map((style) => ({
      id: style.id,
      name: style.name,
      key: style.key,
    })),
  }
}

async function getLocalComponents() {
  await figma.loadAllPagesAsync()

  const components = figma.root.findAllWithCriteria({
    types: ['COMPONENT'],
  })

  return {
    count: components.length,
    components: components.map((component) => ({
      id: component.id,
      name: component.name,
      key: 'key' in component ? component.key : null,
    })),
  }
}

// async function getTeamComponents() {
//   try {
//     const teamComponents =
//       await figma.teamLibrary.getAvailableComponentsAsync();

//     return {
//       count: teamComponents.length,
//       components: teamComponents.map((component) => ({
//         key: component.key,
//         name: component.name,
//         description: component.description,
//         libraryName: component.libraryName,
//       })),
//     };
//   } catch (error) {
//     throw new Error(`Error getting team components: ${error.message}`);
//   }
// }

async function exportNodeAsImage(params) {
  const { nodeId, scale = 1 } = params || {}

  const format = 'PNG'

  if (!nodeId) {
    throw new Error('Missing nodeId parameter')
  }

  const node = await figma.getNodeByIdAsync(nodeId)
  if (!node) {
    throw new Error(`Node not found with ID: ${nodeId}`)
  }

  if (!('exportAsync' in node)) {
    throw new Error(`Node does not support exporting: ${nodeId}`)
  }

  try {
    const settings = {
      format: format,
      constraint: { type: 'SCALE', value: scale },
    }

    const bytes = await node.exportAsync(settings)

    let mimeType
    switch (format) {
      case 'PNG':
        mimeType = 'image/png'
        break
      case 'JPG':
        mimeType = 'image/jpeg'
        break
      case 'SVG':
        mimeType = 'image/svg+xml'
        break
      case 'PDF':
        mimeType = 'application/pdf'
        break
      default:
        mimeType = 'application/octet-stream'
    }

    // Proper way to convert Uint8Array to base64
    const base64 = customBase64Encode(bytes)
    // const imageData = `data:${mimeType};base64,${base64}`;

    return {
      nodeId,
      format,
      scale,
      mimeType,
      imageData: base64,
    }
  } catch (error) {
    throw new Error(`Error exporting node as image: ${error.message}`)
  }
}
function customBase64Encode(bytes) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let base64 = ''

  const byteLength = bytes.byteLength
  const byteRemainder = byteLength % 3
  const mainLength = byteLength - byteRemainder

  let a, b, c, d
  let chunk

  // Main loop deals with bytes in chunks of 3
  for (let i = 0; i < mainLength; i = i + 3) {
    // Combine the three bytes into a single integer
    chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2]

    // Use bitmasks to extract 6-bit segments from the triplet
    a = (chunk & 16515072) >> 18 // 16515072 = (2^6 - 1) << 18
    b = (chunk & 258048) >> 12 // 258048 = (2^6 - 1) << 12
    c = (chunk & 4032) >> 6 // 4032 = (2^6 - 1) << 6
    d = chunk & 63 // 63 = 2^6 - 1

    // Convert the raw binary segments to the appropriate ASCII encoding
    base64 += chars[a] + chars[b] + chars[c] + chars[d]
  }

  // Deal with the remaining bytes and padding
  if (byteRemainder === 1) {
    chunk = bytes[mainLength]

    a = (chunk & 252) >> 2 // 252 = (2^6 - 1) << 2

    // Set the 4 least significant bits to zero
    b = (chunk & 3) << 4 // 3 = 2^2 - 1

    base64 += chars[a] + chars[b] + '=='
  } else if (byteRemainder === 2) {
    chunk = (bytes[mainLength] << 8) | bytes[mainLength + 1]

    a = (chunk & 64512) >> 10 // 64512 = (2^6 - 1) << 10
    b = (chunk & 1008) >> 4 // 1008 = (2^6 - 1) << 4

    // Set the 2 least significant bits to zero
    c = (chunk & 15) << 2 // 15 = 2^4 - 1

    base64 += chars[a] + chars[b] + chars[c] + '='
  }

  return base64
}

// Initialize settings on load
;(async function initializePlugin() {
  try {
    const savedSettings = await figma.clientStorage.getAsync('settings')
    if (savedSettings) {
      if (savedSettings.serverPort) {
        state.serverPort = savedSettings.serverPort
      }
    }

    // Send initial settings to UI
    figma.ui.postMessage({
      type: 'init-settings',
      settings: {
        serverPort: state.serverPort,
      },
    })
  } catch (error) {
    console.error('Error loading settings:', error)
  }
})()

async function scanTextNodes(params) {
  console.log(`Starting to scan text nodes from node ID: ${params.nodeId}`)
  const {
    nodeId,
    useChunking = true,
    chunkSize = 10,
    commandId = generateCommandId(),
  } = params || {}

  const node = await figma.getNodeByIdAsync(nodeId)

  if (!node) {
    console.error(`Node with ID ${nodeId} not found`)
    // Send error progress update
    sendProgressUpdate(
      commandId,
      'scan_text_nodes',
      'error',
      0,
      0,
      0,
      `Node with ID ${nodeId} not found`,
      { error: `Node not found: ${nodeId}` }
    )
    throw new Error(`Node with ID ${nodeId} not found`)
  }

  // If chunking is not enabled, use the original implementation
  if (!useChunking) {
    const textNodes = []
    try {
      // Send started progress update
      sendProgressUpdate(
        commandId,
        'scan_text_nodes',
        'started',
        0,
        1, // Not known yet how many nodes there are
        0,
        `Starting scan of node "${node.name || nodeId}" without chunking`,
        null
      )

      await findTextNodes(node, [], 0, textNodes)

      // Send completed progress update
      sendProgressUpdate(
        commandId,
        'scan_text_nodes',
        'completed',
        100,
        textNodes.length,
        textNodes.length,
        `Scan complete. Found ${textNodes.length} text nodes.`,
        { textNodes }
      )

      return {
        success: true,
        message: `Scanned ${textNodes.length} text nodes.`,
        count: textNodes.length,
        textNodes: textNodes,
        commandId,
      }
    } catch (error) {
      console.error('Error scanning text nodes:', error)

      // Send error progress update
      sendProgressUpdate(
        commandId,
        'scan_text_nodes',
        'error',
        0,
        0,
        0,
        `Error scanning text nodes: ${error.message}`,
        { error: error.message }
      )

      throw new Error(`Error scanning text nodes: ${error.message}`)
    }
  }

  // Chunked implementation
  console.log(`Using chunked scanning with chunk size: ${chunkSize}`)

  // First, collect all nodes to process (without processing them yet)
  const nodesToProcess = []

  // Send started progress update
  sendProgressUpdate(
    commandId,
    'scan_text_nodes',
    'started',
    0,
    0, // Not known yet how many nodes there are
    0,
    `Starting chunked scan of node "${node.name || nodeId}"`,
    { chunkSize }
  )

  await collectNodesToProcess(node, [], 0, nodesToProcess)

  const totalNodes = nodesToProcess.length
  console.log(`Found ${totalNodes} total nodes to process`)

  // Calculate number of chunks needed
  const totalChunks = Math.ceil(totalNodes / chunkSize)
  console.log(`Will process in ${totalChunks} chunks`)

  // Send update after node collection
  sendProgressUpdate(
    commandId,
    'scan_text_nodes',
    'in_progress',
    5, // 5% progress for collection phase
    totalNodes,
    0,
    `Found ${totalNodes} nodes to scan. Will process in ${totalChunks} chunks.`,
    {
      totalNodes,
      totalChunks,
      chunkSize,
    }
  )

  // Process nodes in chunks
  const allTextNodes = []
  let processedNodes = 0
  let chunksProcessed = 0

  for (let i = 0; i < totalNodes; i += chunkSize) {
    const chunkEnd = Math.min(i + chunkSize, totalNodes)
    console.log(
      `Processing chunk ${chunksProcessed + 1}/${totalChunks} (nodes ${i} to ${chunkEnd - 1})`
    )

    // Send update before processing chunk
    sendProgressUpdate(
      commandId,
      'scan_text_nodes',
      'in_progress',
      Math.round(5 + (chunksProcessed / totalChunks) * 90), // 5-95% for processing
      totalNodes,
      processedNodes,
      `Processing chunk ${chunksProcessed + 1}/${totalChunks}`,
      {
        currentChunk: chunksProcessed + 1,
        totalChunks,
        textNodesFound: allTextNodes.length,
      }
    )

    const chunkNodes = nodesToProcess.slice(i, chunkEnd)
    const chunkTextNodes = []

    // Process each node in this chunk
    for (const nodeInfo of chunkNodes) {
      if (nodeInfo.node.type === 'TEXT') {
        try {
          const textNodeInfo = await processTextNode(
            nodeInfo.node,
            nodeInfo.parentPath,
            nodeInfo.depth
          )
          if (textNodeInfo) {
            chunkTextNodes.push(textNodeInfo)
          }
        } catch (error) {
          console.error(`Error processing text node: ${error.message}`)
          // Continue with other nodes
        }
      }

      // Brief delay to allow UI updates and prevent freezing
      await delay(5)
    }

    // Add results from this chunk
    allTextNodes.push(...chunkTextNodes)
    processedNodes += chunkNodes.length
    chunksProcessed++

    // Send update after processing chunk
    sendProgressUpdate(
      commandId,
      'scan_text_nodes',
      'in_progress',
      Math.round(5 + (chunksProcessed / totalChunks) * 90), // 5-95% for processing
      totalNodes,
      processedNodes,
      `Processed chunk ${chunksProcessed}/${totalChunks}. Found ${allTextNodes.length} text nodes so far.`,
      {
        currentChunk: chunksProcessed,
        totalChunks,
        processedNodes,
        textNodesFound: allTextNodes.length,
        chunkResult: chunkTextNodes,
      }
    )

    // Small delay between chunks to prevent UI freezing
    if (i + chunkSize < totalNodes) {
      await delay(50)
    }
  }

  // Send completed progress update
  sendProgressUpdate(
    commandId,
    'scan_text_nodes',
    'completed',
    100,
    totalNodes,
    processedNodes,
    `Scan complete. Found ${allTextNodes.length} text nodes.`,
    {
      textNodes: allTextNodes,
      processedNodes,
      chunks: chunksProcessed,
    }
  )

  return {
    success: true,
    message: `Chunked scan complete. Found ${allTextNodes.length} text nodes.`,
    totalNodes: allTextNodes.length,
    processedNodes: processedNodes,
    chunks: chunksProcessed,
    textNodes: allTextNodes,
    commandId,
  }
}

// Helper function to collect all nodes that need to be processed
async function collectNodesToProcess(node, parentPath = [], depth = 0, nodesToProcess = []) {
  // Skip invisible nodes
  if (node.visible === false) return

  // Get the path to this node
  const nodePath = [...parentPath, node.name || `Unnamed ${node.type}`]

  // Add this node to the processing list
  nodesToProcess.push({
    node: node,
    parentPath: nodePath,
    depth: depth,
  })

  // Recursively add children
  if ('children' in node) {
    for (const child of node.children) {
      await collectNodesToProcess(child, nodePath, depth + 1, nodesToProcess)
    }
  }
}

// Process a single text node
async function processTextNode(node, parentPath, depth) {
  if (node.type !== 'TEXT') return null

  try {
    // Safely extract font information
    let fontFamily = ''
    let fontStyle = ''

    if (node.fontName) {
      if (typeof node.fontName === 'object') {
        if ('family' in node.fontName) fontFamily = node.fontName.family
        if ('style' in node.fontName) fontStyle = node.fontName.style
      }
    }

    // Create a safe representation of the text node
    const safeTextNode = {
      id: node.id,
      name: node.name || 'Text',
      type: node.type,
      characters: node.characters,
      fontSize: typeof node.fontSize === 'number' ? node.fontSize : 0,
      fontFamily: fontFamily,
      fontStyle: fontStyle,
      x: typeof node.x === 'number' ? node.x : 0,
      y: typeof node.y === 'number' ? node.y : 0,
      width: typeof node.width === 'number' ? node.width : 0,
      height: typeof node.height === 'number' ? node.height : 0,
      path: parentPath.join(' > '),
      depth: depth,
    }

    // Highlight the node briefly (optional visual feedback)
    try {
      const originalFills = JSON.parse(JSON.stringify(node.fills))
      node.fills = [
        {
          type: 'SOLID',
          color: { r: 1, g: 0.5, b: 0 },
          opacity: 0.3,
        },
      ]

      // Brief delay for the highlight to be visible
      await delay(100)

      try {
        node.fills = originalFills
      } catch (err) {
        console.error('Error resetting fills:', err)
      }
    } catch (highlightErr) {
      console.error('Error highlighting text node:', highlightErr)
      // Continue anyway, highlighting is just visual feedback
    }

    return safeTextNode
  } catch (nodeErr) {
    console.error('Error processing text node:', nodeErr)
    return null
  }
}

// A delay function that returns a promise
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Keep the original findTextNodes for backward compatibility
async function findTextNodes(node, parentPath = [], depth = 0, textNodes = []) {
  // Skip invisible nodes
  if (node.visible === false) return

  // Get the path to this node including its name
  const nodePath = [...parentPath, node.name || `Unnamed ${node.type}`]

  if (node.type === 'TEXT') {
    try {
      // Safely extract font information to avoid Symbol serialization issues
      let fontFamily = ''
      let fontStyle = ''

      if (node.fontName) {
        if (typeof node.fontName === 'object') {
          if ('family' in node.fontName) fontFamily = node.fontName.family
          if ('style' in node.fontName) fontStyle = node.fontName.style
        }
      }

      // Create a safe representation of the text node with only serializable properties
      const safeTextNode = {
        id: node.id,
        name: node.name || 'Text',
        type: node.type,
        characters: node.characters,
        fontSize: typeof node.fontSize === 'number' ? node.fontSize : 0,
        fontFamily: fontFamily,
        fontStyle: fontStyle,
        x: typeof node.x === 'number' ? node.x : 0,
        y: typeof node.y === 'number' ? node.y : 0,
        width: typeof node.width === 'number' ? node.width : 0,
        height: typeof node.height === 'number' ? node.height : 0,
        path: nodePath.join(' > '),
        depth: depth,
      }

      // Only highlight the node if it's not being done via API
      try {
        // Safe way to create a temporary highlight without causing serialization issues
        const originalFills = JSON.parse(JSON.stringify(node.fills))
        node.fills = [
          {
            type: 'SOLID',
            color: { r: 1, g: 0.5, b: 0 },
            opacity: 0.3,
          },
        ]

        // Promise-based delay instead of setTimeout
        await delay(500)

        try {
          node.fills = originalFills
        } catch (err) {
          console.error('Error resetting fills:', err)
        }
      } catch (highlightErr) {
        console.error('Error highlighting text node:', highlightErr)
        // Continue anyway, highlighting is just visual feedback
      }

      textNodes.push(safeTextNode)
    } catch (nodeErr) {
      console.error('Error processing text node:', nodeErr)
      // Skip this node but continue with others
    }
  }

  // Recursively process children of container nodes
  if ('children' in node) {
    for (const child of node.children) {
      await findTextNodes(child, nodePath, depth + 1, textNodes)
    }
  }
}

// Function to generate simple UUIDs for command IDs
function generateCommandId() {
  return (
    'cmd_' +
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  )
}

async function getAnnotations(params) {
  try {
    const { nodeId, includeCategories = true } = params

    // Get categories first if needed
    let categoriesMap = {}
    if (includeCategories) {
      const categories = await figma.annotations.getAnnotationCategoriesAsync()
      categoriesMap = categories.reduce((map, category) => {
        map[category.id] = {
          id: category.id,
          label: category.label,
          color: category.color,
          isPreset: category.isPreset,
        }
        return map
      }, {})
    }

    if (nodeId) {
      // Get annotations for a specific node
      const node = await figma.getNodeByIdAsync(nodeId)
      if (!node) {
        throw new Error(`Node not found: ${nodeId}`)
      }

      if (!('annotations' in node)) {
        throw new Error(`Node type ${node.type} does not support annotations`)
      }

      const result = {
        nodeId: node.id,
        name: node.name,
        annotations: node.annotations || [],
      }

      if (includeCategories) {
        result.categories = Object.values(categoriesMap)
      }

      return result
    } else {
      // Get all annotations in the current page
      const annotations = []
      const processNode = async (node) => {
        if ('annotations' in node && node.annotations && node.annotations.length > 0) {
          annotations.push({
            nodeId: node.id,
            name: node.name,
            annotations: node.annotations,
          })
        }
        if ('children' in node) {
          for (const child of node.children) {
            await processNode(child)
          }
        }
      }

      // Start from current page
      await processNode(figma.currentPage)

      const result = {
        annotatedNodes: annotations,
      }

      if (includeCategories) {
        result.categories = Object.values(categoriesMap)
      }

      return result
    }
  } catch (error) {
    console.error('Error in getAnnotations:', error)
    throw error
  }
}
/**
 * Scan for nodes with specific types within a node
 * @param {Object} params - Parameters object
 * @param {string} params.nodeId - ID of the node to scan within
 * @param {Array<string>} params.types - Array of node types to find (e.g. ['COMPONENT', 'FRAME'])
 * @returns {Object} - Object containing found nodes
 */
async function scanNodesByTypes(params) {
  console.log(`Starting to scan nodes by types from node ID: ${params.nodeId}`)
  const { nodeId, types = [] } = params || {}

  if (!types || types.length === 0) {
    throw new Error('No types specified to search for')
  }

  const node = await figma.getNodeByIdAsync(nodeId)

  if (!node) {
    throw new Error(`Node with ID ${nodeId} not found`)
  }

  // Simple implementation without chunking
  const matchingNodes = []

  // Send a single progress update to notify start
  const commandId = generateCommandId()
  sendProgressUpdate(
    commandId,
    'scan_nodes_by_types',
    'started',
    0,
    1,
    0,
    `Starting scan of node "${node.name || nodeId}" for types: ${types.join(', ')}`,
    null
  )

  // Recursively find nodes with specified types
  await findNodesByTypes(node, types, matchingNodes)

  // Send completion update
  sendProgressUpdate(
    commandId,
    'scan_nodes_by_types',
    'completed',
    100,
    matchingNodes.length,
    matchingNodes.length,
    `Scan complete. Found ${matchingNodes.length} matching nodes.`,
    { matchingNodes }
  )

  return {
    success: true,
    message: `Found ${matchingNodes.length} matching nodes.`,
    count: matchingNodes.length,
    matchingNodes: matchingNodes,
    searchedTypes: types,
  }
}

/**
 * Helper function to recursively find nodes with specific types
 * @param {SceneNode} node - The root node to start searching from
 * @param {Array<string>} types - Array of node types to find
 * @param {Array} matchingNodes - Array to store found nodes
 */
async function findNodesByTypes(node, types, matchingNodes = []) {
  // Skip invisible nodes
  if (node.visible === false) return

  // Check if this node is one of the specified types
  if (types.includes(node.type)) {
    // Create a minimal representation with just ID, type and bbox
    matchingNodes.push({
      id: node.id,
      name: node.name || `Unnamed ${node.type}`,
      type: node.type,
      // Basic bounding box info
      bbox: {
        x: typeof node.x === 'number' ? node.x : 0,
        y: typeof node.y === 'number' ? node.y : 0,
        width: typeof node.width === 'number' ? node.width : 0,
        height: typeof node.height === 'number' ? node.height : 0,
      },
    })
  }

  // Recursively process children of container nodes
  if ('children' in node) {
    for (const child of node.children) {
      await findNodesByTypes(child, types, matchingNodes)
    }
  }
}
