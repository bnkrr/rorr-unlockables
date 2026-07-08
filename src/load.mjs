import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import TOML from "@iarna/toml";
import fg from "fast-glob";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const UNLOCKABLES_DIR = path.join(ROOT, "unlockables");

export async function loadUnlockables({ root = ROOT } = {}) {
  const baseDir = path.join(root, "unlockables");
  const files = await fg("**/*.toml", { cwd: baseDir, onlyFiles: true });
  const rows = [];
  for (const relativePath of files.sort()) {
    const filePath = path.join(baseDir, relativePath);
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = TOML.parse(raw);
    rows.push(normalizeUnlockable(parsed, relativePath));
  }
  return rows;
}

export function normalizeUnlockable(row, filePath = null) {
  const text = normalizeText(row);
  return {
    id: stringOrNull(row.id),
    category: stringOrNull(row.category),
    target: stringOrNull(row.target),
    icon: stringOrNull(row.icon),
    achievement_id: stringOrNull(row.achievement_id),
    action: stringOrNull(row.action),
    priority: numberOrNull(row.priority),
    opportunity_boost: numberOrNull(row.opportunity_boost),
    effort: numberOrNull(row.effort),
    risk: numberOrNull(row.risk),
    precision: stringOrNull(row.precision),
    confidence: stringOrNull(row.confidence),
    needs_detail: Boolean(row.needs_detail),
    stage: arrayOfObjects(row.stage).map((stage) => ({
      id: stringOrNull(stage.id),
      variants: Array.isArray(stage.variants) ? stage.variants : [],
      role: stringOrNull(stage.role) || "current",
    })),
    hard: {
      survivors: arrayOfStrings(row.hard?.survivors),
      difficulties: arrayOfStrings(row.hard?.difficulties),
      artifacts: arrayOfStrings(row.hard?.artifacts),
      rulesets: arrayOfStrings(row.hard?.rulesets),
    },
    soft: {
      survivors: arrayOfStrings(row.soft?.survivors),
      items: arrayOfStrings(row.soft?.items),
    },
    text,
    source: arrayOfObjects(row.source).map((source) => ({
      type: stringOrNull(source.type),
      ref: stringOrNull(source.ref),
      note: stringOrNull(source.note),
      label: stringOrNull(source.label),
      url: stringOrNull(source.url),
    })),
    filePath,
  };
}

export { ROOT, UNLOCKABLES_DIR };

function stringOrNull(value) {
  if (value == null) return null;
  return String(value);
}

function numberOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function arrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item));
}

function arrayOfObjects(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeText(row) {
  const rawText = row.text || {};
  return {
    en: normalizeLocaleText(rawText.en || {
      name: row.name,
      summary: row.summary,
      location: row.location,
      steps: row.steps,
      notes: row.soft?.notes,
    }),
    "zh-Hans": normalizeLocaleText(rawText["zh-Hans"] || {
      name: row.name_cn,
      summary: null,
      location: null,
      steps: [],
      notes: [],
    }),
  };
}

function normalizeLocaleText(value) {
  return {
    name: stringOrNull(value?.name),
    summary: stringOrNull(value?.summary),
    location: stringOrNull(value?.location),
    steps: arrayOfStrings(value?.steps),
    notes: arrayOfStrings(value?.notes),
  };
}
