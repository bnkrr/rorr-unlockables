import fs from "node:fs";
import path from "node:path";
import TOML from "@iarna/toml";
import { ROOT } from "./load.mjs";
import { createZhHansTranslator } from "./zh-hans.mjs";

const sourcePath = path.resolve(ROOT, "../../data/out/unlockable-opportunities.json");
const unlockablesDir = path.join(ROOT, "unlockables");
const parentRoot = path.resolve(ROOT, "../..");
const wikiBase = "https://riskofrainreturns.wiki.gg/wiki/";

if (!fs.existsSync(sourcePath)) {
  console.error(`Missing source data: ${path.relative(ROOT, sourcePath)}`);
  console.error("Run the parent project's unlockable audit first.");
  process.exit(1);
}

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const rows = Array.isArray(source.unlockables) ? source.unlockables : [];
const wikiIndex = loadWikiIndex();
const metadataIndex = loadMetadataIndex();
const zhHans = createZhHansTranslator(rows);
const survivorIds = [
  "commando",
  "huntress",
  "enforcer",
  "bandit",
  "hand",
  "engineer",
  "sniper",
  "acrid",
  "mercenary",
  "loader",
  "chef",
  "pilot",
  "arti",
  "drifter",
  "miner",
  "robomando",
];

if (!process.argv.includes("--force")) {
  console.error("Refusing to overwrite unlockables/ without --force.");
  console.error("This importer is a migration tool; edit unlockables/ and provenance/ directly for normal updates.");
  process.exit(1);
}

if (rows.length === 0) {
  console.error(`Source data has no unlockables: ${path.relative(ROOT, sourcePath)}`);
  process.exit(1);
}

fs.rmSync(unlockablesDir, { recursive: true, force: true });
fs.mkdirSync(unlockablesDir, { recursive: true });

const usedPaths = new Set();

for (const row of rows) {
  const converted = convertRow(row);
  const relativePath = makePath(converted);
  if (usedPaths.has(relativePath)) {
    throw new Error(`Duplicate output path ${relativePath}`);
  }
  usedPaths.add(relativePath);

  const outputPath = path.join(unlockablesDir, relativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${TOML.stringify(converted).trim()}\n`);
}

console.log(`Imported ${rows.length} unlockables from ${path.relative(ROOT, sourcePath)}`);

function convertRow(row) {
  const identity = normalizeIdentity(row);
  const achievementId = achievementIdForRow(row);
  const displayName = row.display?.name ?? row.id;
  const englishName = row.display?.nameEn ?? null;
  const name = englishName || displayName;
  const nameCn = englishName && displayName !== englishName ? displayName : null;

  return stripEmpty({
    id: identity.id,
    category: identity.category,
    target: identity.target,
    icon: iconForRow(row),
    achievement_id: achievementId,
    action: row.action?.type,
    priority: row.scoring?.basePriority,
    opportunity_boost: row.scoring?.opportunityBoost,
    effort: row.scoring?.effort,
    risk: row.scoring?.risk,
    precision: row.quality?.precision,
    confidence: row.quality?.confidence,
    needs_detail: Boolean(row.quality?.needsDetail),
    stage: row.requirements?.hard?.stages || [],
    hard: {
      survivors: row.requirements?.hard?.survivors || [],
      difficulties: row.requirements?.hard?.difficulties || [],
      artifacts: row.requirements?.hard?.artifacts || [],
      rulesets: row.requirements?.hard?.rulesets || [],
    },
    soft: {
      survivors: row.requirements?.soft?.survivors || [],
      items: row.requirements?.soft?.items || [],
    },
    text: localizedText({ row, name, nameCn, action: row.action, notes: row.requirements?.soft?.notes || [] }),
    source: (row.sources || []).map((source) => enrichSource(source, row)),
  });
}

function normalizeIdentity(row) {
  if (row.category !== "challenge") {
    const target = normalizeTarget(row.category, row.targetId);
    return {
      id: `${row.category}:${target}`,
      category: row.category,
      target,
    };
  }

  const challenge = metadataIndex.challenges.get(row.targetId);
  const target = challenge?.unlocks?.targetId || row.targetId.replace(/^unlock_/, "");
  return {
    id: `other:${target}`,
    category: "other",
    target,
  };
}

function normalizeTarget(category, targetId) {
  const owner = targetOwner(category, targetId);
  return owner ? `${owner}:${targetId}` : targetId;
}

function targetOwner(category, targetId) {
  if (category === "skill") return survivorFromPrefix(targetId);
  if (category === "skin") return survivorFromPrefix(String(targetId || "").replace(/_skin_.*$/, ""));
  if (category === "trial") return survivorFromPrefix(String(targetId || "").replace(/\d+$/, ""));
  return null;
}

function achievementIdForRow(row) {
  return challengeForRow(row)?.id || (row.category === "challenge" ? row.targetId : null);
}

function iconForRow(row) {
  const override = iconOverrideForRow(row);
  if (override) return `icons/${override}`;
  const challenge = challengeForRow(row);
  const icon = challenge?.icon || metadataIconForRow(row);
  return icon ? `icons/${path.basename(icon)}` : null;
}

function iconOverrideForRow(row) {
  if (row.category === "trial" && row.targetId === "final") return "Trial_Judgement.png";
  if (row.category === "trial" && row.targetId === "huntress2") return "Tiny_Imp_Icon.gif";
  return null;
}

function metadataIconForRow(row) {
  if (row.category === "challenge") return metadataIndex.challenges.get(row.targetId)?.icon || null;
  const map = metadataIndex.iconsByCategory[row.category];
  return map?.get(row.targetId)?.icon || null;
}

function survivorFromPrefix(value) {
  const raw = String(value || "");
  const lower = raw.toLowerCase();
  const match = survivorIds
    .filter((id) => lower.startsWith(id.toLowerCase()))
    .sort((a, b) => b.length - a.length)[0];
  return normalizeSurvivorId(match || raw);
}

function normalizeSurvivorId(value) {
  if (!value) return null;
  if (value === "artificer") return "arti";
  return survivorIds.includes(value) ? value : null;
}

function localizedText({ row, name, nameCn, action, notes }) {
  const englishOverride = englishTextOverride(row);
  const summary = englishOverride.summary ?? action?.summary ?? "";
  const location = englishOverride.location ?? action?.location ?? "";
  const steps = action?.steps || [];
  const zhSummary = officialZhSummary(row) || zhHans.text(summary);
  const zhLocation = cleanLabel(officialZhLocation(row, location) || zhHans.text(location));
  return {
    en: stripEmpty({
      name,
      summary,
      location,
      steps,
      notes,
    }),
    "zh-Hans": stripEmpty({
      name: nameCn || zhHans.text(name),
      summary: zhSummary,
      location: zhLocation,
      steps: zhHans.list(steps),
      notes: zhHans.list(notes),
    }),
  };
}

function cleanLabel(value) {
  return value ? String(value).replace(/[。！？]$/, "") : value;
}

function englishTextOverride(row) {
  if (row.category !== "stage") return {};
  const stage = metadataIndex.stages.get(row.targetId);
  const location = stage?.guide?.route || row.action?.location || "";
  const stageNumber = location.match(/Stage (\d+)/)?.[1];
  if (row.targetId === "riskOfRain") {
    return {
      summary: "Final stage. Use the Divine Teleporter after Stage 5; after looping, the Divine Teleporter can also route here.",
      location: "Final stage",
    };
  }
  if (stageNumber) {
    if (/pool/i.test(location)) {
      return {
        summary: `Normal Stage ${stageNumber} pool. It can appear randomly after clearing the previous stage teleporter; visiting it records the stage.`,
        location,
      };
    }
    return {
      summary: `Fixed Stage ${stageNumber}. Enter it after clearing the previous stage teleporter.`,
      location,
    };
  }
  return {};
}

function officialZhSummary(row) {
  if (row.category === "trial") return metadataIndex.trials.get(row.targetId)?.desc || null;
  if (row.category === "stage") return metadataIndex.stages.get(row.targetId)?.guide?.guide || null;
  if (row.action?.steps?.length) return null;
  const challenge = challengeForRow(row);
  return challenge?.description || null;
}

function officialZhLocation(row, fallback) {
  if (row.category === "stage") return metadataIndex.stages.get(row.targetId)?.guide?.route || null;
  const challenge = challengeForRow(row);
  if (challenge?.challengeNameCn && fallback === challenge.challengeName) return challenge.challengeNameCn;
  return null;
}

function challengeForRow(row) {
  if (row.category === "challenge") return metadataIndex.challenges.get(row.targetId) || null;
  const map = metadataIndex.byCategory[row.category];
  return map?.get(row.targetId)?.challenge || null;
}

function enrichSource(source, row) {
  const published = publishSource(source, row);
  const out = stripEmpty({
    type: published.type,
    ref: published.ref,
    note: source.note || published.note,
    label: published.label,
    url: published.url,
  });
  return out;
}

function publishSource(source, row) {
  const ref = source.ref || "";
  if (/^https?:\/\//.test(ref)) {
    return {
      type: "web",
      ref,
      label: hostnameLabel(ref),
      url: ref,
    };
  }

  if (source.type === "annotation") {
    return {
      type: "ai_research",
      ref: "ai_research:manual_annotation",
      label: "AI-assisted manual research",
    };
  }

  const url = sourceUrl(source, row);
  const label = sourceLabel(source, row);
  if (url) {
    return {
      type: "wiki",
      ref: url,
      label,
      url,
    };
  }

  if (source.type === "metadata" || ref.startsWith("metadata.")) {
    return {
      type: "game_metadata",
      ref: gameMetadataRef(row),
      label: gameMetadataLabel(row),
    };
  }

  if (source.type === "game_lang" || ref.startsWith("data/readonly/")) {
    return {
      type: "game_metadata",
      ref: "game_metadata:language_pack",
      label: "Game metadata: language pack",
    };
  }

  if (ref.startsWith("data/wiki/")) {
    return {
      type: "wiki",
      ref: "wiki:cached_extract",
      label: "Risk of Rain Returns Wiki",
    };
  }

  return {
    type: "ai_research",
    ref: "ai_research:unclassified_source",
    label: "AI-assisted manual research",
  };
}

function sourceLabel(source, row) {
  const ref = source.ref || "";
  if (source.type === "metadata" || source.type === "game_lang" || ref.startsWith("metadata.") || ref.startsWith("data/readonly/")) {
    return gameMetadataLabel(row);
  }
  if (source.type === "web" && /^https?:\/\//.test(ref)) return hostnameLabel(ref);
  const parsed = parseWikiParsedRef(ref);
  if (parsed) return `Risk of Rain Returns Wiki: ${[parsed.left, parsed.right].filter(Boolean).join(" / ")}`;
  const raw = parseWikiRawRef(ref);
  if (raw) return `Risk of Rain Returns Wiki: ${raw.title}`;
  if (ref.startsWith("data/wiki/")) return "Risk of Rain Returns Wiki";
  if (source.type === "annotation") return "Manual annotation";
  return source.type || "Source";
}

function sourceUrl(source, row) {
  const ref = source.ref || "";
  if (/^https?:\/\//.test(ref)) return ref;

  const parsed = parseWikiParsedRef(ref);
  if (parsed) {
    if (parsed.file === "stage_artifacts.json") {
      const entry = wikiIndex.artifacts.get(`${parsed.left}\0${parsed.right}`);
      if (entry) return wikiUrl(entry.stageFile, entry.headingId);
    }
    if (parsed.file === "stage_prisms.json") {
      const entry = wikiIndex.prisms.get(`${parsed.left}\0${parsed.right}`);
      if (entry) return wikiUrl(entry.stageFile, entry.headingId);
    }
    if (parsed.file === "stage_monsters.json") {
      if (row.category === "monster_log") return wikiUrl("Monsters.html", slugWiki(row.name));
      return wikiUrl("Monsters.html");
    }
  }

  const raw = parseWikiRawRef(ref);
  if (raw) return wikiUrl(raw.page, raw.anchor);

  if (source.type === "annotation" && row.category === "skin") return wikiUrl(row.name?.replace(/^Strange Prism: /, "Strange Prism "));
  return null;
}

function parseWikiParsedRef(ref) {
  const match = ref.match(/^data\/wiki\/parsed\/([^:]+)(?::([^/]+)\/(.+))?$/);
  if (!match) return null;
  return {
    file: match[1],
    left: match[2] || null,
    right: match[3] || null,
  };
}

function parseWikiRawRef(ref) {
  const match = ref.match(/^data\/wiki\/raw\/(.+?)(?:\.html)?(?:(#|:)(.+))?$/);
  if (!match) return null;
  const pageTitle = match[1].replace(/\.html$/, "");
  return {
    page: `${pageTitle}.html`,
    title: pageTitle.replace(/_/g, " "),
    anchor: match[2] === "#" ? match[3] : null,
  };
}

function loadWikiIndex() {
  return {
    artifacts: indexWikiRows("stage_artifacts.json", "artifact"),
    prisms: indexWikiRows("stage_prisms.json", "prism"),
  };
}

function loadMetadataIndex() {
  const metadataPath = path.join(parentRoot, "data", "out", "metadata.json");
  const metadata = fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, "utf8")) : {};
  const challenges = new Map((metadata.challenges || []).map((challenge) => [challenge.id, challenge]));
  const byCategory = {
    item: indexRowsWithChallenge(metadata.items, challenges),
    skill: indexRowsWithChallenge(metadata.skills, challenges),
    skin: indexSkinChallenges(challenges),
    survivor: indexRowsWithChallenge(metadata.survivors, challenges),
    artifact: indexRowsWithChallenge(metadata.artifacts, challenges),
  };
  const iconsByCategory = {
    artifact: indexRowsById(metadata.artifacts),
    item: indexRowsById(metadata.items),
    monster_log: indexRowsById(metadata.monsters),
    secret_stage: indexRowsById(metadata.stages),
    skill: indexRowsById(metadata.skills),
    stage: indexRowsById(metadata.stages),
    survivor: indexRowsById(metadata.survivors),
    trial: indexRowsById(metadata.trials),
  };

  return {
    challenges,
    trials: new Map((metadata.trials || []).map((trial) => [trial.id, trial])),
    stages: new Map((metadata.stages || []).map((stage) => [stage.id, stage])),
    byCategory,
    iconsByCategory,
  };
}

function indexRowsById(rows = []) {
  return new Map(rows.map((row) => [row.id, row]));
}

function indexRowsWithChallenge(rows = [], challenges) {
  const map = new Map();
  for (const row of rows) {
    const challengeId = row.unlock?.challengeId;
    map.set(row.id, { row, challenge: challengeId ? challenges.get(challengeId) || null : null });
  }
  return map;
}

function indexSkinChallenges(challenges) {
  const map = new Map();
  for (const challenge of challenges.values()) {
    const targetId = challenge.unlocks?.targetId;
    if (targetId && /_skin_/.test(targetId)) map.set(targetId, { row: null, challenge });
  }
  return map;
}

function indexWikiRows(file, key) {
  const map = new Map();
  const filePath = path.join(parentRoot, "data", "wiki", "parsed", file);
  if (!fs.existsSync(filePath)) return map;
  const rows = JSON.parse(fs.readFileSync(filePath, "utf8"));
  for (const row of rows) {
    map.set(`${row.stage}\0${row[key]}`, row);
  }
  return map;
}

function wikiUrl(pageOrTitle, anchor = null) {
  const page = String(pageOrTitle || "").replace(/\.html$/, "");
  const url = `${wikiBase}${encodeWikiPage(page)}`;
  return anchor ? `${url}#${encodeWikiAnchor(anchor)}` : url;
}

function encodeWikiPage(value) {
  return String(value).trim().replace(/\s+/g, "_").split("/").map(encodeURIComponent).join("/");
}

function encodeWikiAnchor(value) {
  return String(value).trim().replace(/\s+/g, "_").split("_").map(encodeURIComponent).join("_");
}

function slugWiki(value) {
  return String(value || "").trim().replace(/\s+/g, "_");
}

function hostnameLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Web";
  }
}

function gameMetadataLabel(row) {
  return {
    artifact: "Game metadata: artifact definition",
    challenge: "Game metadata: challenge definition",
    item: "Game metadata: item unlock condition",
    skill: "Game metadata: skill unlock condition",
    skin: "Game metadata: skin unlock condition",
    stage: "Game metadata: stage definition",
    survivor: "Game metadata: survivor definition",
    trial: "Game metadata: Providence Trial definition",
  }[row.category] || "Game metadata";
}

function gameMetadataRef(row) {
  return {
    artifact: "game_metadata:artifact_definition",
    challenge: "game_metadata:challenge_definition",
    item: "game_metadata:item_unlock_condition",
    skill: "game_metadata:skill_unlock_condition",
    skin: "game_metadata:skin_unlock_condition",
    stage: "game_metadata:stage_definition",
    survivor: "game_metadata:survivor_definition",
    trial: "game_metadata:providence_trial_definition",
  }[row.category] || "game_metadata:definition";
}

function makePath(row) {
  const dir = categoryDir(row.category);
  const target = row.target || row.id?.split(":").slice(1).join(":") || row.id;
  return path.join(dir, `${slug(target)}.toml`);
}

function categoryDir(category) {
  return {
    artifact: "artifacts",
    item: "items",
    monster_log: "monster-logs",
    other: "other",
    secret_stage: "secret-stages",
    skill: "skills",
    skin: "skins",
    stage: "stages",
    survivor: "survivors",
    trial: "trials",
  }[category] || "other";
}

function slug(value) {
  return String(value || "unknown")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function stripEmpty(value) {
  if (Array.isArray(value)) return value.map(stripEmpty);
  if (!value || typeof value !== "object") return value;

  const out = {};
  for (const [key, child] of Object.entries(value)) {
    if (child == null || child === "") continue;
    if (Array.isArray(child)) {
      out[key] = child.map(stripEmpty);
      continue;
    }
    if (typeof child === "object") {
      out[key] = stripEmpty(child);
      continue;
    }
    out[key] = child;
  }
  return out;
}
