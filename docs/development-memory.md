# Babel Tour development preferences

Project: `C:/Users/35988/diorama/babel-tour`

The user wants faster development with short visual feedback cycles. These
preferences apply to future work in this project:

- Make one coherent visual revision and show it promptly after the required
  quick checks and a focused rendered inspection. Avoid repeated speculative
  polishing and optional diagnostic work before asking for design feedback.
- Prefer a small tree preview, where available, with garden materials and
  lighting, explicit specimen seeds, and saved camera views. Verify the selected
  result in the garden once it is ready.
- Reuse preview browser sessions and batch saved viewpoints. Extend the shared
  tools instead of creating ad hoc copies for each visual request.
- Keep `npm run check` after app edits. Do not run browser smoke tests for a
  purely visual change. Run smoke once after a settled change to navigation,
  input, interaction, walking/collision behaviour, or scene lifecycle behaviour;
  repeat only for a later relevant change or failure.
- Gradually isolate procedural growth with independent seeds per specimen,
  separate from placement and colour. Preserve the current garden's exact
  shapes and planting when migrating its seeds. Do not reshuffle it as part of
  development-tool improvements.
- Keep unrelated working-tree changes intact and make one small commit per
  coherent change.
- An instructions-only request changes instructions and memory only. Building
  preview tools or migrating existing seeds requires a separate explicit task;
  do not expand visual fixes into those projects.

These preferences were explicitly requested on 2026-10-14 after the mist and
red-maple fixes took too many preview and verification cycles. `AGENTS.md` is
the operative project instruction; keep this memory and the verify skill
consistent with it.
