import fs from "node:fs";
import path from "node:path";
import TOML from "@iarna/toml";
import { loadUnlockables, PROVENANCE_DIR, ROOT } from "./load.mjs";

const force = process.argv.includes("--force");
const rows = await loadUnlockables();

let written = 0;
let skipped = 0;

for (const row of rows) {
  const relativePath = row.filePath;
  const outputPath = path.join(PROVENANCE_DIR, relativePath);
  if (!force && fs.existsSync(outputPath)) {
    skipped += 1;
    continue;
  }
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${TOML.stringify(provenanceForRow(row)).trim()}\n`);
  written += 1;
}

console.log(`Wrote ${written} provenance files`);
if (skipped) console.log(`Skipped ${skipped} existing provenance files; pass --force to overwrite`);

function provenanceForRow(row) {
  const condition = conditionSource(row);
  const route = routeSource(row);
  const enGuide = guideSource(row);
  const zhGuide = zhGuideSource(row, enGuide);
  return stripEmpty({
    schema_version: 1,
    id: row.id,
    facts: {
      identity: "derived:game_metadata",
      condition,
      route,
      requirements: "derived:opportunity_model",
      scoring: "derived:heuristic",
      icon: row.icon ? "wiki_cache:icons" : "none",
    },
    text: {
      en: {
        name: "game_metadata:language_pack",
        guide: enGuide,
      },
      "zh-Hans": {
        name: zhNameSource(row),
        guide: zhGuide,
      },
    },
    review: {
      facts: reviewForFacts(row),
      en_guide: reviewForGuide(enGuide),
      zh_guide: zhGuide.startsWith("machine_translation:") ? "needs_human_review" : reviewForGuide(zhGuide),
    },
  });
}

function conditionSource(row) {
  if (hasSourceType(row, "game_metadata")) return firstSourceRef(row, "game_metadata");
  if (hasSourceType(row, "wiki")) return firstSourceRef(row, "wiki");
  if (hasSourceType(row, "web")) return firstSourceRef(row, "web");
  if (hasSourceType(row, "ai_research")) return firstSourceRef(row, "ai_research");
  return "derived:unknown";
}

function routeSource(row) {
  if (!row.stage.length && !row.text.en.steps.length) return "none";
  if (hasSourceType(row, "wiki")) return firstSourceRef(row, "wiki");
  if (hasSourceType(row, "web")) return firstSourceRef(row, "web");
  if (hasSourceType(row, "ai_research")) return firstSourceRef(row, "ai_research");
  if (hasSourceType(row, "game_metadata")) return firstSourceRef(row, "game_metadata");
  return "derived:opportunity_model";
}

function guideSource(row) {
  if (row.text.en.steps.length || row.text.en.location) return routeSource(row);
  return conditionSource(row);
}

function zhNameSource(row) {
  const en = row.text.en.name || "";
  const zh = row.text["zh-Hans"].name || "";
  if (!zh) return "none";
  if (zh && zh !== en && /[\u3400-\u9fff]/.test(zh)) return "game_metadata:language_pack";
  return "machine_translation:text.en.name";
}

function zhGuideSource(row, enGuide) {
  const zh = row.text["zh-Hans"];
  if (!zh.summary && !zh.location && !zh.steps.length && !zh.notes.length) return "none";
  if (enGuide.startsWith("game_metadata:") && !row.text.en.steps.length) return "game_metadata:language_pack";
  if (enGuide === "none") return "none";
  return "machine_translation:text.en.guide";
}

function reviewForFacts(row) {
  if (hasSourceType(row, "ai_research")) return "unreviewed";
  if (hasSourceType(row, "wiki") || hasSourceType(row, "web")) return "unreviewed";
  return "accepted";
}

function reviewForGuide(marker) {
  if (marker === "none") return "not_applicable";
  if (marker.startsWith("machine_translation:")) return "needs_human_review";
  if (marker.startsWith("game_metadata:")) return "accepted";
  return "unreviewed";
}

function hasSourceType(row, type) {
  return row.source.some((source) => source.type === type);
}

function firstSourceRef(row, type) {
  const source = row.source.find((candidate) => candidate.type === type);
  if (!source) return `${type}:unknown`;
  if (source.url) return `${type}:${source.url}`;
  return source.ref || `${type}:unknown`;
}

function stripEmpty(value) {
  if (Array.isArray(value)) return value.map(stripEmpty);
  if (!value || typeof value !== "object") return value;

  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (child == null || child === "") continue;
    if (typeof child === "object") {
      const stripped = stripEmpty(child);
      if (Array.isArray(stripped) || Object.keys(stripped).length) out[key] = stripped;
      continue;
    }
    out[key] = child;
  }
  return out;
}
