#!/usr/bin/env node
/**
 * Pattern 1 MCP Server for Google Calendar API
 * Single use_google_calendar tool with 10 actions
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { OAuth2Client } from "google-auth-library"
import { z } from "zod"
import fs from "fs"
import path from "path"
import os from "os"
import { config } from "dotenv"

// Load environment variables from ~/.config/google-mcp/.env
const envPath = path.join(os.homedir(), '.config/google-mcp/.env')
if (fs.existsSync(envPath)) {
  config({ path: envPath })
}

// Debug logging to file
const DEBUG_LOG = path.join(os.homedir(), '.config/google-mcp/debug.log')
function debugLog(...args: any[]) {
  const timestamp = new Date().toISOString()
  const message = `[${timestamp}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}\n`
  fs.appendFileSync(DEBUG_LOG, message)
  console.error(...args)
}

// Import Calendar handlers
import { CreateEventHandler } from "./handlers/core/CreateEventHandler.js"
import { UpdateEventHandler } from "./handlers/core/UpdateEventHandler.js"
import { DeleteEventHandler } from "./handlers/core/DeleteEventHandler.js"
import { GetEventHandler } from "./handlers/core/GetEventHandler.js"
import { ListEventsHandler } from "./handlers/core/ListEventsHandler.js"
import { SearchEventsHandler } from "./handlers/core/SearchEventsHandler.js"
import { ListCalendarsHandler } from "./handlers/core/ListCalendarsHandler.js"
import { GetCurrentTimeHandler } from "./handlers/core/GetCurrentTimeHandler.js"
import { FreeBusyEventHandler } from "./handlers/core/FreeBusyEventHandler.js"
import { ListColorsHandler } from "./handlers/core/ListColorsHandler.js"

// Import Gmail Pattern 1 wrapper
import { executeGmailAction, UseGmailParams, type UseGmailInput } from "./gmail/pattern1.js"

// Import auth
import { initializeOAuth2Client } from "./auth/client.js"
import { TokenManager } from "./auth/tokenManager.js"

// Action enum
enum GoogleCalendarAction {
  GET_CURRENT_TIME = "get-current-time",
  LIST_CALENDARS = "list-calendars",
  LIST_EVENTS = "list-events",
  SEARCH_EVENTS = "search-events",
  GET_EVENT = "get-event",
  CREATE_EVENT = "create-event",
  UPDATE_EVENT = "update-event",
  DELETE_EVENT = "delete-event",
  GET_FREEBUSY = "get-freebusy",
  LIST_COLORS = "list-colors"
}

// Zod schema for use_google_calendar tool parameters
const UseGoogleCalendarParams = {
  action: z.nativeEnum(GoogleCalendarAction).describe("Action to perform"),

  // Calendar & Event IDs
  calendarId: z.union([z.string(), z.array(z.string())]).optional().describe("Calendar ID(s)"),
  eventId: z.string().optional().describe("Event ID"),

  // Event details
  summary: z.string().optional().describe("Event title"),
  description: z.string().optional().describe("Event description"),
  location: z.string().optional().describe("Event location"),
  start: z.string().optional().describe("Start time (ISO 8601 or date string)"),
  end: z.string().optional().describe("End time (ISO 8601 or date string)"),

  // Attendees
  attendees: z.array(z.object({
    email: z.string(),
    displayName: z.string().optional(),
    optional: z.boolean().optional()
  })).optional().describe("Event attendees"),

  // Search/Query params
  timeMin: z.string().optional().describe("Query start time"),
  timeMax: z.string().optional().describe("Query end time"),
  query: z.string().optional().describe("Search query"),
  timeZone: z.string().optional().describe("Timezone (IANA format)"),

  // Conflict detection
  checkConflicts: z.boolean().optional().describe("Check for conflicts (default: true)"),
  allowDuplicates: z.boolean().optional().describe("Allow duplicate events"),
  calendarsToCheck: z.array(z.string()).optional().describe("Calendars to check for conflicts"),

  // Update options
  sendUpdates: z.enum(["all", "externalOnly", "none"]).optional().describe("Send update notifications"),

  // Additional properties
  properties: z.record(z.any()).optional().describe("Additional event properties"),

  // Recurring events
  recurrence: z.array(z.string()).optional().describe("Recurrence rules (RFC5545)"),
  modificationScope: z.enum(["thisEventOnly", "thisAndFollowing", "all"]).optional().describe("Recurring event modification scope"),

  // Misc
  colorId: z.string().optional().describe("Event color ID"),
  visibility: z.enum(["default", "public", "private", "confidential"]).optional().describe("Event visibility"),
  fields: z.array(z.string()).optional().describe("Fields to include in response")
}

type UseGoogleCalendarInput = z.infer<ReturnType<typeof z.object<typeof UseGoogleCalendarParams>>>

let oauth2Client: OAuth2Client
let tokenManager: TokenManager

/**
 * Initialize OAuth2 client
 */
async function initializeAuth(): Promise<void> {
  try {
    debugLog("[DEBUG] initializeAuth() starting")
    oauth2Client = await initializeOAuth2Client()
    debugLog("[DEBUG] OAuth2Client created")

    tokenManager = new TokenManager(oauth2Client)
    debugLog("[DEBUG] TokenManager created, token path:", tokenManager.getTokenPath())

    // Load and validate tokens
    // Note: validateTokens() internally calls loadSavedTokens() and sets credentials
    const hasValidTokens = await tokenManager.validateTokens()
    debugLog("[DEBUG] validateTokens() returned:", hasValidTokens)
    if (!hasValidTokens) {
      debugLog("[google-calendar-mcp] No valid tokens found. Please authenticate first.")
      process.exit(1)
    }

    // Credentials are already set by validateTokens() -> loadSavedTokens()
    // No need to call loadSavedTokens() again or setCredentials() manually

    const creds = oauth2Client.credentials
    debugLog("[DEBUG] oauth2Client.credentials after init:", {
      hasAccessToken: !!creds.access_token,
      hasRefreshToken: !!creds.refresh_token,
      expiry: creds.expiry_date
    })

    debugLog("[google-calendar-mcp] Authentication initialized successfully")
  } catch (error) {
    debugLog("[google-calendar-mcp] Failed to initialize auth:", error)
    process.exit(1)
  }
}

/**
 * Execute Google Calendar action using handlers
 */
async function executeCalendarAction(params: UseGoogleCalendarInput): Promise<any> {
  debugLog("[DEBUG] executeCalendarAction() called for action:", params.action)
  const creds = oauth2Client.credentials
  debugLog("[DEBUG] oauth2Client.credentials at execution:", {
    hasAccessToken: !!creds.access_token,
    hasRefreshToken: !!creds.refresh_token,
    expiry: creds.expiry_date
  })

  switch (params.action) {
    case GoogleCalendarAction.GET_CURRENT_TIME:
      return await new GetCurrentTimeHandler().runTool(params, oauth2Client)

    case GoogleCalendarAction.LIST_CALENDARS:
      return await new ListCalendarsHandler().runTool(params, oauth2Client)

    case GoogleCalendarAction.LIST_EVENTS:
      return await new ListEventsHandler().runTool(params, oauth2Client)

    case GoogleCalendarAction.SEARCH_EVENTS:
      return await new SearchEventsHandler().runTool(params, oauth2Client)

    case GoogleCalendarAction.GET_EVENT:
      return await new GetEventHandler().runTool(params, oauth2Client)

    case GoogleCalendarAction.CREATE_EVENT:
      return await new CreateEventHandler().runTool(params, oauth2Client)

    case GoogleCalendarAction.UPDATE_EVENT:
      return await new UpdateEventHandler().runTool(params, oauth2Client)

    case GoogleCalendarAction.DELETE_EVENT:
      return await new DeleteEventHandler().runTool(params, oauth2Client)

    case GoogleCalendarAction.GET_FREEBUSY:
      return await new FreeBusyEventHandler().runTool(params, oauth2Client)

    case GoogleCalendarAction.LIST_COLORS:
      return await new ListColorsHandler().runTool(params, oauth2Client)

    default:
      throw new Error(`Unknown action: ${params.action}`)
  }
}

// Create MCP server instance
const server = new McpServer({
  name: "google-services-pattern1",
  version: "1.0.0"
})

// Register the use_google_calendar tool
server.tool(
  "use_google_calendar",
  `Complete Google Calendar control - 10 actions covering events, scheduling, availability.

Pattern 1 interface: single tool with action parameter. Supports all Google Calendar operations.`,
  UseGoogleCalendarParams,
  {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true
  },
  async (args) => {
    try {
      // Parse and validate input with Zod
      const params = z.object(UseGoogleCalendarParams).parse(args) as UseGoogleCalendarInput

      // Execute Calendar action
      const result = await executeCalendarAction(params)

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
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

// Register the use_gmail tool
server.tool(
  "use_gmail",
  `Gmail operations - send, read, search, manage labels and threads.

Pattern 1 interface: single tool with action parameter. Supports core Gmail operations including messages, threads, drafts, labels, and batch operations.`,
  UseGmailParams,
  {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true
  },
  async (args) => {
    try {
      // Parse and validate input with Zod
      const params = z.object(UseGmailParams).parse(args) as UseGmailInput

      // Execute Gmail action
      const result = await executeGmailAction(params, oauth2Client)

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(result, null, 2)
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
  debugLog("=== Google Services MCP server starting (Calendar + Gmail) ===")
  debugLog("Process PID:", process.pid)
  debugLog("Environment variables:", {
    GOOGLE_OAUTH_CREDENTIALS: process.env.GOOGLE_OAUTH_CREDENTIALS,
    GOOGLE_CALENDAR_MCP_TOKEN_PATH: process.env.GOOGLE_CALENDAR_MCP_TOKEN_PATH,
    NODE_ENV: process.env.NODE_ENV
  })

  // Initialize auth first
  await initializeAuth()

  // Create stdio transport
  const transport = new StdioServerTransport()

  // Connect server to transport
  await server.connect(transport)

  debugLog("Google Services MCP server (Pattern 1, SDK) running via stdio - Calendar + Gmail tools available")
}

// Run the server
main().catch((error) => {
  console.error("Server error:", error)
  process.exit(1)
})
