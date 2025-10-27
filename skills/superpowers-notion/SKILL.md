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

**Don't add the same user who is DRI to watch in the same page.**

**Databases with DRI/Watch fields:**
- Issue Tracker → Has DRI
- IPS → (check schema)
- 1:1s → Has DRI + Watch
- (Always verify with `get_database` first)

## Title Property Handling (CRITICAL!)

**Problem:** Notion allows renaming title properties in the UI, but the MCP `title` parameter hardcodes "title" as the property name.

**Solution:** ALWAYS use the property name directly in the `properties` object. NEVER use the top-level `title` parameter.

**Pattern for creating pages:**

1. Get database schema first to find actual title property name:
```javascript
const db = await use_notion({
  action: "get_database",
  database_id: process.env.NOTION_DB_ISSUE_TRACKER
})

// Find the property with type === "title"
const titlePropName = Object.keys(db.properties).find(
  key => db.properties[key].type === "title"
)
```

2. Use that property name in the properties object:
```javascript
await use_notion({
  action: "create_page",
  database_id: process.env.NOTION_DB_ISSUE_TRACKER,
  properties: {
    [titlePropName]: {
      title: [{ text: { content: "Your title here" } }]
    },
    "DRI": { people: [{ id: process.env.NOTION_USER_ID }] }
  }
})
```

**Known title property names:**
- Issue Tracker → `"Title"`
- (Check schema for other databases)

## Performance Rules

1. **NO database searches** - Use env vars for database IDs
2. **NO user lookups** - Use `NOTION_USER_ID` env var directly
3. **Batch operations** - Use parallel tool calls when possible
4. **No artificial limits** - Remove `limit: 5` restrictions
5. **Skip confirmations** - Just do it (user trusts you)
6. **Cache title property names** - After first schema fetch, reuse the property name

## Common Operations

**Create issue (correct pattern):**
```javascript
// Step 1: Get database schema to find title property name
const db = await use_notion({
  action: "get_database",
  database_id: process.env.NOTION_DB_ISSUE_TRACKER
})

const titleProp = Object.keys(db.properties).find(
  key => db.properties[key].type === "title"
)

// Step 2: Create page using actual property name
await use_notion({
  action: "create_page",
  database_id: process.env.NOTION_DB_ISSUE_TRACKER,
  properties: {
    [titleProp]: {
      title: [{ text: { content: issue_title } }]
    },
    "DRI": { people: [{ id: process.env.NOTION_USER_ID }] }
  }
})
```

**Quick create (if title property name is known):**
```javascript
// For Issue Tracker, we know the title property is "Title"
await use_notion({
  action: "create_page",
  database_id: process.env.NOTION_DB_ISSUE_TRACKER,
  properties: {
    "Title": {
      title: [{ text: { content: issue_title } }]
    },
    "DRI": { people: [{ id: process.env.NOTION_USER_ID }] }
  }
})
```

**Add to glossary:**
```javascript
// First get schema or use known property name
await use_notion({
  action: "create_page",
  database_id: process.env.NOTION_DB_GLOSSARY,
  properties: {
    [titlePropertyName]: {
      title: [{ text: { content: term } }]
    },
    "Summary": { rich_text: [{ text: { content: definition } }] }
  }
})
```

**Schedule meeting:**
```javascript
await use_notion({
  action: "create_page",
  database_id: process.env.NOTION_DB_MEETINGS,
  properties: {
    [titlePropertyName]: {
      title: [{ text: { content: meeting_name } }]
    },
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

