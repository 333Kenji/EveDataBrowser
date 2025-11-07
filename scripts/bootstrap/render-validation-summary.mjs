#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'fs';
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

const inputPath = args.get('input');
if (!inputPath) {
  console.error('Missing --input <path> argument');
  process.exit(1);
}

const outputPath = args.get('output');

const resolvedInput = resolve(inputPath);
const data = JSON.parse(readFileSync(resolvedInput, 'utf8'));

const lines = [];
lines.push('# Bootstrap Validation Summary');
lines.push('');
lines.push(`- **Run ID**: ${data.run_id}`);
lines.push(`- **Timestamp**: ${data.timestamp}`);
if (typeof data.duration_ms === 'number') {
  lines.push(`- **Runtime**: ${(data.duration_ms / 1000).toFixed(2)} seconds`);
}
lines.push(`- **Summary**: ${data.summary}`);
lines.push('');

if (Array.isArray(data.containers) && data.containers.length > 0) {
  lines.push('### Container Health Snapshot');
  lines.push('');
  lines.push('_Table 1: Container readiness, mapped ports, and latest health output._');
  lines.push('');
  lines.push('| Container | State | Ports | Health Output |');
  lines.push('|-----------|-------|-------|----------------|');
  for (const container of data.containers) {
    const ports = Array.isArray(container.ports) ? container.ports.join('<br/>') : '';
    const healthOutput = (container.health_output || '').replace(/\n/g, '<br/>');
    lines.push(`| ${container.name} | ${container.state} | ${ports} | ${healthOutput} |`);
  }
  lines.push('');
}

if (Array.isArray(data.endpoints) && data.endpoints.length > 0) {
  lines.push('### Endpoint Responses');
  lines.push('');
  lines.push('_Table 2: Outcome of health endpoint probes used by bootstrap validation._');
  lines.push('');
  lines.push('| Endpoint | Status | Latency (ms) | Payload Digest |');
  lines.push('|----------|--------|--------------|----------------|');
  for (const endpoint of data.endpoints) {
    lines.push(`| ${endpoint.url} | ${endpoint.status_code} | ${endpoint.latency_ms ?? ''} | ${endpoint.payload_digest} |`);
  }
  lines.push('');
}

if (Array.isArray(data.prerequisites) && data.prerequisites.length > 0) {
  lines.push('## Prerequisites');
  lines.push('');
  for (const pre of data.prerequisites) {
    lines.push(`- **${pre.name}** — ${pre.status}${pre.details ? `: ${pre.details}` : ''}`);
  }
  lines.push('');
}

if (Array.isArray(data.remediation_actions)) {
  lines.push('## Remediation Actions');
  lines.push('');
  if (data.remediation_actions.length === 0) {
    lines.push('- None required.');
  } else {
    for (const action of data.remediation_actions) {
      lines.push(`- ${action}`);
    }
  }
  lines.push('');
}

const markdown = `${lines.join('\n')}\n`;

if (outputPath) {
  writeFileSync(resolve(outputPath), markdown, 'utf8');
} else {
  process.stdout.write(markdown);
}
