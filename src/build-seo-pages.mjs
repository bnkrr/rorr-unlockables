import fs from "node:fs";
import path from "node:path";
import { loadUnlockables, ROOT } from "./load.mjs";
import { textReferenceParts } from "./text-references.mjs";

const SITE_ORIGIN = "https://rorr-unlockables.github.io";
const OUTPUT_DIR = path.join(ROOT, "dist");
const rows = await loadUnlockables();
const entities = rows.entities;
const byTarget = new Map(rows.map((row) => [row.target, row]));

for (const row of rows) {
  const outputPath = path.join(OUTPUT_DIR, entryPath(row), "index.html");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderPage(row));
}

fs.writeFileSync(path.join(OUTPUT_DIR, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUTPUT_DIR, "sitemap.xml"), renderSitemap(rows));
console.log(`Wrote ${rows.length} static entry pages, sitemap.xml, and robots.txt`);

function renderPage(row) {
  const en = { ...row.sourceText.en, name: row.text.en.name };
  const zh = { ...row.sourceText["zh-Hans"], name: row.text["zh-Hans"].name };
  const canonical = absoluteUrl(entryPath(row));
  const title = `${en.name} unlock guide | RoRR Unlockables`;
  const description = truncate(plainText(en.summary, "en") || `How to unlock ${en.name} in Risk of Rain Returns.`);
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: en.name,
    description,
    url: canonical,
    inLanguage: ["en", "zh-Hans"],
    isPartOf: {
      "@type": "WebSite",
      name: "RoRR Unlockables",
      url: `${SITE_ORIGIN}/`,
    },
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="${esc(description)}" />
    <meta name="robots" content="index,follow" />
    <link rel="canonical" href="${esc(canonical)}" />
    <link rel="icon" type="image/png" href="/icons/Artifact_of_Origin_Select.png" />
    <meta property="og:type" content="article" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${esc(canonical)}" />
    <title>${esc(title)}</title>
    <script type="application/ld+json">${jsonLd}</script>
    <style>
      :root { color-scheme: light; font-family: Inter, system-ui, sans-serif; color: #182432; background: #f5f7fa; }
      body { margin: 0; }
      main { max-width: 780px; margin: 0 auto; padding: 32px 20px 56px; }
      a { color: #155f90; text-underline-offset: 2px; }
      .back, .eyebrow { font-size: 14px; font-weight: 700; }
      article { margin-top: 22px; padding: 28px; border: 1px solid #d7e0e8; border-radius: 8px; background: #fff; }
      h1 { margin: 0; font-size: clamp(28px, 6vw, 42px); line-height: 1.08; }
      h2 { margin-top: 28px; font-size: 20px; }
      .translation { color: #586777; margin: 8px 0 22px; }
      .summary { color: #283b4d; font-size: 18px; line-height: 1.6; }
      .section { margin-top: 26px; }
      ul, ol { padding-left: 22px; line-height: 1.6; }
      .meta { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 0; }
      .meta span { padding: 5px 8px; border-radius: 999px; background: #edf2f6; color: #425466; font-size: 13px; font-weight: 700; }
      .zh { margin-top: 36px; padding-top: 26px; border-top: 1px solid #dfe6ed; }
      .source { color: #637384; font-size: 14px; }
      footer { margin-top: 20px; color: #637384; font-size: 14px; }
    </style>
  </head>
  <body>
    <main>
      <a class="back" href="/">Browse all unlockables</a>
      <article>
        <div class="eyebrow">${esc(categoryLabel(row.category))}</div>
        <h1>${esc(en.name || row.target)}</h1>
        <p class="translation">${esc(zh.name || "")}</p>
        <p class="summary">${renderText(en.summary, "en", row.target)}</p>
        ${renderDetails(row, en, "en")}
        ${renderSources(row)}
        <section class="zh" lang="zh-Hans">
          <div class="eyebrow">${esc(categoryLabel(row.category))}</div>
          <h2>${esc(zh.name || row.target)}</h2>
          <p class="summary">${renderText(zh.summary, "zh-Hans", row.target)}</p>
          ${renderDetails(row, zh, "zh-Hans")}
        </section>
        <div class="meta"><span>${esc(row.target)}</span>${row.achievement_id ? `<span>${esc(row.achievement_id)}</span>` : ""}</div>
      </article>
      <footer>Community-maintained Risk of Rain Returns unlock routes.</footer>
    </main>
  </body>
</html>`;
}

function renderDetails(row, text, locale) {
  const sections = [];
  if (text.location) sections.push(`<section class="section"><h2>${locale === "en" ? "Location" : "地点"}</h2><p>${renderText(text.location, locale, row.target)}</p></section>`);
  if (text.steps.length) sections.push(`<section class="section"><h2>${locale === "en" ? "Steps" : "步骤"}</h2><ol>${text.steps.map((step) => `<li>${renderText(step, locale, row.target)}</li>`).join("")}</ol></section>`);
  if (text.notes.length) sections.push(`<section class="section"><h2>${locale === "en" ? "Notes" : "说明"}</h2><ul>${text.notes.map((note) => `<li>${renderText(note, locale, row.target)}</li>`).join("")}</ul></section>`);
  if (row.stage.length) sections.push(`<section class="section"><h2>${locale === "en" ? "Stages" : "关卡"}</h2><ul>${row.stage.map((stage) => `<li>${renderEntity(stage.id, locale, null, row.target)}${stage.variants.length ? ` (${locale === "en" ? "variant" : "变体"} ${esc(stage.variants.join(", "))})` : ""}</li>`).join("")}</ul></section>`);
  return sections.join("");
}

function renderSources(row) {
  if (!row.source.length) return "";
  return `<section class="section"><h2>Sources</h2><ul>${row.source.map((source) => {
    const label = source.label || source.type || "Source";
    return source.url ? `<li><a href="${esc(source.url)}" rel="noreferrer">${esc(label)}</a></li>` : `<li class="source">${esc(label)}</li>`;
  }).join("")}</ul></section>`;
}

function renderText(value, locale, currentTarget) {
  return textReferenceParts(value, entities, locale).map((part) => part.entity ? renderEntity(part.entity, locale, part.label, currentTarget) : esc(part.text)).join("");
}

function plainText(value, locale) {
  return textReferenceParts(value, entities, locale).map((part) => part.label || part.text).join("");
}

function renderEntity(id, locale, label = null, currentTarget = null) {
  const entity = entities.get(id);
  const text = label || entity?.name?.[locale] || entity?.name?.en || id;
  const target = byTarget.get(id);
  if (target && target.target !== currentTarget) return `<a href="${esc(entryPath(target))}">${esc(text)}</a>`;
  if (entity?.url) return `<a href="${esc(entity.url)}" rel="noreferrer">${esc(text)}</a>`;
  return esc(text);
}

function renderSitemap(rows) {
  const urls = ["/", ...rows.map(entryPath)].sort();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((url) => `  <url><loc>${escXml(absoluteUrl(url))}</loc></url>`).join("\n")}\n</urlset>\n`;
}

function entryPath(row) {
  return `/${row.filePath.replace(/\.toml$/, "")}/`;
}

function absoluteUrl(value) {
  return `${SITE_ORIGIN}${value}`;
}

function categoryLabel(category) {
  return category.replace(/_/g, " ");
}

function truncate(value, limit = 160) {
  return value.length <= limit ? value : `${value.slice(0, limit - 3).trimEnd()}...`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function escXml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]);
}
