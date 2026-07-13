#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function findRepoRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (fs.existsSync(path.join(current, 'book-config.json')) && fs.existsSync(path.join(current, 'package.json'))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error('Repository root with book-config.json and package.json was not found.');
    }
    current = parent;
  }
}

const repoRoot = findRepoRoot(process.cwd());
const errors = [];

const figureIndex = {
  route: '/appendices/appendix-d/',
  entry: {
    id: 'appendix-d',
    title: '付録D：図表索引',
    description: '第7章で公開している PNG 図版の用途と確認観点',
    order: 18,
    srcPath: 'src/appendices/appendix-d/index.md',
    docsPath: 'docs/appendices/appendix-d/index.md',
    navPath: '/appendices/appendix-d/',
  },
  chapter: {
    title: '第7章：認証・認可と基本セキュリティ',
    srcPath: 'src/chapters/chapter07/index.md',
    docsPath: 'docs/chapters/chapter07/index.md',
    route: '/chapters/chapter07/',
  },
  figures: [
    {
      indexAnchor: 'figure-index-ch07-rbac-can-i',
      anchor: 'figure-ch07-rbac-can-i',
      indexHeading: '図7-1：RBAC の最小権限チェック（例）',
      alt: 'RBAC の最小権限チェック（例）',
      sourcePath: './images/ch07-rbac-can-i-01.png',
      purpose: 'ServiceAccount に付与した Role と RoleBinding が、必要な `list pods` だけを許可する最小権限になっていることを確認する例です。',
      inspection: '`kubectl auth can-i list pods` が `yes` になることに加え、許可していない操作が `no` になることを確認します。対象 namespace、ServiceAccount、API リソース、verb が意図した範囲に限定されているかを本文の RBAC 定義と照合してください。',
    },
    {
      indexAnchor: 'figure-index-ch07-pss-namespace-label',
      anchor: 'figure-ch07-pss-namespace-label',
      indexHeading: '図7-2：PSS の適用（例）',
      alt: 'PSS の適用（例）',
      sourcePath: './images/ch07-pss-namespace-label-02.png',
      purpose: 'tenant namespace に Pod Security Admission の `restricted` プロファイルを適用するラベル設定例を確認します。',
      inspection: '`pod-security.kubernetes.io/enforce`、`warn` と各 `*-version` ラベルが対象 namespace に付与されていること、`--overwrite` による更新対象が意図どおりであることを確認します。例外 namespace は本文の方針どおり根拠・期限・代替策とともに管理してください。',
    },
  ],
};

function addError(message) {
  errors.push(message);
}

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function collectFiles(relDir) {
  const files = [];
  for (const entry of fs.readdirSync(path.join(repoRoot, relDir), { withFileTypes: true })) {
    const relPath = path.posix.join(relDir, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(relPath));
    else files.push(relPath);
  }
  return files;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    addError(`${label} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertArrayEqual(actual, expected, label) {
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    addError(`${label} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertContains(text, expected, label) {
  if (!text.includes(expected)) {
    addError(`${label} does not contain ${JSON.stringify(expected)}`);
  }
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripFrontMatter(markdown) {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? markdown.slice(match[0].length) : markdown;
}

function markdownImageReferences(markdown) {
  const references = [];
  const pattern = /!\[([^\]]*)\]\(([^)\s]+\.png)\)/g;
  let match;
  while ((match = pattern.exec(markdown)) !== null) {
    references.push({ alt: match[1], sourcePath: match[2], index: match.index });
  }
  return references;
}

function explicitAnchors(markdown) {
  return Array.from(markdown.matchAll(/\{#([A-Za-z0-9_-]+)\}/g), (match) => match[1]);
}

function validateUniqueAnchors(markdown, label) {
  const seen = new Set();
  for (const anchor of explicitAnchors(markdown)) {
    if (seen.has(anchor)) addError(`${label} has a duplicate explicit anchor: ${anchor}`);
    seen.add(anchor);
  }
}

function validateFigureAnchorPrecedesImage(markdown, reference, figure, label) {
  const preceding = markdown.slice(0, reference.index);
  const anchorAtEnd = new RegExp(`(?:^|\\n)#{1,6}[^\\n]*\\{#${escapeRegExp(figure.anchor)}\\}\\s*\\n\\s*$`);
  if (!anchorAtEnd.test(preceding)) {
    addError(`${label} must place stable anchor ${figure.anchor} immediately before ${figure.sourcePath}`);
  }
}

function validateConfig(config) {
  assertEqual(config.ux && config.ux.modules && config.ux.modules.figureIndex, true, 'book-config.json ux.modules.figureIndex');

  const appendices = (config.structure && config.structure.appendices) || [];
  const matchingEntries = appendices.filter((entry) => entry.navPath === figureIndex.route);
  assertEqual(matchingEntries.length, 1, 'book-config.json figure index route count');
  const entry = matchingEntries[0];
  if (!entry) return;

  for (const [key, expected] of Object.entries(figureIndex.entry)) {
    assertEqual(entry[key], expected, `book-config.json Appendix D ${key}`);
  }

  const appendixCIndex = appendices.findIndex((candidate) => candidate.id === 'appendix-c');
  const appendixDIndex = appendices.findIndex((candidate) => candidate.id === figureIndex.entry.id);
  const afterword = config.structure && config.structure.afterword;
  if (appendixCIndex === -1 || appendixDIndex !== appendixCIndex + 1) {
    addError('book-config.json must place Appendix D immediately after Appendix C for previous navigation.');
  }
  if (!afterword || afterword.order !== figureIndex.entry.order + 1) {
    addError('book-config.json must place afterword immediately after Appendix D for next navigation.');
  }
}

function validateSourceDocsSync(srcPath, docsPath, label) {
  const source = readText(srcPath);
  const docsBody = stripFrontMatter(readText(docsPath));
  assertEqual(docsBody, source.trimStart(), `${label} src/docs body`);
  return { source, docs: docsBody };
}

function validateChapterInventory(chapterSource, chapterDocs) {
  const sourceReferences = markdownImageReferences(chapterSource);
  const docsReferences = markdownImageReferences(chapterDocs);
  const expectedPaths = figureIndex.figures.map((figure) => figure.sourcePath);
  const expectedAlts = figureIndex.figures.map((figure) => figure.alt);

  assertArrayEqual(sourceReferences.map((reference) => reference.sourcePath), expectedPaths, 'src chapter07 referenced PNG inventory/order');
  assertArrayEqual(sourceReferences.map((reference) => reference.alt), expectedAlts, 'src chapter07 referenced PNG titles/order');
  assertArrayEqual(docsReferences.map((reference) => reference.sourcePath), expectedPaths, 'docs chapter07 referenced PNG inventory/order');
  assertArrayEqual(docsReferences.map((reference) => reference.alt), expectedAlts, 'docs chapter07 referenced PNG titles/order');

  validateUniqueAnchors(chapterSource, 'src chapter07');
  validateUniqueAnchors(chapterDocs, 'docs chapter07');

  figureIndex.figures.forEach((figure, index) => {
    const sourceReference = sourceReferences[index];
    const docsReference = docsReferences[index];
    if (sourceReference) validateFigureAnchorPrecedesImage(chapterSource, sourceReference, figure, 'src chapter07');
    if (docsReference) validateFigureAnchorPrecedesImage(chapterDocs, docsReference, figure, 'docs chapter07');
    assertEqual(explicitAnchors(chapterSource).filter((anchor) => anchor === figure.anchor).length, 1, `src chapter07 anchor ${figure.anchor} count`);
    assertEqual(explicitAnchors(chapterDocs).filter((anchor) => anchor === figure.anchor).length, 1, `docs chapter07 anchor ${figure.anchor} count`);
  });
}

function validateGlobalPngInventory() {
  const expectedReferences = figureIndex.figures.map((figure) =>
    path.posix.join('chapters/chapter07', figure.sourcePath.replace(/^\.\//, '')),
  );
  const actualReferences = [];

  for (const file of collectFiles('src').filter((candidate) => candidate.endsWith('.md')).sort()) {
    for (const reference of markdownImageReferences(readText(file))) {
      actualReferences.push(
        path.posix.normalize(
          path.posix.join(path.posix.dirname(file.replace(/^src\//, '')), reference.sourcePath),
        ),
      );
    }
  }
  assertArrayEqual(actualReferences, expectedReferences, 'global src referenced PNG inventory/order');

  const sourceAssets = collectFiles('src')
    .filter((candidate) => candidate.toLowerCase().endsWith('.png'))
    .sort();
  const expectedAssets = expectedReferences.map((reference) => `src/${reference}`).sort();
  assertArrayEqual(sourceAssets, expectedAssets, 'global src PNG asset inventory');

  for (const sourceAsset of expectedAssets) {
    const docsAsset = sourceAsset.replace(/^src\//, 'docs/');
    if (!fs.existsSync(path.join(repoRoot, docsAsset))) {
      addError(`generated PNG is missing: ${docsAsset}`);
      continue;
    }
    const sourceBytes = fs.readFileSync(path.join(repoRoot, sourceAsset));
    const docsBytes = fs.readFileSync(path.join(repoRoot, docsAsset));
    if (!sourceBytes.equals(docsBytes)) addError(`generated PNG differs from source: ${docsAsset}`);
  }
}

function validateIndexPage(indexSource, indexDocs) {
  const expectedHeadings = figureIndex.figures.map((figure) => figure.indexHeading);
  const expectedIndexAnchors = figureIndex.figures.map((figure) => figure.indexAnchor);
  const expectedTargets = figureIndex.figures.map((figure) => figure.anchor);

  for (const [label, markdown] of [['src Appendix D', indexSource], ['docs Appendix D', indexDocs]]) {
    validateUniqueAnchors(markdown, label);
    assertEqual(markdownImageReferences(markdown).length, 0, `${label} embedded PNG count`);

    const headings = Array.from(markdown.matchAll(/^### (図7-\d+：.+) \{#([A-Za-z0-9_-]+)\}$/gm));
    assertArrayEqual(headings.map((match) => match[1]), expectedHeadings, `${label} indexed figure headings/order`);
    assertArrayEqual(headings.map((match) => match[2]), expectedIndexAnchors, `${label} indexed figure anchors/order`);

    const targets = Array.from(
      markdown.matchAll(/\[図を開く\]\(\.\.\/\.\.\/chapters\/chapter07\/#([A-Za-z0-9_-]+)\)/g),
      (match) => match[1],
    );
    assertArrayEqual(targets, expectedTargets, `${label} direct figure link targets/order`);

    figureIndex.figures.forEach((figure) => {
      assertContains(markdown, `- **章**: [${figureIndex.chapter.title}](../../chapters/chapter07/)`, `${label} ${figure.indexHeading} chapter`);
      assertContains(markdown, `- **目的**: ${figure.purpose}`, `${label} ${figure.indexHeading} purpose`);
      assertContains(markdown, `- **確認観点**: ${figure.inspection}`, `${label} ${figure.indexHeading} inspection guidance`);
    });
  }
}

function validateNavigationAndTop(config) {
  const sourceTop = readText('src/index.md');
  const docsTop = stripFrontMatter(readText('docs/index.md'));
  const topLink = '- [付録D：図表索引](appendices/appendix-d/)';
  assertContains(sourceTop, topLink, 'src top page Appendix D link');
  assertContains(docsTop, topLink, 'docs top page Appendix D link');

  const navigation = readText('docs/_data/navigation.yml');
  const appendixC = '  - title: "付録C：参考リンク集"\n    path: "/appendices/appendix-c/"';
  const appendixD = '  - title: "付録D：図表索引"\n    path: "/appendices/appendix-d/"';
  assertContains(navigation, appendixD, 'sidebar Appendix D item');
  if (!(navigation.indexOf(appendixC) < navigation.indexOf(appendixD))) {
    addError('docs/_data/navigation.yml must list Appendix C before Appendix D for previous navigation.');
  }

  const appendices = config.structure.appendices;
  assertEqual(appendices.filter((entry) => entry.id === 'appendix-d').length, 1, 'book-config.json Appendix D entry count');
}

function main() {
  const config = readJson('book-config.json');
  validateConfig(config);

  const chapter = validateSourceDocsSync(figureIndex.chapter.srcPath, figureIndex.chapter.docsPath, 'chapter07');
  const index = validateSourceDocsSync(figureIndex.entry.srcPath, figureIndex.entry.docsPath, 'Appendix D');
  validateChapterInventory(chapter.source, chapter.docs);
  validateGlobalPngInventory();
  validateIndexPage(index.source, index.docs);
  validateNavigationAndTop(config);

  if (errors.length > 0) {
    console.error('❌ Figure index contract check failed:');
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(`✅ Figure index contract check passed (${figureIndex.figures.length} referenced PNGs, Appendix D route ${figureIndex.route}).`);
}

main();
