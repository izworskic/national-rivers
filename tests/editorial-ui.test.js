const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "public/national-tools/rivers/index.html"), "utf8");

test("uses the editorial national-tool shell without changing the tool contract", () => {
  assert.match(html, /data-editorial-tool-ui="2026-09"/);
  assert.match(html, /id="editorial-tool-ui"/);
  assert.match(html, /class="breadcrumb"/);
  assert.match(html, /<a href="\/">Home<\/a>/);
  assert.match(html, /<a href="\/tools\/">Michigan Tools<\/a>/);
  assert.match(html, /<a href="\/national-tools\/" aria-current="page">U\.S\. Outdoor Tools<\/a>/);
  assert.match(html, /<form id="loc"/);
  assert.match(html, /id="result"/);
  assert.match(html, /national-tools\.js/);
  assert.match(html, /<link rel="canonical" href="https://chrisizworski\.com/national-tools/rivers/">/);
});

test("editorial override keeps the quiet Michigan-style visual language", () => {
  const start = html.indexOf('<style id="editorial-tool-ui">');
  const end = html.indexOf("</style>", start);
  assert.ok(start >= 0 && end > start);
  const css = html.slice(start, end);
  assert.match(css, /--editorial-paper:#f8f6f1/);
  assert.match(css, /--editorial-green:#2c5f2d/);
  assert.match(css, /font-family:Georgia/);
  assert.match(css, /box-shadow:none/);
  assert.doesNotMatch(css, /linear-gradient|radial-gradient/);
});
