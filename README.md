# RoRR Unlockables

Human-maintained unlockable knowledge base for Risk of Rain Returns.

Source data lives in one TOML file per unlockable:

```text
unlockables/<category>/<slug>.toml
```

Named game entities are maintained separately and are the sole source for
localized names, ownership, and icons:

```text
metadata/entities/<type>s.toml
```

Each file's table path is the type-local entity ID. For example:

```toml
# metadata/entities/skills.toml
[acrid.acridC2]
icon = "icons/AcridC2.png"
owner = "survivor.acrid"

[acrid.acridC2.name]
en = "Dissolving Ambush"
zh-Hans = "溶解伏击"
```

Field provenance and review state live in a same-path TOML file:

```text
provenance/<category>/<slug>.toml
```

Generated files live in `dist/` and are not hand-edited:

```text
dist/data.json
dist/audit.json
dist/index.html
```

Run locally:

```bash
npm install
npm run provenance:init
npm run audit
npm run build
```

Initialize missing provenance files without overwriting existing review markers:

```bash
npm run provenance:init
```

Extract English/Chinese guide pairs and apply curated guide reviews:

```bash
npm run --silent en:report > en-guides.report.json
npm run en:review
npm run --silent zh:report > zh-guides.report.json
npm run zh:review
```

Preview the site:

```bash
npm run dev
```

Data rules:

- Keep source facts in TOML.
- Keep one unlockable per file.
- Reference named game content with typed IDs such as `item.gasoline`, `stage.desolateForest`, and `survivor.acrid`; do not duplicate entity names or icons in unlockable files.
- Keep entity labels, ownership, and icons in `metadata/entities/`; keep unlockable summaries, locations, steps, and notes with the unlockable.
- Use `{{entity.id}}` inside every player-facing summary, location, step, and note when mentioning a named entity. The build resolves it to the active locale and the audit rejects raw entity labels.
- Keep one provenance file per unlockable file, at the same relative path.
- Use provenance to mark field source and review state. In particular, `machine_translation:*` plus `needs_human_review` means the text is published for convenience but still needs human review.
- Add sources for every manual route claim. `source.ref` is published data, so keep it as a public URL or stable marker such as `game_metadata:item_unlock_condition` or `ai_research:manual_annotation`.
- Treat `source` as factual evidence for the unlockable, and `provenance` as field-level origin/review metadata.
- Treat `dist/` and `web/public/*.json` as generated outputs.
- Do not include raw game assets, save files, or copied language-pack data.
- `npm run import:main` is a migration tool and refuses to overwrite `unlockables/` unless called with `-- --force`; normal updates should edit `unlockables/` and `provenance/` directly.
