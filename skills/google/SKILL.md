---
name: google
description: Google workspace automation - Calendar + Gmail integration
allowed-tools: Task, mcp__plugin_salmon-marketplace_google-calendar__use_google_calendar, mcp__plugin_salmon-marketplace_google-calendar__use_gmail
---

# Superpowers: Google

## MANDATORY: Always Use Subagents

**NEVER call MCP tools directly from this skill.**

ALL Google operations MUST be executed through subagents using the Task tool.

**Pattern:**
1. Skill parses user intent
2. Skill dispatches Task with subagent_type="general-purpose"
3. Subagent executes Google MCP calls
4. Subagent returns structured results
5. Skill formats results for user

## What This Does

Direct access to Google Calendar + Gmail with zero friction. Shared authentication at ~/.config/google-mcp/

**Architecture:** Multi-tool MCP pattern - Single MCP server exposing two tools

## Calendar Operations

Use `use_google_calendar` for:
- `list-events` - List calendar events with filtering
- `create-event` - Create new calendar events
- `update-event` - Update existing events
- `delete-event` - Delete events
- `get-event` - Get specific event details
- `get-freebusy` - Check calendar availability
- `search-events` - Search for events
- `list-calendars` - List available calendars
- `get-current-time` - Get current time in timezone
- `list-colors` - Get available event colors

### Common Calendar Workflows

**Schedule meeting:**
```javascript
use_google_calendar({
  action: "create-event",
  calendarId: "primary",
  summary: "Team Sync",
  start: "2025-10-28T14:00:00-07:00",
  end: "2025-10-28T15:00:00-07:00",
  attendees: [{email: "colleague@example.com"}],
  checkConflicts: true
})
```

**Check availability:**
```javascript
use_google_calendar({
  action: "get-freebusy",
  timeMin: "2025-10-28T09:00:00-07:00",
  timeMax: "2025-10-28T17:00:00-07:00",
  calendarsToCheck: ["primary"]
})
```

**List today's events:**
```javascript
use_google_calendar({
  action: "list-events",
  calendarId: "primary",
  timeMin: "2025-10-27T00:00:00-07:00",
  timeMax: "2025-10-27T23:59:59-07:00"
})
```

## Gmail Operations

Use `use_gmail` for:
- `list_messages` - List emails with filtering
- `get_message` - Get specific email details
- `send_message` - Send new email
- `get_profile` - Get Gmail profile info
- `list_labels` - List Gmail labels
- `create_label` - Create new label
- `list_threads` - List email threads
- `get_thread` - Get thread details
- `modify_message` - Modify message (labels, read status)
- `trash_message` - Move message to trash
- `delete_message` - Permanently delete message
- `get_attachment` - Download email attachment

### Common Gmail Workflows

**Send email:**
```javascript
use_gmail({
  action: "send_message",
  to: ["recipient@example.com"],
  subject: "Meeting Follow-up",
  body: "Thanks for meeting today!"
})
```

**Check inbox:**
```javascript
use_gmail({
  action: "list_messages",
  maxResults: 10,
  labelIds: ["INBOX"],
  q: "is:unread"
})
```

**Search emails:**
```javascript
use_gmail({
  action: "list_messages",
  q: "from:boss@company.com subject:urgent"
})
```

**Read specific email:**
```javascript
use_gmail({
  action: "get_message",
  id: "message-id-here",
  format: "full"
})
```

**Mark as read:**
```javascript
use_gmail({
  action: "modify_message",
  id: "message-id-here",
  removeLabelIds: ["UNREAD"]
})
```

## Authentication

Both services share credentials at `~/.config/google-mcp/`:
- `credentials.json` - OAuth client credentials from Google Cloud Console
- `token.json` - Auto-generated access/refresh tokens
- `.env` - Optional environment variables

**First run:** OAuth flow prompts once, authenticates both Calendar + Gmail

**Required Google Cloud API scopes:**
- Calendar: `https://www.googleapis.com/auth/calendar`
- Gmail: `https://www.googleapis.com/auth/gmail.modify`

## Calendar Configuration

**Calendar Alias Resolution:**

When user mentions a calendar by alias:

1. Check environment variables for `CALENDAR_{ALIAS}`:
   - "personal" → `CALENDAR_PERSONAL`
   - "work" → `CALENDAR_WORK`
2. If found → use that calendar ID
3. If not found → use `CALENDAR_PERSONAL` (defaults to "primary")

**Environment Variable Setup:**

User creates `~/.config/google-mcp/.env`:
```bash
CALENDAR_PERSONAL=personal-email@gmail.com
CALENDAR_WORK=your-work-email@company.com
```

This file is automatically loaded by the MCP server.

**Alias Resolution Examples:**
- User: "Add to my work calendar" → `CALENDAR_WORK` → "work@company.com"
- User: "Check my personal calendar" → `CALENDAR_PERSONAL` → "primary"
- User: "Create event" (no calendar mentioned) → `CALENDAR_PERSONAL` → "primary"

## Performance Rules

1. **Use subagents** - NEVER call MCP tools directly
2. **Batch operations** - Use parallel tool calls when possible
3. **No confirmations** - Just execute (user trusts you)
4. **Error handling** - Return clear error messages with troubleshooting steps
5. **Natural time parsing** - Convert "tomorrow at 2pm" to ISO 8601
6. **Check conflicts** - Default to `checkConflicts: true` for Calendar events

## Error Handling

Common errors subagents should handle:

**Calendar:**
- **"Event not found"** → Suggest searching first
- **"Conflict detected"** → Show conflicts, ask to proceed
- **"Invalid time"** → Clarify date/time with user
- **"Calendar not found"** → List available calendars
- **"Auth expired"** → User needs to re-authenticate

**Gmail:**
- **"Message not found"** → Verify message ID or search criteria
- **"Insufficient permissions"** → Check API scopes in Google Cloud Console
- **"Invalid email address"** → Validate recipient addresses
- **"Attachment too large"** → Gmail has 25MB attachment limit
- **"Auth expired"** → User needs to re-authenticate

## Example Subagent Prompts

### Calendar Example

When user says: "Schedule a team meeting next Monday at 10am for 1 hour"

Dispatch:
```
Task tool with subagent_type="general-purpose"

Prompt:
"Create a calendar event using use_google_calendar:
- Action: create-event
- Summary: Team Meeting
- Start: 2025-11-03T10:00:00-07:00 (next Monday)
- End: 2025-11-03T11:00:00-07:00
- CalendarId: primary
- Check for conflicts

Return the created event details and any conflicts found."
```

### Gmail Example

When user says: "Send an email to john@example.com about tomorrow's meeting"

Dispatch:
```
Task tool with subagent_type="general-purpose"

Prompt:
"Send an email using use_gmail:
- Action: send_message
- To: ['john@example.com']
- Subject: Tomorrow's Meeting
- Body: [Draft appropriate message about meeting]

Return confirmation of sent email with message ID."
```

## Combined Workflows

### Email + Calendar Integration

When user says: "Send meeting invite to sarah@company.com for tomorrow at 2pm"

Dispatch subagent to:
1. Create calendar event with attendee
2. Optionally send follow-up email with details

```javascript
// Step 1: Create calendar event (auto-sends invite)
use_google_calendar({
  action: "create-event",
  summary: "Meeting with Sarah",
  start: "2025-10-28T14:00:00-07:00",
  end: "2025-10-28T15:00:00-07:00",
  attendees: [{email: "sarah@company.com"}],
  sendUpdates: "all"
})

// Step 2: Optional follow-up email
use_gmail({
  action: "send_message",
  to: ["sarah@company.com"],
  subject: "Meeting Tomorrow",
  body: "Looking forward to our meeting tomorrow at 2pm!"
})
```

### Check Schedule + Send Status

When user says: "Am I free this afternoon? If so, email my team I'm available"

Dispatch subagent to:
1. Check calendar availability
2. Send email based on result

```javascript
// Step 1: Check availability
const freebusy = await use_google_calendar({
  action: "get-freebusy",
  timeMin: "2025-10-27T12:00:00-07:00",
  timeMax: "2025-10-27T18:00:00-07:00",
  calendarsToCheck: ["primary"]
})

// Step 2: Send email if free
if (freebusy.free) {
  await use_gmail({
    action: "send_message",
    to: ["team@company.com"],
    subject: "Available This Afternoon",
    body: "I'm free this afternoon if anyone needs to meet."
  })
}
```

## Tips for Subagents

**Calendar:**
- Parse dates carefully - "tomorrow" needs current date context
- Always specify timezone - Default to calendar's timezone
- Handle conflicts gracefully - Show warnings, let user decide
- Search before update/delete - Don't assume event IDs
- Use descriptive summaries - Better than generic "Meeting"

**Gmail:**
- Format email body properly - Use plain text or HTML
- Validate email addresses before sending
- Use Gmail search syntax for powerful filtering
- Handle large result sets with pagination
- Respect user privacy - Don't log email contents
