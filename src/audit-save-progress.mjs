import { progressCheckFor } from "../lib/rorr-save-progress/index.mjs";
import { loadUnlockables } from "./load.mjs";

const rows = await loadUnlockables();
const unresolved = rows.filter((row) => !progressCheckFor(row)).map((row) => ({ id: row.id, category: row.category }));
const checks = rows.map(progressCheckFor).filter(Boolean);
const duplicateChecks = duplicateValues(checks.map((check) => `${check.kind}:${check.key}`));
const byKind = countBy(checks, (check) => check.kind);
const byCategory = countBy(rows, (row) => row.category);

const report = {
  unlockables: rows.length,
  resolved: checks.length,
  unresolved: unresolved.length,
  duplicate_checks: duplicateChecks.length,
  by_kind: byKind,
  by_category: byCategory,
};

console.log(JSON.stringify(report, null, 2));
if (unresolved.length) console.error("Unresolved:", unresolved);
if (duplicateChecks.length) console.error("Duplicate checks:", duplicateChecks);
if (unresolved.length || duplicateChecks.length) process.exitCode = 1;

function duplicateValues(values) {
  const counts = countBy(values, (value) => value);
  return Object.entries(counts).filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
}

function countBy(values, keyFor) {
  const out = {};
  for (const value of values) {
    const key = keyFor(value);
    out[key] = (out[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort());
}
