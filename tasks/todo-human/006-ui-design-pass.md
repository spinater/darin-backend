# UI design pass — turn the design skills into a real token layer

- status: todo-human
- commit:

- 🚫 Blocked on linus: the `style-tile` skill gates at Phase 1 and will not produce a direction
  without **brand adjectives (3–5), the reference apps he likes, and the anti-reference**. Those are
  his call, not a default an agent may pick — the answer decides every colour and every radius in
  `app/globals.css`.

## Goal

The skills are installed (`.claude/skills/`, listed in CLAUDE.md Quick Reference) and
`/design-review` is wired as a merge gate (§9), but **nothing has been run through them yet**. The
app's whole design system today is fifteen lines of `app/globals.css`: one font token and six
component classes (`.btn` `.btn-ghost` `.input` `.card` `.th` `.td`), all on the Tailwind `neutral`
scale. That is coherent but it is not a decision — it is the default.

This card runs the pipeline end to end and lands the result in code:

1. `style-tile` → `.docs/design/brand/style-tile.md` — needs the brief above.
2. `color-palette-generator` → `.docs/design/brand/color-palette.md` — palette with WCAG AA ratings
   for every foreground/background pair the app actually uses.
3. Both of the above become `@theme` tokens in `app/globals.css`, and the component classes are
   rewritten to read them. **A colour that stays in the doc has not shipped.**
4. `no-code-app-plan` → `.docs/design/screens/screen-inventory.md` — the eleven routes under
   `app/`, each with its empty / loading / error / long-Thai-name state.
5. `/design-review` on every screen the tokens touched.

## Notes

- Constraints the direction has to survive, all of them already true in the repo: UI text is Thai
  with no i18n layer · Noto Sans Thai leads the font stack, so line-height must clear diacritics ·
  money is right-aligned at two decimals through each page's `baht()` helper · payroll `warnings`
  must be visible on screen, not swallowed · payslips print.
- Audience split: an owner/admin doing the monthly run on a desktop, and staff checking one payslip
  on a phone. Two very different densities out of one token set.
- Do not introduce a component library. The design system is `app/globals.css` and the skills all
  end by editing that file — a second source of styling is the failure this card exists to prevent.
- `icon-set-brief`, `saas-onboarding-flow`, `microcopy-writer` and `content-style-guide` are
  installed for the stages after this one; they are not part of this card's definition of done.
