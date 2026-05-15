# Manifest: bibe-site-landing-refresh

## Caller Interface

### Inputs

- `page_files` <- `bindings/caller/page_files.md`
- `hero_image` <- `bindings/caller/hero_image.md`
- `brand_direction` <- `bindings/caller/brand_direction.md`
- `copy_constraint` <- `bindings/caller/copy_constraint.md`

### Returns

- `responsive_report`
- `anti_slop_report`
- `implementation_constraints`

## Graph

### landing-page-responsive

- source: `services/web-landing-page-responsive.prose.md`
- workspace: `workspace/landing-page-responsive/`
- inputs:
  - `page_files` <- `caller.page_files`
  - `hero_image` <- `caller.hero_image`
  - `brand_direction` <- `caller.brand_direction`
  - `copy_constraint` <- `caller.copy_constraint`
- outputs:
  - `responsive_report.md`

### anti-slop-cleanup

- source: `services/web-anti-slop-cleanup.prose.md`
- workspace: `workspace/anti-slop-cleanup/`
- inputs:
  - `page_files` <- `caller.page_files`
  - `responsive_report` <- `landing-page-responsive.responsive_report`
  - `brand_direction` <- `caller.brand_direction`
  - `copy_constraint` <- `caller.copy_constraint`
- outputs:
  - `anti_slop_report.md`
  - `implementation_constraints.md`

## Execution Order

1. `landing-page-responsive`
2. `anti-slop-cleanup`
3. Apply implementation edits in the host workspace.
4. Run site validation, visual checks, deploy, and DNS/custom-domain verification.

## Warnings

- Source recipes are recipe-style `.prose.md` files without canonical `kind: program` frontmatter, so this run snapshots them as service inputs and uses this manifest as the upgraded executable contract.
- The current host is executing the services inline and preserving their reports as file artifacts in this run.
