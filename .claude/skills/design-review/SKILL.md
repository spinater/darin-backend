---
name: design-review
description: "Standalone UX-UI audit of a screen, component, or flow — readability of the numbers, consistency with the token layer, states, Thai wrapping, print, accessibility. Usage: /design-review [route, path, or flow name]"
---

# /design-review

Audit the UI named in `$ARGUMENTS` (ask if empty — accepts a route such as `/payslips`, a file path
under `app/`, a flow name, or a design doc under `.docs/design/`).

1. **Locate the target files.** `graphify query "<name>"` first (`graphify-out/` is built — see
   CLAUDE.md §8), otherwise glob `app/**`. Design docs under `.docs/design/**` are valid targets:
   review them for screen-inventory completeness, state coverage, and device fit.
2. **Read the token layer before the screen** — `app/globals.css` holds the whole design system
   (`@theme` tokens + the `.btn` / `.input` / `.card` / `.th` / `.td` classes). Anything the screen
   styles by hand that duplicates one of those is a finding.
3. **Spawn the `uxui-designer` agent in review mode** on those files. It checks: reuse of the token
   layer, visual hierarchy, every state (empty / loading / error / long Thai name), money formatting
   and right-alignment, `warnings` rendered on the screen, Thai wrapping at phone width,
   `@media print` output where the page is printable, and accessibility basics (AA contrast, focus,
   labelled inputs, keyboard).
4. **Report the ranked findings** — severity, file, what is wrong, the concrete fix, owning fixer
   agent — then `VERDICT: BLOCK | APPROVE-WITH-NITS | APPROVE`. Offer to apply the fixes.

A fix that adds a new visual decision lands in `app/globals.css`, not in the page — say so in the
finding, so the next screen inherits it instead of re-inventing it.
