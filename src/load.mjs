import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import TOML from "@iarna/toml";
import fg from "fast-glob";
import { resolveTextReferences } from "./text-references.mjs";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const UNLOCKABLES_DIR = path.join(ROOT, "unlockables");
const PROVENANCE_DIR = path.join(ROOT, "provenance");
const ENTITIES_DIR = path.join(ROOT, "metadata", "entities");

const ENTITY_TYPE_BY_FILE = {
  "artifacts.toml": "artifact",
  "items.toml": "item",
  "monsters.toml": "monster",
  "other.toml": "other",
  "skills.toml": "skill",
  "skins.toml": "skin",
  "stages.toml": "stage",
  "survivors.toml": "survivor",
  "trials.toml": "trial",
};

export async function loadUnlockables({ root = ROOT } = {}) {
  const baseDir = path.join(root, "unlockables");
  const provenanceDir = path.join(root, "provenance");
  const files = await fg("**/*.toml", { cwd: baseDir, onlyFiles: true });
  const provenance = await loadProvenance({ root });
  const entities = await loadEntities({ root });
  const rows = [];
  for (const relativePath of files.sort()) {
    const filePath = path.join(baseDir, relativePath);
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = TOML.parse(raw);
    rows.push(hydrateUnlockable(normalizeUnlockable(parsed, relativePath, provenance.get(relativePath) || null), entities));
  }
  rows.provenanceFiles = provenance;
  rows.orphanProvenanceFiles = [...provenance.keys()].filter((relativePath) => !files.includes(relativePath)).sort();
  rows.provenanceDir = provenanceDir;
  rows.entities = entities;
  return rows;
}

export async function loadEntities({ root = ROOT } = {}) {
  const baseDir = path.join(root, "metadata", "entities");
  const entities = new Map();
  if (!fs.existsSync(baseDir)) return entities;
  const files = await fg("*.toml", { cwd: baseDir, onlyFiles: true });
  for (const relativePath of files.sort()) {
    const type = ENTITY_TYPE_BY_FILE[relativePath];
    if (!type) continue;
    const parsed = TOML.parse(fs.readFileSync(path.join(baseDir, relativePath), "utf8"));
    for (const { key, value } of entityEntries(parsed)) {
      const id = `${type}.${key}`;
      entities.set(id, {
        id,
        type,
        icon: stringOrNull(value?.icon),
        owner: stringOrNull(value?.owner),
        name: {
          en: stringOrNull(value?.name?.en),
          "zh-Hans": stringOrNull(value?.name?.["zh-Hans"]),
        },
      });
    }
  }
  return entities;
}

function entityEntries(value, prefix = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  if (value.name && typeof value.name === "object") return [{ key: prefix.join("."), value }];
  return Object.entries(value)
    .filter(([key]) => key !== "schema_version")
    .flatMap(([key, child]) => entityEntries(child, [...prefix, key]));
}

export async function loadProvenance({ root = ROOT } = {}) {
  const baseDir = path.join(root, "provenance");
  const out = new Map();
  if (!fs.existsSync(baseDir)) return out;
  const files = await fg("**/*.toml", { cwd: baseDir, onlyFiles: true });
  for (const relativePath of files.sort()) {
    const filePath = path.join(baseDir, relativePath);
    const raw = fs.readFileSync(filePath, "utf8");
    out.set(relativePath, normalizeProvenance(TOML.parse(raw), relativePath));
  }
  return out;
}

export function normalizeUnlockable(row, filePath = null, provenance = null) {
  const text = normalizeText(row);
  return {
    id: stringOrNull(row.id),
    category: stringOrNull(row.category),
    target: stringOrNull(row.target),
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
    provenance,
    filePath,
  };
}

function hydrateUnlockable(row, entities) {
  const entity = entities.get(row.target) || null;
  return {
    ...row,
    entity,
    icon: entity?.icon || null,
    sourceText: row.text,
    text: {
      en: { ...resolveLocaleText(row.text.en, entities, "en"), name: entity?.name?.en || null },
      "zh-Hans": { ...resolveLocaleText(row.text["zh-Hans"], entities, "zh-Hans"), name: entity?.name?.["zh-Hans"] || null },
    },
  };
}

function resolveLocaleText(text, entities, locale) {
  return {
    ...text,
    summary: resolveTextReferences(text.summary, entities, locale),
    location: resolveTextReferences(text.location, entities, locale),
    steps: text.steps.map((value) => resolveTextReferences(value, entities, locale)),
    notes: text.notes.map((value) => resolveTextReferences(value, entities, locale)),
  };
}

export function normalizeProvenance(row, filePath = null) {
  return {
    id: stringOrNull(row.id),
    schema_version: numberOrNull(row.schema_version),
    facts: mapStrings(row.facts),
    text: {
      en: mapStrings(row.text?.en),
      "zh-Hans": mapStrings(row.text?.["zh-Hans"]),
    },
    review: mapStrings(row.review),
    note: stringOrNull(row.note),
    filePath,
  };
}

export { ROOT, UNLOCKABLES_DIR, PROVENANCE_DIR, ENTITIES_DIR };

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

function mapStrings(value) {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, stringOrNull(child)]));
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
