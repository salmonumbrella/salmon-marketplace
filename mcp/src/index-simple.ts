import * as readline from "readline";
import { Client } from '@notionhq/client';

// Initialize Notion client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

// Pattern 1 tool schema
const tools = [{
  name: "use_notion",
  description: "Interact with Notion API - 19 actions covering databases, pages, blocks, users, comments, search.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "query_database", "create_database", "update_database", "get_database",
          "create_page", "get_page", "update_page", "get_page_property",
          "get_block_children", "append_block_children", "get_block", "update_block", "delete_block",
          "get_user", "list_users", "get_self",
          "get_comments", "create_comment",
          "search"
        ],
        description: "Action to perform"
      },
      database_id: { type: "string", description: "Database ID" },
      page_id: { type: "string", description: "Page ID" },
      block_id: { type: "string", description: "Block ID" },
      user_id: { type: "string", description: "User ID" },
      property_id: { type: "string", description: "Property ID" },
      title: { type: "string", description: "Title/name" },
      properties: { type: "object", description: "Properties object" },
      children: { type: "array", description: "Block children array" },
      content: { type: "string", description: "Text content (converted to paragraph block)" },
      parent: { type: "object", description: "Parent reference {database_id: ...} or {page_id: ...}" },
      query: { type: "string", description: "Search/filter query" },
      filter: { type: "object", description: "Database filter object" },
      sorts: { type: "array", description: "Sort array" },
      limit: { type: "number", description: "Result limit (default: 10)" },
      start_cursor: { type: "string", description: "Pagination cursor" }
    },
    required: ["action"]
  }
}];

// Handle tool calls by routing to Notion SDK
async function handleToolCall(args: Record<string, unknown>): Promise<unknown> {
  const action = args.action as string;

  try {
    switch (action) {
      // Database operations
      case "query_database":
        return await notion.databases.query({
          database_id: args.database_id as string,
          filter: args.filter as any,
          sorts: args.sorts as any,
          start_cursor: args.start_cursor as string,
          page_size: args.limit as number,
        });

      case "get_database":
        return await notion.databases.retrieve({ database_id: args.database_id as string });

      case "create_database":
        return await notion.databases.create({
          parent: args.parent as any,
          title: args.title ? [{ text: { content: args.title as string } }] : [],
          properties: args.properties as any,
        });

      case "update_database":
        return await notion.databases.update({
          database_id: args.database_id as string,
          title: args.title ? [{ text: { content: args.title as string } }] : undefined,
          properties: args.properties as any,
        });

      // Page operations
      case "create_page":
        const pageProps = { ...(args.properties as any) || {} };
        if (args.title) {
          pageProps.title = { title: [{ text: { content: args.title as string } }] };
        }
        return await notion.pages.create({
          parent: args.parent || { database_id: args.database_id as string },
          properties: pageProps,
        });

      case "get_page":
        return await notion.pages.retrieve({ page_id: args.page_id as string });

      case "update_page":
        return await notion.pages.update({
          page_id: args.page_id as string,
          properties: args.properties as any,
        });

      case "get_page_property":
        return await notion.pages.properties.retrieve({
          page_id: args.page_id as string,
          property_id: args.property_id as string,
        });

      // Block operations
      case "get_block_children":
        return await notion.blocks.children.list({
          block_id: args.block_id as string,
          start_cursor: args.start_cursor as string,
          page_size: args.limit as number,
        });

      case "append_block_children":
        const children = args.children as any[] || [];
        if (args.content && children.length === 0) {
          children.push({
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: args.content as string } }]
            }
          });
        }
        return await notion.blocks.children.append({
          block_id: args.block_id || args.page_id as string,
          children,
        });

      case "get_block":
        return await notion.blocks.retrieve({ block_id: args.block_id as string });

      case "update_block":
        return await notion.blocks.update({
          block_id: args.block_id as string,
          ...args
        } as any);

      case "delete_block":
        return await notion.blocks.delete({ block_id: args.block_id as string });

      // User operations
      case "get_user":
        return await notion.users.retrieve({ user_id: args.user_id as string });

      case "list_users":
        return await notion.users.list({
          start_cursor: args.start_cursor as string,
          page_size: args.limit as number,
        });

      case "get_self":
        return await notion.users.me({});

      // Comment operations
      case "get_comments":
        return await notion.comments.list({
          block_id: args.block_id as string,
          start_cursor: args.start_cursor as string,
          page_size: args.limit as number,
        });

      case "create_comment":
        return await notion.comments.create({
          parent: args.parent as any,
          rich_text: [{ text: { content: args.content as string } }],
        });

      // Search
      case "search":
        return await notion.search({
          query: args.query as string,
          filter: args.filter as any,
          sort: args.sorts as any,
          start_cursor: args.start_cursor as string,
          page_size: args.limit as number,
        });

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    throw new Error(
      `Notion API error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

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
            capabilities: { tools: {} },
            serverInfo: {
              name: "notion-mcp-pattern1",
              version: "4.1.0",
            },
          },
        };
      } else if (request.method === "tools/list") {
        response = {
          jsonrpc: "2.0",
          id: request.id,
          result: { tools },
        };
      } else if (request.method === "tools/call") {
        const toolArgs = request.params?.arguments as Record<string, unknown>;

        try {
          const result = await handleToolCall(toolArgs);
          response = {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              content: [{
                type: "text",
                text: JSON.stringify(result, null, 2),
              }],
              isError: false,
            },
          };
        } catch (error) {
          response = {
            jsonrpc: "2.0",
            id: request.id,
            result: {
              content: [{
                type: "text",
                text: error instanceof Error ? error.message : String(error),
              }],
              isError: true,
            },
          };
        }
      } else {
        response = {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`,
          },
        };
      }

      console.log(JSON.stringify(response));
    } catch (error) {
      console.error("Error processing request:", error);
    }
  });
}

main();
