#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$repo_root"

pnpm --filter @ezra-mcp/cli build
pnpm --filter @ezra-mcp/mcp build
mkdir -p "$HOME/.local/bin"
ln -sf "$repo_root/packages/cli/dist/bin.js" "$HOME/.local/bin/ezra-mcp"
ln -sf "$repo_root/packages/mcp/dist/server.js" "$HOME/.local/bin/ezra-mcp-mcp"

echo "Installed ezra-mcp and ezra-mcp-mcp into $HOME/.local/bin"
