# RoRR Unlockables

Human-maintained unlockable knowledge base for Risk of Rain Returns.

Source data lives in one TOML file per unlockable:

```text
unlockables/<category>/<slug>.toml
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
npm run audit
npm run build
```

Refresh from the parent `rorr_progress` generated opportunities:

```bash
npm run import:main
npm run build
```

Preview the site:

```bash
npm run dev
```

Data rules:

- Keep source facts in TOML.
- Keep one unlockable per file.
- Add sources for every manual route claim. `source.ref` is published data, so keep it as a public URL or stable marker such as `game_metadata:item_unlock_condition` or `ai_research:manual_annotation`.
- Treat `dist/` and `web/public/*.json` as generated outputs.
- Do not include raw game assets, save files, or copied language-pack data.
