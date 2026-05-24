# Prayer Pass - Read-Aloud Panel Workflow

This is the staged prayer-corpus review pipeline for the Chosen Portion
`output-canonical` corpus. It adapts the Hybrid Writer orchestration pattern to
prayer: specific embodied readers react first, a single editor rewrites, and a
hard gate validates the result before promotion.

## Source And Output

- Source corpus:
  `/Users/kikimac/.hermes/repos/apollostreetcompany/chosen-portion-landing-page/.claude/worktrees/mossy-bouncing-pancake/output-canonical`
- Reviewed output tree:
  `baseline/prayer-dictionary/prayer-pass/runs/<run-id>/reviewed-output`
- Source files are never edited in place.
- Every run writes panel records, a manifest, a validation report, and a human
  summary so rejected prayers can be restarted without losing evidence.

## Pipeline Shape

1. **Manifest**: inventory all `365-prayers` and `prayer-dictionary` markdown
   files with stable artifact ids and relative output paths.
2. **Panel prompt build**: attach one read-aloud persona, one pastor persona,
   and three audience personas to each prayer. All prompts use `embody`.
3. **Issue extraction**: detect read-aloud awkwardness, direct-address drift,
   lowercase divine pronouns, fabricated specifics, forced contrasts, bad
   promise logic, coined phrases, and aphoristic endings.
4. **Single editor rewrite**: only the editor rewrites. Audience agents react;
   they do not author the final prayer.
5. **Hard gate**: read-aloud and pastor checks must pass; at least two audience
   personas must approve, with no severe alienation.
6. **Report**: write per-prayer panel JSON plus run-level markdown reports.

## Commands

Build or refresh the all-file manifest:

```bash
pnpm prayer:panel:manifest
```

Run the fixed 10-prayer pilot:

```bash
pnpm prayer:panel:pilot
```

Validate the pilot output:

```bash
pnpm prayer:panel:validate
```

Run a custom subset:

```bash
node scripts/prayer-panel-runner.mjs run \
  --run-id custom-subset \
  --paths-file /absolute/path/to/paths.txt
```

`paths.txt` contains source-relative paths such as
`365-prayers/toddlers/01-15.md`, one per line.

## Gates

The validator rejects a rewritten prayer when:

- Direct address is missing from the opening.
- Divine-address pronouns remain lowercase.
- Known awkward/coined phrases remain.
- A toddler prayer uses adult theological register.
- A story/dictionary prayer keeps a commentary-first opening.
- `Amen.` is missing.
- Fewer than two audience personas approve.
- The pastor pass marks Scripture, promise logic, or God-address as unsafe.

## Editorial Rule

Specificity is good when it is borrowable. The pass removes fabricated biography
but preserves concrete prayer handles. The target is not generic safety; the
target is language a real believer can read aloud without tripping and still
feel, "these words are for someone like me."
