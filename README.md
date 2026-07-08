# RoRR Unlockables

Human-maintained unlockable knowledge base for Risk of Rain Returns.

Source data lives in one TOML file per unlockable:

```text
unlockables/<category>/<slug>.toml
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

Extract English/Chinese guide pairs and apply curated zh-Hans guide reviews:

```bash
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
- Keep one provenance file per unlockable file, at the same relative path.
- Use provenance to mark field source and review state. In particular, `machine_translation:*` plus `needs_human_review` means the text is published for convenience but still needs human review.
- Add sources for every manual route claim. `source.ref` is published data, so keep it as a public URL or stable marker such as `game_metadata:item_unlock_condition` or `ai_research:manual_annotation`.
- Treat `source` as factual evidence for the unlockable, and `provenance` as field-level origin/review metadata.
- Treat `dist/` and `web/public/*.json` as generated outputs.
- Do not include raw game assets, save files, or copied language-pack data.
- `npm run import:main` is a migration tool and refuses to overwrite `unlockables/` unless called with `-- --force`; normal updates should edit `unlockables/` and `provenance/` directly.
