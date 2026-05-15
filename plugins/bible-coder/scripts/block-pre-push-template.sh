#!/usr/bin/env bash
set -euo pipefail

refs_file="$(mktemp -t bible-coder-pre-push.XXXXXX)"
cleanup() {
  rm -f "$refs_file"
}
trap cleanup EXIT
cat > "$refs_file"
remote_name="${1:-unknown}"
remote_url="${2:-unknown}"
pending_ref_count="$(wc -l < "$refs_file" | tr -d ' ')"
branch="$(git symbolic-ref --quiet --short HEAD 2>/dev/null || git rev-parse --short HEAD 2>/dev/null || echo unknown)"

echo "Psalm 23:1 (WEB)" > /dev/tty
echo "Yahweh is my shepherd: I shall lack nothing." > /dev/tty
echo "Remote: $remote_name $remote_url" > /dev/tty
echo "Branch: $branch; pending refs: $pending_ref_count" > /dev/tty
echo "Prayer Gate is a personal attestation. Bible Coder cannot verify private prayer and does not pray on your behalf." > /dev/tty
echo "To continue, type exactly: I have prayed" > /dev/tty
printf "> " > /dev/tty
read -r response < /dev/tty

if [[ "$response" != "I have prayed" ]]; then
  echo "Prayer Gate attestation did not match. Push aborted." > /dev/tty
  exit 1
fi

exit 0
