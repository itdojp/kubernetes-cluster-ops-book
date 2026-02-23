#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

async function copyDirectory(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function build() {
  const sourceDir = path.join(process.cwd(), 'docs');
  const outputDir = path.join(process.cwd(), 'dist');

  // clean dist
  try {
    await fs.rm(outputDir, { recursive: true, force: true });
  } catch (_) {}

  await copyDirectory(sourceDir, outputDir);
  console.log('✅ Build completed:', outputDir);
}

if (require.main === module) {
  build().catch((err) => {
    console.error('❌ Build failed:', err);
    process.exit(1);
  });
}

module.exports = build;
