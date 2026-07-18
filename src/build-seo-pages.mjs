import fs from "node:fs";
import path from "node:path";
import { loadUnlockables, ROOT } from "./load.mjs";

const SITE_ORIGIN = "https://rorr-unlockables.github.io";
const OUTPUT_DIR = path.join(ROOT, "dist");
const rows = await loadUnlockables();
const appShell = fs.readFileSync(path.join(OUTPUT_DIR, "index.html"), "utf8");

for (const row of rows) {
  const outputPath = path.join(OUTPUT_DIR, entryPath(row), "index.html");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, renderPage(row));
}

fs.writeFileSync(path.join(OUTPUT_DIR, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUTPUT_DIR, "sitemap.xml"), renderSitemap(rows));
console.log(`Wrote ${rows.length} static entry pages, sitemap.xml, and robots.txt`);

function renderPage(row) {
  const en = row.text.en;
  const canonical = absoluteUrl(entryPath(row));
  const title = `${en.name} unlock guide | RoRR Unlockables`;
  const description = truncate(stripMarkup(en.summary) || `How to unlock ${en.name} in Risk of Rain Returns.`);
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

  return appShell
    .replaceAll('href="./icons/', 'href="/icons/')
    .replaceAll('href="./assets/', 'href="/assets/')
    .replaceAll('src="./assets/', 'src="/assets/')
    .replace(/<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escapeHtml(canonical)}" />`)
    .replace(/<meta property="og:type" content="[^"]*" \/>/, '<meta property="og:type" content="article" />')
    .replace(/<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(canonical)}" />`)
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, `<script type="application/ld+json">${jsonLd}</script>`);
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

function truncate(value, limit = 160) {
  return value.length <= limit ? value : `${value.slice(0, limit - 3).trimEnd()}...`;
}

function stripMarkup(value) {
  return String(value || "").replace(/<[^>]*>/g, "");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
}

function escXml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]);
}
