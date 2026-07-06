import {
  ACTIONS_REQUIRING_STAGE,
  ACTIONS,
  CATEGORIES,
  CONFIDENCE,
  PRECISION,
  SOURCE_TYPES,
  STAGE_ROLE,
  STAGES,
  SURVIVORS,
} from "./constants.mjs";

export function auditUnlockables(rows) {
  const issues = [];
  const seen = new Map();
  for (const row of rows) {
    const id = row.id || `<missing:${row.filePath || "unknown"}>`;
    if (!row.id) add(issues, "schema", "high", "missing id", id, row.filePath);
    if (!row.category || !CATEGORIES.has(row.category)) add(issues, "schema", "high", "invalid category", id, row.filePath, { category: row.category });
    if (!row.target) add(issues, "schema", "high", "missing target", id, row.filePath);
    auditTarget(issues, row, id);
    if (row.icon && !/^icons\/[^/]+\.(png|jpg|jpeg|gif|webp)$/i.test(row.icon)) {
      add(issues, "schema", "medium", "invalid icon path", id, row.filePath, { icon: row.icon });
    }
    if (row.achievement_id && !/^unlock_[A-Za-z0-9_]+$/.test(row.achievement_id)) {
      add(issues, "schema", "medium", "invalid achievement_id", id, row.filePath, { achievement_id: row.achievement_id });
    }
    if (!row.action) add(issues, "schema", "high", "missing action", id, row.filePath);
    else if (!ACTIONS.has(row.action)) add(issues, "schema", "medium", "unknown action", id, row.filePath, { action: row.action });
    auditText(issues, row, id);
    if (!row.precision || !PRECISION.has(row.precision)) add(issues, "schema", "high", "invalid precision", id, row.filePath, { precision: row.precision });
    if (!row.confidence || !CONFIDENCE.has(row.confidence)) add(issues, "schema", "high", "invalid confidence", id, row.filePath, { confidence: row.confidence });
    for (const key of ["priority", "opportunity_boost", "effort", "risk"]) {
      const value = row[key];
      if (!Number.isInteger(value) || value < 0 || value > 100) add(issues, "scoring", "medium", `invalid ${key}`, id, row.filePath, { value });
    }
    if (row.id) {
      if (seen.has(row.id)) add(issues, "schema", "high", "duplicate id", id, row.filePath, { first: seen.get(row.id) });
      seen.set(row.id, row.filePath);
    }
    if (row.category && row.id && !row.id.startsWith(`${row.category}:`)) {
      add(issues, "schema", "medium", "id/category prefix mismatch", id, row.filePath);
    }
    if (ACTIONS_REQUIRING_STAGE.has(row.action) && row.precision !== "currently_unobtainable" && row.stage.length === 0) {
      add(issues, "requirements", "high", "stage-bound unlockable missing stage", id, row.filePath);
    }
    if ((["artifact", "secret_stage"].includes(row.category) || row.action === "world_prism") && row.precision !== "currently_unobtainable" && row.text.en.steps.length === 0) {
      add(issues, "content", "medium", "route unlockable missing steps", id, row.filePath);
    }
    if (row.source.length === 0) add(issues, "sources", "high", "missing source", id, row.filePath);
    for (const stage of row.stage) {
      if (!stage.id || !STAGES.has(stage.id)) add(issues, "references", "medium", "unknown stage id", id, row.filePath, { stage: stage.id });
      if (!STAGE_ROLE.has(stage.role)) add(issues, "schema", "medium", "invalid stage role", id, row.filePath, { role: stage.role });
      if (!Array.isArray(stage.variants)) add(issues, "schema", "medium", "stage variants must be an array", id, row.filePath);
    }
    for (const survivor of [...row.hard.survivors, ...row.soft.survivors]) {
      if (!SURVIVORS.has(survivor)) add(issues, "references", "medium", "unknown survivor id", id, row.filePath, { survivor });
    }
    for (const source of row.source) {
      if (!source.type || !source.ref) add(issues, "sources", "medium", "source missing type/ref", id, row.filePath, source);
      else {
        if (!SOURCE_TYPES.has(source.type)) add(issues, "sources", "high", "unpublished source type", id, row.filePath, source);
        if (!isPublishedRef(source.ref)) add(issues, "sources", "high", "unpublished source ref", id, row.filePath, source);
        if (source.url && !/^https?:\/\//.test(source.url)) add(issues, "sources", "high", "source url must be public", id, row.filePath, source);
      }
    }
  }
  const groups = groupIssues(issues);
  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    summary: {
      unlockables: rows.length,
      issues: issues.length,
      issue_groups: groups.length,
      by_severity: countBy(issues, (issue) => issue.severity),
      by_area: countBy(issues, (issue) => issue.area),
      by_category: countBy(rows, (row) => row.category || "unknown"),
      achievement_backed: rows.filter((row) => row.achievement_id).length,
    },
    issues: groups,
  };
}

function auditTarget(issues, row, id) {
  if (!row.target) return;
  const parts = String(row.target).split(":");
  if (parts.length > 2 || parts.some((part) => !part)) {
    add(issues, "schema", "medium", "invalid target", id, row.filePath, { target: row.target });
    return;
  }
  if (parts.length === 2 && !SURVIVORS.has(parts[0])) {
    add(issues, "references", "medium", "unknown target owner", id, row.filePath, { target: row.target, owner: parts[0] });
  }
}

function auditText(issues, row, id) {
  const en = row.text?.en || {};
  const zh = row.text?.["zh-Hans"] || {};
  if (!en.name) add(issues, "text", "high", "missing text.en.name", id, row.filePath);
  if (!zh.name) add(issues, "text", "high", "missing text.zh-Hans.name", id, row.filePath);
  if (!en.summary) add(issues, "text", "high", "missing text.en.summary", id, row.filePath);
  if (!zh.summary) add(issues, "text", "high", "missing text.zh-Hans.summary", id, row.filePath);
  if (Boolean(en.location) !== Boolean(zh.location)) add(issues, "text", "high", "locale location mismatch", id, row.filePath, { en: en.location, zhHans: zh.location });
  if (en.steps.length !== zh.steps.length) add(issues, "text", "high", "locale steps length mismatch", id, row.filePath, { en: en.steps.length, zhHans: zh.steps.length });
  if (en.notes.length !== zh.notes.length) add(issues, "text", "high", "locale notes length mismatch", id, row.filePath, { en: en.notes.length, zhHans: zh.notes.length });
}

function isPublishedRef(ref) {
  if (/^https?:\/\//.test(ref)) return true;
  if (/^(game_metadata|ai_research|wiki):[a-z0-9_:-]+$/i.test(ref)) return true;
  return false;
}

function add(issues, area, severity, title, id, filePath, detail = null) {
  issues.push({ area, severity, title, id, filePath, detail });
}

function groupIssues(issues) {
  const map = new Map();
  for (const issue of issues) {
    const key = `${issue.area}\0${issue.severity}\0${issue.title}`;
    if (!map.has(key)) map.set(key, { area: issue.area, severity: issue.severity, title: issue.title, count: 0, items: [] });
    const group = map.get(key);
    group.count += 1;
    group.items.push({ id: issue.id, filePath: issue.filePath, detail: issue.detail });
  }
  return [...map.values()].sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || b.count - a.count || a.title.localeCompare(b.title));
}

function countBy(rows, fn) {
  const out = {};
  for (const row of rows) {
    const key = fn(row);
    out[key] = (out[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(out).sort());
}

function severityRank(severity) {
  return { high: 3, medium: 2, low: 1 }[severity] || 0;
}
