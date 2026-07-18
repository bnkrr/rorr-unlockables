import "./style.css";

const state = {
  data: null,
  audit: null,
  selectedId: null,
  review: {},
  filters: {
    q: "",
    category: [],
    stage: [],
    survivor: [],
    lock: [],
  },
  locale: "en",
};

const reviewKey = "rorr-unlockables-review:v1";
const uiStateKey = "rorr-unlockables-ui:v1";
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
};

const els = {
  auditBadge: document.querySelector("#auditBadge"),
  locale: document.querySelector("#locale"),
  search: document.querySelector("#search"),
  category: document.querySelector("#category"),
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
  state.review = loadReview();
  applyUiState(loadUiState());
  sanitizeUiState();
  if (migrateLegacyFragment()) return;
  applyEntryPath();
  state.selectedId ||= data.unlockables[0]?.id || null;
  renderLocaleSwitch();
  els.search.value = state.filters.q;
  bindFilters();
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

function render() {
  renderLocaleSwitch();
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
        <small>${esc(labelFor("category", row.category))}${row.achievement_id ? " · achievement" : ""}${survivorFacet(row).length ? ` · ${esc(survivorFacet(row).map((id) => labelFor("survivor", id)).join(", "))}` : ""}${row.needs_detail ? " · needs detail" : ""}</small>
      </button>
      <button class="row-lock ${reviewState(row).unlocked ? "active" : ""}" type="button" data-lock="${esc(row.id)}">${esc(reviewState(row).unlocked ? labelFor("lock", "unlocked") : labelFor("lock", "locked"))}</button>
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
      <span>${esc(labelFor("category", row.category))}</span>
    </div>
    <p class="summary-text">${renderTextParts(textParts.summary, row.target)}</p>
    ${renderTags(row)}
    ${renderStages(row)}
    ${renderNotes(text, textParts, row.target)}
    ${renderSteps(text, textParts, row.target)}
    ${renderSources(row)}
    <dl>
      <div><dt>Action</dt><dd>${esc(row.action)}</dd></div>
      <div><dt>Achievement</dt><dd>${row.achievement_id ? esc(row.achievement_id) : "no"}</dd></div>
      <div><dt>Priority</dt><dd>${row.priority}</dd></div>
      <div><dt>Opportunity</dt><dd>${row.opportunity_boost}</dd></div>
      <div><dt>Effort</dt><dd>${row.effort}</dd></div>
      <div><dt>Risk</dt><dd>${row.risk}</dd></div>
      <div><dt>Quality</dt><dd>${esc(row.precision)} / ${esc(row.confidence)}</dd></div>
      ${text.location ? `<div><dt>Location</dt><dd>${renderTextParts(textParts.location, row.target)}</dd></div>` : ""}
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
  return `<div class="tags">${tags.map((tag) => `<span>${esc(tag.type)}:${renderEntityReference(tag.value, row.target)}</span>`).join("")}</div>`;
}

function rootAssetPath(value) {
  return `/${String(value).replace(/^\.?\//, "")}`;
}

function renderStages(row) {
  if (!row.stage.length) return "";
  return `<section><h3>Stages</h3><ul>${row.stage.map((stage) => `
    <li>${renderEntityReference(stage.id, row.target)} ${stage.variants.length ? `variant ${esc(stage.variants.join(", "))}` : ""} <small>${esc(stage.role)}</small></li>
  `).join("")}</ul></section>`;
}

function renderNotes(text, parts, currentTarget) {
  if (!text.notes.length) return "";
  return `<section><h3>Notes</h3><ul>${text.notes.map((note, index) => `<li>${renderTextParts(parts.notes[index], currentTarget, note)}</li>`).join("")}</ul></section>`;
}

function renderSteps(text, parts, currentTarget) {
  if (!text.steps.length) return "";
  return `<section><h3>Steps</h3><ol>${text.steps.map((step, index) => `<li>${renderTextParts(parts.steps[index], currentTarget, step)}</li>`).join("")}</ol></section>`;
}

function renderSources(row) {
  if (!row.source.length) return "";
  return `<section><h3>Sources</h3><ul>${row.source.map((source) => `
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

function filteredRows() {
  return state.data.unlockables.filter((row) => {
    const q = state.filters.q;
    if (q && !searchText(row).includes(q)) return false;
    if (!matchesAny(state.filters.category, [row.category])) return false;
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

function renderTextParts(parts, currentTarget, fallback = "") {
  if (!Array.isArray(parts) || parts.length === 0) return esc(fallback);
  return parts.map((part) => part.entity
    ? renderEntityReference(part.entity, currentTarget, part.label)
    : esc(part.text)
  ).join("");
}

function renderEntityReference(entityId, currentTarget, label = entityLabel(entityId)) {
  const target = state.data.unlockables.find((row) => row.target === entityId);
  if (target) {
    if (target.target === currentTarget) return esc(label);
    return `<a class="entity-link" href="${esc(entryUrl(target))}">${esc(label)}</a>`;
  }
  const url = state.data.entities?.[entityId]?.url;
  if (url) return `<a class="entity-link" href="${esc(url)}" target="_blank" rel="noreferrer">${esc(label)}</a>`;
  return esc(label);
}

function searchText(row) {
  const parts = [row.id, row.category, row.target, row.icon, row.achievement_id];
  parts.push(labelFor("category", row.category), ...row.stage.map((stage) => labelFor("stage", stage.id)), ...survivorFacet(row), ...survivorFacet(row).map((id) => labelFor("survivor", id)));
  const references = [...(row.hard?.survivors || []), ...(row.hard?.artifacts || []), ...(row.soft?.survivors || []), ...(row.soft?.items || [])];
  parts.push(...references, ...references.map(entityLabel));
  for (const text of Object.values(row.text || {})) {
    parts.push(text.name, text.summary, text.location, ...(text.steps || []), ...(text.notes || []));
  }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function reviewState(row) {
  return { unlocked: Boolean(state.review[row.id]?.unlocked) };
}

function survivorFacet(row) {
  return Array.isArray(row.facets?.survivors) ? row.facets.survivors : [];
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
  if (reviewState(row).unlocked) delete state.review[id];
  else state.review[id] = { unlocked: true };
  saveReview();
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
  state.filters = { q: "", category: [], stage: [], survivor: [], lock: [] };
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
    stage: unique(state.data.unlockables.flatMap((row) => row.stage.map((stage) => stage.id))),
    survivor: unique(state.data.unlockables.flatMap(survivorFacet)),
    lock: ["locked", "unlocked"],
  };
}

function renderAllFilterDropdowns() {
  const values = filterValues();
  for (const key of ["category", "stage", "survivor", "lock"]) {
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
  for (const key of ["category", "stage", "survivor", "lock"]) {
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
  for (const key of ["category", "stage", "survivor", "lock"]) {
    for (const value of state.filters[key]) {
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
  const lookupGroup = group === "lock" ? "status" : group;
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
  const lookupGroup = group === "lock" ? "status" : group;
  const order = Object.fromEntries(Object.keys(state.data.lookups?.[lookupGroup] || {}).map((value, index) => [value, index]));
  return [...values].sort((a, b) => {
    const rankA = order[a] ?? Number.MAX_SAFE_INTEGER;
    const rankB = order[b] ?? Number.MAX_SAFE_INTEGER;
    if (rankA !== rankB) return rankA - rankB;
    return labelFor(group, a).localeCompare(labelFor(group, b));
  });
}

function groupLabel(group) {
  const labels = {
    category: { en: "Category", "zh-Hans": "分类" },
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

function loadReview() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(reviewKey) || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveReview() {
  sessionStorage.setItem(reviewKey, JSON.stringify(state.review));
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
  for (const key of ["category", "stage", "survivor", "lock"]) {
    if (Array.isArray(saved.filters[key])) state.filters[key] = unique(saved.filters[key]);
  }
}

function sanitizeUiState() {
  const values = filterValues();
  for (const key of ["category", "stage", "survivor", "lock"]) {
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
