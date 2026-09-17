# Design docs — Darin Payroll

Output of the design skills in `.claude/skills/` (listed in CLAUDE.md, Quick Reference). These are
**design intent**, not a record of the code — the code's map is `.docs/knowledge/` cards and
`graphify-out/` (§8).

| Folder | Owns | Produced by |
|---|---|---|
| `brand/` | Visual direction and the palette that becomes `@theme` tokens in `app/globals.css` | `style-tile` · `color-palette-generator` · `icon-set-brief` |
| `screens/` | Screen inventory, per-screen flow, screen→entity map, navigation IA | `no-code-app-plan` |
| `reports/` | Payroll report and dashboard wireframes, chart choices, print layout | `data-dashboard-design` |
| `workflow/` | The real processes behind the screens (sync → review → run → payslip) | `workflow-mapper` |
| `sop/` | Staff-facing procedure documents | `sop-builder` |

Two rules that keep this folder honest:

1. **A doc here is a valid `/design-review` target.** Review it for state coverage and device fit
   before the screen is built, not after.
2. **A visual decision is only real once it lands in `app/globals.css`.** A colour that lives only
   in `brand/` has not shipped — say which token it becomes.
