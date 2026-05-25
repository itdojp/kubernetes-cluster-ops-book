#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function findRepoRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (
      fs.existsSync(path.join(current, 'book-config.json')) &&
      fs.existsSync(path.join(current, 'package.json'))
    ) {
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
const repoRootReal = fs.realpathSync(repoRoot);
const errors = [];

function relDisplay(absPath) {
  const rel = path.relative(repoRoot, absPath);
  return rel || '.';
}

function addError(message) {
  errors.push(message);
}

function readText(relPath) {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf8');
}

function readJson(relPath) {
  return JSON.parse(readText(relPath));
}

function normalizeSlash(value) {
  return String(value || '').replace(/\\/g, '/');
}

function isInside(base, target) {
  const rel = path.relative(base, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function resolveRepoPath(relPath, fieldName, options = {}) {
  if (typeof relPath !== 'string' || relPath.trim() === '') {
    addError(`${fieldName} must be a non-empty relative path.`);
    return null;
  }
  if (path.isAbsolute(relPath)) {
    addError(`${fieldName} must be relative, got absolute path: ${relPath}`);
    return null;
  }

  const absPath = path.resolve(repoRoot, relPath);
  if (!isInside(repoRoot, absPath)) {
    addError(`${fieldName} escapes repository root: ${relPath}`);
    return null;
  }

  if (options.mustExist) {
    try {
      fs.lstatSync(absPath);
    } catch (err) {
      addError(`${fieldName} target not found: ${relPath}`);
      return null;
    }

    let realPath;
    try {
      realPath = fs.realpathSync(absPath);
    } catch (err) {
      addError(`${fieldName} cannot be resolved: ${relPath} (${err.message})`);
      return null;
    }

    if (!isInside(repoRootReal, realPath)) {
      addError(`${fieldName} resolves outside repository root: ${relPath} -> ${realPath}`);
      return null;
    }

    if (options.file && !fs.statSync(absPath).isFile()) {
      addError(`${fieldName} must point to a file: ${relPath}`);
      return null;
    }
  }

  return absPath;
}

function parseScalar(rawValue) {
  const value = String(rawValue || '').trim();
  if (value === '') return '';
  if (value.startsWith('"') && value.endsWith('"')) {
    return value
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\');
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

function parseTopLevelYaml(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    if (/^\s/.test(line) || /^\s*(#|$)/.test(line)) continue;
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (rawValue.trim() === '') continue;
    values[key] = parseScalar(rawValue);
  }
  return values;
}

function parseFrontMatter(markdown, relPath) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    addError(`${relPath} is missing YAML front matter.`);
    return { data: {}, body: markdown };
  }
  return {
    data: parseTopLevelYaml(match[1]),
    body: markdown.slice(match[0].length),
  };
}

function parseNavigationYaml(text) {
  const result = {};
  let currentSection = null;
  let currentItem = null;

  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(line)) continue;

    const sectionMatch = line.match(/^([A-Za-z0-9_-]+):\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      result[currentSection] = [];
      currentItem = null;
      continue;
    }

    if (!currentSection) continue;

    const titleMatch = line.match(/^\s*-\s+title:\s*(.+)$/);
    if (titleMatch) {
      currentItem = { title: parseScalar(titleMatch[1]) };
      result[currentSection].push(currentItem);
      continue;
    }

    const pathMatch = line.match(/^\s+path:\s*(.+)$/);
    if (pathMatch && currentItem) {
      currentItem.path = parseScalar(pathMatch[1]);
    }
  }

  return result;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    addError(`${label} mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertContains(haystack, needle, label) {
  if (!haystack.includes(needle)) {
    addError(`${label} does not contain ${JSON.stringify(needle)}.`);
  }
}

function canonicalRepoSlug(repositoryUrl) {
  const match = String(repositoryUrl || '').match(/github\.com[:/]([^/]+\/[^/.]+)(?:\.git)?$/);
  return match ? match[1] : null;
}

function normalizeHomepage(value) {
  const raw = String(value || '');
  return raw.endsWith('/') ? raw : `${raw}/`;
}

function collectEntries(config) {
  const s = config.structure || {};
  const entries = [];
  if (s.index) entries.push({ ...s.index, section: 'index' });
  if (s.introduction) entries.push({ ...s.introduction, section: 'introduction' });
  if (Array.isArray(s.chapters)) entries.push(...s.chapters.map((entry) => ({ ...entry, section: 'chapters' })));
  if (Array.isArray(s.appendices)) entries.push(...s.appendices.map((entry) => ({ ...entry, section: 'appendices' })));
  if (s.afterword) entries.push({ ...s.afterword, section: 'afterword' });
  return entries;
}

function walkFiles(absDir, visitor, relDir = '') {
  const dirents = fs.readdirSync(absDir, { withFileTypes: true });
  for (const dirent of dirents) {
    const relPath = normalizeSlash(path.join(relDir, dirent.name));
    const absPath = path.join(absDir, dirent.name);
    if (dirent.isDirectory()) {
      walkFiles(absPath, visitor, relPath);
      continue;
    }
    visitor({ absPath, relPath, dirent });
  }
}

function filesAreEqual(leftPath, rightPath) {
  const leftFd = fs.openSync(leftPath, 'r');
  const rightFd = fs.openSync(rightPath, 'r');
  const leftBuffer = Buffer.allocUnsafe(64 * 1024);
  const rightBuffer = Buffer.allocUnsafe(64 * 1024);

  try {
    while (true) {
      const leftBytes = fs.readSync(leftFd, leftBuffer, 0, leftBuffer.length, null);
      const rightBytes = fs.readSync(rightFd, rightBuffer, 0, rightBuffer.length, null);
      if (leftBytes !== rightBytes) return false;
      if (leftBytes === 0) return true;
      if (!leftBuffer.subarray(0, leftBytes).equals(rightBuffer.subarray(0, rightBytes))) {
        return false;
      }
    }
  } finally {
    fs.closeSync(leftFd);
    fs.closeSync(rightFd);
  }
}

function navPathToDocsPath(navPath, label) {
  if (typeof navPath !== 'string' || navPath.trim() === '') {
    addError(`${label} must be a non-empty path.`);
    return null;
  }
  if (!navPath.startsWith('/')) {
    addError(`${label} must start with '/': ${navPath}`);
    return null;
  }
  if (/^https?:\/\//.test(navPath) || navPath.includes('://')) {
    addError(`${label} must be an internal path: ${navPath}`);
    return null;
  }
  const withoutQuery = navPath.split(/[?#]/, 1)[0];
  const segments = withoutQuery.split('/').filter(Boolean);
  if (segments.some((segment) => segment === '..' || segment === '.')) {
    addError(`${label} must not contain relative path segments: ${navPath}`);
    return null;
  }
  if (!withoutQuery.endsWith('/')) {
    addError(`${label} should use a directory-style permalink ending with '/': ${navPath}`);
  }
  return path.join('docs', ...segments, 'index.md');
}

function validateMetadata(config, pkg, lockRoot, docsConfig, readme) {
  const repoSlug = canonicalRepoSlug(config.repository && config.repository.url);
  if (!repoSlug) {
    addError('book-config.json repository.url must be a GitHub repository URL ending in .git.');
    return;
  }

  assertEqual(pkg.name, 'kubernetes-cluster-ops-book', 'package.json name');
  assertEqual(pkg.version, config.version, 'package.json version');
  assertEqual(pkg.description, config.description, 'package.json description');
  assertEqual(pkg.author, config.author, 'package.json author');
  assertEqual(pkg.license, config.license, 'package.json license');
  assertEqual(pkg.repository && pkg.repository.type, 'git', 'package.json repository.type');
  assertEqual(pkg.repository && pkg.repository.url, config.repository.url, 'package.json repository.url');
  assertEqual(normalizeHomepage(pkg.homepage), config.homepage, 'package.json homepage');
  assertEqual(pkg.bugs && pkg.bugs.url, `https://github.com/${repoSlug}/issues`, 'package.json bugs.url');

  assertEqual(lockRoot.name, pkg.name, 'package-lock root name');
  assertEqual(lockRoot.version, pkg.version, 'package-lock root version');
  assertEqual(lockRoot.license, pkg.license, 'package-lock root license');

  assertEqual(docsConfig.title, config.title, 'docs/_config.yml title');
  assertEqual(docsConfig.description, config.description, 'docs/_config.yml description');
  assertEqual(docsConfig.author, config.author, 'docs/_config.yml author');
  assertEqual(docsConfig.version, config.version, 'docs/_config.yml version');
  assertEqual(docsConfig.lang, config.language, 'docs/_config.yml lang');
  assertEqual(docsConfig.repository_branch, config.repository.branch, 'docs/_config.yml repository_branch');
  assertEqual(docsConfig.url, 'https://itdojp.github.io', 'docs/_config.yml url');
  assertEqual(docsConfig.baseurl, '/kubernetes-cluster-ops-book', 'docs/_config.yml baseurl');
  assertEqual(docsConfig.repository, repoSlug, 'docs/_config.yml repository');

  assertContains(readme, config.homepage, 'README.md online URL');
  assertContains(readme, 'npm run check:metadata', 'README.md quality gate');
  assertContains(readme, 'npm test', 'README.md test command');
}

function validateEntries(config, entries) {
  const seenIds = new Set();
  const seenOrders = new Set();
  const seenDocsPaths = new Set();
  const seenNavPaths = new Set();

  for (const entry of entries) {
    const label = `book-config.json structure.${entry.section}.${entry.id || '<missing-id>'}`;
    if (!entry.id) addError(`${label} is missing id.`);
    if (seenIds.has(entry.id)) addError(`${label} id is duplicated: ${entry.id}`);
    seenIds.add(entry.id);

    if (!Number.isInteger(entry.order)) addError(`${label} order must be an integer.`);
    if (seenOrders.has(entry.order)) addError(`${label} order is duplicated: ${entry.order}`);
    seenOrders.add(entry.order);

    const srcAbs = resolveRepoPath(entry.srcPath, `${label}.srcPath`, { mustExist: true, file: true });
    const docsAbs = resolveRepoPath(entry.docsPath, `${label}.docsPath`, { mustExist: true, file: true });

    if (entry.srcPath && !normalizeSlash(entry.srcPath).startsWith('src/')) {
      addError(`${label}.srcPath must be under src/: ${entry.srcPath}`);
    }
    if (entry.docsPath && !normalizeSlash(entry.docsPath).startsWith('docs/')) {
      addError(`${label}.docsPath must be under docs/: ${entry.docsPath}`);
    }
    if (seenDocsPaths.has(entry.docsPath)) addError(`${label}.docsPath is duplicated: ${entry.docsPath}`);
    seenDocsPaths.add(entry.docsPath);

    if (entry.navPath) {
      if (seenNavPaths.has(entry.navPath)) addError(`${label}.navPath is duplicated: ${entry.navPath}`);
      seenNavPaths.add(entry.navPath);
      const expectedDocsPath = navPathToDocsPath(entry.navPath, `${label}.navPath`);
      if (expectedDocsPath) {
        assertEqual(normalizeSlash(entry.docsPath), normalizeSlash(expectedDocsPath), `${label}.docsPath derived from navPath`);
      }
    }

    if (!srcAbs || !docsAbs) continue;

    const srcText = fs.readFileSync(srcAbs, 'utf8');
    const docsText = fs.readFileSync(docsAbs, 'utf8');
    const parsed = parseFrontMatter(docsText, relDisplay(docsAbs));
    const fm = parsed.data;

    assertEqual(fm.layout, 'book', `${entry.docsPath} front matter layout`);
    assertEqual(fm.order, String(entry.order), `${entry.docsPath} front matter order`);
    assertEqual(fm.title, entry.title, `${entry.docsPath} front matter title`);
    if (entry.permalink) {
      assertEqual(fm.permalink, entry.permalink, `${entry.docsPath} front matter permalink`);
    }
    if (entry.id === 'index') {
      assertEqual(fm.description, config.description, `${entry.docsPath} front matter description`);
      assertEqual(fm.author, config.author, `${entry.docsPath} front matter author`);
      assertEqual(fm.version, config.version, `${entry.docsPath} front matter version`);
    }

    const expectedBody = srcText.trimStart();
    if (parsed.body !== expectedBody) {
      addError(`${entry.docsPath} body is not synchronized with ${entry.srcPath}; run npm run sync.`);
    }
  }
}

function validateStaticAssets(entries) {
  const srcRoot = path.join(repoRoot, 'src');
  const docsRoot = path.join(repoRoot, 'docs');
  const mirroredDocsAssets = new Set();

  for (const entry of entries) {
    const docsRel = normalizeSlash(entry.docsPath || '').replace(/^docs\//, '');
    const firstSegment = docsRel.split('/', 1)[0];
    if (firstSegment && firstSegment !== 'index.md') {
      mirroredDocsAssets.add(firstSegment);
    }
  }

  const srcAssets = new Map();
  walkFiles(srcRoot, ({ relPath, dirent }) => {
    if (path.extname(relPath).toLowerCase() === '.md') return;
    if (!dirent.isFile() && !dirent.isSymbolicLink()) return;
    srcAssets.set(relPath, `src/${relPath}`);
  });

  const docsAssets = new Map();
  walkFiles(docsRoot, ({ relPath, dirent }) => {
    if (path.extname(relPath).toLowerCase() === '.md') return;
    if (!dirent.isFile() && !dirent.isSymbolicLink()) return;
    const firstSegment = relPath.split('/', 1)[0];
    if (!mirroredDocsAssets.has(firstSegment)) return;
    docsAssets.set(relPath, `docs/${relPath}`);
  });

  for (const [relPath, srcRel] of srcAssets) {
    const docsRel = `docs/${relPath}`;
    const srcAbs = resolveRepoPath(srcRel, `static asset ${srcRel}`, { mustExist: true, file: true });
    const docsAbs = resolveRepoPath(docsRel, `static asset ${docsRel}`, { mustExist: true, file: true });
    if (!srcAbs || !docsAbs) continue;

    const srcStat = fs.statSync(srcAbs);
    const docsStat = fs.statSync(docsAbs);
    if (srcStat.size !== docsStat.size) {
      addError(`${docsRel} is not synchronized with ${srcRel}; run npm run sync.`);
      continue;
    }

    if (!filesAreEqual(srcAbs, docsAbs)) {
      addError(`${docsRel} is not synchronized with ${srcRel}; run npm run sync.`);
    }
  }

  for (const relPath of docsAssets.keys()) {
    if (!srcAssets.has(relPath)) {
      addError(`docs/${relPath} has no matching source asset at src/${relPath}; run npm run sync.`);
    }
  }
}

function validateNavigation(config, nav) {
  const s = config.structure || {};
  const expected = {
    introduction: s.introduction ? [s.introduction] : [],
    chapters: Array.isArray(s.chapters) ? s.chapters : [],
    appendices: Array.isArray(s.appendices) ? s.appendices : [],
    afterword: s.afterword ? [s.afterword] : [],
  };

  for (const section of Object.keys(expected)) {
    const actualItems = nav[section] || [];
    const expectedItems = expected[section];
    assertEqual(actualItems.length, expectedItems.length, `docs/_data/navigation.yml ${section} item count`);
    const max = Math.min(actualItems.length, expectedItems.length);
    for (let i = 0; i < max; i += 1) {
      assertEqual(actualItems[i].title, expectedItems[i].title, `docs/_data/navigation.yml ${section}[${i}].title`);
      assertEqual(actualItems[i].path, expectedItems[i].navPath, `docs/_data/navigation.yml ${section}[${i}].path`);

      const docsRel = navPathToDocsPath(actualItems[i].path, `docs/_data/navigation.yml ${section}[${i}].path`);
      if (docsRel) {
        resolveRepoPath(docsRel, `docs/_data/navigation.yml ${section}[${i}].target`, { mustExist: true, file: true });
      }
    }
  }
}

function main() {
  const config = readJson('book-config.json');
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');
  const lockRoot = lock.packages && lock.packages[''] ? lock.packages[''] : {};
  const docsConfig = parseTopLevelYaml(readText('docs/_config.yml'));
  const nav = parseNavigationYaml(readText('docs/_data/navigation.yml'));
  const readme = readText('README.md');

  const entries = collectEntries(config);

  validateMetadata(config, pkg, lockRoot, docsConfig, readme);
  validateEntries(config, entries);
  validateStaticAssets(entries);
  validateNavigation(config, nav);

  if (errors.length > 0) {
    console.error('❌ Metadata consistency check failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`✅ Metadata consistency check passed (${entries.length} pages, ${entries.length - 1} navigation targets).`);
}

main();
