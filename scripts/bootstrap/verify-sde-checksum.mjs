#!/usr/bin/env node
import { createHash } from 'crypto';
import { createReadStream, statSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (arg.startsWith('--')) {
    const key = arg.replace(/^--/, '');
    const value = process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
      ? process.argv[i + 1]
      : 'true';
    if (value !== 'true') {
      i += 1;
    }
    args.set(key, value);
  }
}

const fileArg = args.get('file');
const expectedArg = args.get('expected');
const metadataArg = args.get('metadata');
const format = args.get('format') || 'text';

const DEFAULT_ARCHIVE = 'eve-online-static-data-3031812-json.zip';
const DEFAULT_EXPECTED = process.env.EVE_SDE_SHA256 || null;
const DEFAULT_METADATA = 'logs/bootstrap/sde-lite/metadata.json';

const filePath = resolve(fileArg || DEFAULT_ARCHIVE);
const metadataPath = metadataArg ? resolve(metadataArg) : resolve(DEFAULT_METADATA);

const readMetadataChecksum = (targetPath) => {
  if (!targetPath || !existsSync(targetPath)) {
    return null;
  }

  try {
    const raw = readFileSync(targetPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.checksum === 'string') {
      return parsed.checksum;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(`Failed to read checksum metadata from ${targetPath}: ${error.message}`);
  }

  return null;
};

let expected = expectedArg || DEFAULT_EXPECTED;
if (!expected) {
  expected = readMetadataChecksum(metadataPath);
}
expected = expected ? String(expected).toLowerCase() : null;

const respond = (payload, exitCode) => {
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } else {
    process.stdout.write(`${payload.status.toUpperCase()}: ${payload.actual} (expected ${payload.expected})\n`);
  }
  process.exit(exitCode);
};

if (!expected) {
  respond({
    status: 'fail',
    file: filePath,
    expected: null,
    actual: null,
    metadata: metadataPath,
    message: 'Expected checksum not provided. Supply --expected, set EVE_SDE_SHA256, or ensure metadata.json exists.',
  }, 1);
}

try {
  statSync(filePath);
} catch (error) {
  respond({
    status: 'fail',
    file: filePath,
    expected,
    actual: null,
    message: `Archive not found at ${filePath}`,
  }, 1);
}

const hash = createHash('sha256');
const stream = createReadStream(filePath);

stream.on('data', (chunk) => {
  hash.update(chunk);
});

stream.on('error', (error) => {
  respond({
    status: 'fail',
    file: filePath,
    expected,
    actual: null,
    message: error.message,
  }, 1);
});

stream.on('end', () => {
  const actual = hash.digest('hex');
  const match = actual === expected;
  respond({
    status: match ? 'pass' : 'fail',
    file: filePath,
    expected,
    actual,
    metadata: metadataPath,
  }, match ? 0 : 1);
});
