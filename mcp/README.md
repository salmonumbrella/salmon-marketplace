# Notion MCP Server (SDK Edition)

This directory powers the `superpowers-notion` Claude skill. The server is built on Anthropic’s official MCP SDK and exposes the entire Notion API through a single `use_notion` tool (Pattern 1).

## Environment

Copy `.env.example` and fill in the values you need:

```bash
cp .env.example .env
```

Required:
- `NOTION_TOKEN` *(preferred)* – internal integration token, used to authenticate every call.
- or `NOTION_API_KEY` – legacy alias; either token satisfies the server.

Optional:
- `NOTION_USER_ID` – lets the skill auto-fill people fields like `DRI` / `Watch`.
- `NOTION_DB_*` variables – map intents to database IDs for instant routing.

The server prints a startup summary highlighting which variables were detected.

## Build

```bash
npm install
npm run build
```

`npm run build` bundles `src/index-sdk.ts` to `dist/index.js`, which is what the Claude plugin launches.

## Smoke Test

With your env vars loaded you can execute a quick API round-trip:

```bash
node dist/index.js <<'JSON'
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"use_notion","arguments":{"action":"get_self"}}}
JSON
```

You should see three responses, the last containing your Notion bot user details. Abort with `Ctrl+D` when done.

## Code Layout

- `src/index-sdk.ts` – MCP server implementation (loads env, registers tool, routes actions).
- `src/config.ts` – env guard + debug logging.
- `dist/index.js` – compiled output consumed by the plugin.

Legacy OpenAPI-proxy code has been removed; the SDK version is now the single source of truth.
