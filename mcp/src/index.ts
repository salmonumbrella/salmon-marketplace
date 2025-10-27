import { Client } from "@notionhq/client";
import * as readline from "readline";

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

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

async function handleToolCall(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  try {
    if (name !== "use_notion") {
      throw new Error(`Unknown tool: ${name}`);
    }

    const action = args.action as string;

    switch (action) {
      case "query_database": {
        const databaseId = args.database_id as string;
        const limit = (args.limit as number) || 10;

        const response = await notion.databases.query({
          database_id: databaseId,
          page_size: limit,
        });

        return {
          pages: response.results.map((page: any) => ({
            id: page.id,
            title: page.properties.title?.title?.[0]?.plain_text || "Untitled",
            properties: page.properties,
            url: page.url,
          })),
          total: response.results.length,
        };
      }

      case "create_page": {
        const databaseId = args.database_id as string;
        const title = args.title as string;
        const customProps = (args.properties as Record<string, any>) || {};

        const response = await notion.pages.create({
          parent: { database_id: databaseId },
          properties: {
            title: {
              title: [{ text: { content: title } }],
            },
            ...customProps,
          },
        });

        return {
          id: response.id,
          title: title,
          url: (response as any).url,
          created_time: (response as any).created_time,
        };
      }

      case "update_page": {
        const pageId = args.page_id as string;
        const properties = args.properties as Record<string, any>;

        const response = await notion.pages.update({
          page_id: pageId,
          properties: properties,
        });

        return {
          id: response.id,
          updated: true,
          url: (response as any).url,
        };
      }

      case "get_database": {
        const databaseId = args.database_id as string;

        const response = await notion.databases.retrieve({
          database_id: databaseId,
        });

        return {
          id: response.id,
          title: (response as any).title?.[0]?.plain_text || "Untitled",
          properties: Object.entries((response as any).properties || {}).map(
            ([key, prop]: any) => ({
              name: key,
              type: prop.type,
            })
          ),
        };
      }

      case "create_database": {
        const parent = args.parent as Record<string, any>;
        const title = args.title as string;
        const properties = args.properties as Record<string, any>;

        const response = await notion.databases.create({
          parent,
          title: [{ type: "text", text: { content: title } }],
          properties,
        });

        return { id: response.id, url: (response as any).url };
      }

      case "update_database": {
        const databaseId = args.database_id as string;
        const updates: any = {};
        if (args.title) updates.title = [{ type: "text", text: { content: args.title as string } }];
        if (args.properties) updates.properties = args.properties;

        const response = await notion.databases.update({
          database_id: databaseId,
          ...updates,
        });

        return { id: response.id, updated: true };
      }

      case "get_page": {
        const pageId = args.page_id as string;
        const response = await notion.pages.retrieve({ page_id: pageId });
        return response;
      }

      case "get_page_property": {
        const pageId = args.page_id as string;
        const propertyId = args.property_id as string;
        const response = await notion.pages.properties.retrieve({
          page_id: pageId,
          property_id: propertyId,
        });
        return response;
      }

      case "get_block_children": {
        const blockId = args.block_id as string;
        const limit = (args.limit as number) || 100;
        const response = await notion.blocks.children.list({
          block_id: blockId,
          page_size: limit,
        });
        return { blocks: response.results, has_more: response.has_more };
      }

      case "append_block_children": {
        const blockId = args.block_id || args.page_id;
        let children = args.children as any[];

        // If content string provided, convert to paragraph block
        if (args.content && !children) {
          children = [{
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: args.content as string } }],
            },
          }];
        }

        const response = await notion.blocks.children.append({
          block_id: blockId as string,
          children,
        });

        return { success: true, blocks_added: (response as any).results.length };
      }

      case "get_block": {
        const blockId = args.block_id as string;
        const response = await notion.blocks.retrieve({ block_id: blockId });
        return response;
      }

      case "update_block": {
        const blockId = args.block_id as string;
        const updates = { ...args };
        delete updates.action;
        delete updates.block_id;

        const response = await notion.blocks.update({
          block_id: blockId,
          ...updates,
        } as any);

        return { id: response.id, updated: true };
      }

      case "delete_block": {
        const blockId = args.block_id as string;
        const response = await notion.blocks.delete({ block_id: blockId });
        return { id: response.id, deleted: true };
      }

      case "get_user": {
        const userId = args.user_id as string;
        const response = await notion.users.retrieve({ user_id: userId });
        return response;
      }

      case "list_users": {
        const limit = (args.limit as number) || 100;
        const response = await notion.users.list({ page_size: limit });
        return { users: response.results, has_more: response.has_more };
      }

      case "get_self": {
        const response = await notion.users.me({});
        return response;
      }

      case "get_comments": {
        const blockId = args.block_id as string;
        const response = await notion.comments.list({ block_id: blockId });
        return { comments: response.results };
      }

      case "create_comment": {
        const parent = args.parent as { page_id: string } | { discussion_id: string };
        const content = args.content as string;

        const response = await notion.comments.create({
          parent,
          rich_text: [{ type: "text", text: { content } }],
        });

        return { id: response.id, created: true };
      }

      case "search": {
        const query = args.query as string;
        const limit = (args.limit as number) || 10;

        const response = await notion.search({
          query: query,
          page_size: limit,
        });

        return {
          results: response.results.map((item: any) => ({
            id: item.id,
            type: item.object,
            title:
              item.properties?.title?.title?.[0]?.plain_text ||
              (item as any).title?.[0]?.plain_text ||
              "Untitled",
            url: item.url,
          })),
          total: response.results.length,
        };
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    throw new Error(
      `Tool error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
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
              name: "notion-mcp",
              version: "1.0.0",
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
