# GitHub MCP server (FluxyChat official example)

Minimal MCP server you can run locally and connect to FluxyChat agents in ~5 minutes.

## Prerequisites

- Node.js 20+
- GitHub personal access token (read-only scopes: `repo`, `read:org`)

## Quick start

```bash
cd examples/mcp/github
npm install
export GITHUB_TOKEN=ghp_...
npm start
```

The server speaks MCP over stdio. Point your agent or `createMcpClient` at this process.

## Tools exposed

| Tool | Description |
|------|-------------|
| `search_repositories` | Search public repos by query |
| `get_issue` | Fetch issue title + body by repo + number |
| `create_issue` | Open an issue (requires write token) |

## Wire into FluxyChat

1. Console → **Agents** → enable MCP tools for your agent profile.
2. Add server config (stdio transport) or install from marketplace catalog id `github-mcp`.
3. Invoke agent in a room — tools appear as `tool_call` events on the room timeline.

## Security

- Never commit `GITHUB_TOKEN`.
- Run [mcp-audit](https://github.com/search?q=mcp-audit) in CI before publishing a fork to your marketplace.

See also: `examples/mcp/slack`, `examples/mcp/notion`.
