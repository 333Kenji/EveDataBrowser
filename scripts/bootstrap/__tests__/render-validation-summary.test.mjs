import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join, resolve } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'url';

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..', '..');
const renderer = resolve(repoRoot, 'scripts/bootstrap/render-validation-summary.mjs');
const sample = resolve(repoRoot, 'logs/bootstrap/sample-validation.json');

const createTempDir = async () => mkdtemp(join(tmpdir(), 'bootstrap-render-'));

await test('renders markdown summary to file', async () => {
  const tempDir = await createTempDir();
  const outputFile = join(tempDir, 'summary.md');
  await exec('node', [renderer, '--input', sample, '--output', outputFile]);
  const markdown = await readFile(outputFile, 'utf8');
  assert.ok(markdown.includes('# Bootstrap Validation Summary'), 'includes heading');
  assert.ok(markdown.includes('| Container | State |'), 'includes container table');
  await rm(tempDir, { recursive: true, force: true });
});

await test('supports stdout output', async () => {
  const result = await exec('node', [renderer, '--input', sample]);
  assert.match(result.stdout, /Endpoint Responses/);
  assert.match(result.stdout, /Remediation Actions/);
});
