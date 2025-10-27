#!/usr/bin/env node
/**
 * Pattern 1 MCP Server for Google Calendar API
 * Single use_google_calendar tool with 16 actions
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { OAuth2Client } from "google-auth-library"
import { z } from "zod"

// Import handlers
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
    oauth2Client = await initializeOAuth2Client()
    tokenManager = new TokenManager(oauth2Client)

    // Load and validate tokens
    const hasValidTokens = await tokenManager.validateTokens()
    if (!hasValidTokens) {
      console.error("[google-calendar-mcp] No valid tokens found. Please authenticate first.")
      process.exit(1)
    }

    const tokens = await tokenManager.loadSavedTokens()
    if (tokens) {
      oauth2Client.setCredentials(tokens)
    }

    console.error("[google-calendar-mcp] Authentication initialized successfully")
  } catch (error) {
    console.error("[google-calendar-mcp] Failed to initialize auth:", error)
    process.exit(1)
  }
}

/**
 * Execute Google Calendar action using handlers
 */
async function executeCalendarAction(params: UseGoogleCalendarInput): Promise<any> {
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
  name: "google-calendar-pattern1",
  version: "1.0.0"
})

// Register the use_google_calendar tool
server.tool(
  "use_google_calendar",
  `Complete Google Calendar control - 16 actions covering events, scheduling, availability.

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

// Main function
async function main() {
  // Initialize auth first
  await initializeAuth()

  // Create stdio transport
  const transport = new StdioServerTransport()

  // Connect server to transport
  await server.connect(transport)

  console.error("Google Calendar MCP server (Pattern 1, SDK) running via stdio")
}

// Run the server
main().catch((error) => {
  console.error("Server error:", error)
  process.exit(1)
})
