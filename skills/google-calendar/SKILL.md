---
name: superpowers-google-calendar
description: Google Calendar automation - events, scheduling, availability, conflict detection
allowed-tools: Task, mcp__google_calendar__use_google_calendar
---

# Superpowers: Google Calendar

## MANDATORY: Always Use Subagents

**NEVER call MCP tools directly from this skill.**

ALL Calendar operations MUST be executed through subagents using the Task tool.

**Pattern:**
1. Skill parses user intent
2. Skill dispatches Task with subagent_type="general-purpose"
3. Subagent executes use_google_calendar MCP calls
4. Subagent returns structured results
5. Skill formats results for user

## What This Does

Direct access to Google Calendar with zero friction. Create events, check availability, search calendar, manage schedules.

**Architecture:** Pattern 1 (single tool, 10 actions, ~2-3k tokens) • On-demand loading (zero context until invoked)

## Calendar Configuration

**Calendar Alias Resolution:**

When user mentions a calendar by alias (e.g., "put this on my work calendar"):

1. Check environment variables for `CALENDAR_{ALIAS}`:
   - "personal" → `CALENDAR_PERSONAL`
   - "work" → `CALENDAR_WORK`
   - "family" → `CALENDAR_FAMILY`
   - etc.
2. If found → use that calendar ID
3. If not found → use `CALENDAR_PERSONAL` (default to "primary")

**Environment Variable Setup:**

User configures in `~/.zshrc` or `~/.bashrc`:
```bash
export CALENDAR_PERSONAL="primary"
export CALENDAR_WORK="work@company.com"
export CALENDAR_FAMILY="family@gmail.com"
```

Or in `~/.claude/plugins/marketplaces/salmon-marketplace/mcp/.env` for local development.

**Alias Resolution Examples:**
- User: "Add to my work calendar" → `CALENDAR_WORK` → "work@company.com"
- User: "Check my personal calendar" → `CALENDAR_PERSONAL` → "primary"
- User: "Create event" (no calendar mentioned) → `CALENDAR_PERSONAL` → "primary" (default)

**First Time Setup:**

If user says "work calendar" but `CALENDAR_WORK` is not set, prompt:
```
I can help you set up calendar aliases! Add this to your ~/.zshrc or ~/.bashrc:

export CALENDAR_WORK="your-work-email@company.com"

Then restart your terminal and Claude Code.
```

## Common Operations

### Create Event

When user says: "Create a meeting tomorrow at 2pm"

Dispatch subagent to:
```javascript
use_google_calendar({
  action: "create-event",
  calendarId: "primary",
  summary: "Meeting",
  start: "2025-10-28T14:00:00",
  end: "2025-10-28T15:00:00",
  checkConflicts: true
})
```

### List Events

When user says: "What's on my calendar this week?"

Dispatch subagent to:
```javascript
use_google_calendar({
  action: "list-events",
  calendarId: "primary",
  timeMin: "2025-10-27T00:00:00",
  timeMax: "2025-11-03T23:59:59"
})
```

### Check Availability

When user says: "Am I free tomorrow afternoon?"

Dispatch subagent to:
```javascript
use_google_calendar({
  action: "get-freebusy",
  calendarId: "primary",
  timeMin: "2025-10-28T12:00:00",
  timeMax: "2025-10-28T18:00:00"
})
```

### Update Event

When user says: "Move my 2pm meeting to 3pm"

Dispatch subagent to:
1. Search for event at 2pm
2. Update with new time:
```javascript
use_google_calendar({
  action: "update-event",
  calendarId: "primary",
  eventId: "<event-id-from-search>",
  start: "2025-10-28T15:00:00",
  end: "2025-10-28T16:00:00",
  checkConflicts: true
})
```

### Delete Event

When user says: "Cancel my meeting tomorrow"

Dispatch subagent to:
1. Search for event
2. Delete:
```javascript
use_google_calendar({
  action: "delete-event",
  calendarId: "primary",
  eventId: "<event-id-from-search>",
  sendUpdates: "all"
})
```

## Advanced Features

### Conflict Detection

**Default behavior:** Always on, warns only (non-blocking)

Conflicts are returned in the response:
```json
{
  "event": { ... },
  "conflicts": [
    {
      "type": "time_conflict",
      "message": "Overlaps with: Team Standup (2:00 PM - 2:30 PM)"
    }
  ]
}
```

**To bypass:** Set `allowDuplicates: true` or `checkConflicts: false`

### Multi-Calendar Operations

Check multiple calendars:
```javascript
use_google_calendar({
  action: "list-events",
  calendarId: ["primary", "work@company.com", "personal@gmail.com"],
  timeMin: "2025-10-27T00:00:00",
  timeMax: "2025-10-28T00:00:00"
})
```

### Recurring Events

Create recurring event:
```javascript
use_google_calendar({
  action: "create-event",
  summary: "Weekly Standup",
  start: "2025-10-28T10:00:00",
  end: "2025-10-28T10:30:00",
  recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR"]
})
```

## Actions Available

1. **get-current-time** - Get current time in calendar timezone
2. **list-calendars** - List available calendars
3. **list-events** - List events from calendar(s)
4. **search-events** - Search events by query
5. **get-event** - Get event details
6. **create-event** - Create new event (with conflict detection)
7. **update-event** - Update existing event
8. **delete-event** - Delete event
9. **get-freebusy** - Check availability
10. **list-colors** - Get available event colors

## Authentication

**Default credentials location:** `~/.config/google-mcp/`
- `gcp-oauth.keys.json` - OAuth client configuration
- `tokens.json` - Access + refresh tokens (auto-updated)

**Custom credentials location (optional):**

Users can override default paths with environment variables:
- `GOOGLE_OAUTH_CREDENTIALS` - Path to OAuth credentials file
- `GOOGLE_CALENDAR_MCP_TOKEN_PATH` - Path to tokens file

Example in `~/.zshrc` or `~/.bashrc`:
```bash
export GOOGLE_OAUTH_CREDENTIALS="/path/to/my/credentials.json"
export GOOGLE_CALENDAR_MCP_TOKEN_PATH="/path/to/my/tokens.json"
```

**No plugin.json configuration needed** - paths are intentionally NOT hardcoded to allow user flexibility.

## Performance Rules

1. **Always use subagents** - Never call MCP directly
2. **Check conflicts by default** - Unless user explicitly wants to skip
3. **Batch operations** - Use parallel tool calls when possible
4. **Natural time parsing** - Convert "tomorrow at 2pm" to ISO 8601
5. **Calendar resolution** - "primary" for main calendar, full ID for others

## Error Handling

Common errors subagents should handle:
- **"Event not found"** → Suggest searching first
- **"Conflict detected"** → Show conflicts, ask to proceed
- **"Invalid time"** → Clarify date/time with user
- **"Calendar not found"** → List available calendars
- **"Auth expired"** → User needs to re-authenticate

## Example Subagent Prompt

When user says: "Schedule a team meeting next Monday at 10am for 1 hour"

Dispatch:
```
Task tool with subagent_type="general-purpose"

Prompt:
"Create a calendar event using use_google_calendar:
- Action: create-event
- Summary: Team Meeting
- Start: 2025-11-03T10:00:00 (next Monday)
- End: 2025-11-03T11:00:00
- CalendarId: primary
- Check for conflicts

Return the created event details and any conflicts found."
```

## Tips for Subagents

- **Parse dates carefully** - "tomorrow" needs current date context
- **Always specify timezone** - Default to calendar's timezone
- **Handle conflicts gracefully** - Show warnings, let user decide
- **Search before update/delete** - Don't assume event IDs
- **Use descriptive summaries** - Better than generic "Meeting"
