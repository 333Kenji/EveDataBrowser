#!/usr/bin/env node
import { performance } from 'node:perf_hooks';

const fallbackDataset = [
  {
    id: 'ships',
    name: 'Ships',
    groups: [
      {
        id: 'frigates',
        name: 'Frigates',
        types: ['Atron', 'Condor', 'Executioner'],
      },
      {
        id: 'destroyers',
        name: 'Destroyers',
        types: ['Cormorant', 'Catalyst', 'Thrasher'],
      },
    ],
  },
  {
    id: 'modules',
    name: 'Modules',
    groups: [
      {
        id: 'afterburners',
        name: 'Afterburners',
        types: ['1MN Afterburner I', '5MN Microwarpdrive I'],
      },
      {
        id: 'armor',
        name: 'Armor Plates',
        types: ['200mm Steel Plates I', '400mm Steel Plates I'],
      },
    ],
  },
];

function queryDataset(query) {
  const normalized = query.toLowerCase();

  return fallbackDataset.reduce((count, category) => {
    const matchesCategory = category.name.toLowerCase().includes(normalized);
    const matchingGroups = category.groups.filter((group) =>
      group.name.toLowerCase().includes(normalized)
    );

    const matchingTypes = category.groups.flatMap((group) =>
      group.types.filter((type) => type.toLowerCase().includes(normalized))
    );

    if (matchesCategory) {
      return count + matchingTypes.length + matchingGroups.length;
    }

    return count + matchingGroups.length + matchingTypes.length;
  }, 0);
}

const queries = ['frig', '1mn', 'cata', 'armor', 'ships', 'destroyers'];
const threshold = 100;
const results = [];

for (const query of queries) {
  const started = performance.now();
  queryDataset(query);
  const ended = performance.now();
  results.push({ query, latencyMs: Number((ended - started).toFixed(3)) });
}

const average = results.reduce((sum, item) => sum + item.latencyMs, 0) / results.length;
const max = Math.max(...results.map((item) => item.latencyMs));

const report = {
  benchmark: 'dropdown-search-typeahead',
  averageLatencyMs: Number(average.toFixed(3)),
  maxLatencyMs: Number(max.toFixed(3)),
  thresholdMs: threshold,
  withinThreshold: max <= threshold,
  samples: results,
  timestamp: new Date().toISOString(),
};

console.log(JSON.stringify(report, null, 2));
