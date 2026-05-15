---
name: bibe-site-landing-refresh
kind: program
---

### Description

Refresh the Bibe Code landing page using the current OpenProse Contract Markdown and VM semantics.

### Services

- `landing-page-responsive`
- `anti-slop-cleanup`

### Requires

- `page_files`: `apps/site/src/index.html`, `apps/site/src/styles.css`, and site validation scripts.
- `hero_image`: `/Users/kikimac/Downloads/jesus-one.png`.
- `brand_direction`: bold, iconic, contemporary streetwear style with geometric radiant halo rays, subtle cross motifs, clean 2d vector contrast, sharp outlines, controlled line weight, strong negative space, and clear hierarchy.
- `copy_constraint`: landing-page copy must be phrased as benefits and what users get, with no functionality-descriptive marketing copy.

### Ensures

- `responsive_report`: viewport issues, page direction, and launch checks.
- `anti_slop_report`: keep/remove/replace decisions and final cleanup verdict.
- `implementation_constraints`: concrete edits and validations to apply to the landing page.

### Runtime

- `persist`: project

### Strategies

- Preserve the Bibe Code brand line: "Stop Vibe Coding. Start Bibe Coding."
- Treat the supplied hero image as the first-viewport visual signal.
- Prefer high-contrast red, navy, bone, and gold accents from the image over beige or generic gradients.
- Use compact benefit-led copy; commands and docs may stay on secondary pages.
