# Cursor Talk to Figma Dev MCP

This project implements a Model Context Protocol (MCP) integration between Cursor AI and Figma Dev mode, allowing Cursor to communicate with Figma for reading designs.

https://github.com/user-attachments/assets/129a14d2-ed73-470f-9a4c-2240b2a4885c

## Project Structure

- `src/talk_to_figma_mcp/` - TypeScript MCP server for Figma integration
- `src/cursor_mcp_plugin/` - Figma plugin for communicating with Cursor
- `src/socket.ts` - WebSocket server that facilitates communication between the MCP server and Figma plugin

## Get Started

### Repo setup

1. Install [Bun](https://bun.sh/) if you haven’t already:

   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Clone the repo and navigate to the folder:

   ```bash
   git clone git@github.com:eqlion/cursor-talk-to-figma-dev-mcp.git
   cd cursor-talk-to-figma-dev-mcp
   ```

3. Install JS dependencies:

   ```bash
   bun install
   ```

4. Start the WebSocket server (used for communication between the Figma plugin and the MCP server):

   ```bash
   bun socket
   ```

5. Add the server to your Cursor MCP config at `~/.cursor/mcp.json`:

   Run `which bun` to find the full path to `"command"`, then update your config:

   ```json
   {
     "mcpServers": {
       "TalkToFigma": {
         "command": "/Users/YOURUSERNAME/.bun/bin/bun",
         "args": [
           "/Users/YOURUSERNAME/path/to/cursor-talk-to-figma-dev-mcp/src/talk_to_figma_mcp/server.ts"
         ]
       }
     }
   }
   ```

   Alternatively, go to Cursor > Settings… > Cursor Settings > MCP and click “Add new global MCP server.”

   You might need to refresh the server connection if it doesn’t connect right away.

6. Done! You’re all set.

### Figma Plugin

1. Open any Figma file you want to use.
2. Switch to dev mode (if not already enabled).
3. In the right pane, go to “Plugins”.
4. In the Plugins section:
   - Switch to **Development**,
   - Click **New**,
   - Choose **“Import plugin from manifest…”**
5. In the file dialog, navigate to the repo folder, open the `cursor_mcp_plugin` directory, and select `manifest.json`.
6. If everything was configured correctly, the plugin should now be active.

## Usage

1. Start the WebSocket server
2. Install the MCP server in Cursor
3. Open Figma and run the Cursor MCP Plugin
4. Connect the plugin to the WebSocket server by joining a channel using `join_channel`
5. Use Cursor to communicate with Figma using the MCP tools

## MCP Tools

The MCP server provides the following tools for interacting with Figma:

### Document & Selection

- `get_document_info` - Get information about the current Figma document
- `get_selection` - Get information about the current selection
- `get_node_info` - Get detailed information about a specific node
- `get_nodes_info` - Get detailed information about multiple nodes by providing an array of node IDs

### Annotations

- `get_annotations` - Get all annotations in the current document or specific node
- `scan_nodes_by_types` - Scan for nodes with specific types (useful for finding annotation targets)

### Modifying text content

- `scan_text_nodes` - Scan text nodes with intelligent chunking for large designs

### Components & Styles

- `get_styles` - Get information about local styles
- `get_local_components` - Get information about local components
- `get_team_components` - Get information about team components

### Export & Advanced

- `export_node_as_image` - Export a node as an image (PNG, JPG, SVG, or PDF)
- `execute_figma_code` - Execute arbitrary JavaScript code in Figma (use with caution)

### Connection Management

- `join_channel` - Join a specific channel to communicate with Figma

## Development

### Building the Figma Plugin

1. Navigate to the Figma plugin directory:

   ```
   cd src/cursor_mcp_plugin
   ```

2. Edit code.js and ui.html

## Best Practices

When working with the Figma MCP:

1. Always join a channel before sending commands
2. Get document overview using `get_document_info` first
3. Check current selection with `get_selection` before modifications
4. Verify changes using `get_node_info`
5. Use component instances when possible for consistency
6. Handle errors appropriately as all commands can throw exceptions
7. For large designs:
   - Use chunking parameters in `scan_text_nodes`
   - Monitor progress through WebSocket updates
   - Implement appropriate error handling
8. For text operations:
   - Use batch operations when possible
   - Consider structural relationships
   - Verify changes with targeted exports
9. For converting legacy annotations:
   - Scan text nodes to identify numbered markers and descriptions
   - Use `scan_nodes_by_types` to find UI elements that annotations refer to
   - Match markers with their target elements using path, name, or proximity
   - Categorize annotations appropriately with `get_annotations`
   - Create native annotations with `set_multiple_annotations` in batches
   - Verify all annotations are properly linked to their targets
   - Delete legacy annotation nodes after successful conversion

## License

MIT

## Acknowledgments

This project is based on [cursor-talk-to-figma-mcp](https://github.com/sonnylazuardi/cursor-talk-to-figma-mcp) by [Sonny Lazuardi](https://github.com/sonnylazuardi), which is licensed under the MIT License.
