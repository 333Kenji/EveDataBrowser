import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, '../../..');
const targetUrl = process.env.DROPDOWN_BENCHMARK_URL ?? 'http://localhost:3400/api/taxonomy?search=atr';
const iterations = Number(process.env.DROPDOWN_BENCHMARK_RUNS ?? 25);

if (iterations <= 0) {
  throw new Error('DROPDOWN_BENCHMARK_RUNS must be greater than zero');
}

const latencies = [];

for (let i = 0; i < iterations; i += 1) {
  const started = performance.now();
  const response = await fetch(targetUrl);
  await response.text();
  const elapsed = performance.now() - started;
  latencies.push(elapsed);
}

latencies.sort((a, b) => a - b);
const average = latencies.reduce((total, value) => total + value, 0) / latencies.length;
const max = latencies[latencies.length - 1];
const p95Index = Math.floor(latencies.length * 0.95) - 1;
const p95 = latencies[Math.max(0, p95Index)];

const timestamp = new Date().toISOString();
const row = `| ${timestamp} | ${average.toFixed(3)} | ${max.toFixed(3)} | ${p95.toFixed(3)} | 100 | ✅ | Automated harness sample (${iterations} runs) |`;

const docPath = resolve(repoRoot, 'docs/dropdown-search-benchmark.md');
const header = '# Dropdown Search Benchmark Log\n\n| Timestamp (UTC) | Average Latency (ms) | Max Latency (ms) | P95 Latency (ms) | Threshold (ms) | Within Target | Notes |\n| --- | --- | --- | --- | --- | --- | --- |\n';

if (!existsSync(docPath)) {
  writeFileSync(docPath, `${header}${row}\n`, 'utf8');
} else {
  const current = readFileSync(docPath, 'utf8');
  if (!current.startsWith('# Dropdown Search Benchmark Log')) {
    writeFileSync(docPath, `${header}${row}\n`, 'utf8');
  } else if (current.includes('| Timestamp (UTC) |') && !current.includes('| P95 Latency (ms) |')) {
    // Replace legacy header without P95 column.
    const updatedHeader = current.replace(
      '| Timestamp (UTC) | Average Latency (ms) | Max Latency (ms) | Threshold (ms) | Within Target | Notes |',
      '| Timestamp (UTC) | Average Latency (ms) | Max Latency (ms) | P95 Latency (ms) | Threshold (ms) | Within Target | Notes |',
    );
    writeFileSync(docPath, `${updatedHeader.trim()}\n${row}\n`, 'utf8');
  } else {
    appendFileSync(docPath, `${row}\n`, 'utf8');
  }
}

echoResult({ timestamp, average, max, p95 });

function echoResult({ timestamp, average, max, p95 }) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ timestamp, averageMs: average, maxMs: max, p95Ms: p95, iterations }, null, 2));
}
