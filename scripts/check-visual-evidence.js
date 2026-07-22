#!/usr/bin/env node
/* Fail-closed contract for the published, sanitized visual-evidence inventory. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { renderVisualEvidence, transcriptSetSha256 } = require('./render-visual-evidence');

const EXPECTED = [
  ['ch00-change-record', 'chapter00', 'ch00-change-record-gate-01.png', 'chapter00.txt'],
  ['ch01-cluster-inventory', 'chapter01', 'ch01-cluster-inventory-01.png', 'chapter01.txt'],
  ['ch02-control-plane-readyz', 'chapter02', 'ch02-control-plane-readyz-01.png', 'chapter02.txt'],
  ['ch03-etcd-snapshot-status', 'chapter03', 'ch03-etcd-snapshot-status-01.png', 'chapter03.txt'],
  ['ch04-node-conditions', 'chapter04', 'ch04-node-conditions-01.png', 'chapter04.txt'],
  ['ch05-dns-service', 'chapter05', 'ch05-dns-service-check-01.png', 'chapter05.txt'],
  ['ch06-storage-pvc', 'chapter06', 'ch06-storage-pvc-check-01.png', 'chapter06.txt'],
  ['ch07-rbac-can-i', 'chapter07', 'ch07-rbac-can-i-01.png', 'chapter07-rbac.txt'],
  ['ch07-pss-namespace-label', 'chapter07', 'ch07-pss-namespace-label-02.png', 'chapter07-pss.txt'],
  ['ch08-quota-limitrange', 'chapter08', 'ch08-quota-limitrange-01.png', 'chapter08.txt'],
  ['ch09-apiserver-metrics', 'chapter09', 'ch09-apiserver-metrics-01.png', 'chapter09.txt'],
  ['ch10-version-skew', 'chapter10', 'ch10-version-skew-inventory-01.png', 'chapter10.txt'],
  ['ch11-service-recovery', 'chapter11', 'ch11-service-recovery-01.png', 'chapter11.txt'],
  ['ch12-policy-gate', 'chapter12', 'ch12-policy-gate-01.png', 'chapter12.txt'],
];
const ARTIFACT_DIRECTORY = 'evidence/issue-16-capture/sanitized-artifact';
const ARTIFACT_FILE_SET_SHA256 = '3a48f5ab0db8f1009dd03cf85a2e7bdfc4aed5be150eaeeea1534da2337236ac';
const ARTIFACT_FILE_SHA256 = {
  'chapter00.txt': 'b0a580f4908344a59d22ab4f511d2b292a53315e5ec4f37a3ca91017a262561a',
  'chapter01.txt': '88caad6a32ab2db0e8878eb889253ae0a2df7aa8d306bb6ece13cbb2e51c5228',
  'chapter02.txt': '7bb82376f385640f7f90e8b7fe681c9449d46be24c8f9a164e31436678081150',
  'chapter03.txt': '05a961b96d88e95957f6ee44b90b81c8a3e0d8559fd83a01fa7cd68ad7b0d607',
  'chapter04.txt': '7d427edbc91b534b2f9e162e5be192725de8e3b7873374eaf74a0a71dba5b860',
  'chapter05.txt': '61d2828ed4d5de79a51ac12747aff799bf4d3a816892f9fe85f6f409f30328ff',
  'chapter06.txt': 'd99ff9b22c95d69cefadac84fd7be2e1c28f776af4776ee353d21e14d174df9c',
  'chapter07-pss.txt': 'a63e10f1a46470abdb5b6253b884db1736544bd57c966f9c3e8dcb1a05f965bc',
  'chapter07-rbac.txt': '2b3b6ea265a229560c167b5c98ac0b55bd10643967eab0ce9d06e9db42668ef7',
  'chapter08.txt': '2c688b4387d0f1626f83b0792d6bbf9e48687c00d4d414f2ec3cfb4c8604d14d',
  'chapter09.txt': 'b686984764f466ac19e21d15701a601820f81e5e3fabdc96fde68c7c2dd3b204',
  'chapter10.txt': '91d05bb0cef7cc0e3e07dbc0b668568e40bdbfda764b79ba9330c1a0b6804b2f',
  'chapter11.txt': '0616da137b29502c5db090c50591ae19ae537b4e476b4a15acdce1300223c54d',
  'chapter12.txt': 'eac7f1131de53cbefc635c124808769632cd162042d7ae298741d86a539897c2',
  'environment.json': '9da6fb74299c804fbc0bbdfce50602a7cd515362961199b2f14ba9827e84b3e3',
};
const PUBLICATION_TRANSFORM = 'normalize CRLF to LF; operations-lab -> [masked-namespace]; tenant-a and team-a -> [masked-tenant]';
const MAX_FILE_BYTES = 500 * 1024;
const MAX_DECODED_BYTES = 32 * 1024 * 1024;
const MIN_WIDTH = 1200;
const MAX_WIDTH = 1800;
const MIN_HEIGHT = 320;
const MAX_HEIGHT = 2600;
const REQUIRED_PNG_TEXT_KEYS = [
  'visual-evidence-transcript',
  'visual-evidence-captured-at',
  'visual-evidence-environment',
];
const ALLOWED_PNG_CHUNKS = new Set(['IHDR', 'tEXt', 'IDAT', 'IEND']);
const FORBIDDEN = [
  { label: 'GitHub token', pattern: /(?:ghp_|github_pat_)[A-Za-z0-9_]+/i },
  { label: 'bearer token', pattern: /Bearer\s+[A-Za-z0-9._-]+/i },
  { label: 'email address', pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { label: 'absolute home path', pattern: /\/home\/[A-Za-z0-9._-]+/ },
  { label: 'known local identity', pattern: /(?:devuser|ootakazuhiko|GMKP-OOTA)/i },
  { label: 'capture fixture identity', pattern: /(?:ops-qa|kind-ops-qa|operations-lab|tenant-a|team-a|policy-lab)/i },
  { label: 'unsafe placeholder credential', pattern: /(?:change-me|example-secret-value)/i },
  { label: 'IPv4 address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/ },
  { label: 'unmasked IPv6 address', pattern: /(?:[0-9A-Fa-f]{1,4}:){3,}[0-9A-Fa-f:]{1,}/ },
  { label: 'container identifier', pattern: /containerd:\/\/[0-9a-f]{12,}/i },
  { label: 'dynamic volume UUID', pattern: /pvc-[0-9a-f]{8}-[0-9a-f-]{27}/i },
];
const ARTIFACT_FORBIDDEN = FORBIDDEN.filter(({ label }) => label !== 'capture fixture identity');

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function publishTranscript(source) {
  return source.toString('utf8').replace(/\r\n/g, '\n')
    .replaceAll('operations-lab', '[masked-namespace]')
    .replaceAll('tenant-a', '[masked-tenant]')
    .replaceAll('team-a', '[masked-tenant]');
}

function loadSanitizedArtifact(repoRoot, errors) {
  const root = path.join(repoRoot, ARTIFACT_DIRECTORY);
  const buffers = new Map();
  let names = [];
  try {
    names = fs.readdirSync(root, { withFileTypes: true }).map((entry) => {
      if (!entry.isFile() || entry.isSymbolicLink()) errors.push(`sanitized capture artifact must contain regular files only: ${entry.name}`);
      return entry.name;
    }).sort();
  } catch (error) {
    errors.push(`sanitized capture artifact directory is missing: ${error.message}`);
    return buffers;
  }
  const expectedNames = Object.keys(ARTIFACT_FILE_SHA256).sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) errors.push('sanitized capture artifact inventory differs from the reviewed 15-file set');
  const fileSet = crypto.createHash('sha256');
  for (const name of names) {
    const file = path.join(root, name);
    let value;
    try {
      const stat = fs.lstatSync(file);
      if (!stat.isFile() || stat.isSymbolicLink()) continue;
      value = fs.readFileSync(file);
    } catch (error) {
      errors.push(`sanitized capture artifact file is unreadable: ${name}`);
      continue;
    }
    buffers.set(name, value);
    fileSet.update(name).update('\0').update(value).update('\0');
    if (sha256(value) !== ARTIFACT_FILE_SHA256[name]) errors.push(`sanitized capture artifact SHA-256 differs: ${name}`);
    const sensitiveText = value.toString('utf8');
    for (const forbidden of ARTIFACT_FORBIDDEN) {
      if (forbidden.pattern.test(sensitiveText)) errors.push(`sanitized capture artifact ${name}: ${forbidden.label} remains`);
    }
  }
  if (fileSet.digest('hex') !== ARTIFACT_FILE_SET_SHA256) errors.push('sanitized capture artifact file-set SHA-256 differs from the reviewed download');
  return buffers;
}

function readJson(file, errors, label) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${label} is not readable JSON: ${error.message}`);
    return {};
  }
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function decodePng(buffer) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) return { error: 'signature or IHDR is missing' };
  let offset = 8;
  let header;
  let sawIend = false;
  const imageData = [];
  const text = {};
  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) return { error: 'chunk header is truncated' };
    const length = buffer.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = typeStart + 4;
    const crcStart = dataStart + length;
    const nextOffset = crcStart + 4;
    if (nextOffset > buffer.length) return { error: 'chunk payload is truncated' };
    const typeBuffer = buffer.subarray(typeStart, dataStart);
    const type = typeBuffer.toString('ascii');
    const data = buffer.subarray(dataStart, crcStart);
    if (crc32(Buffer.concat([typeBuffer, data])) !== buffer.readUInt32BE(crcStart)) return { error: `${type} chunk CRC is invalid` };
    if (!header && type !== 'IHDR') return { error: 'IHDR is not the first chunk' };
    if (!ALLOWED_PNG_CHUNKS.has(type)) return { error: `unsupported PNG chunk ${type}` };
    if (type === 'IHDR') {
      if (header || length !== 13) return { error: 'IHDR is duplicated or malformed' };
      header = {
        width: data.readUInt32BE(0), height: data.readUInt32BE(4), bitDepth: data[8], colorType: data[9],
        compression: data[10], filter: data[11], interlace: data[12],
      };
    } else if (type === 'tEXt') {
      const separator = data.indexOf(0);
      if (separator <= 0) return { error: 'tEXt chunk is malformed' };
      const keyword = data.subarray(0, separator).toString('latin1');
      if (Object.hasOwn(text, keyword)) return { error: `tEXt keyword is duplicated: ${keyword}` };
      text[keyword] = data.subarray(separator + 1).toString('latin1');
    } else if (type === 'IDAT') {
      if (sawIend) return { error: 'IDAT appears after IEND' };
      imageData.push(data);
    } else if (type === 'IEND') {
      if (length !== 0 || sawIend) return { error: 'IEND is duplicated or malformed' };
      sawIend = true;
      if (nextOffset !== buffer.length) return { error: 'data remains after IEND' };
    }
    offset = nextOffset;
  }
  if (!header || !sawIend || imageData.length === 0) return { error: 'IHDR, IDAT, or IEND is missing' };
  if (!header.width || !header.height || header.compression !== 0 || header.filter !== 0 || header.interlace !== 0) {
    return { error: 'unsupported or invalid IHDR fields' };
  }
  if (header.width < MIN_WIDTH || header.width > MAX_WIDTH || header.height < MIN_HEIGHT || header.height > MAX_HEIGHT) {
    return { error: `image dimensions ${header.width}x${header.height} are outside the safety limits` };
  }
  const colorTypes = {
    0: { channels: 1, depths: [1, 2, 4, 8, 16] }, 2: { channels: 3, depths: [8, 16] },
    4: { channels: 2, depths: [8, 16] }, 6: { channels: 4, depths: [8, 16] },
  };
  const color = colorTypes[header.colorType];
  if (!color || !color.depths.includes(header.bitDepth)) {
    return { error: 'invalid color type or bit depth' };
  }
  const rowBytesBig = (BigInt(header.width) * BigInt(color.channels) * BigInt(header.bitDepth) + 7n) / 8n;
  const expectedBytesBig = BigInt(header.height) * (rowBytesBig + 1n);
  if (expectedBytesBig > BigInt(MAX_DECODED_BYTES)) return { error: 'decoded image exceeds the safety limit' };
  const rowBytes = Number(rowBytesBig);
  const expectedBytes = Number(expectedBytesBig);
  let pixels;
  try {
    pixels = zlib.inflateSync(Buffer.concat(imageData), { maxOutputLength: expectedBytes });
  } catch (error) {
    return { error: `IDAT cannot be inflated: ${error.message}` };
  }
  if (pixels.length !== expectedBytes) return { error: 'inflated scanline length is invalid' };
  for (let row = 0; row < header.height; row += 1) {
    if (pixels[row * (rowBytes + 1)] > 4) return { error: 'scanline filter type is invalid' };
  }
  return { width: header.width, height: header.height, text };
}

function listPngFiles(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) return listPngFiles(full);
    return entry.name.toLowerCase().endsWith('.png') ? [full] : [];
  });
}

function count(text, value) {
  return text.split(value).length - 1;
}

function workflowRunsCommand(workflow, command) {
  const lines = workflow.replace(/\r\n/g, '\n').split('\n');
  let stepsIndent = null;
  let stepIndent = null;
  let step = null;
  let blockScalarIndent = null;
  const exactCommand = (scalar) => [command, `'${command}'`, `"${command}"`].includes(scalar);
  const eligible = () => step && exactCommand(step.run) && !step.conditional && !step.failureTolerant;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const indent = line.match(/^\s*/)[0].length;
    if (blockScalarIndent !== null) {
      if (indent > blockScalarIndent) continue;
      blockScalarIndent = null;
    }
    if (line.trimStart().startsWith('#')) continue;
    if (/:\s*[|>][0-9+-]*\s*(?:#.*)?$/.test(line)) blockScalarIndent = indent;
    const steps = line.match(/^(\s*)steps:\s*$/);
    if (steps) {
      if (eligible()) return true;
      stepsIndent = steps[1].length;
      stepIndent = null;
      step = null;
      continue;
    }
    if (stepsIndent === null) continue;
    if (indent <= stepsIndent) {
      if (eligible()) return true;
      stepsIndent = null;
      stepIndent = null;
      step = null;
      continue;
    }
    const item = line.match(/^(\s*)-\s+(.*)$/);
    if (item && item[1].length === stepsIndent + 2) {
      if (eligible()) return true;
      stepIndent = item[1].length;
      step = { run: null, conditional: false, failureTolerant: false };
      const inlineRun = item[2].match(/^run:\s*(.*?)\s*$/);
      if (inlineRun) step.run = inlineRun[1];
      if (/^if\s*:/.test(item[2])) step.conditional = true;
      if (/^continue-on-error\s*:/.test(item[2])) step.failureTolerant = true;
      continue;
    }
    if (!step || stepIndent === null || indent !== stepIndent + 2) continue;
    const direct = line.trim();
    const directRun = direct.match(/^run:\s*(.*?)\s*$/);
    if (directRun) step.run = directRun[1];
    if (/^if\s*:/.test(direct)) step.conditional = true;
    if (/^continue-on-error\s*:/.test(direct)) step.failureTolerant = true;
  }
  return eligible();
}

function workflowJobBlock(workflow, jobName) {
  const lines = workflow.replace(/\r\n/g, '\n').split('\n');
  let jobsFound = false;
  let start = null;
  let blockScalarIndent = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const indent = line.match(/^\s*/)[0].length;
    if (blockScalarIndent !== null) {
      if (!line.trim() || indent > blockScalarIndent) continue;
      blockScalarIndent = null;
    }
    if (/^\s*[^#].*:\s*[|>][0-9+-]*\s*(?:#.*)?$/.test(line)) blockScalarIndent = indent;
    if (!jobsFound) {
      if (/^jobs:\s*$/.test(line)) jobsFound = true;
      continue;
    }
    if (line.trim() && indent === 0) break;
    const job = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (!job) continue;
    if (start !== null) return lines.slice(start, index).join('\n');
    if (job[1] === jobName) start = index;
  }
  return start === null ? null : lines.slice(start).join('\n');
}

function jobIsUnconditional(jobBlock) {
  return jobBlock && !/^    (?:if|continue-on-error)\s*:/m.test(jobBlock);
}

function validateVisualEvidence(repoRoot = path.resolve(__dirname, '..')) {
  const errors = [];
  const sourceManifestPath = path.join(repoRoot, 'src/assets/visual-evidence/manifest.json');
  const docsManifestPath = path.join(repoRoot, 'docs/assets/visual-evidence/manifest.json');
  const manifest = readJson(sourceManifestPath, errors, 'source visual-evidence manifest');
  const entries = Array.isArray(manifest.entries) ? manifest.entries : [];
  let sourceManifestBuffer;
  try {
    sourceManifestBuffer = fs.readFileSync(sourceManifestPath);
    if (!sourceManifestBuffer.equals(fs.readFileSync(docsManifestPath))) errors.push('generated visual-evidence manifest must exactly match canonical src manifest');
  } catch (error) {
    if (sourceManifestBuffer) errors.push(`generated visual-evidence manifest is missing: ${error.message}`);
  }

  const packageJson = readJson(path.join(repoRoot, 'package.json'), errors, 'package.json');
  const expectedScript = 'node scripts/check-visual-evidence.js && node scripts/check-visual-evidence-regression.js';
  if (packageJson.scripts?.['check:visual-evidence'] !== expectedScript) errors.push('package.json must define the complete check:visual-evidence contract');
  if (!packageJson.scripts?.test?.includes('npm run check:visual-evidence')) errors.push('package.json test must run check:visual-evidence');
  try {
    const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/book-qa.yml'), 'utf8');
    const qaJob = workflowJobBlock(workflow, 'qa');
    if (!qaJob) errors.push('Book QA must define the qa job');
    else {
      if (!jobIsUnconditional(qaJob)) errors.push('Book QA qa job must not have job-level if or continue-on-error');
      if (!workflowRunsCommand(qaJob, 'npm test')) errors.push('Book QA must run the local visual-evidence contract through npm test');
      if (!workflowRunsCommand(qaJob, 'npm run check:capture-provenance')) errors.push('Book QA must verify the immutable capture run through check:capture-provenance');
    }
  } catch (error) {
    errors.push('.github/workflows/book-qa.yml is missing');
  }
  try {
    const policy = fs.readFileSync(path.join(repoRoot, 'SCREENSHOTS.md'), 'utf8');
    for (const marker of [
      'src/assets/visual-evidence/manifest.json', 'npm run check:visual-evidence', 'npm run check:capture-provenance',
      'scripts/render-visual-evidence.js', 'raw transcript', ARTIFACT_DIRECTORY,
      'capture runの保持と更新', 'fail-closedで停止',
    ]) {
      if (!policy.includes(marker)) errors.push(`SCREENSHOTS.md must document ${marker}`);
    }
  } catch (error) {
    errors.push('SCREENSHOTS.md is missing');
  }
  try {
    const css = fs.readFileSync(path.join(repoRoot, 'docs/assets/css/main.css'), 'utf8');
    const responsiveRule = css.match(/\.page-content img,\s*\.page-content svg,\s*\.page-content video\s*\{([^}]*)\}/);
    if (!responsiveRule || !/max-width:\s*100%;/.test(responsiveRule[1]) || !/height:\s*auto;/.test(responsiveRule[1])) {
      errors.push('published CSS must keep visual evidence responsive');
    }
  } catch (error) {
    errors.push('published main.css is missing');
  }

  if (manifest.schemaVersion !== 1) errors.push('manifest schemaVersion must be 1');
  if (manifest.issue !== 16) errors.push('manifest issue must be 16');
  if (!/Actual command output only/.test(manifest.policy || '') || !/fabricated operational state is prohibited/.test(manifest.policy || '')) {
    errors.push('manifest policy must require actual output and prohibit fabrication');
  }
  if (!/^https:\/\/github\.com\/itdojp\/kubernetes-cluster-ops-book\/actions\/runs\/\d+$/.test(manifest.captureRun || '')) {
    errors.push('manifest captureRun must identify the successful isolated capture run');
  }
  const attestation = manifest.captureAttestation || {};
  const expectedAttestation = {
    repository: 'itdojp/kubernetes-cluster-ops-book', runId: 29956126898,
    runUrl: 'https://github.com/itdojp/kubernetes-cluster-ops-book/actions/runs/29956126898',
    workflowName: 'Temporary Issue 16 visual evidence capture', workflowPath: '.github/workflows/issue-16-capture.yml',
    event: 'push', headBranch: 'codex/issue-16-capture', headSha: '035e378825b79e45850c4f7f12ab84877f6f9038',
    captureWorkflowBlobSha: '5e67a410bc86c53f3241079d8e7e89d1075b5c88',
    captureScriptPath: '.github/issue-16-capture.sh', captureScriptBlobSha: 'd527b6b1ee27ddb0fa62a203675509f82e116a17',
    runAttempt: 1, status: 'completed', conclusion: 'success', artifactName: 'issue-16-sanitized-transcripts',
    artifactId: 8544117974, artifactSizeBytes: 6620,
    artifactSha256: 'e529d9e6967dc1fdca3fafdfa6ab23ee9fb54e1141c43ab43b341783d6639da7',
    artifactDeletedAfterVerification: true, sourceTranscriptCount: 14,
    sanitizedArtifactDirectory: ARTIFACT_DIRECTORY, sanitizedArtifactFileCount: 15,
    sanitizedArtifactFileSetSha256: ARTIFACT_FILE_SET_SHA256,
    publicationTransform: PUBLICATION_TRANSFORM,
  };
  for (const [key, expected] of Object.entries(expectedAttestation)) {
    if (attestation[key] !== expected) errors.push(`capture attestation ${key} differs from the reviewed successful run`);
  }
  if (manifest.captureRun !== attestation.runUrl) errors.push('captureRun and captureAttestation.runUrl must match');
  if (attestation.publishedTranscriptSetSha256 !== transcriptSetSha256(entries)) errors.push('published transcript-set SHA-256 differs from the capture attestation');
  try {
    const rendererHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(repoRoot, 'scripts/render-visual-evidence.js'))).digest('hex');
    const fontHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(repoRoot, 'scripts/visual-evidence-font.json'))).digest('hex');
    if (attestation.rendererSha256 !== rendererHash) errors.push('capture attestation renderer SHA-256 differs from the reviewed renderer');
    if (attestation.fontBitmapSha256 !== fontHash) errors.push('capture attestation font bitmap SHA-256 differs from the reviewed font');
  } catch (error) {
    errors.push(`deterministic renderer contract is missing: ${error.message}`);
  }
  if (entries.length !== EXPECTED.length) errors.push(`manifest entry count: expected ${EXPECTED.length}, got ${entries.length}`);
  const artifactBuffers = loadSanitizedArtifact(repoRoot, errors);

  const ids = new Set();
  const sourceFiles = new Set();
  const docsFiles = new Set();
  const hashes = new Set();
  entries.forEach((entry, index) => {
    const expected = EXPECTED[index];
    const label = entry.id || `entry[${index}]`;
    if (!entry.id || ids.has(entry.id)) errors.push(`${label}: duplicate or missing id`);
    ids.add(entry.id);
    if (!expected || entry.id !== expected[0] || entry.chapter !== expected[1]) errors.push(`${label}: entry order/id/chapter differs from the fixed 14-item P0 inventory`);
    const expectedSource = expected && `src/chapters/${expected[1]}/images/${expected[2]}`;
    const expectedDocs = expected && `docs/chapters/${expected[1]}/images/${expected[2]}`;
    if (entry.file !== expectedSource || entry.docsFile !== expectedDocs) {
      errors.push(`${label}: source/docs file paths differ from the fixed P0 inventory`);
      return;
    }
    const expectedArtifactFile = expected && `${ARTIFACT_DIRECTORY}/${expected[3]}`;
    if (entry.sourceArtifactFile !== expectedArtifactFile || entry.sourceArtifactSha256 !== ARTIFACT_FILE_SHA256[expected?.[3]]) {
      errors.push(`${label}: source artifact path/SHA-256 differs from the reviewed capture file`);
    }
    const artifactBuffer = expected && artifactBuffers.get(expected[3]);
    if (!artifactBuffer) errors.push(`${label}: reviewed source artifact transcript is missing`);
    else if (entry.displayedTranscript !== publishTranscript(artifactBuffer)) {
      errors.push(`${label}: displayed transcript does not match the deterministic publication transform of the reviewed artifact`);
    }
    sourceFiles.add(entry.file);
    docsFiles.add(entry.docsFile);
    const sourceAbsolute = path.join(repoRoot, entry.file);
    const docsAbsolute = path.join(repoRoot, entry.docsFile);
    try {
      if (fs.lstatSync(sourceAbsolute).isSymbolicLink() || fs.lstatSync(docsAbsolute).isSymbolicLink()) errors.push(`${label}: image files must be regular files, not symlinks`);
    } catch (error) {
      errors.push(`${label}: source or docs image is missing`);
      return;
    }
    let sourceBuffer;
    let docsBuffer;
    try {
      sourceBuffer = fs.readFileSync(sourceAbsolute);
      docsBuffer = fs.readFileSync(docsAbsolute);
    } catch (error) {
      errors.push(`${label}: source or docs image is unreadable`);
      return;
    }
    if (!sourceBuffer.equals(docsBuffer)) errors.push(`${label}: generated docs PNG must exactly match canonical src PNG`);
    try {
      const deterministic = renderVisualEvidence(entry);
      if (!sourceBuffer.equals(deterministic.buffer)) errors.push(`${label}: PNG raster/encoding must be the deterministic rendering of the checked transcript`);
    } catch (error) {
      errors.push(`${label}: deterministic rendering failed (${error.message})`);
    }
    if (sourceBuffer.length >= MAX_FILE_BYTES) errors.push(`${label}: image is ${sourceBuffer.length} bytes; must be below ${MAX_FILE_BYTES}`);
    const dimensions = decodePng(sourceBuffer);
    if (dimensions.error) {
      errors.push(`${label}: image is not a complete decodable PNG (${dimensions.error})`);
      return;
    }
    if (dimensions.width < MIN_WIDTH || dimensions.width > MAX_WIDTH || dimensions.height < MIN_HEIGHT || dimensions.height > MAX_HEIGHT) {
      errors.push(`${label}: image dimensions ${dimensions.width}x${dimensions.height} are outside ${MIN_WIDTH}-${MAX_WIDTH} x ${MIN_HEIGHT}-${MAX_HEIGHT}`);
    }
    if (entry.width !== dimensions.width || entry.height !== dimensions.height || entry.bytes !== sourceBuffer.length) {
      errors.push(`${label}: manifest dimensions/bytes do not match the PNG`);
    }
    const digest = crypto.createHash('sha256').update(sourceBuffer).digest('hex');
    if (entry.sha256 !== digest) errors.push(`${label}: SHA-256 does not match the PNG`);
    if (hashes.has(digest)) errors.push(`${label}: duplicate image content hash ${digest}`);
    hashes.add(digest);
    if (dimensions.text['visual-evidence-transcript'] !== entry.displayedTranscript) errors.push(`${label}: embedded PNG transcript must match the manifest`);
    if (dimensions.text['visual-evidence-captured-at'] !== entry.capturedAt) errors.push(`${label}: embedded PNG capture date must match the manifest`);
    if (dimensions.text['visual-evidence-environment'] !== entry.environment) errors.push(`${label}: embedded PNG environment must match the manifest`);
    for (const keyword of Object.keys(dimensions.text)) {
      if (!REQUIRED_PNG_TEXT_KEYS.includes(keyword)) errors.push(`${label}: unrecognized PNG tEXt keyword ${keyword}`);
    }

    if (!entry.alt || !entry.alt.includes('判断')) errors.push(`${label}: alt must state the reader decision point`);
    if (!entry.caption || !entry.caption.includes(entry.capturedAt || '') || !entry.caption.includes('JST') || !entry.caption.includes('判断')) {
      errors.push(`${label}: caption must include capture date, JST, and inspection intent`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.capturedAt || '') || entry.captureTimezone !== 'Asia/Tokyo (UTC+09:00)' || !entry.dateBasis) {
      errors.push(`${label}: capturedAt, captureTimezone, and dateBasis are required`);
    }
    if (!entry.environment || !entry.versions || Object.keys(entry.versions).length < 2 || !entry.captureSource || !entry.setupSummary) {
      errors.push(`${label}: environment, versions, captureSource, and setupSummary are required`);
    }
    const versionMarkers = Object.values(entry.versions).flatMap((value) => String(value).match(/\d+(?:\.\d+)+/g) || []);
    if (versionMarkers.length < 2 || !versionMarkers.every((marker) => entry.caption?.includes(marker))) {
      errors.push(`${label}: caption must include every dotted version marker`);
    }
    if (entry.sourceKind !== 'terminal-output') errors.push(`${label}: sourceKind must be terminal-output`);
    if (!Array.isArray(entry.sourceCommands) || entry.sourceCommands.length === 0 || !Array.isArray(entry.maskedFields)) {
      errors.push(`${label}: sourceCommands and maskedFields are required`);
    }
    if (typeof entry.displayedTranscript !== 'string' || !entry.displayedTranscript.endsWith('\n')) errors.push(`${label}: displayedTranscript must be newline-terminated text`);
    const transcriptCommands = typeof entry.displayedTranscript === 'string'
      ? entry.displayedTranscript.split('\n').filter((line) => line.startsWith('$ ')).map((line) => line.slice(2)) : [];
    if (JSON.stringify(transcriptCommands) !== JSON.stringify(entry.sourceCommands)) errors.push(`${label}: sourceCommands must exactly match displayed command lines`);
    const sensitiveText = JSON.stringify({ entry, pngText: dimensions.text });
    for (const forbidden of FORBIDDEN) if (forbidden.pattern.test(sensitiveText)) errors.push(`${label}: ${forbidden.label} remains in published evidence`);

    for (const rootName of ['src', 'docs']) {
      const chapterFile = path.join(repoRoot, rootName, 'chapters', entry.chapter, 'index.md');
      let chapterText;
      try {
        chapterText = fs.readFileSync(chapterFile, 'utf8').replace(/\r\n/g, '\n');
      } catch (error) {
        errors.push(`${label}: ${rootName} chapter source is missing`);
        continue;
      }
      const reference = `./images/${path.basename(entry.file)}`;
      const marker = `![${entry.alt}](${reference})\n\n_${entry.caption}_`;
      if (count(chapterText, reference) !== 1) errors.push(`${label}: ${rootName} chapter must reference the image exactly once`);
      if (count(chapterText, marker) !== 1) errors.push(`${label}: ${rootName} alt and immediate caption must match the manifest`);
    }
  });

  for (const [rootName, expectedFiles] of [['src', sourceFiles], ['docs', docsFiles]]) {
    const inventory = listPngFiles(path.join(repoRoot, rootName))
      .map((file) => path.relative(repoRoot, file).split(path.sep).join('/')).sort();
    const expectedInventory = [...expectedFiles].sort();
    for (const file of inventory) if (!expectedFiles.has(file)) errors.push(`untracked ${rootName} screenshot PNG: ${file}`);
    for (const file of expectedInventory) if (!inventory.includes(file)) errors.push(`manifest references absent ${rootName} screenshot PNG: ${file}`);
  }
  return errors;
}

if (require.main === module) {
  const errors = validateVisualEvidence();
  if (errors.length) {
    console.error(`Visual-evidence contract failed (${errors.length}):`);
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(`Visual-evidence contract passed: ${EXPECTED.length} PNGs with src/docs sync, provenance, embedded transcript, and sensitive-data checks.`);
}

module.exports = { crc32, validateVisualEvidence };
