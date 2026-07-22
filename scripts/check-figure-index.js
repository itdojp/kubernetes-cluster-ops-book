#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const APPENDIX_ID = 'appendix-d';
const APPENDIX_ROUTE = '/appendices/appendix-d/';
const APPENDIX_DESCRIPTION = '全13章で公開する14点のP0 visual evidenceと確認観点';
const EXPECTED = [
  ['ch00-change-record', 'chapter00', 'ch00-change-record-gate-01.png', 'figure-ch00-change-record-gate-01', 'figure-index-ch00-change-record-gate-01'],
  ['ch01-cluster-inventory', 'chapter01', 'ch01-cluster-inventory-01.png', 'figure-ch01-cluster-inventory-01', 'figure-index-ch01-cluster-inventory-01'],
  ['ch02-control-plane-readyz', 'chapter02', 'ch02-control-plane-readyz-01.png', 'figure-ch02-control-plane-readyz-01', 'figure-index-ch02-control-plane-readyz-01'],
  ['ch03-etcd-snapshot-status', 'chapter03', 'ch03-etcd-snapshot-status-01.png', 'figure-ch03-etcd-snapshot-status-01', 'figure-index-ch03-etcd-snapshot-status-01'],
  ['ch04-node-conditions', 'chapter04', 'ch04-node-conditions-01.png', 'figure-ch04-node-conditions-01', 'figure-index-ch04-node-conditions-01'],
  ['ch05-dns-service', 'chapter05', 'ch05-dns-service-check-01.png', 'figure-ch05-dns-service-check-01', 'figure-index-ch05-dns-service-check-01'],
  ['ch06-storage-pvc', 'chapter06', 'ch06-storage-pvc-check-01.png', 'figure-ch06-storage-pvc-check-01', 'figure-index-ch06-storage-pvc-check-01'],
  ['ch07-rbac-can-i', 'chapter07', 'ch07-rbac-can-i-01.png', 'figure-ch07-rbac-can-i', 'figure-index-ch07-rbac-can-i'],
  ['ch07-pss-namespace-label', 'chapter07', 'ch07-pss-namespace-label-02.png', 'figure-ch07-pss-namespace-label', 'figure-index-ch07-pss-namespace-label'],
  ['ch08-quota-limitrange', 'chapter08', 'ch08-quota-limitrange-01.png', 'figure-ch08-quota-limitrange-01', 'figure-index-ch08-quota-limitrange-01'],
  ['ch09-apiserver-metrics', 'chapter09', 'ch09-apiserver-metrics-01.png', 'figure-ch09-apiserver-metrics-01', 'figure-index-ch09-apiserver-metrics-01'],
  ['ch10-version-skew', 'chapter10', 'ch10-version-skew-inventory-01.png', 'figure-ch10-version-skew-inventory-01', 'figure-index-ch10-version-skew-inventory-01'],
  ['ch11-service-recovery', 'chapter11', 'ch11-service-recovery-01.png', 'figure-ch11-service-recovery-01', 'figure-index-ch11-service-recovery-01'],
  ['ch12-policy-gate', 'chapter12', 'ch12-policy-gate-01.png', 'figure-ch12-policy-gate-01', 'figure-index-ch12-policy-gate-01'],
];

function fail(message) { throw new Error(`figure-index contract: ${message}`); }
function assert(condition, message) { if (!condition) fail(message); }
function read(relativePath) { return fs.readFileSync(path.join(ROOT, relativePath), 'utf8'); }
function count(text, value) { return text.split(value).length - 1; }
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function stripFrontMatter(markdown) {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? markdown.slice(match[0].length) : markdown;
}
function collectFiles(relativeDirectory) {
  const directory = path.join(ROOT, relativeDirectory);
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}
function pngReferences(markdown) {
  return [...markdown.matchAll(/!\[([^\]]*)\]\(([^)]+\.png)(?:#[^)]+)?\)/g)].map((match) => ({ alt: match[1], target: match[2] }));
}
function chapterTitle(chapter) {
  return read(`src/chapters/${chapter}/index.md`).split(/\r?\n/, 1)[0].replace(/^#\s+/, '');
}

function checkConfiguration(config) {
  assert(config.ux?.modules?.figureIndex === true, 'ux.modules.figureIndex must remain true');
  const appendices = config.structure?.appendices;
  assert(Array.isArray(appendices), 'structure.appendices must be configured');
  const matches = appendices.filter((entry) => entry.id === APPENDIX_ID);
  assert(matches.length === 1, 'Appendix D must be configured exactly once');
  const appendix = matches[0];
  assert(appendix.title === '付録D：図表索引', 'Appendix D title must remain reader-facing');
  assert(appendix.description === APPENDIX_DESCRIPTION, 'Appendix D description must identify the 13-chapter/14-figure inventory');
  assert(appendix.order === 18 && appendix.srcPath === 'src/appendices/appendix-d/index.md' && appendix.docsPath === 'docs/appendices/appendix-d/index.md' && appendix.navPath === APPENDIX_ROUTE, 'Appendix D route/order/source/generated paths must remain stable');
  const appendixCIndex = appendices.findIndex((entry) => entry.id === 'appendix-c');
  const appendixDIndex = appendices.findIndex((entry) => entry.id === APPENDIX_ID);
  assert(appendixCIndex >= 0 && appendixDIndex === appendixCIndex + 1, 'Appendix D must immediately follow Appendix C');
  assert(config.structure?.afterword?.order === 19, 'afterword must immediately follow Appendix D');
  const formatter = JSON.parse(read('book-formatter-config.json'));
  assert(JSON.stringify(formatter.ux) === JSON.stringify(config.ux), 'formatter ux must match book-config.json');
  assert(JSON.stringify(formatter.structure) === JSON.stringify(config.structure), 'formatter structure must match book-config.json');
}

function checkManifest() {
  const manifest = JSON.parse(read('src/assets/visual-evidence/manifest.json'));
  assert(manifest.issue === 16 && Array.isArray(manifest.entries), 'Issue 16 manifest must be available');
  assert(manifest.entries.length === EXPECTED.length, `manifest must contain exactly ${EXPECTED.length} entries`);
  manifest.entries.forEach((entry, index) => {
    const expected = EXPECTED[index];
    assert(expected && [entry.id, entry.chapter, path.basename(entry.file), entry.anchor, entry.indexAnchor].every((value, position) => value === expected[position]), `manifest entry ${index + 1} differs from the fixed inventory/order`);
    assert(entry.alt && entry.indexPurpose && entry.indexInspection, `${entry.id || index}: figure index metadata is incomplete`);
  });
  return manifest.entries;
}

function checkChapterInventory(entries) {
  const actualReferences = [];
  const sourceMarkdown = collectFiles('src').filter((file) => file.endsWith('.md')).sort();
  const docsMarkdown = collectFiles('docs').filter((file) => file.endsWith('.md')).sort();
  for (const file of sourceMarkdown) {
    for (const reference of pngReferences(read(file))) {
      actualReferences.push(path.posix.normalize(path.posix.join(path.posix.dirname(file.replace(/^src\//, '')), reference.target)));
    }
  }
  const expectedReferences = entries.map((entry) => entry.file.replace(/^src\//, ''));
  assert(JSON.stringify(actualReferences) === JSON.stringify(expectedReferences), `source markdown PNG references must be the exact fixed inventory/order; got ${JSON.stringify(actualReferences)}`);

  const sourceAssets = collectFiles('src').filter((file) => file.toLowerCase().endsWith('.png')).sort();
  const expectedAssets = entries.map((entry) => entry.file).sort();
  assert(JSON.stringify(sourceAssets) === JSON.stringify(expectedAssets), `source PNG assets must be one-to-one with the manifest; got ${JSON.stringify(sourceAssets)}`);

  const sourceAll = sourceMarkdown.map(read).join('\n');
  const docsAll = docsMarkdown.map(read).join('\n');
  for (const entry of entries) {
    const filename = path.basename(entry.file);
    const sourceChapter = read(`src/chapters/${entry.chapter}/index.md`).replace(/\r\n/g, '\n');
    const docsChapter = read(`docs/chapters/${entry.chapter}/index.md`).replace(/\r\n/g, '\n');
    const marker = `![${entry.alt}](./images/${filename})`;
    const anchorPattern = new RegExp(`^### .+ \\{#${escapeRegExp(entry.anchor)}\\}\\n\\n${escapeRegExp(marker)}$`, 'm');
    assert(anchorPattern.test(sourceChapter), `${entry.id}: canonical stable anchor must immediately precede the image`);
    assert(anchorPattern.test(stripFrontMatter(docsChapter)), `${entry.id}: generated stable anchor must immediately precede the image`);
    assert(count(sourceAll, `{#${entry.anchor}}`) === 1, `${entry.id}: canonical figure anchor must be globally unique`);
    assert(count(docsAll, `{#${entry.anchor}}`) === 1, `${entry.id}: generated figure anchor must be globally unique`);
    const docsAsset = entry.docsFile;
    assert(fs.existsSync(path.join(ROOT, docsAsset)), `${entry.id}: generated PNG is missing`);
    assert(fs.readFileSync(path.join(ROOT, entry.file)).equals(fs.readFileSync(path.join(ROOT, docsAsset))), `${entry.id}: generated PNG differs from canonical source`);
  }
}

function checkIndex(entries) {
  const source = read('src/appendices/appendix-d/index.md').replace(/\r\n/g, '\n');
  const docs = stripFrontMatter(read('docs/appendices/appendix-d/index.md')).replace(/\r\n/g, '\n');
  assert(docs === source, 'generated Appendix D body must exactly match canonical source');
  assert(pngReferences(source).length === 0, 'Appendix D must link to figures instead of embedding duplicate images');
  assert(source.includes('実際に参照している14点') && source.includes('合成したoperational stateではありません'), 'Appendix D must state scope and authenticity');
  const headings = [...source.matchAll(/^### 図D-(\d{2})：(.+) \{#([^}]+)\}$/gm)];
  assert(headings.length === entries.length, `Appendix D must contain exactly ${entries.length} indexed entries`);
  headings.forEach((heading, index) => {
    const entry = entries[index];
    const number = String(index + 1).padStart(2, '0');
    assert(heading[1] === number && heading[2] === entry.alt && heading[3] === entry.indexAnchor, `${entry.id}: index number/title/anchor must match the manifest`);
    const end = index + 1 < headings.length ? headings[index + 1].index : source.length;
    const section = source.slice(heading.index, end);
    const title = chapterTitle(entry.chapter);
    assert(section.includes(`- **章**: [${title}](../../chapters/${entry.chapter}/)`), `${entry.id}: index chapter link is missing`);
    assert(section.includes(`- **本文**: [図を開く](../../chapters/${entry.chapter}/#${entry.anchor})`), `${entry.id}: direct figure link is missing`);
    assert(section.includes(`- **ファイル**: \`${path.basename(entry.file)}\``), `${entry.id}: filename is missing`);
    assert(section.includes(`- **目的**: ${entry.indexPurpose}`), `${entry.id}: purpose differs from the manifest`);
    assert(section.includes(`- **確認の観点**: ${entry.indexInspection}`), `${entry.id}: inspection guidance differs from the manifest`);
    assert(count(source, `{#${entry.indexAnchor}}`) === 1, `${entry.id}: index anchor must be unique`);
    assert(source.slice(0, heading.index).lastIndexOf(`## ${title}`) >= 0, `${entry.id}: entry must be under its chapter heading`);
  });
}

function checkReaderNavigation() {
  const topLink = '[付録D：図表索引](appendices/appendix-d/)';
  assert(read('src/index.md').includes(topLink), 'canonical top page must link to Appendix D');
  assert(read('docs/index.md').includes(topLink), 'generated top page must link to Appendix D');
  const navigation = read('docs/_data/navigation.yml');
  const appendixC = '  - title: "付録C：参考リンク集"\n    path: "/appendices/appendix-c/"';
  const appendixD = '  - title: "付録D：図表索引"\n    path: "/appendices/appendix-d/"';
  assert(count(navigation, appendixD) === 1, 'sidebar must contain Appendix D exactly once');
  assert(navigation.indexOf(appendixC) < navigation.indexOf(appendixD), 'sidebar must place Appendix D after Appendix C');
}

function main() {
  const config = JSON.parse(read('book-config.json'));
  checkConfiguration(config);
  const entries = checkManifest();
  checkChapterInventory(entries);
  checkIndex(entries);
  checkReaderNavigation();
  console.log(`✅ Figure index contract passed: ${entries.length} referenced PNGs, stable anchors, direct links, navigation, and src/docs generation verified.`);
}

try { main(); } catch (error) { console.error(`❌ ${error.message}`); process.exit(1); }
