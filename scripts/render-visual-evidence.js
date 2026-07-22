#!/usr/bin/env node
/* Deterministic, dependency-free renderer: the checked transcript is the sole variable raster input. */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const FONT_PATH = path.join(__dirname, 'visual-evidence-font.json');
const FONT_SHA256 = 'ac3f74b72bede216a4a9cd0e328ee17f85c2123dc35298782845937805ddbd07';
const fontBytes = fs.readFileSync(FONT_PATH);
if (crypto.createHash('sha256').update(fontBytes).digest('hex') !== FONT_SHA256) {
  throw new Error('visual-evidence font bitmap differs from the reviewed renderer contract');
}
const FONT = JSON.parse(fontBytes.toString('utf8'));

const WIDTH = 1400;
const MARGIN_X = 42;
const HEADER_HEIGHT = 64;
const BODY_TOP = 84;
const LINE_HEIGHT = 36;
const CELL_WIDTH = 20;
const GLYPH_SCALE = 2;
const WRAP_COLUMNS = 64;
const MIN_HEIGHT = 420;
const MAX_HEIGHT = 2550;
const COLORS = {
  background: [16, 24, 32], header: [29, 42, 53], normal: [229, 233, 240],
  command: [139, 213, 202], success: [166, 218, 149], error: [237, 135, 150], headerText: [183, 200, 214],
};

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
function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}
function textChunk(keyword, value) {
  const key = Buffer.from(keyword, 'latin1');
  const text = Buffer.from(value, 'latin1');
  if (key.length < 1 || key.length > 79 || key.includes(0) || text.length !== value.length) {
    throw new Error(`PNG tEXt value is not Latin-1 safe: ${keyword}`);
  }
  return pngChunk('tEXt', Buffer.concat([key, Buffer.from([0]), text]));
}
function expandTabs(line) {
  let result = '';
  for (const character of line) {
    if (character === '\t') result += ' '.repeat(4 - (result.length % 4));
    else result += character;
  }
  return result;
}
function lineColor(line) {
  if (line.startsWith('$ ')) return COLORS.command;
  if (line === 'yes' || line.includes('PASS')) return COLORS.success;
  if (line === 'no' || line.includes('Forbidden')) return COLORS.error;
  return COLORS.normal;
}
function wrapTranscript(transcript) {
  const output = [];
  for (const rawLine of transcript.replace(/\r\n/g, '\n').replace(/\n$/, '').split('\n')) {
    const color = lineColor(rawLine);
    let remaining = expandTabs(rawLine);
    if (!remaining) { output.push({ text: '', color }); continue; }
    let continuation = false;
    while (remaining.length > 0) {
      const prefix = continuation ? '  ' : '';
      const available = WRAP_COLUMNS - prefix.length;
      output.push({ text: prefix + remaining.slice(0, available), color });
      remaining = remaining.slice(available);
      continuation = true;
    }
  }
  return output;
}
function fillRow(raw, row, color) {
  const stride = 1 + WIDTH * 3;
  let offset = row * stride + 1;
  for (let x = 0; x < WIDTH; x += 1) {
    raw[offset] = color[0]; raw[offset + 1] = color[1]; raw[offset + 2] = color[2]; offset += 3;
  }
}
function setPixel(raw, height, x, y, color) {
  if (x < 0 || x >= WIDTH || y < 0 || y >= height) return;
  const offset = y * (1 + WIDTH * 3) + 1 + x * 3;
  raw[offset] = color[0]; raw[offset + 1] = color[1]; raw[offset + 2] = color[2];
}
function drawText(raw, height, text, x, y, color) {
  let cursor = x;
  for (const character of text) {
    const code = character.codePointAt(0);
    const rows = FONT.glyphs[String(code)];
    if (!rows) throw new Error(`unsupported visual-evidence raster character U+${code.toString(16).toUpperCase()}`);
    for (let glyphY = 0; glyphY < FONT.height; glyphY += 1) {
      for (let glyphX = 0; glyphX < FONT.width; glyphX += 1) {
        if ((rows[glyphY] & (1 << (FONT.width - 1 - glyphX))) === 0) continue;
        for (let dy = 0; dy < GLYPH_SCALE; dy += 1) {
          for (let dx = 0; dx < GLYPH_SCALE; dx += 1) {
            setPixel(raw, height, cursor + glyphX * GLYPH_SCALE + dx, y + glyphY * GLYPH_SCALE + dy, color);
          }
        }
      }
    }
    cursor += CELL_WIDTH;
  }
}
function renderVisualEvidence(entry) {
  if (typeof entry.displayedTranscript !== 'string' || !entry.displayedTranscript.endsWith('\n')) {
    throw new Error(`${entry.id || 'entry'}: displayedTranscript must be newline terminated`);
  }
  const lines = wrapTranscript(entry.displayedTranscript);
  const height = Math.max(MIN_HEIGHT, BODY_TOP + lines.length * LINE_HEIGHT + 36);
  if (height > MAX_HEIGHT) throw new Error(`${entry.id}: deterministic render height ${height} exceeds ${MAX_HEIGHT}`);
  const stride = 1 + WIDTH * 3;
  const raw = Buffer.alloc(height * stride);
  for (let row = 0; row < height; row += 1) fillRow(raw, row, row < HEADER_HEIGHT ? COLORS.header : COLORS.background);
  const header = `Sanitized execution evidence | ${entry.chapter} | ${entry.capturedAt} JST`;
  if (header.length > WRAP_COLUMNS) throw new Error(`${entry.id}: deterministic header is too long`);
  drawText(raw, height, header, MARGIN_X, 16, COLORS.headerText);
  lines.forEach((line, index) => drawText(raw, height, line.text, MARGIN_X, BODY_TOP + index * LINE_HEIGHT, line.color));

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(WIDTH, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const buffer = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    textChunk('visual-evidence-transcript', entry.displayedTranscript),
    textChunk('visual-evidence-captured-at', entry.capturedAt),
    textChunk('visual-evidence-environment', entry.environment),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return { buffer, width: WIDTH, height };
}
function transcriptSetSha256(entries) {
  const hash = crypto.createHash('sha256');
  for (const entry of entries) hash.update(entry.id).update('\0').update(entry.displayedTranscript).update('\0');
  return hash.digest('hex');
}
function writeRepositoryEvidence(repoRoot) {
  const sourceManifest = path.join(repoRoot, 'src/assets/visual-evidence/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(sourceManifest, 'utf8'));
  for (const entry of manifest.entries) {
    const rendered = renderVisualEvidence(entry);
    for (const relativePath of [entry.file, entry.docsFile]) {
      const destination = path.join(repoRoot, relativePath);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, rendered.buffer);
    }
    entry.width = rendered.width;
    entry.height = rendered.height;
    entry.bytes = rendered.buffer.length;
    entry.sha256 = crypto.createHash('sha256').update(rendered.buffer).digest('hex');
  }
  manifest.captureAttestation.publishedTranscriptSetSha256 = transcriptSetSha256(manifest.entries);
  const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(sourceManifest, serialized);
  const docsManifest = path.join(repoRoot, 'docs/assets/visual-evidence/manifest.json');
  fs.mkdirSync(path.dirname(docsManifest), { recursive: true });
  fs.writeFileSync(docsManifest, serialized);
  console.log(`Rendered ${manifest.entries.length} deterministic visual-evidence PNGs.`);
}

if (require.main === module) {
  if (process.argv[2] !== '--write' || process.argv.length !== 3) {
    console.error('Usage: node scripts/render-visual-evidence.js --write');
    process.exit(2);
  }
  writeRepositoryEvidence(path.resolve(__dirname, '..'));
}
module.exports = { renderVisualEvidence, transcriptSetSha256 };
