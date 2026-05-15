#!/usr/bin/env bash
set -euo pipefail

echo "Build the MCP server from the repo root, then configure your client with:"
echo "  make link-local"
echo "  command: bible-coder-mcp"
echo "  env: BIBLE_CODER_API_URL, BIBLE_CODER_TOKEN"
echo ""
echo "Run setup first so MCP clients can read the same local goal:"
echo "  bible-coder setup"
