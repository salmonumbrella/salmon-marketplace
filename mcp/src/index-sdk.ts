#!/usr/bin/env node
/**
 * Pattern 1 MCP Server for Notion API using official SDK
 * Single use_notion tool with 19 actions
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { Client } from "@notionhq/client"
import { z } from "zod"

import { loadEnvConfig, logConfigSummary, MissingEnvError } from "./config.js"

let notion: Client
let notionUserId: string | undefined

try {
  const envConfig = loadEnvConfig()
  notion = new Client({
    auth: envConfig.authToken
  })
  notionUserId = envConfig.userId
  logConfigSummary(envConfig)
} catch (error) {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`[notion-mcp] Failed to initialize configuration: ${message}`)
  if (error instanceof MissingEnvError) {
    console.error("[notion-mcp] Exiting because required environment variables are missing.")
  }
  process.exit(1)
}

// Action enum
enum NotionAction {
  QUERY_DATABASE = "query_database",
  CREATE_DATABASE = "create_database",
  UPDATE_DATABASE = "update_database",
  GET_DATABASE = "get_database",
  CREATE_PAGE = "create_page",
  GET_PAGE = "get_page",
  UPDATE_PAGE = "update_page",
  GET_PAGE_PROPERTY = "get_page_property",
  GET_BLOCK_CHILDREN = "get_block_children",
  APPEND_BLOCK_CHILDREN = "append_block_children",
  GET_BLOCK = "get_block",
  UPDATE_BLOCK = "update_block",
  DELETE_BLOCK = "delete_block",
  GET_USER = "get_user",
  LIST_USERS = "list_users",
  GET_SELF = "get_self",
  GET_COMMENTS = "get_comments",
  CREATE_COMMENT = "create_comment",
  SEARCH = "search"
}

// Zod schema for use_notion tool parameters
const UseNotionParams = {
  action: z.nativeEnum(NotionAction).describe("Action to perform"),
  database_id: z.string().optional().describe("Database ID"),
  page_id: z.string().optional().describe("Page ID"),
  block_id: z.string().optional().describe("Block ID"),
  user_id: z.string().optional().describe("User ID"),
  property_id: z.string().optional().describe("Property ID"),
  title: z.string().optional().describe("Title/name"),
  properties: z.record(z.any()).optional().describe("Properties object"),
  children: z.array(z.any()).optional().describe("Block children array"),
  content: z.string().optional().describe("Text content (converted to paragraph block)"),
  parent: z.record(z.any()).optional().describe("Parent reference {database_id: ...} or {page_id: ...}"),
  query: z.string().optional().describe("Search/filter query"),
  filter: z.record(z.any()).optional().describe("Database filter object"),
  sorts: z.array(z.any()).optional().describe("Sort array"),
  limit: z.number().optional().describe("Result limit (default: 10)"),
  start_cursor: z.string().optional().describe("Pagination cursor")
}

type UseNotionInput = z.infer<ReturnType<typeof z.object<typeof UseNotionParams>>>

function requireParam<T>(value: T | undefined, param: string, action: NotionAction): T {
  if (value === undefined || value === null || value === "") {
    throw new Error(`"${param}" is required for action "${action}"`)
  }
  return value as T
}

function ensurePeopleFieldAutoAssign(properties: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!notionUserId) {
    return properties
  }

  if (!properties) {
    return undefined
  }

  const cloned = { ...properties }

  for (const [field, value] of Object.entries(properties)) {
    if (!value || typeof value !== "object") continue

    const typed = value as Record<string, unknown>
    if (!("people" in typed)) continue

    const people = typed.people
    if (!Array.isArray(people) || people.length > 0) {
      continue
    }

    cloned[field] = {
      ...typed,
      people: [{ id: notionUserId }]
    }
  }

  return cloned
}

/**
 * Execute Notion action using official SDK
 */
async function executeNotionAction(params: UseNotionInput): Promise<any> {
  switch (params.action) {
    // Database operations
    case NotionAction.QUERY_DATABASE:
      return await notion.databases.query({
        database_id: requireParam(params.database_id, "database_id", params.action),
        filter: params.filter as any,
        sorts: params.sorts as any,
        start_cursor: params.start_cursor,
        page_size: params.limit,
      })

    case NotionAction.GET_DATABASE:
      return await notion.databases.retrieve({ database_id: requireParam(params.database_id, "database_id", params.action) })

    case NotionAction.CREATE_DATABASE:
      return await notion.databases.create({
        parent: params.parent as any,
        title: params.title ? [{ text: { content: params.title } }] : [],
        properties: params.properties as any
      })

    case NotionAction.UPDATE_DATABASE:
      return await notion.databases.update({
        database_id: requireParam(params.database_id, "database_id", params.action),
        title: params.title ? [{ text: { content: params.title } }] : undefined,
        properties: params.properties as any
      })

    // Page operations
    case NotionAction.CREATE_PAGE:
      const pageProps = ensurePeopleFieldAutoAssign(params.properties || {})
      if (params.title && pageProps && !("title" in pageProps)) {
        ;(pageProps as Record<string, unknown>).title = {
          title: [{ text: { content: params.title } }]
        }
      }
      return await notion.pages.create({
        parent: params.parent || { database_id: requireParam(params.database_id, "database_id", params.action) },
        properties: pageProps as any
      })

    case NotionAction.GET_PAGE:
      return await notion.pages.retrieve({ page_id: requireParam(params.page_id, "page_id", params.action) })

    case NotionAction.UPDATE_PAGE:
      return await notion.pages.update({
        page_id: requireParam(params.page_id, "page_id", params.action),
        properties: params.properties as any
      })

    case NotionAction.GET_PAGE_PROPERTY:
      return await notion.pages.properties.retrieve({
        page_id: requireParam(params.page_id, "page_id", params.action),
        property_id: requireParam(params.property_id, "property_id", params.action)
      })

    // Block operations
    case NotionAction.GET_BLOCK_CHILDREN:
      return await notion.blocks.children.list({
        block_id: requireParam(params.block_id, "block_id", params.action),
        start_cursor: params.start_cursor,
        page_size: params.limit
      })

    case NotionAction.APPEND_BLOCK_CHILDREN:
      const children = params.children ? [...params.children] : []
      if (params.content && children.length === 0) {
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: params.content } }]
          }
        } as any)
      }
      return await notion.blocks.children.append({
        block_id: requireParam(params.block_id ?? params.page_id, "block_id or page_id", params.action),
        children: children as any
      })

    case NotionAction.GET_BLOCK:
      return await notion.blocks.retrieve({ block_id: requireParam(params.block_id, "block_id", params.action) })

    case NotionAction.UPDATE_BLOCK:
      return await notion.blocks.update({
        block_id: requireParam(params.block_id, "block_id", params.action),
        ...params
      } as any)

    case NotionAction.DELETE_BLOCK:
      return await notion.blocks.delete({ block_id: requireParam(params.block_id, "block_id", params.action) })

    // User operations
    case NotionAction.GET_USER:
      return await notion.users.retrieve({ user_id: requireParam(params.user_id, "user_id", params.action) })

    case NotionAction.LIST_USERS:
      return await notion.users.list({
        start_cursor: params.start_cursor,
        page_size: params.limit
      })

    case NotionAction.GET_SELF:
      return await notion.users.me({})

    // Comment operations
    case NotionAction.GET_COMMENTS:
      return await notion.comments.list({
        block_id: requireParam(params.block_id, "block_id", params.action),
        start_cursor: params.start_cursor,
        page_size: params.limit
      })

    case NotionAction.CREATE_COMMENT:
      return await notion.comments.create({
        parent: params.parent as any,
        rich_text: [{ text: { content: requireParam(params.content, "content", params.action) } }] as any
      })

    // Search
    case NotionAction.SEARCH:
      return await notion.search({
        query: params.query,
        filter: params.filter as any,
        sort: params.sorts as any,
        start_cursor: params.start_cursor,
        page_size: params.limit
      })

    default:
      throw new Error(`Unknown action: ${params.action}`)
  }
}

// Create MCP server instance
const server = new McpServer({
  name: "notion-mcp-pattern1",
  version: "5.1.0"
})

// Register the use_notion tool
server.tool(
  "use_notion",
  `Interact with Notion API - 19 actions covering databases, pages, blocks, users, comments, search.

Pattern 1 interface: single tool with action parameter. Supports all Notion API operations.`,
  UseNotionParams,
  {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true
  },
  async (args) => {
    try {
      // Parse and validate input with Zod
      const params = z.object(UseNotionParams).parse(args) as UseNotionInput

      // Execute Notion action
      const result = await executeNotionAction(params)

      return {
        content: [{
          type: "json" as const,
          json: result
        }]
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      return {
        content: [{
          type: "text" as const,
          text: `Error: ${errorMessage}`
        }],
        isError: true
      }
    }
  }
)

// Main function
async function main() {
  // Create stdio transport
  const transport = new StdioServerTransport()

  // Connect server to transport
  await server.connect(transport)

  console.error("Notion MCP server (Pattern 1, SDK) running via stdio")
}

// Run the server
main().catch((error) => {
  console.error("Server error:", error)
  process.exit(1)
})
