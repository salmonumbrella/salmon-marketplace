---
name: superpowers-notion
description: Interact with Notion databases and pages via on-demand MCP - creates issues, queries data, manages content with zero context until invoked
---

# Superpowers: Notion

## What This Does

Provides Notion API access through an on-demand MCP plugin. The MCP loads ONLY when you use it, preserving context for the main conversation.

**Architecture:** Plugin with bundled MCP server (Pattern 1: single tool, 19 actions, ~1k tokens)

## When to Use

- User asks to create/update Notion content
- User wants to query Notion databases
- User needs to manage pages, blocks, comments
- ANY Notion operation

## Quick Start

When user asks to interact with Notion:

1. **Find the right database** (don't hardcode IDs!)
2. **Use the `use_notion` tool** with appropriate action
3. **Return results** to user

## Finding Databases Dynamically

❌ **DON'T:** Hardcode database IDs
✅ **DO:** Search for databases by name

```javascript
// Step 1: Search for issue tracker
use_notion({
  action: "search",
  query: "Issues",  // or "Issue Tracker", "Tasks", etc.
  limit: 5
})

// Step 2: Use the database_id from results
use_notion({
  action: "create_page",
  database_id: "<id-from-search>",
  title: "Bug: Login broken",
  properties: { ... }
})
```

**Common database names to search for:**
- Issues/Issue Tracker → bug tracking
- Tasks/To-Do → task management
- Projects → project tracking
- Notes/Docs → documentation

## Available Actions (19 total)

**Databases:**
- `query_database` - Search/filter pages
- `create_database` - Make new database
- `update_database` - Modify database schema
- `get_database` - Get database structure

**Pages:**
- `create_page` - Add new page
- `get_page` - Retrieve page details
- `update_page` - Modify page properties
- `get_page_property` - Get specific property

**Blocks (content):**
- `get_block_children` - List child blocks
- `append_block_children` - Add content
- `get_block` - Get block details
- `update_block` - Modify block
- `delete_block` - Remove block

**Users:**
- `get_user` - Get user by ID
- `list_users` - List all users
- `get_self` - Get bot user info

**Comments:**
- `get_comments` - Get comments on block
- `create_comment` - Add comment

**Search:**
- `search` - Workspace-wide search

## Example: Create Issue

```javascript
// User: "Create an issue called 'Fix login bug'"

// 1. Find issue database
const results = use_notion({
  action: "search",
  query: "Issues"
})

// 2. Create issue
use_notion({
  action: "create_page",
  database_id: results.results[0].id,
  title: "Fix login bug"
})
```

## Example: Query Tasks

```javascript
// User: "Show me all open tasks"

// 1. Find tasks database
const db = use_notion({
  action: "search",
  query: "Tasks",
  limit: 1
})

// 2. Query for open tasks
use_notion({
  action: "query_database",
  database_id: db.results[0].id,
  limit: 20
})
```

## Context Preservation

**Why this matters:**
- Traditional MCP servers load at session start (always consuming context)
- This plugin's MCP loads ON-DEMAND (zero context until you invoke the skill)
- Pattern 1 architecture: 1 tool instead of 19 = ~1k tokens vs ~12k tokens

**Result:** Main conversation stays clean. Notion operations don't bloat your context budget.

## Installation

Plugin is already installed! If not:
```bash
claude marketplace add salmon-marketplace <url>
claude plugin install superpowers-notion
```

Set environment variable:
```bash
export NOTION_API_KEY="your-key"
```

## Common Patterns

**Create content with properties:**
```javascript
use_notion({
  action: "create_page",
  database_id: "<db-id>",
  title: "Page title",
  properties: {
    "Status": { status: { name: "In Progress" } },
    "Priority": { select: { name: "High" } }
  }
})
```

**Add content to page:**
```javascript
use_notion({
  action: "append_block_children",
  page_id: "<page-id>",
  content: "This is paragraph text"
})
```

**Search and filter:**
```javascript
use_notion({
  action: "query_database",
  database_id: "<db-id>",
  filter: {
    property: "Status",
    status: { equals: "Open" }
  }
})
```

## Red Flags

❌ Hardcoding database IDs → Use search
❌ Assuming database names → Search first, confirm
❌ Creating pages without checking database schema → Get database first
❌ Forgetting to set NOTION_API_KEY → Check env var

## Troubleshooting

**MCP not loading?**
- Check: `claude mcp list` shows `plugin:superpowers-notion:notion`
- Verify: `NOTION_API_KEY` is set
- Restart Claude Code after plugin install

**Can't find database?**
- Search is case-insensitive but partial match
- Try variations: "Issues" vs "Issue Tracker" vs "Tasks"
- List all: `search` with empty query returns everything

**Properties not working?**
- Get database schema first: `get_database`
- Match property types exactly (status, select, multi_select, etc.)
- Property names are case-sensitive

## Why This Plugin Exists

**Problem:** Notion MCP servers are amazing but load at session start, consuming context budget even when not in use.

**Solution:** Bundle MCP in a plugin that loads on-demand. Pattern 1 architecture keeps token count minimal.

**Result:** You get full Notion API power (19 actions) in ~1k tokens, only when you need it.

This is the future of MCP integration: on-demand, context-preserving, powerful.
