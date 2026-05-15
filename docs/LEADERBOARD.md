# Leaderboard

Bible Coder v1 leaderboard is opt-in and privacy-minimal.

## Server Endpoints
- `GET /v1/leaderboard`
- `GET /v1/leaderboard/profile`
- `PUT /v1/leaderboard/profile`

All endpoints require device-token auth.

## Privacy Rules
- Default participation is off.
- Users must explicitly set `optedIn: true` and a display name.
- Public entries expose only display name and completed progress count.
- Entries never expose user IDs, device IDs, references, plan IDs, Scripture text, repo names, repo hashes, branches, commits, or Prayer Gate details.

## Ranking
V1 ranks by completed progress event count, descending, then display name. This is intentionally simple until abuse prevention and richer privacy controls are designed.
