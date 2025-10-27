---
name: superpowers-notion
description: Personal Notion automation - context-efficient, pre-configured databases, auto-assigns DRI/Watch fields
allowed-tools: Task, mcp__notion__use_notion
---

# Superpowers: Notion (Personal Edition)

## MANDATORY: Always Use Subagents

**NEVER call MCP tools directly from this skill.**

ALL Notion operations MUST be executed through subagents using the Task tool.

**Pattern:**
1. Skill parses user intent
2. Skill dispatches Task with subagent_type="general-purpose"
3. Subagent executes Notion MCP calls
4. Subagent returns structured results
5. Skill formats results for user

## What This Does

Direct access to your Notion workspace with zero friction. All databases pre-configured, auto-assignment built-in.

**Architecture:** Pattern 1 (single tool, 19 actions, ~1k tokens) • On-demand loading (zero context until invoked)

## Your Databases (Pre-configured)

**DO NOT search for databases.** Use these environment variables directly:

```bash
NOTION_DB_ISSUE_TRACKER  # Issue Tracker (main bugs/tasks)
NOTION_DB_IPS            # Issue Proposed Solutions
NOTION_DB_MEETINGS       # Meetings
NOTION_DB_ONE_ON_ONES    # 1:1s
NOTION_DB_GLOSSARY       # Glossary (terms/definitions)
NOTION_DB_SOP            # Standard Operating Procedures
NOTION_DB_CONTACTS       # Contacts
NOTION_DB_AREAS_OF_RESPONSIBILITY  # Areas of Responsibility
NOTION_DB_CONTENT_CALENDAR  # Content Calendar
NOTION_DB_GUIDES         # Guides
NOTION_DB_CONTRACTS      # Contracts
NOTION_DB_NOTEBOOKS      # Notebooks
NOTION_DB_VENDOR_INVOICES   # Vendor Invoices
NOTION_DB_PAYEE          # Payee
```

**NEVER use search to find databases.** Environment variables are already loaded.

## User Intent → Database Mapping

When user says:                   Use this database:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"create an issue"                 NOTION_DB_ISSUE_TRACKER
"add a solution"                  NOTION_DB_IPS
"schedule a meeting"              NOTION_DB_MEETINGS
"create a 1:1"                    NOTION_DB_ONE_ON_ONES
"add to glossary"                 NOTION_DB_GLOSSARY
"create SOP"                      NOTION_DB_SOP
"add contact"                     NOTION_DB_CONTACTS
"schedule content"                NOTION_DB_CONTENT_CALENDAR
"create guide"                    NOTION_DB_GUIDES
"add contract"                    NOTION_DB_CONTRACTS
"create notebook"                 NOTION_DB_NOTEBOOKS
"add invoice"                     NOTION_DB_VENDOR_INVOICES
"add payee"                       NOTION_DB_PAYEE

## Auto-Assignment (Critical!)

**When creating pages, ALWAYS check for these people fields:**

- `DRI` (Directly Responsible Individual)
- `Watch` (people watching/following)
- `Assignee`
- `Owner`
- `Assigned to`

**AUTO-ASSIGN user to these fields:**

```javascript
// User ID is pre-configured in env
const userId = process.env.NOTION_USER_ID;  // No API call needed!

// Auto-populate in properties
properties: {
  "DRI": { people: [{ id: userId }] },
  "Watch": { people: [{ id: userId }] }
}
```

**Databases with DRI/Watch fields:**
- Issue Tracker → Has DRI
- IPS → (check schema)
- 1:1s → Has DRI + Watch
- (Always verify with `get_database` first)

## Performance Rules

1. **NO database searches** - Use env vars for database IDs
2. **NO user lookups** - Use `NOTION_USER_ID` env var directly
3. **Batch operations** - Use parallel tool calls when possible
4. **No artificial limits** - Remove `limit: 5` restrictions
5. **Skip confirmations** - Just do it (user trusts you)

## Common Operations

**Create issue:**
```javascript
use_notion({
  action: "create_page",
  database_id: process.env.NOTION_DB_ISSUE_TRACKER,
  title: issue_title,
  properties: { "DRI": { people: [{ id: process.env.NOTION_USER_ID }] } }
})
```

**Add to glossary:**
```javascript
use_notion({
  action: "create_page",
  database_id: process.env.NOTION_DB_GLOSSARY,
  title: term,
  properties: {
    "Summary": { rich_text: [{ text: { content: definition } }] }
  }
})
```

**Schedule meeting:**
```javascript
use_notion({
  action: "create_page",
  database_id: process.env.NOTION_DB_MEETINGS,
  title: meeting_name,
  properties: {
    "Date": { date: { start: iso_datetime } },
    "DRI": { people: [{ id: process.env.NOTION_USER_ID }] }
  }
})
```

**Query open issues:**
```javascript
use_notion({
  action: "query_database",
  database_id: process.env.NOTION_DB_ISSUE_TRACKER,
  filter: {
    and: [
      {
        or: [
          { property: "DRI", people: { contains: process.env.NOTION_USER_ID } },
          { property: "Watch", people: { contains: process.env.NOTION_USER_ID } }
        ]
      },
      { property: "Status", status: { does_not_equal: "Done" } },
      { property: "Status", status: { does_not_equal: "Canceled" } },
      { property: "Status", status: { does_not_equal: "Triage" } }
    ]
  }
})
```

