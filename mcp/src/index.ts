import path from 'node:path'
import * as fs from 'node:fs'
import * as readline from "readline";
import { fileURLToPath } from 'url'
import { initProxy } from './init-server.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Debug logging to track MCP server startup
const debugLog = (msg: string) => {
  const timestamp = new Date().toISOString()
  const logEntry = `${timestamp} - ${msg}\n`
  fs.appendFileSync('/tmp/notion-mcp-debug.log', logEntry)
}

debugLog('=== MCP Server Starting ===')
debugLog(`NOTION_TOKEN present: ${process.env.NOTION_TOKEN ? 'YES' : 'NO'}`)
debugLog(`NOTION_API_KEY present: ${process.env.NOTION_API_KEY ? 'YES' : 'NO'}`)
debugLog(`Working directory: ${process.cwd()}`)
debugLog(`__dirname: ${__dirname}`)

// MCP Protocol implementation
interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

// Pattern 1 tool schema - single tool with actions
const tools = [
  {
    name: "use_notion",
    description: "Interact with Notion API - 19 actions covering databases, pages, blocks, users, comments, search.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Action to perform",
          enum: [
            // Database operations
            "query_database", "create_database", "update_database", "get_database",
            // Page operations
            "create_page", "get_page", "update_page", "get_page_property",
            // Block operations
            "get_block_children", "append_block_children", "get_block", "update_block", "delete_block",
            // User operations
            "get_user", "list_users", "get_self",
            // Comment operations
            "get_comments", "create_comment",
            // Search
            "search"
          ],
        },
        // IDs
        database_id: { type: "string", description: "Database ID" },
        page_id: { type: "string", description: "Page ID" },
        block_id: { type: "string", description: "Block ID" },
        user_id: { type: "string", description: "User ID" },
        property_id: { type: "string", description: "Property ID" },
        // Data
        title: { type: "string", description: "Title/name" },
        properties: { type: "object", description: "Properties object" },
        children: { type: "array", description: "Block children array" },
        content: { type: "string", description: "Text content (converted to paragraph block)" },
        parent: { type: "object", description: "Parent reference {database_id: ...} or {page_id: ...}" },
        // Filters and options
        query: { type: "string", description: "Search/filter query" },
        filter: { type: "object", description: "Database filter object" },
        sorts: { type: "array", description: "Sort array" },
        limit: { type: "number", description: "Result limit (default: 10)" },
        start_cursor: { type: "string", description: "Pagination cursor" },
      },
      required: ["action"],
    },
  },
];

// Action to Notion MCP tool mapping
const ACTION_TO_TOOL_MAP: Record<string, { tool: string, method: string }> = {
  // Database operations
  "query_database": { tool: "query-database", method: "POST" },
  "create_database": { tool: "create-database", method: "POST" },
  "update_database": { tool: "update-database", method: "PATCH" },
  "get_database": { tool: "get-database", method: "GET" },
  // Page operations
  "create_page": { tool: "create-page", method: "POST" },
  "get_page": { tool: "get-page", method: "GET" },
  "update_page": { tool: "update-page-properties", method: "PATCH" },
  "get_page_property": { tool: "get-page-property", method: "GET" },
  // Block operations
  "get_block_children": { tool: "get-block-children", method: "GET" },
  "append_block_children": { tool: "append-block-children", method: "PATCH" },
  "get_block": { tool: "get-block", method: "GET" },
  "update_block": { tool: "update-block", method: "PATCH" },
  "delete_block": { tool: "delete-block", method: "DELETE" },
  // User operations
  "get_user": { tool: "get-user", method: "GET" },
  "list_users": { tool: "list-users", method: "GET" },
  "get_self": { tool: "get-bot-user", method: "GET" },
  // Comment operations
  "get_comments": { tool: "get-comments", method: "GET" },
  "create_comment": { tool: "create-comment", method: "POST" },
  // Search
  "search": { tool: "search", method: "POST" },
};

// Initialize Notion's official MCP proxy
let notionProxy: any = null;

async function initializeProxy() {
  if (!notionProxy) {
    const specPath = path.resolve(__dirname, 'notion-openapi.json')
    const baseUrl = process.env.BASE_URL ?? undefined
    notionProxy = await initProxy(specPath, baseUrl)
  }
  return notionProxy
}

// Route Pattern 1 action to Pattern 2 tool
async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  try {
    if (name !== "use_notion") {
      throw new Error(`Unknown tool: ${name}`);
    }

    const action = args.action as string;
    const mapping = ACTION_TO_TOOL_MAP[action];

    if (!mapping) {
      throw new Error(`Unknown action: ${action}`);
    }

    // Initialize proxy
    const proxy = await initializeProxy();

    // Build tool name with method suffix (how Notion's MCP names tools)
    const toolName = `${mapping.tool}-${mapping.method}`;

    // Transform args to Notion's format
    const notionArgs = transformArgs(action, args);

    // Call Notion's official tool through their proxy
    const result = await proxy.callTool(toolName, notionArgs);

    // Transform result back to our simple format
    return transformResult(action, result);

  } catch (error) {
    throw new Error(
      `Tool error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// Transform our Pattern 1 args to Notion's expected format
function transformArgs(action: string, args: Record<string, unknown>): Record<string, unknown> {
  const transformed: Record<string, unknown> = {};

  // Remove action field
  const { action: _, ...rest } = args;

  // Map field names to Notion's API parameter names
  if (rest.database_id) transformed.database_id = rest.database_id;
  if (rest.page_id) transformed.page_id = rest.page_id;
  if (rest.block_id) transformed.block_id = rest.block_id;
  if (rest.user_id) transformed.user_id = rest.user_id;
  if (rest.property_id) transformed.property_id = rest.property_id;
  if (rest.filter) transformed.filter = rest.filter;
  if (rest.sorts) transformed.sorts = rest.sorts;
  if (rest.start_cursor) transformed.start_cursor = rest.start_cursor;
  if (rest.limit !== undefined) transformed.page_size = rest.limit;
  if (rest.query) transformed.query = rest.query;
  if (rest.parent) transformed.parent = rest.parent;
  if (rest.properties) transformed.properties = rest.properties;
  if (rest.children) transformed.children = rest.children;

  // Handle page creation with title
  if (action === "create_page" && rest.title) {
    if (!transformed.properties) {
      transformed.properties = {};
    }
    (transformed.properties as any).title = {
      title: [{ text: { content: rest.title } }]
    };
  }

  return transformed;
}

// Transform Notion's result to our simple format
function transformResult(action: string, result: any): unknown {
  // For now, pass through as-is
  // We could add transformation logic here if needed
  return result;
}

async function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  rl.on("line", async (line) => {
    try {
      const request: MCPRequest = JSON.parse(line);

      let response: MCPResponse;

      if (request.method === "initialize") {
        response = {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: {},
            },
            serverInfo: {
              name: "notion-mcp-pattern1",
              version: "2.0.0",
            },
          },
        };
      } else if (request.method === "tools/list") {
        response = {
          jsonrpc: "2.0",
          id: request.id,
          result: {
            tools: tools,
          },
        };
      } else if (request.method === "tools/call") {
        const toolName = request.params?.name as string;
        const toolArgs = request.params?.arguments as Record<string, unknown>;

        try {
          const result = await handleToolCall(toolName, toolArgs);
          response = {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2),
                },
              ],
              isError: false,
            },
          };
        } catch (error) {
          response = {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              content: [
                {
                  type: "text",
                  text: error instanceof Error ? error.message : String(error),
                },
              ],
              isError: true,
            },
          };
        }
      } else {
        response = {
          jsonrpc: "2.0",
          id: request.id,
          error: { code: -32601, message: "Method not found" },
        };
      }

      console.log(JSON.stringify(response));
    } catch (error) {
      console.error(
        "Error processing request:",
        error instanceof Error ? error.message : String(error)
      );
    }
  });

  rl.on("close", () => {
    process.exit(0);
  });
}

main().catch(console.error);
