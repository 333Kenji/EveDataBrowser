#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import process from "node:process";

function parseArgs(argv) {
  const args = { input: "data/sde", output: "logs/staging-manifests" };
  for (let i = 2; i < argv.length; i += 1) {
    const current = argv[i];
    const next = argv[i + 1];
    if ((current === "--input" || current === "-i") && next) {
      args.input = next;
      i += 1;
    } else if ((current === "--output" || current === "-o") && next) {
      args.output = next;
      i += 1;
    } else if (current === "--help" || current === "-h") {
      printHelp();
      process.exit(0);
    } else {
      console.warn(`Ignoring unrecognised argument: ${current}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/bootstrap/generate-sde-manifest.mjs [options]\n\nOptions:\n  -i, --input   Directory containing SDE .jsonl files (default: data/sde)\n  -o, --output  Directory to write manifest files (default: logs/staging-manifests)\n  -h, --help    Show this help message`);
}

async function checksumFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}

async function collectEntries(inputDir) {
  const entries = await readdir(inputDir, { withFileTypes: true });
  const jsonlEntries = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"));
  if (jsonlEntries.length === 0) {
    throw new Error(`No .jsonl files found in ${inputDir}`);
  }

  const results = [];
  for (const entry of jsonlEntries) {
    const absolutePath = path.join(inputDir, entry.name);
    const stats = await stat(absolutePath);
    const checksum = await checksumFile(absolutePath);
    results.push({
      name: entry.name,
      relativePath: path.relative(process.cwd(), absolutePath),
      sizeBytes: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      checksum,
    });
  }

  results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

async function main() {
  try {
    const { input, output } = parseArgs(process.argv);
    const absoluteInput = path.resolve(process.cwd(), input);
    const absoluteOutput = path.resolve(process.cwd(), output);

    const files = await collectEntries(absoluteInput);
    await mkdir(absoluteOutput, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const manifestPath = path.join(absoluteOutput, `sde-manifest-${timestamp}.json`);
    const manifest = {
      generatedAt: new Date().toISOString(),
      inputDir: path.relative(process.cwd(), absoluteInput),
      fileCount: files.length,
      files,
    };

    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    console.log(`Manifest written to ${path.relative(process.cwd(), manifestPath)}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

await main();
