# Code graph: make §8 "ask the graph before reading files" real

- status: done
- commit: 76a6f71

## Goal

§8 told every agent to read a knowledge card first and then read files. With three cards in the
repo, "then read files" was where every agent landed — which is the expensive step, and the one
that fills a context window with code nobody needed.

`graphify` closes that gap: an AST-extracted call/import graph of the repo that answers *which*
symbols a question touches, so the file reads that follow are the few that matter.

## What landed

- `graphify-out/` built at task time (`graphify 0.9.51` — 90 code files, 625 nodes, 938 edges),
  scope = the repo minus everything `.gitignore` already hides.
- `.gitignore` — `graphify-out/` is **generated and rebuildable**, so it is not committed. A
  committed graph is a graph that goes stale silently, which is worse than no graph.
- `CLAUDE.md` §8 rewritten as the real order: **knowledge card → graph → grep → whole files**,
  with the four queries that carry their weight (`query`, `affected`, `path`, `god-nodes`) and a
  Quick Reference row pointing at `graphify-out/GRAPH_REPORT.md`.

## Traps written into §8 on purpose

- **Refresh after every commit that touched code** — `graphify update .` re-extracts by AST, no
  API key and no LLM cost. A graph nobody refreshes is a map of a town that moved.
- **Two absences are deliberate, not breakage**: `.docs/**` is not in the graph (semantic doc
  extraction needs an LLM backend) and communities are named after their dominant symbol rather
  than in prose. Both need `ANTHROPIC_API_KEY` — `graphify extract .` and `graphify label .`.
  Written down because "the docs are missing from the graph" is exactly the kind of thing a later
  agent reports as a bug and spends a turn on.

## Not in this card

Card [007](../todo/007-knowledge-code-cards.md) uses the graph's hubs (`requireAdmin()`, `db`,
`periodRange()`, `currentStaff()`) to pick the boundaries of the `code/` knowledge cards — the
graph is the input to that card, not a substitute for it.
