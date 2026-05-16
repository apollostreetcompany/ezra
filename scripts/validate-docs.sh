#!/usr/bin/env bash
set -euo pipefail

required_files=(
  "AGENTS.md"
  "CONTINUITY.md"
  "HANDOFF.md"
  "MISTAKES.md"
  "DEPLOYMENT.md"
  "Makefile"
  "package.json"
  ".agents/plugins/marketplace.json"
  "plugins/ezra-mcp/.codex-plugin/plugin.json"
  "plugins/ezra-mcp/.mcp.json"
  "plugins/ezra-mcp/.app.json"
  "plugins/ezra-mcp/skills/setup/SKILL.md"
  "plugins/ezra-mcp/skills/lookup/SKILL.md"
  "plugins/ezra-mcp/skills/billing/SKILL.md"
  "docs/V1_PLAN.md"
  "docs/BILLING.md"
  "docs/INSTALLATION.md"
  "docs/LIVE_SMOKE_TESTING.md"
  "docs/MCP_TOOL_REFERENCE.md"
  "docs/MCP_DOCS.md"
  "docs/RELEASE_CHECKLIST.md"
  "docs/SITE_DEPLOYMENT.md"
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
json.loads(Path("plugins/ezra-mcp/.codex-plugin/plugin.json").read_text())
json.loads(Path("plugins/ezra-mcp/.mcp.json").read_text())
json.loads(Path("plugins/ezra-mcp/.app.json").read_text())
wrangler = json.loads(Path("apps/worker/wrangler.jsonc").read_text())
dbs = wrangler.get("d1_databases") or []
if not dbs:
    raise SystemExit("Wrangler must define an Ezra D1 database binding.")
db = dbs[0]
if db.get("database_name") != "ezra-mcp-prod":
    raise SystemExit("Wrangler database_name must be ezra-mcp-prod.")
database_id = db.get("database_id")
if database_id in {None, "", "REPLACE_WITH_EZRA_MCP_PROD_D1_ID", "daf7cf0b-9d54-4948-a815-fc798d28978a"}:
    raise SystemExit("Wrangler database_id must be the confirmed distinct Ezra D1 id, not a placeholder or Bible Coder id.")
if database_id != "13f487c0-02fc-44da-814c-252925bb59da":
    raise SystemExit("Wrangler database_id differs from the confirmed ezra-mcp-prod D1 id.")
assets = wrangler.get("assets") or {}
if assets.get("directory") != "../site/dist" or assets.get("binding") != "ASSETS":
    raise SystemExit("Wrangler assets binding must point at apps/site/dist through ../site/dist.")
routes = wrangler.get("routes") or []
patterns = {route.get("pattern") for route in routes}
if "ezramcp.com/*" not in patterns:
    raise SystemExit("Wrangler routes must include ezramcp.com/*.")
for index, line in enumerate(Path("handoff/beads.jsonl").read_text().splitlines(), start=1):
    if line.strip():
        json.loads(line)
PY

if grep -R "\[TODO\|TODO:" .agents/plugins plugins/ezra-mcp docs >/dev/null; then
  echo "Generated scaffold TODOs remain in plugin/docs." >&2
  exit 1
fi

if grep -R --exclude=validate-docs.sh --exclude-dir=node_modules --exclude-dir=dist "plugins/bible-coder\|@bible-coder\|BIBLE_CODER_\|bible-coder-mcp\|bible-coder setup\|Bibe Code\|bibecoder\|Prayer Gate\|API_BIBLE" apps packages plugins docs scripts Makefile package.json >/dev/null; then
  echo "Leftover active Bible Coder/Bibe surface found." >&2
  exit 1
fi

if ! grep -Fq "/v1/checkout/public-session" docs/BILLING.md apps/site/src/index.html apps/site/src/pro/index.html; then
  echo "Public checkout endpoint is not documented and wired." >&2
  exit 1
fi

if ! grep -Fq "/v1/checkout/session-status" docs/BILLING.md apps/site/src/checkout/success/index.html; then
  echo "Checkout success verification endpoint is not documented and wired." >&2
  exit 1
fi

echo "Docs validation passed."
