import test from "node:test";
import assert from "node:assert/strict";
import { parseSave, progressCheckFor, resolveProgress, SaveProgressError } from "../lib/rorr-save-progress/index.mjs";

const rows = [
  { id: "artifact:origin", category: "artifact", achievement_id: "unlock_artifact_origin", target_entity: { game: { game_id: "ror:origin" } } },
  { id: "skill:huntress:huntressZ2", category: "skill", achievement_id: "unlock_huntress_z2" },
  { id: "monster_log:wisp", category: "monster_log", target_entity: { game: { game_id: "ror:wisp" } } },
  { id: "stage:desolateForest", category: "stage", target_entity: { game: { game_id: "ror:desolateForest" } } },
  { id: "trial:huntress:huntress1", category: "trial", target: "trial.huntress.huntress1" },
];

test("parseSave accepts BOM-prefixed save JSON", () => {
  assert.deepEqual(parseSave(`\uFEFF${JSON.stringify({ flags: [] })}`), { flags: [] });
});

test("parseSave rejects unrelated JSON", () => {
  assert.throws(() => parseSave("{}"), (error) => error instanceof SaveProgressError && error.code === "missing_flags");
});

test("progressCheckFor derives all supported save paths", () => {
  assert.deepEqual(progressCheckFor(rows[0]), { kind: "flag", key: "artifact_ror:origin_viewed" });
  assert.deepEqual(progressCheckFor(rows[1]), { kind: "flag", key: "challenge_unlock_huntress_z2_completed" });
  assert.deepEqual(progressCheckFor(rows[2]), { kind: "flag", key: "monster_wisp_got" });
  assert.deepEqual(progressCheckFor(rows[3]), { kind: "flag", key: "stage_desolateForest_visited" });
  assert.deepEqual(progressCheckFor(rows[4]), { kind: "trial", key: "huntress1" });
});

test("resolveProgress reports unlocked, locked, unresolved, and evidence", () => {
  const result = resolveProgress({
    flags: ["artifact_ror:origin_viewed", "challenge_unlock_huntress_z2_completed", "stage_desolateForest_visited"],
    trials: { main: { trial_complete: { huntress1: 2 } } },
  }, [...rows, { id: "other:unknown", category: "other" }]);

  assert.deepEqual(result.unlockedIds, [
    "artifact:origin",
    "skill:huntress:huntressZ2",
    "stage:desolateForest",
    "trial:huntress:huntress1",
  ]);
  assert.deepEqual(result.lockedIds, ["monster_log:wisp"]);
  assert.deepEqual(result.unresolved, [{ id: "other:unknown", reason: "unsupported_unlockable" }]);
  assert.equal(result.evidence["trial:huntress:huntress1"].value, true);
});
