const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..", "public", "national-tools", "rivers");
const personId = "https://chrisizworski.com/#person";
const personUrl = "https://chrisizworski.com/";

function pageFiles() {
  const pages = [path.join(root, "index.html")];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const page = path.join(root, entry.name, "index.html");
    if (fs.existsSync(page)) pages.push(page);
  }
  return pages;
}

function walk(value, visit) {
  if (!value || typeof value !== "object") return;
  visit(value);
  if (Array.isArray(value)) value.forEach((item) => walk(item, visit));
  else Object.values(value).forEach((item) => walk(item, visit));
}

function jsonLd(html, file) {
  const blocks = [...html.matchAll(/<script\\b[^>]*type=["']application\\/ld\\+json["'][^>]*>([\\s\\S]*?)<\\/script>/gi)];
  assert.ok(blocks.length > 0, `${file}: expected JSON-LD`);
  return blocks.map((match) => {
    try {
      return JSON.parse(match[1]);
    } catch (error) {
      assert.fail(`${file}: invalid JSON-LD: ${error.message}`);
    }
  });
}

test("river hub and generated location pages publish the canonical Person entity", () => {
  const pages = pageFiles();
  assert.equal(pages.length, 9, "expected the hub and all eight generated location pages");

  for (const file of pages) {
    const html = fs.readFileSync(file, "utf8");
    const nodes = [];
    for (const block of jsonLd(html, file)) walk(block, (node) => nodes.push(node));

    assert.ok(
      nodes.some((node) => {
        const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
        return types.includes("Person")
          && node["@id"] === personId
          && node.name === "Chris Izworski"
          && node.url === personUrl;
      }),
      `${file}: must define the full canonical Chris Person`,
    );

    const publishingNodes = nodes.filter((node) => {
      const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      return types.includes("WebSite") || types.includes("SoftwareApplication");
    });
    assert.ok(publishingNodes.length > 0, `${file}: expected primary publishing schema`);

    for (const node of publishingNodes) {
      const types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
      assert.equal(
        (node.author || node.creator)?.["@id"],
        personId,
        `${file}: ${types.join("/")} must reference Chris as author or creator`,
      );
      assert.equal(
        node.publisher?.["@id"],
        personId,
        `${file}: ${types.join("/")} must publish under the canonical Person`,
      );
    }
  }
});
