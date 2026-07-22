#!/usr/bin/env node
/* Mutation regression for the fail-closed visual-evidence contract. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { crc32, validateVisualEvidence } = require('./check-visual-evidence');
const { textChunk } = require('./render-visual-evidence');

const repoRoot = path.resolve(__dirname, '..');
const cacheRoot = path.join(repoRoot, 'node_modules', '.cache');
fs.mkdirSync(cacheRoot, { recursive: true });
const fixtureRoot = fs.mkdtempSync(path.join(cacheRoot, 'kubernetes-cluster-ops-visual-evidence-'));

function copy(relativePath) {
  const source = path.join(repoRoot, relativePath);
  const target = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

const manifestPath = path.join(fixtureRoot, 'src/assets/visual-evidence/manifest.json');
function readManifest() { return JSON.parse(fs.readFileSync(manifestPath, 'utf8')); }
function writeManifest(value) { fs.writeFileSync(manifestPath, `${JSON.stringify(value, null, 2)}\n`); }

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function insertBeforeIend(png, chunk) {
  return Buffer.concat([png.subarray(0, -12), chunk, png.subarray(-12)]);
}

function mutateFirstRasterByte(png) {
  const signature = png.subarray(0, 8);
  const chunks = [];
  const imageData = [];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.subarray(offset + 4, offset + 8).toString('ascii');
    const end = offset + 12 + length;
    if (type === 'IDAT') imageData.push(png.subarray(offset + 8, offset + 8 + length));
    else chunks.push({ type, buffer: png.subarray(offset, end) });
    offset = end;
  }
  const pixels = zlib.inflateSync(Buffer.concat(imageData));
  pixels[1] ^= 1;
  const output = [signature];
  for (const chunk of chunks) {
    if (chunk.type === 'IEND') output.push(pngChunk('IDAT', zlib.deflateSync(pixels, { level: 9 })));
    output.push(chunk.buffer);
  }
  return Buffer.concat(output);
}

function expectFailure(name, evidence, mutate, restore) {
  try {
    mutate();
    const errors = validateVisualEvidence(fixtureRoot);
    if (!errors.some((error) => error.includes(evidence))) throw new Error(`${name}: expected ${JSON.stringify(evidence)}, got:\n${errors.join('\n')}`);
  } finally {
    restore();
  }
}

function expectSuccess(name, mutate, restore) {
  try {
    mutate();
    const errors = validateVisualEvidence(fixtureRoot);
    if (errors.length) throw new Error(`${name}: expected success, got:\n${errors.join('\n')}`);
  } finally {
    restore();
  }
}

function expectFailureWhenSupported(name, evidence, mutate, restore) {
  try {
    try {
      mutate();
    } catch (error) {
      if (['EACCES', 'ENOSYS', 'EPERM'].includes(error.code)) return false;
      throw error;
    }
    const errors = validateVisualEvidence(fixtureRoot);
    if (!errors.some((error) => error.includes(evidence))) throw new Error(`${name}: expected ${JSON.stringify(evidence)}, got:\n${errors.join('\n')}`);
    return true;
  } finally {
    restore();
  }
}

function expectThrow(name, evidence, operation) {
  let thrown = null;
  try {
    operation();
  } catch (error) {
    thrown = error;
  }
  if (!thrown) throw new Error(`${name}: operation returned normally; expected an exception`);
  if (!thrown.message.includes(evidence)) throw thrown;
}

// Keep the mutation fixture proportional to the visual-evidence contract rather
// than to the size of the whole book. The validator reads these chapter,
// inventory, policy, workflow, and rendering paths only.
for (const item of [
  'src/assets/visual-evidence', 'src/chapters',
  'docs/assets/visual-evidence', 'docs/assets/css/main.css', 'docs/chapters',
  'package.json', 'SCREENSHOTS.md', '.github/workflows/book-qa.yml',
  'scripts/render-visual-evidence.js', 'scripts/visual-evidence-font.json',
]) copy(item);
const baselineManifest = fs.readFileSync(manifestPath, 'utf8');
let passed = 0;
let skipped = 0;

try {
  for (const [name, keyword, value] of [
    ['non-Latin-1 tEXt value', 'evidence', 'snowman \u2603'],
    ['NUL in tEXt value', 'evidence', 'prefix\0suffix'],
    ['non-Latin-1 tEXt keyword', 'evidence-\u2603', 'value'],
  ]) {
    expectThrow(name, 'not Latin-1 safe', () => textChunk(keyword, value));
    passed += 1;
  }
  const cases = [
    ['package integration drift', 'complete check:visual-evidence contract',
      () => { const p = path.join(fixtureRoot, 'package.json'); const v = JSON.parse(fs.readFileSync(p)); v.scripts['check:visual-evidence'] = 'true'; fs.writeFileSync(p, `${JSON.stringify(v, null, 2)}\n`); },
      () => fs.copyFileSync(path.join(repoRoot, 'package.json'), path.join(fixtureRoot, 'package.json'))],
    ['Book QA integration drift', 'Book QA must run the local visual-evidence contract through npm test',
      () => { const p = path.join(fixtureRoot, '.github/workflows/book-qa.yml'); const v = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, v.replace('run: npm test', '# run: npm test\n        run: npm run build')); },
      () => fs.copyFileSync(path.join(repoRoot, '.github/workflows/book-qa.yml'), path.join(fixtureRoot, '.github/workflows/book-qa.yml'))],
    ['Book QA heredoc decoy', 'Book QA must run the local visual-evidence contract through npm test',
      () => { const p = path.join(fixtureRoot, '.github/workflows/book-qa.yml'); const v = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, v.replace('run: npm test', "run: |\n          cat <<'EOF'\n          npm test\n          EOF")); },
      () => fs.copyFileSync(path.join(repoRoot, '.github/workflows/book-qa.yml'), path.join(fixtureRoot, '.github/workflows/book-qa.yml'))],
    ['Book QA YAML-shaped heredoc decoy', 'Book QA must run the local visual-evidence contract through npm test',
      () => { const p = path.join(fixtureRoot, '.github/workflows/book-qa.yml'); const v = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, v.replace('run: npm test', "run: |\n          cat <<'EOF'\n          steps:\n            - run: npm test\n          EOF")); },
      () => fs.copyFileSync(path.join(repoRoot, '.github/workflows/book-qa.yml'), path.join(fixtureRoot, '.github/workflows/book-qa.yml'))],
    ['conditional Book QA step', 'Book QA must run the local visual-evidence contract through npm test',
      () => { const p = path.join(fixtureRoot, '.github/workflows/book-qa.yml'); const v = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, v.replace('run: npm test', 'if: ${{ false }}\n        run: npm test')); },
      () => fs.copyFileSync(path.join(repoRoot, '.github/workflows/book-qa.yml'), path.join(fixtureRoot, '.github/workflows/book-qa.yml'))],
    ['failure-tolerant Book QA step', 'Book QA must run the local visual-evidence contract through npm test',
      () => { const p = path.join(fixtureRoot, '.github/workflows/book-qa.yml'); const v = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, v.replace('run: npm test', 'continue-on-error: true\n        run: npm test')); },
      () => fs.copyFileSync(path.join(repoRoot, '.github/workflows/book-qa.yml'), path.join(fixtureRoot, '.github/workflows/book-qa.yml'))],
    ['conditional Book QA job', 'Book QA qa job must not have job-level if or continue-on-error',
      () => { const p = path.join(fixtureRoot, '.github/workflows/book-qa.yml'); const v = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, v.replace('  qa:\n', '  qa:\n    if: ${{ false }}\n')); },
      () => fs.copyFileSync(path.join(repoRoot, '.github/workflows/book-qa.yml'), path.join(fixtureRoot, '.github/workflows/book-qa.yml'))],
    ['failure-tolerant Book QA job', 'Book QA qa job must not have job-level if or continue-on-error',
      () => { const p = path.join(fixtureRoot, '.github/workflows/book-qa.yml'); const v = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, v.replace('  qa:\n', '  qa:\n    continue-on-error: true\n')); },
      () => fs.copyFileSync(path.join(repoRoot, '.github/workflows/book-qa.yml'), path.join(fixtureRoot, '.github/workflows/book-qa.yml'))],
    ['capture provenance integration drift', 'Book QA must verify the immutable capture run through check:capture-provenance',
      () => { const p = path.join(fixtureRoot, '.github/workflows/book-qa.yml'); const v = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, v.replace('run: npm run check:capture-provenance', 'run: npm run build')); },
      () => fs.copyFileSync(path.join(repoRoot, '.github/workflows/book-qa.yml'), path.join(fixtureRoot, '.github/workflows/book-qa.yml'))],
    ['conditional capture provenance step', 'Book QA must verify the immutable capture run through check:capture-provenance',
      () => { const p = path.join(fixtureRoot, '.github/workflows/book-qa.yml'); const v = fs.readFileSync(p, 'utf8'); fs.writeFileSync(p, v.replace('run: npm run check:capture-provenance', 'if: ${{ false }}\n        run: npm run check:capture-provenance')); },
      () => fs.copyFileSync(path.join(repoRoot, '.github/workflows/book-qa.yml'), path.join(fixtureRoot, '.github/workflows/book-qa.yml'))],
    ['missing manifest entry', 'manifest entry count',
      () => { const m = readManifest(); m.entries.pop(); writeManifest(m); },
      () => fs.writeFileSync(manifestPath, baselineManifest)],
    ['duplicate id', 'duplicate or missing id',
      () => { const m = readManifest(); m.entries[1].id = m.entries[0].id; writeManifest(m); },
      () => fs.writeFileSync(manifestPath, baselineManifest)],
    ['digest drift', 'SHA-256 does not match',
      () => { const m = readManifest(); m.entries[0].sha256 = '0'.repeat(64); writeManifest(m); },
      () => fs.writeFileSync(manifestPath, baselineManifest)],
    ['dimension drift', 'dimensions/bytes do not match',
      () => { const m = readManifest(); m.entries[0].width += 1; writeManifest(m); },
      () => fs.writeFileSync(manifestPath, baselineManifest)],
    ['embedded transcript drift', 'embedded PNG transcript must match',
      () => { const m = readManifest(); m.entries[0].displayedTranscript += 'drift\n'; writeManifest(m); },
      () => fs.writeFileSync(manifestPath, baselineManifest)],
    ['sensitive IPv4 metadata', 'IPv4 address remains',
      () => { const m = readManifest(); m.entries[0].setupSummary = 'host 192.0.2.10'; writeManifest(m); },
      () => fs.writeFileSync(manifestPath, baselineManifest)],
    ['alt loses decision', 'alt must state the reader decision point',
      () => { const m = readManifest(); m.entries[0].alt = '単なる画面'; writeManifest(m); },
      () => fs.writeFileSync(manifestPath, baselineManifest)],
    ['caption loses date', 'caption must include capture date',
      () => { const m = readManifest(); m.entries[0].caption = '判断だけを示す'; writeManifest(m); },
      () => fs.writeFileSync(manifestPath, baselineManifest)],
    ['capture run attestation drift', 'capture attestation runId differs',
      () => { const m = readManifest(); m.captureAttestation.runId += 1; writeManifest(m); },
      () => fs.writeFileSync(manifestPath, baselineManifest)],
    ['renderer source drift', 'renderer SHA-256 differs',
      () => { const p = path.join(fixtureRoot, 'scripts/render-visual-evidence.js'); fs.appendFileSync(p, '\n// drift\n'); },
      () => fs.copyFileSync(path.join(repoRoot, 'scripts/render-visual-evidence.js'), path.join(fixtureRoot, 'scripts/render-visual-evidence.js'))],
  ];
  for (const [name, evidence, mutate, restore] of cases) {
    expectFailure(name, evidence, mutate, restore);
    passed += 1;
  }

  const sourceImage = path.join(fixtureRoot, 'src/chapters/chapter00/images/ch00-change-record-gate-01.png');
  const docsImage = path.join(fixtureRoot, 'docs/chapters/chapter00/images/ch00-change-record-gate-01.png');
  const baselineImage = fs.readFileSync(sourceImage);
  const baselineDocsImage = fs.readFileSync(docsImage);
  expectFailure('generated image drift', 'generated docs PNG must exactly match',
    () => fs.writeFileSync(docsImage, Buffer.from('not the canonical image')),
    () => fs.writeFileSync(docsImage, baselineDocsImage));
  passed += 1;

  const sourceChapter = path.join(fixtureRoot, 'src/chapters/chapter00/index.md');
  const docsChapter = path.join(fixtureRoot, 'docs/chapters/chapter00/index.md');
  const baselineSourceChapter = fs.readFileSync(sourceChapter, 'utf8');
  const baselineDocsChapter = fs.readFileSync(docsChapter, 'utf8');
  expectFailure('missing source chapter reference', 'src chapter must reference the image exactly once',
    () => fs.writeFileSync(sourceChapter, baselineSourceChapter.replace('./images/ch00-change-record-gate-01.png', './images/missing.png')),
    () => fs.writeFileSync(sourceChapter, baselineSourceChapter));
  passed += 1;
  expectFailure('generated caption drift', 'docs alt and immediate caption must match',
    () => fs.writeFileSync(docsChapter, baselineDocsChapter.replace('changeId、ownerRole', '別の説明')),
    () => fs.writeFileSync(docsChapter, baselineDocsChapter));
  passed += 1;
  expectSuccess('CRLF chapter portability',
    () => { fs.writeFileSync(sourceChapter, baselineSourceChapter.replace(/\n/g, '\r\n')); fs.writeFileSync(docsChapter, baselineDocsChapter.replace(/\n/g, '\r\n')); },
    () => { fs.writeFileSync(sourceChapter, baselineSourceChapter); fs.writeFileSync(docsChapter, baselineDocsChapter); });

  const workflow = path.join(fixtureRoot, '.github/workflows/book-qa.yml');
  const baselineWorkflow = fs.readFileSync(workflow, 'utf8');
  expectSuccess('Book QA step-name portability',
    () => fs.writeFileSync(workflow, baselineWorkflow.replace('name: Local npm QA', 'name: Run repository QA')),
    () => fs.writeFileSync(workflow, baselineWorkflow));

  const extraLower = path.join(fixtureRoot, 'src/chapters/chapter00/images/untracked.png');
  expectFailure('untracked lowercase PNG', 'untracked src screenshot PNG',
    () => fs.copyFileSync(sourceImage, extraLower), () => fs.rmSync(extraLower, { force: true }));
  passed += 1;
  const extraUpper = path.join(fixtureRoot, 'src/chapters/chapter00/images/untracked.PNG');
  expectFailure('untracked uppercase PNG', 'untracked src screenshot PNG',
    () => fs.copyFileSync(sourceImage, extraUpper), () => fs.rmSync(extraUpper, { force: true }));
  passed += 1;
  const symlink = path.join(fixtureRoot, 'src/chapters/chapter00/images/symlink.png');
  if (expectFailureWhenSupported('untracked symlink PNG', 'untracked src screenshot PNG',
    () => fs.symlinkSync('ch00-change-record-gate-01.png', symlink), () => fs.rmSync(symlink, { force: true }))) {
    passed += 1;
  } else {
    skipped += 1;
  }

  expectFailure('truncated PNG', 'not a complete decodable PNG',
    () => fs.writeFileSync(sourceImage, baselineImage.subarray(0, 40)),
    () => fs.writeFileSync(sourceImage, baselineImage));
  passed += 1;
  expectFailure('oversized decoded PNG', 'image dimensions 100000x100000 are outside the safety limits',
    () => {
      const oversized = Buffer.from(baselineImage);
      oversized.writeUInt32BE(100000, 16);
      oversized.writeUInt32BE(100000, 20);
      oversized.writeUInt32BE(crc32(oversized.subarray(12, 29)), 29);
      fs.writeFileSync(sourceImage, oversized);
      const m = readManifest();
      m.entries[0].width = 100000; m.entries[0].height = 100000; m.entries[0].bytes = oversized.length;
      m.entries[0].sha256 = crypto.createHash('sha256').update(oversized).digest('hex');
      writeManifest(m);
    },
    () => { fs.writeFileSync(sourceImage, baselineImage); fs.writeFileSync(manifestPath, baselineManifest); });
  passed += 1;
  expectFailure('data after IEND', 'data remains after IEND',
    () => fs.writeFileSync(sourceImage, Buffer.concat([baselineImage, Buffer.from('trailing')])),
    () => fs.writeFileSync(sourceImage, baselineImage));
  passed += 1;
  expectFailure('visible raster tampering', 'PNG raster/encoding must be the deterministic rendering',
    () => {
      const mutated = mutateFirstRasterByte(baselineImage);
      fs.writeFileSync(sourceImage, mutated);
      fs.writeFileSync(docsImage, mutated);
      const m = readManifest();
      m.entries[0].bytes = mutated.length;
      m.entries[0].sha256 = crypto.createHash('sha256').update(mutated).digest('hex');
      writeManifest(m);
    },
    () => {
      fs.writeFileSync(sourceImage, baselineImage);
      fs.writeFileSync(docsImage, baselineDocsImage);
      fs.writeFileSync(manifestPath, baselineManifest);
    });
  passed += 1;
  expectFailure('unrecognized PNG text metadata', 'unrecognized PNG tEXt keyword',
    () => {
      const comment = pngChunk('tEXt', Buffer.from('Comment\0sanitized-but-untracked-metadata', 'latin1'));
      const mutated = insertBeforeIend(baselineImage, comment);
      fs.writeFileSync(sourceImage, mutated);
      fs.writeFileSync(docsImage, mutated);
      const m = readManifest();
      m.entries[0].bytes = mutated.length;
      m.entries[0].sha256 = crypto.createHash('sha256').update(mutated).digest('hex');
      writeManifest(m);
    },
    () => {
      fs.writeFileSync(sourceImage, baselineImage);
      fs.writeFileSync(docsImage, baselineDocsImage);
      fs.writeFileSync(manifestPath, baselineManifest);
    });
  passed += 1;
  const metadataCases = [
    ['iTXt', Buffer.concat([
      Buffer.from('Comment\0', 'latin1'), Buffer.from([0, 0, 0, 0]), Buffer.from('untracked international text', 'utf8'),
    ])],
    ['zTXt', Buffer.concat([
      Buffer.from('Comment\0', 'latin1'), Buffer.from([0]), zlib.deflateSync(Buffer.from('untracked compressed text', 'latin1')),
    ])],
  ];
  for (const [chunkType, payload] of metadataCases) {
    expectFailure(`unsupported ${chunkType} metadata`, `unsupported PNG chunk ${chunkType}`,
      () => {
        const mutated = insertBeforeIend(baselineImage, pngChunk(chunkType, payload));
        fs.writeFileSync(sourceImage, mutated);
        fs.writeFileSync(docsImage, mutated);
        const m = readManifest();
        m.entries[0].bytes = mutated.length;
        m.entries[0].sha256 = crypto.createHash('sha256').update(mutated).digest('hex');
        writeManifest(m);
      },
      () => {
        fs.writeFileSync(sourceImage, baselineImage);
        fs.writeFileSync(docsImage, baselineDocsImage);
        fs.writeFileSync(manifestPath, baselineManifest);
      });
    passed += 1;
  }

  const screenshots = path.join(fixtureRoot, 'SCREENSHOTS.md');
  const baselineScreenshots = fs.readFileSync(screenshots, 'utf8');
  expectFailure('policy integration drift', 'SCREENSHOTS.md must document npm run check:visual-evidence',
    () => fs.writeFileSync(screenshots, baselineScreenshots.replace('npm run check:visual-evidence', 'npm run removed')),
    () => fs.writeFileSync(screenshots, baselineScreenshots));
  passed += 1;
  const css = path.join(fixtureRoot, 'docs/assets/css/main.css');
  const baselineCss = fs.readFileSync(css, 'utf8');
  expectFailure('responsive CSS drift', 'published CSS must keep visual evidence responsive',
    () => fs.writeFileSync(css, baselineCss.replace('max-width: 100%;', 'max-width: none;')),
    () => fs.writeFileSync(css, baselineCss));
  passed += 1;

  const finalErrors = validateVisualEvidence(fixtureRoot);
  if (finalErrors.length) throw new Error(`Restored fixture failed:\n${finalErrors.join('\n')}`);
  console.log(`Visual-evidence regression passed: ${passed}/${passed} negative mutations, ${skipped} unsupported-platform skips, 2/2 portability checks, 1/1 restored baseline.`);
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
