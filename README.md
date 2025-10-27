# Salmon Marketplace

Personal Claude Code plugin marketplace by salmonumbrella.

## Plugins

### superpowers-notion

Complete Notion API access with on-demand MCP loading - zero context pollution until you use it.

**Architecture:**
- Pattern 1 (single `use_notion` tool with 19 actions)
- Bundled MCP server (loads only when invoked)
- ~1k tokens context usage
- Follows superpowers-chrome design pattern

**Features:**
- **19 actions**: Full Notion API coverage (databases, pages, blocks, users, comments, search)
- **Context preservation**: MCP loads on-demand, not at session start
- **Dynamic database finding**: Search by name (no hardcoded IDs)
- **Pattern 1 efficiency**: One tool instead of 19 separate tools

**Installation:**

```bash
# Add this marketplace
claude marketplace add salmon-marketplace https://github.com/salmonumbrella/salmon-marketplace.git

# Install the plugin
claude plugin install superpowers-notion
```

**Setup:**

1. Create Notion integration at https://www.notion.so/my-integrations
2. Get your API token
3. Set environment variable:
   ```bash
   export NOTION_API_KEY="your-token-here"
   ```
4. Grant your integration access to databases in Notion
5. Restart Claude Code

**Usage:**

```javascript
// Create an issue
"Create an issue called 'Fix login bug'"

// Query tasks
"Show me all open tasks in my task database"

// Add content
"Add a note to the project page about the deadline"
```

The plugin dynamically finds your databases by name, so no configuration needed!

**Verify it's loaded:**

```bash
claude mcp list
# Should show: plugin:superpowers-notion:notion ✓ Connected
```

## Why This Exists

Traditional Notion MCP servers load at session start, consuming ~12k+ tokens even when not in use. This plugin:
- Loads on-demand (zero tokens until invoked)
- Uses Pattern 1 (1 tool vs 19 = ~1k tokens vs ~12k tokens)
- Preserves context for your actual work

Perfect for occasional Notion operations without the context overhead.

## Contributing

Want to add this to the official superpowers marketplace? See [CONTRIBUTING.md](CONTRIBUTING.md) for PR guidelines.

## License

MIT
