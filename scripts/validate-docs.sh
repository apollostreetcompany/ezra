#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "AGENTS.md"
  "CONTINUITY.md"
  "HANDOFF.md"
  "MISTAKES.md"
  "DEPLOYMENT.md"
  "Makefile"
  ".agents/plugins/marketplace.json"
  "plugins/bible-coder/.codex-plugin/plugin.json"
  "plugins/bible-coder/.mcp.json"
  "plugins/bible-coder/.app.json"
  "plugins/bible-coder/hooks.json"
  "plugins/bible-coder/skills/bible-reading/SKILL.md"
  "plugins/bible-coder/skills/plan-create/SKILL.md"
  "plugins/bible-coder/skills/block/SKILL.md"
  "docs/V1_PLAN.md"
  "docs/API_BIBLE_COMPLIANCE.md"
  "docs/PRAYER_GATE.md"
  "docs/MCP_INSTALL_CLAUDE.md"
  "docs/MCP_INSTALL_GEMINI.md"
  "docs/BILLING.md"
  "docs/LEADERBOARD.md"
  "docs/LIVE_SMOKE_TESTING.md"
  "docs/MCP_TOOL_REFERENCE.md"
  "docs/MCP_DOCS.md"
  "docs/RELEASE_CHECKLIST.md"
  "docs/SITE_DEPLOYMENT.md"
  "docs/SETUP_UX_AND_INFRA.md"
  "docs/PROMPT_BLOCKING_MATRIX.md"
  "docs/PRIVACY.md"
  "handoff/beads.schema.json"
  "handoff/beads.jsonl"
)

for path in "${required_files[@]}"; do
  if [[ ! -e "$path" ]]; then
    echo "Missing required file: $path" >&2
    exit 1
  fi
done

required_agent_sections=(
  "## 1. Mission (North Star)"
  "## 2. Core Architecture"
  "## 3. Tech Stack"
  "## 4. Agent and Sub-Agent Profiles"
  "## 5. Branching & Commits"
  "## 6. Continuity Ledger"
  "## 7. Workflow"
  "## 8. Orchestration"
)

for heading in "${required_agent_sections[@]}"; do
  if ! grep -Fq "$heading" AGENTS.md; then
    echo "AGENTS.md missing heading: $heading" >&2
    exit 1
  fi
done

required_continuity_sections=(
  "## Goal (incl. success criteria)"
  "## Constraints/Assumptions"
  "## Key Decisions"
  "## State"
  "### Done"
  "### Now"
  "### Next"
  "## Open Questions"
  "## Working Set"
)

for heading in "${required_continuity_sections[@]}"; do
  if ! grep -Fq "$heading" CONTINUITY.md; then
    echo "CONTINUITY.md missing heading: $heading" >&2
    exit 1
  fi
done

python3 - <<'PY'
import json
from pathlib import Path

json.loads(Path("handoff/beads.schema.json").read_text())
json.loads(Path(".agents/plugins/marketplace.json").read_text())
json.loads(Path("plugins/bible-coder/.codex-plugin/plugin.json").read_text())
json.loads(Path("plugins/bible-coder/.mcp.json").read_text())
json.loads(Path("plugins/bible-coder/.app.json").read_text())
json.loads(Path("plugins/bible-coder/hooks.json").read_text())
for index, line in enumerate(Path("handoff/beads.jsonl").read_text().splitlines(), start=1):
    if line.strip():
        json.loads(line)
PY

if grep -R "\[TODO\|TODO:" .agents/plugins plugins/bible-coder docs >/dev/null; then
  echo "Generated scaffold TODOs remain in plugin/docs." >&2
  exit 1
fi

if grep -R '"block_enable"\|"block_disable"' plugins/bible-coder docs >/dev/null; then
  echo "MCP mutation tools for Prayer Gate are forbidden in v1." >&2
  exit 1
fi

echo "Docs validation passed."
