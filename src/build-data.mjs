import fs from "node:fs";
import path from "node:path";
import TOML from "@iarna/toml";
import { auditUnlockables } from "./audit-lib.mjs";
import { SURVIVORS } from "./constants.mjs";
import { loadUnlockables, ROOT } from "./load.mjs";

const rows = await loadUnlockables();
const audit = auditUnlockables(rows);
const publishedRows = rows.map(enrichRow);
const lookups = loadLookups();
const dist = path.join(ROOT, "dist");
const publicDir = path.join(ROOT, "web", "public");
const parentRoot = path.resolve(ROOT, "../..");
const assetIconsDir = path.join(ROOT, "assets", "icons");
fs.mkdirSync(dist, { recursive: true });
fs.mkdirSync(publicDir, { recursive: true });
copyIcons(rows, [dist, publicDir]);

const dataJson = JSON.stringify({
  schema_version: 1,
  generated_at: new Date().toISOString(),
  locales: ["en", "zh-Hans"],
  lookups,
  unlockables: publishedRows,
}, null, 2);
const auditJson = JSON.stringify(audit, null, 2);

for (const dir of [dist, publicDir]) {
  fs.writeFileSync(path.join(dir, "data.json"), dataJson);
  fs.writeFileSync(path.join(dir, "audit.json"), auditJson);
}

console.log(`Wrote ${path.relative(ROOT, path.join(dist, "data.json"))}`);
console.log(`Wrote ${path.relative(ROOT, path.join(dist, "audit.json"))}`);
console.log(`Wrote ${path.relative(ROOT, path.join(publicDir, "data.json"))}`);
console.log(`Wrote ${path.relative(ROOT, path.join(publicDir, "audit.json"))}`);

if (audit.summary.issues > 0) process.exitCode = 1;

function enrichRow(row) {
  const ownerSurvivors = ownerSurvivorFacet(row);
  const requiredSurvivors = survivorList(row.hard?.survivors || []);
  const recommendedSurvivors = survivorList(row.soft?.survivors || []);
  return {
    ...row,
    facets: {
      owner_survivors: ownerSurvivors,
      required_survivors: requiredSurvivors,
      recommended_survivors: recommendedSurvivors,
      survivors: unionSorted([ownerSurvivors, requiredSurvivors, recommendedSurvivors]),
    },
  };
}

function ownerSurvivorFacet(row) {
  const owner = targetOwner(row);
  return owner ? [owner] : [];
}

function survivorList(values) {
  return [...new Set(values)].filter((value) => SURVIVORS.has(value)).sort();
}

function unionSorted(groups) {
  return [...new Set(groups.flat())].sort();
}

function targetOwner(row) {
  if (row.category === "survivor") return row.target;
  const [owner, rest] = String(row.target || "").split(":");
  if (rest && SURVIVORS.has(owner)) return owner;
  return null;
}

function loadLookups() {
  const filePath = path.join(ROOT, "metadata", "facets.toml");
  if (!fs.existsSync(filePath)) return {};
  return TOML.parse(fs.readFileSync(filePath, "utf8"));
}

function copyIcons(rows, targetRoots) {
  const iconIndex = buildIconIndex([
    assetIconsDir,
    path.join(parentRoot, "data", "wiki", "icons"),
    path.join(parentRoot, "data", "out", "icons"),
  ]);
  const icons = [...new Set(rows.map((row) => row.icon).filter(Boolean))];
  const expectedNames = new Set(icons.map((icon) => path.basename(icon)));
  fs.mkdirSync(assetIconsDir, { recursive: true });

  for (const root of targetRoots) {
    const dir = path.join(root, "icons");
    fs.mkdirSync(dir, { recursive: true });
    removeStaleIcons(dir, expectedNames);
  }

  let copied = 0;
  for (const icon of icons) {
    const name = path.basename(icon);
    const source = findIconSource(iconIndex, name);
    if (!source) continue;
    const assetPath = path.join(assetIconsDir, name);
    if (path.resolve(source) !== path.resolve(assetPath)) {
      fs.copyFileSync(source, assetPath);
    }
    for (const root of targetRoots) {
      fs.copyFileSync(assetPath, path.join(root, "icons", name));
    }
    copied += 1;
  }

  console.log(`Copied ${copied}/${icons.length} referenced icons`);
}

function removeStaleIcons(dir, expectedNames) {
  for (const name of fs.readdirSync(dir)) {
    const filePath = path.join(dir, name);
    if (!fs.statSync(filePath).isFile()) continue;
    if (/\.(png|jpg|jpeg|gif|webp)$/i.test(name) && !expectedNames.has(name)) {
      fs.rmSync(filePath);
    }
  }
}

function buildIconIndex(dirs) {
  const index = new Map();
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      const filePath = path.join(dir, name);
      if (!fs.statSync(filePath).isFile()) continue;
      if (!/\.(png|jpg|jpeg|gif|webp)$/i.test(name)) continue;
      index.set(name.toLowerCase(), filePath);
    }
  }
  return index;
}

function findIconSource(index, name) {
  const exact = index.get(name.toLowerCase());
  if (exact) return exact;
  const parsed = path.parse(name);
  return index.get(`${parsed.name}location${parsed.ext}`.toLowerCase()) || null;
}
