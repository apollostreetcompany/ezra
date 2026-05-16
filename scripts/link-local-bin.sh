#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${EZRA_MCP_BIN_DIR:-"$HOME/.local/bin"}"

mkdir -p "$BIN_DIR"

pnpm --dir "$ROOT_DIR" --filter @ezra-mcp/cli build
pnpm --dir "$ROOT_DIR" --filter @ezra-mcp/mcp build

ln -sf "$ROOT_DIR/packages/cli/dist/bin.js" "$BIN_DIR/ezra-mcp"
ln -sf "$ROOT_DIR/packages/mcp/dist/server.js" "$BIN_DIR/ezra-mcp-mcp"

echo "Linked ezra-mcp -> $ROOT_DIR/packages/cli/dist/bin.js"
echo "Linked ezra-mcp-mcp -> $ROOT_DIR/packages/mcp/dist/server.js"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "Add $BIN_DIR to PATH before running ezra-mcp from a new shell." ;;
esac
