export function parseSave(value) {
  let save = value;
  if (typeof value === "string") {
    const text = value.replace(/^\uFEFF/, "").trim();
    if (!text) throw new SaveProgressError("empty_save", "The selected file is empty.");
    try {
      save = JSON.parse(text);
    } catch (error) {
      throw new SaveProgressError("invalid_json", "The selected file is not valid JSON.", { cause: error });
    }
  }
  if (!save || typeof save !== "object" || Array.isArray(save)) {
    throw new SaveProgressError("invalid_save", "The selected JSON is not a Risk of Rain Returns save.");
  }
  if (!Array.isArray(save.flags)) {
    throw new SaveProgressError("missing_flags", "The save does not contain a flags array.");
  }
  return save;
}

export function resolveProgress(saveValue, unlockables) {
  const save = parseSave(saveValue);
  if (!Array.isArray(unlockables)) throw new TypeError("unlockables must be an array");

  const flags = new Set(save.flags.map(String));
  const trialComplete = save.trials?.main?.trial_complete || {};
  const unlockedIds = [];
  const lockedIds = [];
  const unresolved = [];
  const evidence = {};

  for (const row of unlockables) {
    const check = progressCheckFor(row);
    if (!check) {
      unresolved.push({ id: row?.id || null, reason: "unsupported_unlockable" });
      continue;
    }
    const unlocked = evaluateCheck(check, flags, trialComplete);
    (unlocked ? unlockedIds : lockedIds).push(row.id);
    evidence[row.id] = { ...check, value: unlocked };
  }

  return {
    unlockedIds,
    lockedIds,
    unresolved,
    evidence,
    summary: {
      total: unlockables.length,
      unlocked: unlockedIds.length,
      locked: lockedIds.length,
      unresolved: unresolved.length,
    },
  };
}

export function progressCheckFor(row) {
  if (!row || typeof row !== "object" || !row.id) return null;
  const gameId = stripNamespace(row.target_entity?.game?.game_id);
  if (row.achievement_id) {
    return {
      kind: "flag",
      key: `challenge_${row.achievement_id}_completed`,
    };
  }

  if (row.category === "monster_log" && gameId) {
    return { kind: "flag", key: `monster_${gameId}_got` };
  }
  if (["stage", "secret_stage"].includes(row.category) && gameId) {
    return { kind: "flag", key: `stage_${gameId}_visited` };
  }
  if (row.category === "trial") {
    const trialId = String(row.target || "").split(".").at(-1);
    if (trialId) return { kind: "trial", key: trialId };
  }
  return null;
}

export class SaveProgressError extends Error {
  constructor(code, message, options) {
    super(message, options);
    this.name = "SaveProgressError";
    this.code = code;
  }
}

function evaluateCheck(check, flags, trialComplete) {
  if (check.kind === "flag") return flags.has(check.key);
  if (check.kind === "trial") return Boolean(trialComplete[check.key]);
  return false;
}

function stripNamespace(value) {
  if (!value) return null;
  return String(value).replace(/^ror[:-]/, "");
}
