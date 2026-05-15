#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${BIBLE_CODER_BIN_DIR:-"$HOME/.local/bin"}"

mkdir -p "$BIN_DIR"

pnpm --dir "$ROOT_DIR" --filter @bible-coder/cli build
pnpm --dir "$ROOT_DIR" --filter @bible-coder/mcp build

ln -sf "$ROOT_DIR/packages/cli/dist/bin.js" "$BIN_DIR/bible-coder"
ln -sf "$ROOT_DIR/packages/mcp/dist/server.js" "$BIN_DIR/bible-coder-mcp"

echo "Linked bible-coder -> $ROOT_DIR/packages/cli/dist/bin.js"
echo "Linked bible-coder-mcp -> $ROOT_DIR/packages/mcp/dist/server.js"
case ":$PATH:" in
  *":$BIN_DIR:"*) ;;
  *) echo "Add $BIN_DIR to PATH before running bible-coder from a new shell." ;;
esac
