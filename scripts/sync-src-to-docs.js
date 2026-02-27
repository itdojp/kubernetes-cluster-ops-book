#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

function yamlDoubleQuoteEscape(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"');
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf-8'));
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

function isMarkdownFile(filePath) {
  return path.extname(filePath).toLowerCase() === '.md';
}

function frontMatter({ title, order, permalink }) {
  const lines = [
    '---',
    'layout: book',
    `order: ${order}`,
    `title: "${yamlDoubleQuoteEscape(title)}"`,
  ];
  if (permalink) {
    lines.push(`permalink: ${permalink}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

function collectEntries(config) {
  const s = config.structure || {};
  const entries = [];
  if (s.index) entries.push(s.index);
  if (s.introduction) entries.push(s.introduction);
  if (Array.isArray(s.chapters)) entries.push(...s.chapters);
  if (Array.isArray(s.appendices)) entries.push(...s.appendices);
  if (s.afterword) entries.push(s.afterword);
  return entries;
}

async function writeDocsPage(entry) {
  const srcPath = path.join(process.cwd(), entry.srcPath);
  const docsPath = path.join(process.cwd(), entry.docsPath);

  const body = await fs.readFile(srcPath, 'utf-8');
  await ensureDir(path.dirname(docsPath));

  const fm = frontMatter({
    title: entry.title,
    order: entry.order,
    permalink: entry.permalink,
  });

  await fs.writeFile(docsPath, `${fm}${body.trimStart()}`, 'utf-8');
}

async function syncStaticAssets() {
  const srcRoot = path.join(process.cwd(), 'src');
  const docsRoot = path.join(process.cwd(), 'docs');

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(srcPath);
        continue;
      }
      if (isMarkdownFile(srcPath)) continue;

      const relPath = path.relative(srcRoot, srcPath);
      const docsPath = path.join(docsRoot, relPath);
      await ensureDir(path.dirname(docsPath));
      await fs.copyFile(srcPath, docsPath);
    }
  }

  await walk(srcRoot);
}

function buildNavigationYaml(config) {
  const s = config.structure || {};
  const intro = s.introduction;
  const chapters = s.chapters || [];
  const appendices = s.appendices || [];
  const afterword = s.afterword;

  const lines = [];

  if (intro) {
    lines.push('introduction:');
    lines.push(`  - title: "${yamlDoubleQuoteEscape(intro.title)}"`);
    lines.push(`    path: "${yamlDoubleQuoteEscape(intro.navPath)}"`);
    lines.push('');
  }

  lines.push('chapters:');
  for (const ch of chapters) {
    lines.push(`  - title: "${yamlDoubleQuoteEscape(ch.title)}"`);
    lines.push(`    path: "${yamlDoubleQuoteEscape(ch.navPath)}"`);
  }
  lines.push('');

  lines.push('appendices:');
  for (const ap of appendices) {
    lines.push(`  - title: "${yamlDoubleQuoteEscape(ap.title)}"`);
    lines.push(`    path: "${yamlDoubleQuoteEscape(ap.navPath)}"`);
  }
  lines.push('');

  if (afterword) {
    lines.push('afterword:');
    lines.push(`  - title: "${yamlDoubleQuoteEscape(afterword.title)}"`);
    lines.push(`    path: "${yamlDoubleQuoteEscape(afterword.navPath)}"`);
  }

  return lines.join('\n') + '\n';
}

async function main() {
  const configPath = path.join(process.cwd(), 'book-config.json');
  const config = await readJson(configPath);
  const entries = collectEntries(config);

  for (const entry of entries) {
    await writeDocsPage(entry);
  }

  const navYml = buildNavigationYaml(config);
  const navPath = path.join(process.cwd(), 'docs', '_data', 'navigation.yml');
  await ensureDir(path.dirname(navPath));
  await fs.writeFile(navPath, navYml, 'utf-8');

  await syncStaticAssets();

  console.log('✅ Synced src -> docs');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Sync failed:', err);
    process.exit(1);
  });
}
