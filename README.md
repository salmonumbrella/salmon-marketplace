# Salmon Marketplace

Personal Claude Code plugin marketplace by salmonumbrella.

## Plugins

### superpowers-notion

Complete Notion API access with on-demand MCP loading - zero context pollution until you use it.

**Architecture:**
- Pattern 1 (single `use_notion` tool with 19 actions)
- Bundled MCP server (loads only when invoked)
- ~1k tokens context usage
- Built on the official Claude MCP SDK (mirrors the superpowers-chrome layout)

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
3. Set environment variables:
   ```bash
   export NOTION_TOKEN="ntn_your_internal_integration_token"
   export NOTION_USER_ID="your-user-id"                   # optional, enables auto-assign
   # Optional: preconfigure database ids for zero-lookups
   export NOTION_DB_ISSUE_TRACKER="..."                   # repeat for the rest
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

### superpowers-google-calendar

Complete Google Calendar API access with on-demand MCP loading - zero context pollution until you use it.

**Architecture:**
- Pattern 1 (single `use_google_calendar` tool with 10 actions)
- Bundled MCP server (loads only when invoked)
- ~2-3k tokens context usage
- Built on the official Claude MCP SDK (mirrors the superpowers-chrome layout)

**Features:**
- **10 actions**: Full Google Calendar coverage (events, scheduling, availability, conflicts)
- **Context preservation**: MCP loads on-demand, not at session start
- **Conflict detection**: Automatic time conflict and duplicate detection
- **Multi-calendar support**: Query multiple calendars simultaneously
- **Pattern 1 efficiency**: One tool instead of 16 separate tools

**Installation:**

```bash
# Add this marketplace (if not already added)
claude marketplace add salmon-marketplace https://github.com/salmonumbrella/salmon-marketplace.git

# Install the plugin
claude plugin install superpowers-google-calendar
```

**Setup:**

1. **Get OAuth Credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create or select a project
   - Enable the Google Calendar API
   - Create OAuth 2.0 credentials (Desktop app)
   - Download as `gcp-oauth.keys.json`

2. **Place credentials** (choose one option):

   **Option A: Default location (recommended)**
   ```bash
   mkdir -p ~/.config/google-mcp
   mv ~/Downloads/gcp-oauth.keys.json ~/.config/google-mcp/
   ```

   **Option B: Custom location (advanced)**
   ```bash
   # Place anywhere and set environment variables
   export GOOGLE_OAUTH_CREDENTIALS="/path/to/credentials.json"
   export GOOGLE_CALENDAR_MCP_TOKEN_PATH="/path/to/tokens.json"
   ```

3. **Run OAuth flow** (first time only):
   ```bash
   cd ~/.claude/plugins/marketplaces/salmon-marketplace/mcp
   npm install
   npm run auth
   ```

4. **Configure calendar aliases** (optional but recommended):

   Create `~/.config/google-mcp/.env`:
   ```bash
   CALENDAR_PERSONAL=personal-email@gmail.com
   CALENDAR_WORK=your-work-email@company.com
   ```

   Now you can say "add to my work calendar" or "check my personal calendar"!

5. Restart your terminal and Claude Code

**Usage:**

```javascript
// Create an event
"Schedule a team meeting next Monday at 10am"

// Check availability
"Am I free tomorrow afternoon?"

// Search calendar
"What's on my calendar this week?"

// Update event
"Move my 2pm meeting to 3pm"
```

The plugin automatically handles conflicts, date parsing, and timezone conversions!

**Verify it's loaded:**

```bash
claude mcp list
# Should show: plugin:superpowers-google-calendar:google-calendar ✓ Connected
```

## Why This Exists (Google Calendar)

Traditional Google Calendar MCP servers load 16 separate tools at session start, consuming ~30-50k tokens. This plugin:
- Loads on-demand (zero tokens until invoked)
- Uses Pattern 1 (1 tool vs 16 = ~2-3k tokens vs ~30-50k tokens)
- Preserves context for your actual work
- Includes conflict detection and smart scheduling

Perfect for calendar operations without the massive context overhead.

## Why This Exists

Traditional Notion MCP servers load at session start, consuming ~12k+ tokens even when not in use. This plugin:
- Loads on-demand (zero tokens until invoked)
- Uses Pattern 1 (1 tool vs 19 = ~1k tokens vs ~12k tokens)
- Preserves context for your actual work

Perfect for occasional Notion operations without the context overhead.

## Development

The Notion MCP server now ships as a single SDK-powered entrypoint (`mcp/src/index-sdk.ts`). To hack on it locally:

```bash
cd mcp
cp .env.example .env                       # edit with your token + workspace ids
npm install
npm run build                              # emits dist/index.js
```

Then point Claude Desktop at the built file with the usual marketplace install flow. The server will fail fast if `NOTION_TOKEN` (or `NOTION_API_KEY`) is missing and prints a short summary of which optional database IDs were detected.

## Contributing

Want to add this to the official superpowers marketplace? See [CONTRIBUTING.md](CONTRIBUTING.md) for PR guidelines.

## License

MIT
