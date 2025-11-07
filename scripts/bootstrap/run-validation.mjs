#!/usr/bin/env node
import { createHash, randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { promisify } from 'util';

const exec = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const parseArgs = () => {
  const map = new Map();
  for (let i = 2; i < process.argv.length; i += 1) {
    const arg = process.argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.replace(/^--/, '');
    const value = process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
      ? process.argv[i + 1]
      : 'true';
    if (value !== 'true') {
      i += 1;
    }
    map.set(key, value);
  }
  return map;
};

const args = parseArgs();
const outputArg = args.get('output');
if (!outputArg) {
  console.error('Missing --output <path> argument');
  process.exit(1);
}
const outputPath = resolve(repoRoot, outputArg);
const mode = process.env.BOOTSTRAP_VALIDATION_MODE || 'live';

const safeExec = async (command, commandArgs, options = {}) => {
  try {
    const { stdout, stderr } = await exec(command, commandArgs, options);
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error) {
    return {
      ok: false,
      stdout: (error.stdout || '').toString().trim(),
      stderr: (error.stderr || error.message || '').toString().trim(),
      code: error.code ?? 1,
    };
  }
};

const remediation = new Set();
const prerequisites = [
  { name: 'Docker', status: 'fail', details: 'docker compose unavailable' },
  { name: 'SDE archive', status: 'fail', details: 'checksum not verified' },
];
const dockerPrereq = prerequisites[0];
const checksumPrereq = prerequisites[1];

if (mode === 'sample') {
  try {
    const samplePath = resolve(repoRoot, 'logs/bootstrap/sample-validation.json');
    const sample = JSON.parse(await readFile(samplePath, 'utf8'));
    const samplePrereqs = Array.isArray(sample.prerequisites) && sample.prerequisites.length > 0
      ? sample.prerequisites
      : [
          { name: 'Docker', status: 'pass', details: 'Sample mode bypass' },
          { name: 'SDE archive', status: 'pass', details: 'Sample mode bypass' },
        ];
    const report = {
      ...sample,
      run_id: randomUUID(),
      timestamp: new Date().toISOString(),
      prerequisites: samplePrereqs,
      remediation_actions: sample.remediation_actions ?? [],
      ok: true,
    };
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    process.exit(0);
  } catch (error) {
    console.error(`Failed to load sample validation fixture: ${error.message}`);
    process.exit(1);
  }
}

// Docker availability
const dockerVersion = await safeExec('docker', ['compose', 'version'], { cwd: repoRoot });
if (dockerVersion.ok) {
  dockerPrereq.status = 'pass';
  dockerPrereq.details = dockerVersion.stdout.split('\n')[0];
} else {
  dockerPrereq.details = dockerVersion.stderr || 'docker compose command failed';
  remediation.add('Start Docker and rerun the bootstrap validation');
}

const containers = [];
if (dockerPrereq.status === 'pass') {
  const psResult = await safeExec('docker', ['compose', 'ps', '--format', 'json'], { cwd: repoRoot });
  if (psResult.ok && psResult.stdout) {
    try {
      const serviceEntries = psResult.stdout
        .split(/\n+/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line));
      for (const entry of serviceEntries) {
        const inspectResult = await safeExec('docker', ['inspect', entry.ID, '--format', '{{json .State.Health}}']);
        let state = entry.State ?? 'unknown';
        let healthOutput = '';
        if (inspectResult.ok && inspectResult.stdout) {
          try {
            const health = JSON.parse(inspectResult.stdout);
            state = health.Status || state;
            const logEntry = Array.isArray(health.Log) && health.Log.length > 0
              ? health.Log[health.Log.length - 1]
              : null;
            if (logEntry && logEntry.Output) {
              healthOutput = logEntry.Output.trim();
            }
          } catch {
            healthOutput = inspectResult.stdout;
          }
        } else {
          healthOutput = inspectResult.stderr || 'Health check unavailable';
        }
        containers.push({
          name: entry.Service || entry.Name || 'unknown',
          state,
          health_output: healthOutput,
          ports: entry.Ports ? entry.Ports.split(',').map((value) => value.trim()) : [],
        });
      }
    } catch (error) {
      remediation.add(`Failed to parse docker compose output: ${error.message}`);
    }
  } else {
    remediation.add('Run `docker compose up -d` before executing bootstrap validation');
  }
}

const endpoints = [];
const apiBase = process.env.VALIDATION_API_BASE ?? 'http://localhost:3400';
const webBase = process.env.VALIDATION_WEB_BASE ?? 'http://localhost:5600';

const targets = [
  { url: `${apiBase.replace(/\/$/, '')}/health`, label: 'API health' },
  { url: webBase.replace(/\/$/, ''), label: 'Web shell' },
];

for (const target of targets) {
  const started = Date.now();
  try {
    const response = await fetch(target.url, { method: 'GET' });
    const buffer = Buffer.from(await response.arrayBuffer());
    const latency = Date.now() - started;
    const digest = createHash('sha256').update(buffer).digest('hex');
    endpoints.push({
      url: target.url,
      status_code: response.status,
      latency_ms: latency,
      payload_digest: `sha256:${digest}`,
    });
    if (response.status >= 400) {
      remediation.add(`Investigate ${target.label} response (status ${response.status})`);
    }
  } catch (error) {
    endpoints.push({
      url: target.url,
      status_code: 0,
      latency_ms: null,
      payload_digest: 'unavailable',
    });
    const message = error && error.message ? error.message : 'unknown error';
    remediation.add(`Unable to reach ${target.label}: ${message}`);
    if (String(message).includes('ECONNREFUSED')) {
  remediation.add('Resolve port conflicts by adjusting `HOST_API_PORT`/`HOST_WEB_PORT` (or overriding VALIDATION_* env vars) and restarting `docker compose up -d`.');
    }
  }
}

// SDE checksum
const checksumScript = resolve(__dirname, 'verify-sde-checksum.mjs');
const checksumResult = await safeExec('node', [checksumScript, '--format', 'json']);
if (checksumResult.ok) {
  try {
    const parsed = JSON.parse(checksumResult.stdout);
    checksumPrereq.status = parsed.status === 'pass' ? 'pass' : 'fail';
    checksumPrereq.details = parsed.status === 'pass'
      ? 'Checksum verified'
      : `Expected ${parsed.expected}, got ${parsed.actual}`;
    if (checksumPrereq.status !== 'pass') {
  remediation.add('Re-download eve-online-static-data-3031812-json.zip to restore expected checksum');
    }
  } catch (error) {
    checksumPrereq.details = `Checksum parsing failed: ${error.message}`;
    remediation.add('Re-run checksum verification with `node scripts/bootstrap/verify-sde-checksum.mjs --format text`');
  }
} else {
  checksumPrereq.details = checksumResult.stderr || 'Checksum script failed';
  remediation.add('Ensure the Eve SDE archive is present before running validation');
}

const isHealthyState = (state) => ['healthy', 'running'].includes(String(state).toLowerCase());
const allContainersHealthy = containers.length > 0 && containers.every((item) => isHealthyState(item.state));
const allEndpointsHealthy = endpoints.every((item) => item.status_code >= 200 && item.status_code < 400);

const overallPass = dockerPrereq.status === 'pass'
  && checksumPrereq.status === 'pass'
  && allContainersHealthy
  && allEndpointsHealthy;

const report = {
  run_id: randomUUID(),
  timestamp: new Date().toISOString(),
  containers,
  endpoints,
  prerequisites,
  summary: overallPass
    ? 'Bootstrap validation succeeded for all services.'
    : 'Bootstrap validation detected issues. Review remediation actions.',
  remediation_actions: Array.from(remediation),
  ok: overallPass,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

if (!overallPass) {
  process.exitCode = 1;
}
