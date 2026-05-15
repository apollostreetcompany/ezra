# API.Bible Compliance

Bible Coder treats premium translation access as a licensing and compliance feature, not just an API feature.

## Launch Gate
Before advertising premium catalog access, obtain written answers from API.Bible for:

1. Is a `$10/month` Bible Coder subscription model permitted as commercial API.Bible use?
2. Which translations are available for this commercial use case?
3. Are per-translation fees per app, per user bracket, per end-user count, or another basis?
4. Is NIV or any requested catalog item unavailable for commercial use?
5. What is the actual overage price for this plan?
6. May cached passage text be reused across displays for up to 14 days?
7. If cached text is displayed, should Bible Coder reuse the original FUMS token, request a fresh token, or report FUMS another way?
8. Does CLI/MCP display count as native app display, web app display, or both?
9. Are model-visible MCP outputs allowed for licensed text?
10. Are embeddings, summaries, paraphrases, or AI explanations of licensed text prohibited?
11. What DRM, printing, territory, and device-count requirements apply?

## Cache Policy
Default production mode before written confirmation:

```text
BIBLE_CODER_CACHE_MODE=metadata-only
```

Post-confirmation mode:

```text
BIBLE_CODER_CACHE_MODE=content-14d
BIBLE_CODER_CACHE_TTL_DAYS=14
```

Bead 7 implementation keeps `metadata-only` as the default. `content-14d` is supported only as an explicit feature flag and clamps TTL to 14 days.

## FUMS Policy
Every server fetch for Scripture content should request FUMS version 3 when supported.

FUMS identifiers:
- `deviceId`: stable random ID per local Bible Coder device.
- `sessionId`: random ID per CLI/MCP/server session.
- `userId`: `HMAC_SHA256(FUMS_USER_HASH_SECRET, internal_user_id)`.

Never send email, Stripe customer ID, GitHub handle, repo name, or raw sync token as FUMS user ID.

Model-visible responses must not include the FUMS token or a FUMS report URL. Human-display responses may include a manual report URL so the display surface can report the view.

## Attribution Policy
Every displayed API.Bible passage must include:
- Translation abbreviation.
- Passage reference.
- Copyright/attribution returned by API.Bible metadata.
- Link or pointer to local copyright/details page when the surface supports links.
- Compact attribution footer in terminal/MCP surfaces.

## AI Boundary
Paid API.Bible text must not enter AI prompts, embeddings, vector indexes, generated summaries, paraphrases, or commentaries unless API.Bible/licensor explicitly permits it in writing.

## Implementation References
- API.Bible authentication uses an `api-key` header against v1 REST endpoints: <https://docs.api.bible/api-reference/getting-started>
- Passage fetch endpoint: `GET /v1/bibles/{bibleId}/passages/{passageId}`. API.Bible documents a 200-verse passage limit: <https://docs.api.bible/guides/passages/>
- Search endpoint: `GET /v1/bibles/{bibleId}/search`: <https://docs.api.bible/guides/search/>
- FUMS v3 requires requesting `fums-version=3`, capturing `meta.fumsToken`, and reporting display views to `https://fums.api.bible/f3`: <https://docs.api.bible/guides/fair-use/>
- API.Bible FAQ describes freemium/paid access as commercial use, says sublicensing is not permitted, requires displayed copyright, and recommends clearing cached content every 14 days or less: <https://docs.api.bible/common-questions/>
