#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"

"$repo_root/plugins/ezra-mcp/scripts/install-cli.sh"
echo "MCP server name: ezra-mcp"
echo "MCP command: ezra-mcp-mcp"
echo "Config source: $repo_root/plugins/ezra-mcp/.mcp.json"
