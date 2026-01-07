#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function usage() {
  console.error('Usage: node scripts/prepare-asar.js <version>');
}

function extractI18nBlock(content) {
  const regex = /const i18n = \{([\s\S]*?)^\s*\};/m;
  const match = content.match(regex);
  if (!match) {
    throw new Error('Unable to locate i18n block.');
  }
  return {
    block: match[1],
    start: match.index,
    end: match.index + match[0].length,
  };
}

function parseI18n(block) {
  const literal = `{${block}}`;
  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${literal});`)();
}

function mergeI18n(originalPath, overlayPath) {
  const originalContent = fs.readFileSync(originalPath, 'utf8');
  const overlayContent = fs.readFileSync(overlayPath, 'utf8');

  const originalBlock = extractI18nBlock(originalContent);
  const overlayBlock = extractI18nBlock(overlayContent);

  const originalMap = parseI18n(originalBlock.block);
  const overlayMap = parseI18n(overlayBlock.block);

  const missingEntries = [];
  for (const [key, value] of Object.entries(overlayMap)) {
    if (!(key in originalMap)) {
      missingEntries.push([key, value]);
    }
  }

  if (missingEntries.length === 0) {
    return;
  }

  const indentMatch = originalContent.slice(0, originalBlock.start).match(/(^|\n)(\s*)const i18n/);
  const baseIndent = indentMatch ? indentMatch[2] : '';
  const entryIndent = `${baseIndent}    `;

  const trimmedBlock = originalBlock.block.replace(/\s*$/, '');
  const newLines = missingEntries
    .map(([key, value]) => `${entryIndent}${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    .join('\n');

  const updatedBlock = `${trimmedBlock}\n${newLines}\n${baseIndent}`;
  const updatedContent = `${originalContent.slice(0, originalBlock.start)}const i18n = {${updatedBlock}};${originalContent.slice(originalBlock.end)}`;

  fs.writeFileSync(originalPath, updatedContent, 'utf8');
}

function findPreloadFile(rootDir) {
  const matches = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile() && entry.name === 'preload.js') {
        matches.push(fullPath);
      }
    }
  }
  walk(rootDir);
  return matches;
}

function main() {
  const version = process.argv[2];
  if (!version) {
    usage();
    process.exit(1);
  }

  const repoRoot = path.resolve(__dirname, '..');
  const inputDir = path.join(repoRoot, 'inputs', version);
  const inputAsar = path.join(inputDir, 'app.asar');
  const inputUnpacked = path.join(inputDir, 'app.asar.unpacked');

  if (!fs.existsSync(inputAsar)) {
    throw new Error(`Missing app.asar at ${inputAsar}`);
  }
  if (!fs.existsSync(inputUnpacked)) {
    throw new Error(`Missing app.asar.unpacked at ${inputUnpacked}`);
  }

  const workDir = fs.mkdtempSync(path.join(repoRoot, 'asar-work-'));
  const extractedDir = path.join(workDir, 'extracted');
  const outputDir = path.join(workDir, 'output');
  fs.mkdirSync(extractedDir, { recursive: true });
  fs.mkdirSync(outputDir, { recursive: true });

  const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  execFileSync(npxCommand, ['--yes', 'asar', 'extract', inputAsar, extractedDir], { stdio: 'inherit' });
  fs.cpSync(inputUnpacked, extractedDir, { recursive: true, force: true });

  const preloadMatches = findPreloadFile(extractedDir);
  if (preloadMatches.length !== 1) {
    throw new Error(`Expected exactly one preload.js, found ${preloadMatches.length}: ${preloadMatches.join(', ')}`);
  }

  const projectPreload = path.join(repoRoot, 'preload.js');
  mergeI18n(preloadMatches[0], projectPreload);

  const unpackEntries = fs.readdirSync(inputUnpacked, { withFileTypes: true });
  const unpackDirs = unpackEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  const unpackFiles = unpackEntries.filter((entry) => entry.isFile()).map((entry) => entry.name);

  const outputAsar = path.join(outputDir, 'app.asar');
  const packArgs = ['--yes', 'asar', 'pack', extractedDir, outputAsar];

  for (const dir of unpackDirs) {
    packArgs.push('--unpack-dir', dir);
  }
  for (const file of unpackFiles) {
    packArgs.push('--unpack', file);
  }

  execFileSync(npxCommand, packArgs, { stdio: 'inherit' });

  fs.copyFileSync(outputAsar, path.join(repoRoot, 'app.asar'));
  fs.rmSync(workDir, { recursive: true, force: true });
}

main();
