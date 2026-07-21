import "./style.css";
import { Copy, createIcons, Eraser, FileCheck2, FileUp, Trash2, Undo2, Unplug, Upload, X } from "lucide";
import { parseSave, resolveProgress, SaveProgressError } from "../../lib/rorr-save-progress/index.mjs";

const state = {
  data: null,
  audit: null,
  selectedId: null,
  progress: { snapshot: null, overrides: {} },
  previousSnapshot: null,
  canUndoSave: false,
  filters: {
    q: "",
    category: [],
    itemTier: [],
    stage: [],
    survivor: [],
    lock: [],
  },
  locale: "en",
};

const reviewKey = "rorr-unlockables-review:v1";
const uiStateKey = "rorr-unlockables-ui:v1";
const progressKey = "rorr-unlockables-progress:v2";
const localeOptions = {
  en: { icon: "/icons/flags/us.svg", label: "English" },
  "zh-Hans": { icon: "/icons/flags/cn.svg", label: "简体中文" },
};
const uiLabels = {
  auditClean: { en: "Audit clean", "zh-Hans": "\u5ba1\u8ba1\u901a\u8fc7" },
  auditIssues: { en: "audit issues", "zh-Hans": "\u4e2a\u5ba1\u8ba1\u95ee\u9898" },
  backToList: { en: "Back to list", "zh-Hans": "\u8fd4\u56de\u5217\u8868" },
  noMatching: { en: "No matching unlockable.", "zh-Hans": "\u6ca1\u6709\u5339\u914d\u7684\u89e3\u9501\u9879\u3002" },
  shown: { en: "shown", "zh-Hans": "\u5df2\u663e\u793a" },
  total: { en: "total", "zh-Hans": "\u603b\u6570" },
  categories: { en: "categories", "zh-Hans": "\u5206\u7c7b" },
  achievements: { en: "achievements", "zh-Hans": "\u6210\u5c31" },
  unlocked: { en: "unlocked", "zh-Hans": "\u5df2\u89e3\u9501" },
  additionalInfo: { en: "Additional information", "zh-Hans": "\u8865\u5145\u4fe1\u606f" },
  relatedChallenges: { en: "Related challenges", "zh-Hans": "\u76f8\u5173\u6311\u6218" },
  loadSave: { en: "Load save", "zh-Hans": "\u52a0\u8f7d\u5b58\u6863" },
  undoImport: { en: "Undo import", "zh-Hans": "\u64a4\u9500\u672c\u6b21\u5bfc\u5165" },
  removeSave: { en: "Remove loaded save", "zh-Hans": "\u79fb\u9664\u5df2\u52a0\u8f7d\u5b58\u6863" },
  clearManual: { en: "Clear manual changes", "zh-Hans": "\u6e05\u9664\u624b\u5de5\u4fee\u6539" },
  resetProgress: { en: "Reset all progress", "zh-Hans": "\u91cd\u7f6e\u5168\u90e8\u8fdb\u5ea6" },
  saveDialogTitle: { en: "Game save", "zh-Hans": "\u6e38\u620f\u5b58\u6863" },
  localSaveTitle: { en: "Windows local save (recommended)", "zh-Hans": "Windows \u672c\u5730\u5b58\u6863\uff08\u63a8\u8350\uff09" },
  localSaveNote: { en: "Choose the newest <SteamID>_localsave.json file in this folder.", "zh-Hans": "\u5728\u8be5\u76ee\u5f55\u4e2d\u9009\u62e9\u6700\u65b0\u7684 <SteamID>_localsave.json\u3002" },
  cloudSaveTitle: { en: "Steam Cloud save", "zh-Hans": "Steam Cloud \u5b58\u6863" },
  savePrivacy: { en: "The file is parsed only in this browser. It is never uploaded, and the original save is not stored.", "zh-Hans": "\u6587\u4ef6\u53ea\u5728\u5f53\u524d\u6d4f\u89c8\u5668\u5185\u89e3\u6790\uff0c\u4e0d\u4f1a\u4e0a\u4f20\uff0c\u4e5f\u4e0d\u4f1a\u4fdd\u5b58\u539f\u59cb\u5b58\u6863\u3002" },
  chooseSave: { en: "Choose save", "zh-Hans": "\u9009\u62e9\u5b58\u6863" },
  replaceSave: { en: "Choose a new save", "zh-Hans": "\u9009\u62e9\u65b0\u5b58\u6863" },
  dropSave: { en: "or drop a save file here", "zh-Hans": "\u6216\u5c06\u5b58\u6863\u62d6\u5230\u6b64\u5904" },
  manageProgress: { en: "Manage progress", "zh-Hans": "\u7ba1\u7406\u8fdb\u5ea6" },
  close: { en: "Close", "zh-Hans": "\u5173\u95ed" },
  copy: { en: "Copy", "zh-Hans": "\u590d\u5236" },
  copied: { en: "Copied", "zh-Hans": "\u5df2\u590d\u5236" },
  saveSource: { en: "save", "zh-Hans": "\u5b58\u6863" },
  manualSource: { en: "manual", "zh-Hans": "\u624b\u5de5" },
  resetConfirm: { en: "Remove the loaded save and all manual progress changes?", "zh-Hans": "\u79fb\u9664\u5df2\u52a0\u8f7d\u5b58\u6863\u5e76\u6e05\u9664\u5168\u90e8\u624b\u5de5\u8fdb\u5ea6\u4fee\u6539\uff1f" },
  clearManualConfirm: { en: "Clear all manual progress changes?", "zh-Hans": "\u6e05\u9664\u5168\u90e8\u624b\u5de5\u8fdb\u5ea6\u4fee\u6539\uff1f" },
  importFailed: { en: "Could not load this save", "zh-Hans": "\u65e0\u6cd5\u52a0\u8f7d\u8be5\u5b58\u6863" },
  imported: { en: "Save loaded", "zh-Hans": "\u5b58\u6863\u5df2\u52a0\u8f7d" },
  unresolved: { en: "unresolved", "zh-Hans": "\u65e0\u6cd5\u5224\u5b9a" },
  manualChanges: { en: "manual changes", "zh-Hans": "\u9879\u624b\u5de5\u4fee\u6539" },
};

const els = {
  auditBadge: document.querySelector("#auditBadge"),
  saveControl: document.querySelector("#saveControl"),
  savePanel: document.querySelector("#savePanel"),
  locale: document.querySelector("#locale"),
  search: document.querySelector("#search"),
  category: document.querySelector("#category"),
  itemTier: document.querySelector("#itemTier"),
  stage: document.querySelector("#stage"),
  survivor: document.querySelector("#survivor"),
  lock: document.querySelector("#lock"),
  activeTags: document.querySelector("#activeTags"),
  summary: document.querySelector("#summary"),
  list: document.querySelector("#list"),
  detail: document.querySelector("#detail"),
};

async function main() {
  const [data, audit] = await Promise.all([
    fetch("/data.json").then((res) => res.json()),
    fetch("/audit.json").then((res) => res.json()),
  ]);
  state.data = data;
  state.audit = audit;
  state.locale = defaultLocale();
  state.progress = loadProgressState();
  sanitizeProgressState();
  applyUiState(loadUiState());
  sanitizeUiState();
  if (migrateLegacyFragment()) return;
  applyEntryPath();
  state.selectedId ||= data.unlockables[0]?.id || null;
  renderLocaleSwitch();
  els.search.value = state.filters.q;
  bindFilters();
  bindSaveControls();
  render();
}

function bindFilters() {
  renderAllFilterDropdowns();

  els.search.addEventListener("input", () => {
    state.filters.q = els.search.value.trim().toLowerCase();
    render();
  });
  els.locale.querySelector("[data-locale-toggle]").addEventListener("click", () => {
    els.locale.classList.toggle("open");
    renderLocaleSwitch();
  });
  els.locale.querySelectorAll("[data-locale]").forEach((button) => {
    button.addEventListener("click", () => {
      state.locale = button.dataset.locale;
      els.locale.classList.remove("open");
      renderAllFilterDropdowns();
      render();
    });
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".filter-dropdown")) closeFilterDropdowns();
    if (!event.target.closest(".locale-menu")) els.locale.classList.remove("open");
  });
  window.addEventListener("resize", () => {
    if (!isMobileLayout()) document.body.classList.remove("detail-mode");
  });
  window.addEventListener("popstate", () => {
    applyEntryPath();
    render();
  });
}

function bindSaveControls() {
  const chooseFile = () => {
    const input = els.savePanel.querySelector("[data-save-file]");
    input.value = "";
    input.click();
  };

  els.saveControl.addEventListener("click", openSaveDialog);
  els.savePanel.querySelector("[data-save-choose]").addEventListener("click", chooseFile);
  els.savePanel.querySelector("[data-save-file]").addEventListener("change", (event) => {
    const file = event.target.files?.[0];
    if (file) importSaveFile(file);
  });
  const dropzone = els.savePanel.querySelector("[data-save-choose]");
  for (const eventName of ["dragenter", "dragover"]) {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      dropzone.classList.add("dragging");
    });
  }
  for (const eventName of ["dragleave", "drop"]) {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  }
  dropzone.addEventListener("drop", (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) importSaveFile(file);
  });
  els.savePanel.addEventListener("close", clearSaveImportResult);
  els.savePanel.querySelector("[data-save-undo]").addEventListener("click", () => {
    if (!state.canUndoSave) return;
    state.progress.snapshot = state.previousSnapshot;
    state.previousSnapshot = null;
    state.canUndoSave = false;
    pruneProgressOverrides();
    saveProgressState();
    clearSaveImportResult();
    render();
  });
  els.savePanel.querySelector("[data-save-remove]").addEventListener("click", () => {
    state.progress.snapshot = null;
    state.previousSnapshot = null;
    state.canUndoSave = false;
    pruneProgressOverrides();
    saveProgressState();
    clearSaveImportResult();
    render();
  });
  els.savePanel.querySelector("[data-save-clear-manual]").addEventListener("click", () => {
    if (!Object.keys(state.progress.overrides).length) return;
    if (!window.confirm(uiLabel("clearManualConfirm"))) return;
    state.progress.overrides = {};
    saveProgressState();
    render();
  });
  els.savePanel.querySelector("[data-save-reset]").addEventListener("click", () => {
    if (!state.progress.snapshot && !Object.keys(state.progress.overrides).length) return;
    if (!window.confirm(uiLabel("resetConfirm"))) return;
    state.progress = { snapshot: null, overrides: {} };
    state.previousSnapshot = null;
    state.canUndoSave = false;
    saveProgressState();
    clearSaveImportResult();
    render();
  });
  els.savePanel.querySelectorAll("[data-copy-path]").forEach((button) => {
    button.addEventListener("click", async () => {
      await copyText(button.dataset.copyPath);
      button.querySelector("span").textContent = uiLabel("copied");
      window.setTimeout(() => { button.querySelector("span").textContent = uiLabel("copy"); }, 1400);
    });
  });
}

function renderSaveControls() {
  const snapshot = state.progress.snapshot;
  const overrides = Object.keys(state.progress.overrides).length;
  els.saveControl.classList.toggle("loaded", Boolean(snapshot));
  els.saveControl.querySelector("[data-save-icon]").innerHTML = `<i data-lucide="${snapshot ? "file-check-2" : "file-up"}"></i>`;
  els.saveControl.title = snapshot ? `${snapshot.filename} · ${snapshot.unlockedIds.length}/${snapshot.total}` : uiLabel("loadSave");
  els.saveControl.setAttribute("aria-label", els.saveControl.title);

  const current = els.savePanel.querySelector("[data-save-current]");
  current.hidden = !snapshot;
  if (snapshot) {
    const importedAt = snapshot.importedAt ? new Date(snapshot.importedAt).toLocaleString(state.locale) : "";
    const total = snapshot.total || state.data.unlockables.length;
    const percent = total ? Math.round(snapshot.unlockedIds.length / total * 100) : 0;
    current.querySelector("[data-save-count]").textContent = `${snapshot.unlockedIds.length} / ${total} ${uiLabel("unlocked")}`;
    current.querySelector("[data-save-percent]").textContent = `${percent}%`;
    current.querySelector("[data-save-progress-bar]").style.width = `${percent}%`;
    current.querySelector("[data-save-filename]").textContent = snapshot.filename;
    current.querySelector("[data-save-imported-at]").textContent = importedAt;
  }
  els.savePanel.querySelector("[data-save-drop-title]").textContent = uiLabel(snapshot ? "replaceSave" : "chooseSave");
  els.savePanel.querySelector("[data-save-drop-hint]").textContent = uiLabel("dropSave");

  setManageAction("undo", state.canUndoSave, uiLabel("undoImport"));
  setManageAction("clear-manual", overrides > 0, `${uiLabel("clearManual")} (${overrides})`);
  setManageAction("remove", Boolean(snapshot), uiLabel("removeSave"));
  setManageAction("reset", Boolean(snapshot) || overrides > 0, uiLabel("resetProgress"));
  renderSaveDialogLabels();
  renderIcons();
}

function renderSaveDialogLabels() {
  els.savePanel.querySelector("[data-save-dialog-title]").textContent = uiLabel("saveDialogTitle");
  els.savePanel.querySelector("[data-save-local-title]").textContent = uiLabel("localSaveTitle");
  els.savePanel.querySelector("[data-save-local-note]").textContent = uiLabel("localSaveNote");
  els.savePanel.querySelector("[data-save-cloud-title]").textContent = uiLabel("cloudSaveTitle");
  els.savePanel.querySelector("[data-save-privacy]").textContent = uiLabel("savePrivacy");
  els.savePanel.querySelectorAll("[data-copy-path] span").forEach((label) => { label.textContent = uiLabel("copy"); });
  setTooltip(els.savePanel.querySelector("[data-save-close]"), uiLabel("close"));
}

function openSaveDialog() {
  renderSaveControls();
  if (!els.savePanel.open) els.savePanel.showModal();
}

function clearSaveImportResult() {
  const resultBox = els.savePanel.querySelector("[data-save-result]");
  resultBox.hidden = true;
  resultBox.className = "save-import-result";
  resultBox.replaceChildren();
}

function setManageAction(name, visible, label) {
  const button = els.savePanel.querySelector(`[data-save-${name}]`);
  button.hidden = !visible;
  setTooltip(button, label);
}

function setTooltip(button, label) {
  button.setAttribute("aria-label", label);
  button.dataset.tooltip = label;
}

function renderIcons() {
  createIcons({
    icons: { Copy, Eraser, FileCheck2, FileUp, Trash2, Undo2, Unplug, Upload, X },
    attrs: { "aria-hidden": "true", "stroke-width": 2 },
  });
}

async function importSaveFile(file) {
  const resultBox = els.savePanel.querySelector("[data-save-result]");
  try {
    const text = await file.text();
    const save = parseSave(text);
    const result = resolveProgress(save, state.data.unlockables);
    const snapshot = {
      filename: file.name,
      importedAt: new Date().toISOString(),
      fingerprint: await shortFingerprint(text),
      unlockedIds: result.unlockedIds,
      unresolvedIds: result.unresolved.map((item) => item.id).filter(Boolean),
      total: result.summary.total,
    };
    state.previousSnapshot = state.progress.snapshot;
    state.canUndoSave = true;
    state.progress.snapshot = snapshot;
    pruneProgressOverrides();
    saveProgressState();
    render();
    resultBox.className = "save-import-result success";
    resultBox.innerHTML = `<strong>${esc(uiLabel("imported"))}</strong><span>${result.summary.unlocked}/${result.summary.total} ${esc(uiLabel("unlocked"))} · ${result.summary.unresolved} ${esc(uiLabel("unresolved"))}</span>`;
  } catch (error) {
    resultBox.className = "save-import-result error";
    const message = error instanceof SaveProgressError ? localizedSaveError(error) : String(error?.message || error);
    resultBox.innerHTML = `<strong>${esc(uiLabel("importFailed"))}</strong><span>${esc(message)}</span>`;
  }
  resultBox.hidden = false;
  openSaveDialog();
}

function localizedSaveError(error) {
  const messages = {
    empty_save: { en: "The selected file is empty.", "zh-Hans": "\u6240\u9009\u6587\u4ef6\u4e3a\u7a7a\u3002" },
    invalid_json: { en: "The selected file is not valid JSON.", "zh-Hans": "\u6240\u9009\u6587\u4ef6\u4e0d\u662f\u6709\u6548\u7684 JSON\u3002" },
    invalid_save: { en: "The selected JSON is not a Risk of Rain Returns save.", "zh-Hans": "\u6240\u9009 JSON \u4e0d\u662f Risk of Rain Returns \u5b58\u6863\u3002" },
    missing_flags: { en: "The save does not contain a flags array.", "zh-Hans": "\u8be5\u6587\u4ef6\u4e0d\u5305\u542b\u5b58\u6863 flags \u6570\u7ec4\u3002" },
  };
  return messages[error.code]?.[state.locale] || messages[error.code]?.en || error.message;
}

async function shortFingerprint(text) {
  if (globalThis.crypto?.subtle) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].slice(0, 8).map((value) => value.toString(16).padStart(2, "0")).join("");
  }
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function render() {
  renderLocaleSwitch();
  renderSaveControls();
  const rows = filteredRows();
  if (!rows.some((row) => row.id === state.selectedId)) state.selectedId = rows[0]?.id || null;
  renderAudit();
  renderSummary(rows);
  renderActiveFilterState();
  renderActiveTags();
  renderList(rows);
  renderDetail(rows.find((row) => row.id === state.selectedId) || null);
  saveUiState();
}

function renderAudit() {
  const issues = state.audit?.summary?.issues || 0;
  els.auditBadge.hidden = issues === 0;
  els.auditBadge.textContent = issues ? `${issues} ${uiLabel("auditIssues")}` : "";
  els.auditBadge.className = issues ? "audit-badge bad" : "audit-badge ok";
}

function renderLocaleSwitch() {
  const current = localeOptions[state.locale] || localeOptions.en;
  const trigger = els.locale.querySelector("[data-locale-toggle]");
  trigger.setAttribute("aria-expanded", String(els.locale.classList.contains("open")));
  trigger.setAttribute("aria-label", current.label);
  trigger.title = current.label;
  const icon = els.locale.querySelector("[data-current-locale-icon]");
  icon.src = current.icon;
  els.locale.querySelectorAll("[data-locale]").forEach((button) => {
    const active = button.dataset.locale === state.locale;
    button.querySelector("img").src = localeOptions[button.dataset.locale].icon;
    button.hidden = active;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
}

function renderSummary(rows) {
  const all = state.data.unlockables;
  const byCategory = countBy(rows, (row) => row.category);
  const achievementBacked = rows.filter((row) => row.achievement_id).length;
  const unlocked = state.data.unlockables.filter((row) => reviewState(row).unlocked).length;
  els.summary.innerHTML = `
    <div><strong>${rows.length}</strong><span>${esc(uiLabel("shown"))}</span></div>
    <div><strong>${all.length}</strong><span>${esc(uiLabel("total"))}</span></div>
    <div><strong>${Object.keys(byCategory).length}</strong><span>${esc(uiLabel("categories"))}</span></div>
    <div><strong>${achievementBacked}</strong><span>${esc(uiLabel("achievements"))}</span></div>
    <div><strong>${unlocked}</strong><span>${esc(uiLabel("unlocked"))}</span></div>
  `;
}

function renderList(rows) {
  els.list.innerHTML = rows.map((row) => `
    <div class="row ${row.id === state.selectedId ? "active" : ""}" data-id="${esc(row.id)}">
      <button class="row-main" type="button" data-select="${esc(row.id)}">
        ${renderIcon(row, "row-icon")}
        <span>${esc(localeText(row).name || row.id)}</span>
        <small>${esc(labelFor("category", row.category))}${itemTier(row) ? ` · ${esc(labelFor("itemTier", itemTier(row)))}` : ""}${row.achievement_id ? " · achievement" : ""}${survivorFacet(row).length ? ` · ${esc(survivorFacet(row).map((id) => labelFor("survivor", id)).join(", "))}` : ""}${row.needs_detail ? " · needs detail" : ""}</small>
      </button>
      ${renderLockButton(row)}
    </div>
  `).join("");
  els.list.querySelectorAll("[data-select]").forEach((button) => {
    button.addEventListener("click", () => {
      selectRow(button.dataset.select);
    });
  });
  els.list.querySelectorAll("[data-lock]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleUnlocked(button.dataset.lock);
      render();
    });
  });
}

function renderLockButton(row) {
  const progress = reviewState(row);
  const source = progress.source === "save" ? uiLabel("saveSource") : progress.source === "manual" ? uiLabel("manualSource") : "";
  return `<button class="row-lock ${progress.unlocked ? "active" : ""}" type="button" data-lock="${esc(row.id)}">
    <span>${esc(progress.unlocked ? labelFor("lock", "unlocked") : labelFor("lock", "locked"))}</span>
    ${source ? `<small>${esc(source)}</small>` : ""}
  </button>`;
}

function renderDetail(row) {
  if (!row) {
    els.detail.innerHTML = `
      <button class="detail-back" type="button" data-detail-back>${esc(uiLabel("backToList"))}</button>
      <p>${esc(uiLabel("noMatching"))}</p>
    `;
    bindDetailBack();
    return;
  }
  const text = localeText(row);
  const textParts = localeTextParts(row);
  const altText = state.locale === "en" ? row.text["zh-Hans"] : row.text.en;
  els.detail.innerHTML = `
    <button class="detail-back" type="button" data-detail-back>${esc(uiLabel("backToList"))}</button>
    <div class="detail-head">
      ${renderIcon(row, "detail-icon")}
      <div>
        <h2>${esc(text.name || row.id)}</h2>
        <p>${esc([altText?.name, row.id].filter(Boolean).join(" · "))}</p>
      </div>
      <span>${esc([labelFor("category", row.category), itemTier(row) ? labelFor("itemTier", itemTier(row)) : null].filter(Boolean).join(" · "))}</span>
    </div>
    <p class="summary-text">${renderTextParts(textParts.summary, row)}</p>
    ${renderAdditional(row)}
    ${renderTags(row)}
    ${renderStages(row)}
    ${renderNotes(text, textParts, row)}
    ${renderSteps(text, textParts, row)}
    ${renderEntityRelations(row)}
    ${renderSources(row)}
    ${renderGameData(row)}
    <dl>
      <div><dt>Action</dt><dd>${esc(row.action)}</dd></div>
      <div><dt>Achievement</dt><dd>${row.achievement_id ? esc(row.achievement_id) : "no"}</dd></div>
      <div><dt>Priority</dt><dd>${row.priority}</dd></div>
      <div><dt>Opportunity</dt><dd>${row.opportunity_boost}</dd></div>
      <div><dt>Effort</dt><dd>${row.effort}</dd></div>
      <div><dt>Risk</dt><dd>${row.risk}</dd></div>
      <div><dt>Quality</dt><dd>${esc(row.precision)} / ${esc(row.confidence)}</dd></div>
      ${text.location ? `<div><dt>Location</dt><dd>${renderTextParts(textParts.location, row)}</dd></div>` : ""}
      <div><dt>Needs Detail</dt><dd>${row.needs_detail ? "yes" : "no"}</dd></div>
    </dl>
  `;
  bindDetailBack();
}

function renderIcon(row, className) {
  if (row.icon) {
    return `<img class="${className}" src="${esc(rootAssetPath(row.icon))}" alt="" loading="lazy" />`;
  }
  const name = localeText(row).name || row.id || "?";
  return `<div class="${className} icon-fallback" aria-hidden="true">${esc(String(name).slice(0, 1).toUpperCase())}</div>`;
}

function renderTags(row) {
  const tags = [
    ...(row.hard.survivors || []).map((value) => ({ type: "survivor", value })),
    ...(row.hard.artifacts || []).map((value) => ({ type: "artifact", value })),
    ...(row.soft.survivors || []).map((value) => ({ type: "survivor", value })),
    ...(row.soft.items || []).map((value) => ({ type: "item", value })),
  ];
  if (!tags.length) return "";
  return `<div class="tags">${tags.map((tag) => `<span>${esc(tag.type)}:${renderEntityReference(tag.value, row)}</span>`).join("")}</div>`;
}

function rootAssetPath(value) {
  return `/${String(value).replace(/^\.?\//, "")}`;
}

function renderStages(row) {
  if (!row.stage.length) return "";
  return `<section><h3>Stages</h3><ul>${row.stage.map((stage) => `
    <li>${renderEntityReference(stage.id, row)} ${stage.variants.length ? `variant ${esc(stage.variants.join(", "))}` : ""} <small>${esc(stage.role)}</small></li>
  `).join("")}</ul></section>`;
}

function renderAdditional(row) {
  const notes = (row.additional || [])
    .map((note) => note?.[state.locale] || note?.en)
    .filter(Boolean);
  if (!notes.length) return "";
  return `<aside class="additional-info" role="note">
    <h3>${esc(uiLabel("additionalInfo"))}</h3>
    ${notes.map((note) => `<p>${esc(note)}</p>`).join("")}
  </aside>`;
}

function renderNotes(text, parts, row) {
  if (!text.notes.length) return "";
  return `<section><h3>Notes</h3><ul>${text.notes.map((note, index) => `<li>${renderTextParts(parts.notes[index], row, note)}</li>`).join("")}</ul></section>`;
}

function renderSteps(text, parts, row) {
  if (!text.steps.length) return "";
  return `<section><h3>Steps</h3><ol>${text.steps.map((step, index) => `<li>${renderTextParts(parts.steps[index], row, step)}</li>`).join("")}</ol></section>`;
}

function renderEntityRelations(row) {
  const relations = row.entity.filter((entity) => entity.links.length > 0);
  if (!relations.length) return "";
  return `<section class="entity-relations"><h3>${esc(uiLabel("relatedChallenges"))}</h3><ul>${relations.map((entity) => `
    <li id="${esc(entityRelationAnchor(entity.id))}">
      <strong>${esc(entityLabel(entity.id))}</strong>
      <span>${entity.links.map((id) => {
        const target = state.data.unlockables.find((candidate) => candidate.id === id);
        return target ? `<a class="entity-link" href="${esc(entryUrl(target))}">${esc(localeText(target).name || target.id)}</a>` : "";
      }).filter(Boolean).join("")}</span>
    </li>
  `).join("")}</ul></section>`;
}

function renderSources(row) {
  const publicSources = row.source.filter((source) => source.url);
  if (!publicSources.length) return "";
  return `<section><h3>Sources</h3><ul>${publicSources.map((source) => `
    <li>${renderSource(source)}</li>
  `).join("")}</ul></section>`;
}

function renderSource(source) {
  const label = source.label || source.type || "Source";
  const detail = source.note || "";
  if (source.url) {
    return `<a href="${esc(source.url)}" target="_blank" rel="noreferrer">${esc(label)}</a>${detail ? ` <small>${esc(detail)}</small>` : ""}`;
  }
  return `<span>${esc(label)}</span>${detail ? ` <small>${esc(detail)}</small>` : ""}`;
}

function renderGameData(row) {
  const game = row.target_entity?.game;
  if (!game) return "";
  const entries = [
    ["target_id", row.target],
    ...Object.entries(game).filter(([key]) => key !== "achievement_id"),
  ];
  return `
    <details class="game-data">
      <summary>Game Data</summary>
      <dl>${entries.map(([key, value]) => `
        <div><dt>${esc(humanizeKey(key))}</dt><dd><code>${esc(formatGameValue(value))}</code></dd></div>
      `).join("")}</dl>
    </details>
  `;
}

function humanizeKey(value) {
  return String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatGameValue(value) {
  if (Array.isArray(value)) return value.join(", ") || "none";
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value ?? "");
}

function filteredRows() {
  return state.data.unlockables.filter((row) => {
    const q = state.filters.q;
    if (q && !searchText(row).includes(q)) return false;
    if (!matchesAny(state.filters.category, [row.category])) return false;
    if (!matchesAny(state.filters.itemTier, itemTier(row) ? [itemTier(row)] : [])) return false;
    if (!matchesAny(state.filters.stage, row.stage.map((stage) => stage.id))) return false;
    if (!matchesSurvivorFilter(row)) return false;
    const review = reviewState(row);
    if (!matchesAny(state.filters.lock, [review.unlocked ? "unlocked" : "locked"])) return false;
    return true;
  }).sort(compareRows);
}

function localeText(row) {
  return row.text?.[state.locale] || row.text?.en || { name: row.id, summary: "", location: "", steps: [], notes: [] };
}

function localeTextParts(row) {
  return row.textParts?.[state.locale] || row.textParts?.en || { summary: [], location: [], steps: [], notes: [] };
}

function renderTextParts(parts, row, fallback = "") {
  if (!Array.isArray(parts) || parts.length === 0) return esc(fallback);
  return parts.map((part) => part.entity
    ? renderEntityReference(part.entity, row, part.label)
    : esc(part.text)
  ).join("");
}

function renderEntityReference(entityId, row, label = entityLabel(entityId)) {
  const local = row.entity.find((entity) => entity.id === entityId);
  if (local?.links.length === 1) {
    const linked = state.data.unlockables.find((candidate) => candidate.id === local.links[0]);
    if (linked) return `<a class="entity-link" href="${esc(entryUrl(linked))}">${esc(label)}</a>`;
  }
  if (local?.links.length > 1) {
    return `<a class="entity-link" href="#${esc(entityRelationAnchor(entityId))}">${esc(label)}</a>`;
  }
  if (local) return esc(label);
  const target = state.data.unlockables.find((row) => row.target === entityId);
  if (target) {
    if (target.target === row.target) return esc(label);
    return `<a class="entity-link" href="${esc(entryUrl(target))}">${esc(label)}</a>`;
  }
  const url = state.data.entities?.[entityId]?.url;
  if (url) return `<a class="entity-link" href="${esc(url)}" target="_blank" rel="noreferrer">${esc(label)}</a>`;
  return esc(label);
}

function entityRelationAnchor(entityId) {
  return `related-${entityId.replace(/[^A-Za-z0-9_-]/g, "-")}`;
}

function searchText(row) {
  const parts = [row.id, row.category, row.target, row.icon, row.achievement_id, itemTier(row), itemTier(row) ? labelFor("itemTier", itemTier(row)) : null];
  const game = row.target_entity?.game;
  if (game) parts.push(...Object.keys(game), ...Object.values(game).flatMap((value) => Array.isArray(value) ? value : [value]));
  parts.push(labelFor("category", row.category), ...row.stage.map((stage) => labelFor("stage", stage.id)), ...survivorFacet(row), ...survivorFacet(row).map((id) => labelFor("survivor", id)));
  const references = [...(row.hard?.survivors || []), ...(row.hard?.artifacts || []), ...(row.soft?.survivors || []), ...(row.soft?.items || [])];
  parts.push(...references, ...references.map(entityLabel));
  for (const text of Object.values(row.text || {})) {
    parts.push(text.name, text.summary, text.location, ...(text.steps || []), ...(text.notes || []));
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function reviewState(row) {
  const hasOverride = Object.hasOwn(state.progress.overrides, row.id);
  const saveUnlocked = state.progress.snapshot ? importedUnlockedSet().has(row.id) : false;
  return {
    unlocked: hasOverride ? state.progress.overrides[row.id] : saveUnlocked,
    source: hasOverride ? "manual" : state.progress.snapshot ? "save" : "default",
  };
}

function survivorFacet(row) {
  return Array.isArray(row.facets?.survivors) ? row.facets.survivors : [];
}

function itemTier(row) {
  return row.facets?.item_tier || null;
}

function ownerSurvivors(row) {
  return Array.isArray(row.facets?.owner_survivors) ? row.facets.owner_survivors : [];
}

function requiredSurvivors(row) {
  return Array.isArray(row.facets?.required_survivors) ? row.facets.required_survivors : [];
}

function recommendedSurvivors(row) {
  return Array.isArray(row.facets?.recommended_survivors) ? row.facets.recommended_survivors : [];
}

function matchesSurvivorFilter(row) {
  const selected = state.filters.survivor;
  if (selected.length === 0) return true;
  const owners = ownerSurvivors(row);
  if (owners.length) return intersects(owners, selected);
  const required = requiredSurvivors(row);
  if (required.length) return intersects(required, selected);
  return true;
}

function compareRows(a, b) {
  if (state.filters.survivor.length) {
    const rankDelta = survivorRank(a) - survivorRank(b);
    if (rankDelta) return rankDelta;
  }
  return b.priority - a.priority || a.id.localeCompare(b.id);
}

function survivorRank(row) {
  const selected = state.filters.survivor;
  if (intersects(ownerSurvivors(row), selected)) return 0;
  if (intersects(requiredSurvivors(row), selected)) return 1;
  if (intersects(recommendedSurvivors(row), selected)) return 2;
  if (survivorFacet(row).length === 0) return 3;
  return 4;
}

function matchesAny(selected, values) {
  return selected.length === 0 || values.some((value) => selected.includes(value));
}

function intersects(left, right) {
  return left.some((value) => right.includes(value));
}

function toggleUnlocked(id) {
  const row = state.data.unlockables.find((candidate) => candidate.id === id);
  if (!row) return;
  const desired = !reviewState(row).unlocked;
  const imported = state.progress.snapshot ? importedUnlockedSet().has(id) : false;
  if (desired === imported) delete state.progress.overrides[id];
  else state.progress.overrides[id] = desired;
  saveProgressState();
}

function selectRow(id) {
  const row = state.data.unlockables.find((candidate) => candidate.id === id);
  if (!row) return;
  state.selectedId = row.id;
  if (window.location.pathname !== entryPath(row)) history.pushState(null, "", entryUrl(row));
  if (isMobileLayout()) document.body.classList.add("detail-mode");
  render();
  if (isMobileLayout()) document.querySelector(".layout")?.scrollIntoView({ block: "start" });
}

function applyEntryPath() {
  const row = state.data.unlockables.find((candidate) => entryPath(candidate) === window.location.pathname);
  if (!row) return false;
  state.selectedId = row.id;
  state.filters = { q: "", category: [], itemTier: [], stage: [], survivor: [], lock: [] };
  if (isMobileLayout()) document.body.classList.add("detail-mode");
  return true;
}

function migrateLegacyFragment() {
  const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  if (!raw) return null;
  try {
    const fragment = decodeURIComponent(raw);
    const row = state.data.unlockables.find((candidate) => candidate.target === fragment || candidate.id === fragment);
    if (!row) return false;
    window.location.replace(entryUrl(row));
    return true;
  } catch {
    return false;
  }
}

function entryPath(row) {
  return `/${row.filePath.replace(/\.toml$/, "")}/`;
}

function entryUrl(row) {
  return entryPath(row);
}

function filterValues() {
  return {
    category: unique(state.data.unlockables.map((row) => row.category)),
    itemTier: unique(state.data.unlockables.map(itemTier)),
    stage: unique(state.data.unlockables.flatMap((row) => row.stage.map((stage) => stage.id))),
    survivor: unique(state.data.unlockables.flatMap(survivorFacet)),
    lock: ["locked", "unlocked"],
  };
}

function renderAllFilterDropdowns() {
  const values = filterValues();
  for (const key of ["category", "itemTier", "stage", "survivor", "lock"]) {
    renderFilterDropdown(key, values[key]);
  }
}

function renderFilterDropdown(key, values) {
  const selected = state.filters[key];
  const sorted = orderedFilterValues(key, values);
  els[key].innerHTML = `
    <div class="filter-dropdown" data-filter-root="${esc(key)}">
      <button type="button" class="filter-trigger" data-filter-toggle="${esc(key)}">
        <span>${esc(groupLabel(key))}</span>
        <strong>${esc(filterSummary(selected.length))}</strong>
      </button>
      <div class="filter-menu">
        <button type="button" class="filter-option clear ${selected.length === 0 ? "active" : ""}" data-filter="${esc(key)}" data-value="">${esc(filterSummary(0))}</button>
        ${sorted.map((value) => `<button type="button" class="filter-option ${selected.includes(value) ? "active" : ""}" data-filter="${esc(key)}" data-value="${esc(value)}">${esc(labelFor(key, value))}</button>`).join("")}
      </div>
    </div>
  `;
  els[key].querySelector("[data-filter-toggle]").addEventListener("click", (event) => {
    event.stopPropagation();
    const root = event.currentTarget.closest(".filter-dropdown");
    const wasOpen = root.classList.contains("open");
    closeFilterDropdowns();
    root.classList.toggle("open", !wasOpen);
  });
  els[key].querySelectorAll("[data-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const value = button.dataset.value;
      if (!value) state.filters[key] = [];
      else if (state.filters[key].includes(value)) state.filters[key] = state.filters[key].filter((item) => item !== value);
      else state.filters[key] = [...state.filters[key], value];
      render();
    });
  });
}

function bindDetailBack() {
  els.detail.querySelector("[data-detail-back]")?.addEventListener("click", () => {
    document.body.classList.remove("detail-mode");
    document.querySelector(".layout")?.scrollIntoView({ block: "start" });
  });
}

function isMobileLayout() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function renderActiveFilterState() {
  for (const key of ["category", "itemTier", "stage", "survivor", "lock"]) {
    const selected = state.filters[key];
    const trigger = els[key].querySelector(".filter-trigger strong");
    if (trigger) trigger.textContent = filterSummary(selected.length);
    els[key].querySelectorAll("[data-value]").forEach((button) => {
      const value = button.dataset.value;
      button.classList.toggle("active", value ? state.filters[key].includes(value) : state.filters[key].length === 0);
    });
  }
}

function renderActiveTags() {
  const tags = [];
  for (const key of ["category", "itemTier", "stage", "survivor", "lock"]) {
    for (const value of orderedFilterValues(key, state.filters[key])) {
      tags.push({ key, value });
    }
  }
  if (!tags.length) {
    els.activeTags.innerHTML = "";
    return;
  }
  els.activeTags.innerHTML = tags.map((tag) => `
    <button type="button" class="active-tag" data-remove-filter="${esc(tag.key)}" data-remove-value="${esc(tag.value)}">
      <span>${esc(groupLabel(tag.key))}: ${esc(labelFor(tag.key, tag.value))}</span>
      <strong aria-hidden="true">x</strong>
    </button>
  `).join("");
  els.activeTags.querySelectorAll("[data-remove-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.removeFilter;
      const value = button.dataset.removeValue;
      state.filters[key] = state.filters[key].filter((item) => item !== value);
      render();
    });
  });
}

function closeFilterDropdowns() {
  document.querySelectorAll(".filter-dropdown.open").forEach((node) => node.classList.remove("open"));
}

function labelFor(group, value) {
  if (["stage", "survivor"].includes(group)) return entityLabel(value);
  const lookupGroup = group === "lock" ? "status" : group === "itemTier" ? "item_tier" : group;
  const entry = state.data.lookups?.[lookupGroup]?.[value];
  return entry?.[state.locale] || entry?.en || value;
}

function entityLabel(id) {
  const entity = state.data.entities?.[id];
  return entity?.name?.[state.locale] || entity?.name?.en || id;
}

function uiLabel(key) {
  const entry = uiLabels[key];
  return entry?.[state.locale] || entry?.en || key;
}

function orderedFilterValues(group, values) {
  const lookupGroup = group === "lock" ? "status" : group === "itemTier" ? "item_tier" : group;
  const configured = state.data.lookups?.order?.[group];
  const orderedValues = Array.isArray(configured) && configured.length
    ? configured
    : Object.keys(state.data.lookups?.[lookupGroup] || {});
  const order = Object.fromEntries(orderedValues.map((value, index) => [value, index]));
  return [...values].sort((a, b) => {
    const rankA = order[a] ?? Number.MAX_SAFE_INTEGER;
    const rankB = order[b] ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b, "en");
  });
}

function groupLabel(group) {
  const labels = {
    category: { en: "Category", "zh-Hans": "分类" },
    itemTier: { en: "Item Tier", "zh-Hans": "物品品级" },
    stage: { en: "Stage", "zh-Hans": "关卡" },
    survivor: { en: "Survivor", "zh-Hans": "幸存者" },
    lock: { en: "Status", "zh-Hans": "状态" },
  };
  return labels[group]?.[state.locale] || labels[group]?.en || group;
}

function filterSummary(count) {
  if (!count) return state.locale === "zh-Hans" ? "全部" : "all";
  return state.locale === "zh-Hans" ? `已选 ${count}` : `${count} selected`;
}

function loadProgressState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(progressKey) || "null");
    if (parsed && typeof parsed === "object") return normalizeProgressState(parsed);
  } catch {
    // Fall through to legacy migration.
  }

  const overrides = {};
  try {
    const legacy = JSON.parse(sessionStorage.getItem(reviewKey) || "{}");
    for (const [id, value] of Object.entries(legacy || {})) {
      if (value?.unlocked) overrides[id] = true;
    }
  } catch {
    // Ignore malformed legacy state.
  }
  const migrated = { snapshot: null, overrides };
  localStorage.setItem(progressKey, JSON.stringify(migrated));
  sessionStorage.removeItem(reviewKey);
  return migrated;
}

function normalizeProgressState(value) {
  const snapshot = value.snapshot && typeof value.snapshot === "object" ? {
    filename: String(value.snapshot.filename || "save.json"),
    importedAt: String(value.snapshot.importedAt || ""),
    fingerprint: String(value.snapshot.fingerprint || ""),
    unlockedIds: uniqueStrings(value.snapshot.unlockedIds),
    unresolvedIds: uniqueStrings(value.snapshot.unresolvedIds),
    total: Number(value.snapshot.total) || 0,
  } : null;
  const overrides = {};
  for (const [id, unlocked] of Object.entries(value.overrides || {})) {
    if (typeof unlocked === "boolean") overrides[id] = unlocked;
  }
  return { snapshot, overrides };
}

function sanitizeProgressState() {
  const ids = new Set(state.data.unlockables.map((row) => row.id));
  if (state.progress.snapshot) {
    state.progress.snapshot.unlockedIds = state.progress.snapshot.unlockedIds.filter((id) => ids.has(id));
    state.progress.snapshot.unresolvedIds = state.progress.snapshot.unresolvedIds.filter((id) => ids.has(id));
    state.progress.snapshot.total = state.data.unlockables.length;
  }
  state.progress.overrides = Object.fromEntries(Object.entries(state.progress.overrides).filter(([id]) => ids.has(id)));
  pruneProgressOverrides();
  saveProgressState();
}

function pruneProgressOverrides() {
  const imported = importedUnlockedSet();
  for (const [id, unlocked] of Object.entries(state.progress.overrides)) {
    if (unlocked === imported.has(id)) delete state.progress.overrides[id];
  }
}

function saveProgressState() {
  localStorage.setItem(progressKey, JSON.stringify(state.progress));
}

function importedUnlockedSet() {
  return new Set(state.progress.snapshot?.unlockedIds || []);
}

function defaultLocale() {
  const locales = state.data.locales || [];
  if (locales.includes(navigator.language)) return navigator.language;
  const languagePrefix = navigator.language.split("-")[0];
  return locales.find((locale) => locale.split("-")[0] === languagePrefix) || "en";
}

function loadUiState() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(uiStateKey) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function applyUiState(saved) {
  if (typeof saved.selectedId === "string") state.selectedId = saved.selectedId;
  if (state.data.locales?.includes(saved.locale)) state.locale = saved.locale;
  if (!saved.filters || typeof saved.filters !== "object") return;
  state.filters.q = typeof saved.filters.q === "string" ? saved.filters.q.trim().toLowerCase() : "";
  for (const key of ["category", "itemTier", "stage", "survivor", "lock"]) {
    if (Array.isArray(saved.filters[key])) state.filters[key] = unique(saved.filters[key]);
  }
}

function sanitizeUiState() {
  const values = filterValues();
  for (const key of ["category", "itemTier", "stage", "survivor", "lock"]) {
    const allowed = new Set(values[key]);
    state.filters[key] = state.filters[key].filter((value) => allowed.has(value));
  }
  if (!state.data.unlockables.some((row) => row.id === state.selectedId)) state.selectedId = null;
}

function saveUiState() {
  sessionStorage.setItem(uiStateKey, JSON.stringify({
    selectedId: state.selectedId,
    locale: state.locale,
    filters: state.filters,
  }));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function uniqueStrings(values) {
  return Array.isArray(values) ? [...new Set(values.filter((value) => typeof value === "string"))].sort() : [];
}

function countBy(rows, fn) {
  return rows.reduce((acc, row) => {
    const key = fn(row);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[ch]));
}

main().catch((error) => {
  document.body.innerHTML = `<pre>${esc(error.stack || error.message)}</pre>`;
});
