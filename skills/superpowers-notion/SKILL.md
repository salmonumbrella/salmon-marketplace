---
name: superpowers-notion
description: Personal Notion automation - context-efficient, pre-configured databases, auto-assigns DRI/Watch fields
allowed-tools: mcp__notion__use_notion
---

# Superpowers: Notion (Personal Edition)

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
NOTION_DB_AREAS          # Areas of Responsibility
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

## Workflow: Create Issue (FAST)

```javascript
// ❌ OLD WAY (slow, wastes context):
// 1. Search for "Issue Tracker"
// 2. Filter results
// 3. Use database_id

// ✅ NEW WAY (instant):
use_notion({
  action: "create_page",
  database_id: process.env.NOTION_DB_ISSUE_TRACKER,  // Direct access!
  title: "Fix login bug",
  properties: {
    "DRI": { people: [{ id: userId }] }  // Auto-assign
  }
})
```

## Workflow: Auto-Detect Schema

Before creating pages in a database you haven't used recently:

```javascript
// Get schema to know which fields exist
const schema = use_notion({
  action: "get_database",
  database_id: process.env.NOTION_DB_ONE_ON_ONES
});

// Extract people field names
const peopleFields = schema.properties
  .filter(p => p.type === "people")
  .map(p => p.name);  // ["DRI", "Watch"]

// Auto-populate all people fields
const properties = {};
peopleFields.forEach(field => {
  properties[field] = { people: [{ id: userId }] };
});

// Create page with auto-assignment
use_notion({
  action: "create_page",
  database_id: process.env.NOTION_DB_ONE_ON_ONES,
  title: "1:1 with Team",
  properties
});
```

## Available Actions (19 total)

**Databases:** `query_database`, `create_database`, `update_database`, `get_database`

**Pages:** `create_page`, `get_page`, `update_page`, `get_page_property`

**Blocks:** `get_block_children`, `append_block_children`, `get_block`, `update_block`, `delete_block`

**Users:** `get_user`, `list_users`, `get_self`

**Comments:** `get_comments`, `create_comment`

**Search:** `search` (only use for finding PAGES, not databases!)

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
    property: "Status",
    status: { does_not_equal: "Done" }
  }
})
```

## Red Flags

❌ Using `search` to find databases → Use env vars
❌ Forgetting to auto-assign DRI/Watch → Always check schema
❌ Adding `limit: 5` to searches → Remove artificial limits
❌ Asking for confirmation → Just execute
❌ Generic responses → Be specific to user's workflow

## Speed Philosophy

**Old skill:** Search → Filter → Confirm → Execute (4 steps, high context)

**This skill:** Execute (1 step, minimal context)

User knows what they want. Your job is to execute instantly with zero friction.

## Context Efficiency

- **No database searches** = -1 tool call per operation (instant database resolution)
- **No user lookups** = -1 tool call per page creation (pre-configured user ID)
- **Direct env var access** = zero API overhead
- **Pattern 1 architecture** = ~1k tokens vs ~12k

**Result:** Creating an issue = **1 tool call** (vs 4-5 in old workflow). 4-5x faster, 95% less context usage.

## Troubleshooting

**"Can't find database"** → You searched. Don't search. Use env vars.

**"No DRI field"** → Check database schema with `get_database` first.

**"Permission denied"** → Verify `NOTION_API_KEY` in `~/.config/notion/.env`

**"MCP not loading"** → Restart Claude Code, source your shell config.

## This Is Personal Software

This skill is tailored for personal workflows. It's not generic. It's optimized for one person's Notion workspace.

That's the point. General-purpose tools are slow. Personal tools are fast.

When this proves valuable over time, it can be generalized for wider use.
