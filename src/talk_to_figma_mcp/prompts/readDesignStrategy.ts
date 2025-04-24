import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

const prompt = `When reading Figma designs, follow these best practices:

1. Start with selection:
   - First use get_selection() to understand the current selection
   - If no selection ask user to select single or multiple nodes

2. Get node infos of the selected nodes:
   - Use get_nodes_info() to get the information of the selected nodes
   - If no selection ask user to select single or multiple nodes
`

export const registerReadDesignStrategy = (server: McpServer) => {
  server.prompt('read_design_strategy', 'Best practices for reading Figma designs', (extra) => {
    return {
      messages: [
        {
          role: 'assistant',
          content: {
            type: 'text',
            text: prompt,
          },
        },
      ],
      description: 'Best practices for reading Figma designs',
    }
  })
}
